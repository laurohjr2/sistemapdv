// Teste de instalação local: execute "prepare", recrie os containers sem -v e execute "verify".
// Credenciais são lidas em memória e nunca impressas.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const base = process.env.PDV_DOCKER_URL || 'http://localhost:8080';
const snapshot = '.pdv-local/docker-persistence.json';
async function main() {
  const mode = process.argv[2];
  assert.ok(['prepare', 'verify'].includes(mode), 'Use prepare ou verify');
  const credentials = execFileSync('docker', ['compose', 'run', '--rm', '--no-deps', 'provision', 'node', '/app/docker/local.cjs', 'credentials'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const passwords = [...credentials.matchAll(/^Senha: (.+)$/gm)].map(match => match[1]);
  assert.equal(passwords.length, 2);
  async function request(url, { token, body, method = 'GET', status = 200 } = {}) {
    const response = await fetch(base + '/api' + url, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body && JSON.stringify(body) });
    assert.equal(response.status, status, `${method} ${url}`);
    return status === 204 ? null : response.headers.get('content-type')?.includes('application/json') ? response.json() : response.text();
  }
  await request('/health');
  const login = await request('/auth/login', { method: 'POST', body: { company: 'demo', username: 'admin.local', password: passwords[0] } });
  const token = login.token;
  await request('/support/company-info', { token, status: 403 });
  await request('/products', { token });
  const support = await request('/support/login', { method: 'POST', body: { username: 'support.local', password: passwords[1] } });
  const session = await request('/support/sessions', { token: support.token, method: 'POST', body: { company: 'demo' } });
  const info = await request('/support/company-info', { token: session.token });
  assert.match(info.clientId, /^[a-f0-9-]{36}$/);
  await request('/settings', { token: session.token, method: 'PUT', body: { companyName: 'Alteração proibida' }, status: 403 });
  const settings = await request('/settings', { token });
  if (mode === 'prepare') {
    const marker = `Teste Docker ${Date.now()}`;
    await request('/settings', { token, method: 'PUT', body: { receiptMessage: marker } });
    fs.mkdirSync('.pdv-local', { recursive: true });
    fs.writeFileSync(snapshot, JSON.stringify({ marker, clientId: info.clientId, companyName: settings.companyName }));
  } else {
    const saved = JSON.parse(fs.readFileSync(snapshot, 'utf8'));
    assert.equal(settings.receiptMessage, saved.marker);
    assert.equal(settings.companyName, saved.companyName);
    assert.equal(info.clientId, saved.clientId);
  }
  await request('/support/session/end', { token: session.token, method: 'POST', status: 204 });
  await request('/settings', { token: session.token, status: 401 });
  const html = await fetch(base + '/settings');
  assert.equal(html.status, 200);
  assert.match(await html.text(), /<div id="root">/);
  console.log(`Docker ${mode}: saúde, login, API, ID restrito, suporte somente leitura, revogação e SPA aprovados${mode === 'verify' ? '; dados e ID preservados após recriação' : ''}.`);
}
main().catch(error => { console.error(error.message); process.exit(1); });
