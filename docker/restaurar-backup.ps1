[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$BackupFile,
    [Parameter(Mandatory=$true)][ValidatePattern('^pdv-recovery-[a-z0-9][a-z0-9-]{1,40}$')][string]$TargetProject,
    [ValidateRange(1024,65535)][int]$Port=8093,
    [Security.SecureString]$Password,
    [switch]$SkipBuild
)
. (Join-Path $PSScriptRoot 'recovery-common.ps1')
$lock=$null;$working=$null;$created=$false;$oldPort=$env:PDV_LOCAL_PORT
function Invoke-Target {param([string[]]$Arguments) return (Invoke-PdvDocker -Arguments (@('compose','-p',$TargetProject)+$Arguments))}
try {
    # Resolve a user-supplied relative file before changing to the repository directory.
    $BackupFile=(Resolve-Path -LiteralPath $BackupFile).Path
    $lock=Initialize-PdvRecovery
    $Password=Get-PdvPassword $Password
    $working=Join-Path $script:PdvRoot ('.pdv-local/restore-'+[guid]::NewGuid().ToString('N'));Protect-PdvDirectory $working
    $zip=Join-Path $working 'bundle.zip';Expand-PdvArchive $BackupFile $zip $Password
    $bundle=Join-Path $working 'bundle';Expand-PdvZip $zip $bundle
    $manifest=Test-PdvBundle $bundle
    $release=Get-Content (Join-Path $script:PdvRoot 'bar-frontend/src/release.json') -Raw|ConvertFrom-Json
    if($manifest.version -ne $release.version){throw ('Use a versao '+$manifest.version+' do codigo para restaurar este backup. Depois, atualize normalmente.')}
    $containers=@(Invoke-PdvDocker -Arguments @('ps','-aq','--filter',('label=com.docker.compose.project='+$TargetProject)))
    $volumes=@(Invoke-PdvDocker -Arguments @('volume','ls','-q','--filter',('label=com.docker.compose.project='+$TargetProject)))
    if(($containers -join '').Trim() -or ($volumes -join '').Trim()){throw 'O projeto de destino ja possui containers ou volumes. Escolha outro nome; nenhum dado existente sera sobrescrito.'}
    $env:PDV_LOCAL_PORT=[string]$Port
    $definition=((Invoke-Target -Arguments @('config','--format','json')) -join "`n")|ConvertFrom-Json
    $existingVolumes=@(Invoke-PdvDocker -Arguments @('volume','ls','-q'))
    Assert-PdvIsolatedTarget $definition $TargetProject $existingVolumes
    if(!$SkipBuild){$null=Invoke-Target -Arguments @('build')}
    $null=Invoke-Target -Arguments @('create','--no-build');$created=$true
    $null=Invoke-Target -Arguments @('cp',((Join-Path $bundle 'state')+[IO.Path]::DirectorySeparatorChar+'.'),'prepare:/state')
    $null=Invoke-Target -Arguments @('cp',((Join-Path $bundle 'secrets')+[IO.Path]::DirectorySeparatorChar+'.'),'prepare:/secrets')
    # Zip archives do not carry Unix ownership. Repair only the new target volumes.
    $fix="const fs=require('fs');for(const root of ['/state','/secrets']){fs.chownSync(root,1000,1000);fs.chmodSync(root,root==='/state'?448:493);for(const name of fs.readdirSync(root)){const p=root+'/'+name;if(fs.statSync(p).isFile()){fs.chownSync(p,1000,1000);fs.chmodSync(p,name==='postgres-password'?292:384)}}}"
    $null=Invoke-Target -Arguments @('run','--rm','--no-deps','--user','root','prepare','node','-e',$fix)
    $null=Invoke-Target -Arguments @('up','-d','--no-deps','--wait','--wait-timeout','120','database')
    $temporary='/tmp/pdv-restore-'+[guid]::NewGuid().ToString('N')
    $null=Invoke-Target -Arguments @('exec','-T','database','mkdir',$temporary)
    $globals=Get-Content (Join-Path $bundle 'globals.sql') -Raw
    # The fresh official postgres image already owns the bootstrap postgres role.
    $globals=[regex]::Replace($globals,'(?m)^CREATE ROLE postgres;\r?$','')
    [IO.File]::WriteAllText((Join-Path $working 'globals.sql'),$globals,[Text.UTF8Encoding]::new($false))
    $null=Invoke-Target -Arguments @('cp',(Join-Path $working 'globals.sql'),('database:'+$temporary+'/globals.sql'))
    $null=Invoke-Target -Arguments @('exec','-T','database','psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-f',($temporary+'/globals.sql'))
    foreach($db in $manifest.databases){
        $target=$temporary+'/'+[IO.Path]::GetFileName($db.file)
        $null=Invoke-Target -Arguments @('cp',(Join-Path $bundle $db.file),('database:'+$target))
        $null=Invoke-Target -Arguments @('exec','-T','database','pg_restore','--exit-on-error','--create','-U','postgres','-d','postgres',$target)
    }
    $null=Invoke-Target -Arguments @('exec','-T','database','rm','-rf',$temporary)
    $null=Invoke-Target -Arguments @('up','-d','--no-build','--wait','--wait-timeout','240')
    @{restoredAtUtc=[DateTime]::UtcNow.ToString('o');project=$TargetProject;version=$manifest.version;databaseCount=@($manifest.databases).Count}|ConvertTo-Json|Set-Content -Encoding UTF8 (Join-Path $script:PdvRoot '.pdv-local/restore-status.json')
    Write-Host ('Restauracao concluida em '+$TargetProject+'. A instalacao anterior foi preservada.')
    Write-Host ('Acesse http://127.0.0.1:'+$Port+'/login e use as credenciais existentes na data do backup.')
    Write-Host 'Confira vendas, mesas, saldos, usuarios e acesso Master antes de colocar esta copia em operacao.'
    if(Test-Path (Join-Path $bundle 'host/mail.env')){Write-Host 'O backup contem SMTP. Em uma recuperacao definitiva, recupere mail.env separadamente; ele nao foi aplicado sobre a instalacao em uso.'}
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    if($created){try{$null=Invoke-Target -Arguments @('stop','frontend','backend')}catch{};Write-Host ('Destino incompleto preservado: '+$TargetProject+'. Nao o utilize ate concluir a conferencia.')}
    exit 1
} finally {
    $env:PDV_LOCAL_PORT=$oldPort
    if($working -and (Test-Path $working)){Remove-Item -LiteralPath $working -Recurse -Force}
    if($null -ne $lock){$lock.Dispose()}
}
