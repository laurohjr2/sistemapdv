// An unavailable external destination must leave a valid local archive and resume the POS.
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  { spawnSync } = require("node:child_process");
const { project, rootUrl } = require("./testing/commercial-context.cjs");
assert.match(project, /^pdv-.*-test$/);
const pwsh =
  process.env.PDV_POWERSHELL || path.resolve("work/commerce/powershell/pwsh");
const folder = ".pdv-local/backups",
  before = new Set(fs.readdirSync(folder));
const unavailable = path.join(
  os.tmpdir(),
  "pdv-external-offline-" + Date.now(),
  "backup",
);
const script = path.resolve("work/recovery/external-offline.ps1");
const quote = (s) => "'" + s.replaceAll("'", "''") + "'";
fs.writeFileSync(
  script,
  `$ErrorActionPreference='Stop'\n$password=ConvertTo-SecureString 'Senha de teste recuperacao 2026!' -AsPlainText -Force\n& ./docker/backup.ps1 -Password $password -ExternalPath ${quote(unavailable)}\nexit $LASTEXITCODE`,
);
(async () => {
  const result = spawnSync(pwsh, ["-NoProfile", "-File", script], {
    encoding: "utf8",
    timeout: 180000,
    env: { ...process.env, COMPOSE_PROJECT_NAME: project },
  });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /Copia local preservada/);
  const created = fs
    .readdirSync(folder)
    .filter((f) => f.endsWith(".pdvbkp") && !before.has(f));
  assert.equal(created.length, 1);
  assert.ok(fs.statSync(path.join(folder, created[0])).size > 104);
  assert.ok(!fs.existsSync(unavailable));
  let healthy = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      healthy = (await fetch(rootUrl + "/api/health")).ok;
    } catch {}
    if (healthy) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(healthy, "Sistema nao retomou a operacao");
  console.log(
    "Destino externo indisponivel: copia local preservada, falha sinalizada e API reiniciada.",
  );
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
