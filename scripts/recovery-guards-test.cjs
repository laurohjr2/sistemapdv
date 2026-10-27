// Rejection checks use only a disposable test project's encrypted archive.
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  { spawnSync } = require("node:child_process");
const { project } = require("./testing/commercial-context.cjs");
assert.match(project, /^pdv-.*-test$/);
const target = process.env.PDV_RESTORE_PROJECT || "pdv-recovery-test-20261027";
assert.match(target, /^pdv-recovery-test-/);
const pwsh =
  process.env.PDV_POWERSHELL || path.resolve("work/commerce/powershell/pwsh");
const archive = fs
  .readdirSync(".pdv-local/backups")
  .filter((n) => n.endsWith(".pdvbkp"))
  .sort()
  .at(-1);
assert.ok(archive);
const file = path.resolve(".pdv-local/backups", archive),
  dir = path.resolve("work/recovery");
fs.mkdirSync(dir, { recursive: true });
const quote = (value) => "'" + value.replaceAll("'", "''") + "'";
let checks = 0;
function reject(code, expected) {
  const script = path.join(dir, "guard.ps1");
  fs.writeFileSync(script, "$ErrorActionPreference='Stop'\n" + code);
  const result = spawnSync(pwsh, ["-NoProfile", "-File", script], {
    encoding: "utf8",
    timeout: 120000,
  });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, expected);
  checks++;
}
const invocation = (password) =>
  `$password=ConvertTo-SecureString ${quote(password)} -AsPlainText -Force\n& ./docker/restaurar-backup.ps1 -BackupFile ${quote(file)} -Password $password -TargetProject ${target} -SkipBuild\nexit $LASTEXITCODE`;
reject(invocation("Senha incorreta de teste 2026!"), /Senha incorreta/);
reject(
  invocation("Senha de teste recuperacao 2026!"),
  /destino ja possui containers ou volumes/,
);
reject(
  invocation("Senha de teste recuperacao 2026!").replace(
    "-TargetProject " + target,
    "-TargetProject sistemapdv-local",
  ),
  /ValidatePattern|validation|validat|regular expression/i,
);
reject(
  `. ./docker/recovery-common.ps1\n$lock=Initialize-PdvRecovery\ntry {\n$password=ConvertTo-SecureString 'Senha de teste recuperacao 2026!' -AsPlainText -Force\n& ./docker/backup.ps1 -Password $password\nexit $LASTEXITCODE\n} finally {$lock.Dispose()}`,
  /being used|another process|IOException|file.*lock|processo/i,
);
console.log(
  `${checks} protecoes de recuperacao aprovadas: senha, destino existente, nome de producao e lock simultaneo.`,
);
