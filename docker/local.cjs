// Bootstrap exclusivo da instalação local Docker; nunca carrega dados do ambiente cloud.
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const secrets = '/secrets';
const state = '/state';
const mode = process.argv[2];
const read = name => fs.readFileSync(path.join(secrets, name), 'utf8').trim();
function create(file, bytes, permissions = 0o600) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(bytes).toString('hex'), { mode: permissions });
}
async function main() {
  if (mode === 'prepare') {
    for (const directory of [secrets, state]) {
      fs.mkdirSync(directory, { recursive: true });
      fs.chownSync(directory, 1000, 1000);
      fs.chmodSync(directory, directory === secrets ? 0o755 : 0o700);
    }
    create(path.join(secrets, 'postgres-password'), 32, 0o444);
    create(path.join(secrets, 'admin-password'), 12);
    create(path.join(secrets, 'support-password'), 12);
    create(path.join(state, 'jwt-secret'), 32);
    for (const file of ['admin-password', 'support-password']) fs.chownSync(path.join(secrets, file), 1000, 1000);
    fs.chownSync(path.join(state, 'jwt-secret'), 1000, 1000);
    console.log('Segredos locais preparados. Nenhuma senha foi escrita nos logs.');
    return;
  }
  if (mode === 'credentials') {
    console.log(`Empresa: demo\nUsuário: admin.local\nSenha: ${read('admin-password')}\n\nSuporte: /support\nUsuário: support.local\nSenha: ${read('support-password')}`);
    return;
  }
  if (mode === 'provision') {
    process.env.DB_PASSWORD = read('postgres-password');
    const { initializePlatform, provisionTenant } = require('../bar-management-system/src/tenancy/provision');
    const { platform } = require('../bar-management-system/src/tenancy/platform');
    const config = await initializePlatform();
    const central = platform(config);
    try {
      await central.sequelize.sync();
      await provisionTenant({ slug: 'demo', name: 'Minha empresa', adminUsername: 'admin.local', adminPassword: read('admin-password') });
      await central.SupportUser.findOrCreate({ where: { username: 'support.local' }, defaults: { passwordHash: await require('../bar-management-system/node_modules/bcryptjs').hash(read('support-password'), 12) } });
    } finally { await central.sequelize.close(); }
    console.log('Empresa demo e suporte preparados. Dados existentes preservados.');
    return;
  }
  if (mode === 'serve') {
    process.env.JWT_SECRET = fs.readFileSync(path.join(state, 'jwt-secret'), 'utf8').trim();
    require('../bar-management-system/server');
    return;
  }
  throw new Error('Modo local desconhecido');
}
main().catch(error => { console.error('Falha na instalação local:', error.message); process.exit(1); });
