# Atualiza a instalacao local preservando bancos, configuracao e segredos.
# Execute a partir do repositorio. Compativel com Windows PowerShell 5.1 e PowerShell 7.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot
function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Falha ao executar $Program $($Arguments -join ' '). A atualizacao foi interrompida."
    }
}
$servicesStopped = $false
$updateLock = $null
try {
    New-Item -ItemType Directory -Force -Path (Join-Path $projectRoot '.pdv-local') | Out-Null
    $updateLock = [System.IO.File]::Open((Join-Path $projectRoot '.pdv-local\update.lock'), [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
    if (-not (Test-Path '.\compose.yaml')) { throw 'compose.yaml nao encontrado. Execute o script da pasta docker do projeto.' }
    Invoke-Checked -Program 'git' -Arguments @('rev-parse', '--is-inside-work-tree')
    $branch = (& git branch --show-current)
    if ($LASTEXITCODE -ne 0 -or $branch.Trim() -ne 'feat/pdv-base-fila-mesas') {
        throw 'Selecione a branch feat/pdv-base-fila-mesas antes de atualizar.'
    }
    $changes = (& git status --porcelain --untracked-files=no)
    if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel verificar os arquivos do projeto.' }
    if ($changes) { throw 'Ha arquivos versionados alterados. Preserve suas alteracoes antes de atualizar.' }
    Invoke-Checked -Program 'docker' -Arguments @('compose', 'version')
    Invoke-Checked -Program 'docker' -Arguments @('compose', 'exec', '-T', 'database', 'pg_isready', '-U', 'postgres')
    Write-Host 'Iniciando backup. O sistema ficara indisponivel durante a atualizacao.'
    $backupPath = Join-Path $projectRoot ('.pdv-local\backups\' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
    New-Item -ItemType Directory -Force -Path $backupPath | Out-Null
    Invoke-Checked -Program 'docker' -Arguments @('compose', 'stop', 'frontend', 'backend')
    $servicesStopped = $true
    $temporaryDump = '/tmp/pdv-update-' + [guid]::NewGuid().ToString('N') + '.sql'
    Invoke-Checked -Program 'docker' -Arguments @('compose', 'exec', '-T', 'database', 'pg_dumpall', '-U', 'postgres', '-f', $temporaryDump)
    Invoke-Checked -Program 'docker' -Arguments @('compose', 'cp', ('database:' + $temporaryDump), (Join-Path $backupPath 'bancos.sql'))
    Invoke-Checked -Program 'docker' -Arguments @('compose', 'cp', 'provision:/state', (Join-Path $backupPath 'state'))
    Invoke-Checked -Program 'docker' -Arguments @('compose', 'cp', 'provision:/secrets', (Join-Path $backupPath 'secrets'))
    foreach ($requiredFile in @('bancos.sql', 'state\platform.json', 'state\jwt-secret', 'secrets\postgres-password')) {
        $file = Join-Path $backupPath $requiredFile
        if (-not (Test-Path $file) -or (Get-Item $file).Length -eq 0) { throw "Backup incompleto: $requiredFile. A atualizacao foi interrompida." }
    }
    Invoke-Checked -Program 'docker' -Arguments @('compose', 'exec', '-T', 'database', 'rm', $temporaryDump)
    Write-Host "Backup concluido em $backupPath. Esta pasta contem dados privados; guarde-a protegida."
    Invoke-Checked -Program 'git' -Arguments @('pull', '--ff-only')
    $release = Get-Content '.\bar-frontend\src\release.json' -Raw | ConvertFrom-Json
    Invoke-Checked -Program 'docker' -Arguments @('compose', 'up', '-d', '--build', '--force-recreate', '--wait', '--wait-timeout', '240')
    $mapping = (& docker compose port frontend 80)
    if ($LASTEXITCODE -ne 0 -or -not $mapping) { throw 'Nao foi possivel identificar a porta publicada.' }
    $publishedPort = ($mapping | Select-Object -First 1).Trim().Split(':')[-1]
    if ($publishedPort -notmatch '^\d+$') { throw 'Porta publicada invalida.' }
    $baseUrl = 'http://127.0.0.1:' + $publishedPort
    $api = Invoke-RestMethod -Uri ($baseUrl + '/api/version') -TimeoutSec 20
    $frontend = Invoke-RestMethod -Uri ($baseUrl + '/release.json') -TimeoutSec 20
    if ($api.version -ne $release.version -or $frontend.version -ne $release.version) {
        throw "Versoes diferentes: esperada $($release.version), servidor $($api.version), interface $($frontend.version). O backup foi preservado."
    }
    $servicesStopped = $false
    Write-Host "Atualizacao concluida. Interface e servidor: $($release.version)."
    Write-Host "Acesse $baseUrl/login e pressione Ctrl+Shift+R."
    Write-Host 'Os volumes e as credenciais foram preservados. Nenhuma senha foi exibida.'
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    if ($servicesStopped) {
        Write-Host 'Tentando iniciar os containers existentes. O backup permanece disponivel.'
        & docker compose start backend frontend
    }
    Write-Host 'Nao apague os volumes. Guarde a mensagem de erro, sem compartilhar credenciais.'
    exit 1
} finally {
    if ($null -ne $updateLock) { $updateLock.Dispose() }
}
