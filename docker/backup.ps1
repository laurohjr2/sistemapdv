[CmdletBinding()]
param(
    [Security.SecureString]$Password,
    [string]$ExternalPath,
    [ValidateRange(1,3650)][int]$RetentionDays=30,
    [switch]$Scheduled
)
. (Join-Path $PSScriptRoot 'recovery-common.ps1')
$lock=$null; $stopped=$false; $working=$null; $temporary=$null; $successful=$false; $transcript=$false
try {
    $lock=Initialize-PdvRecovery
    if($Scheduled){$logs=Join-Path $script:PdvRoot '.pdv-local/backup-logs';Protect-PdvDirectory $logs;Start-Transcript -Path (Join-Path $logs ([DateTime]::UtcNow.ToString('yyyyMMddTHHmmssffff')+'.log'))|Out-Null;$transcript=$true}
    if($Scheduled){
        $config=Get-Content (Join-Path $script:PdvRoot '.pdv-local/backup.json') -Raw | ConvertFrom-Json
        if(!$config.externalPath -or $config.retentionDays -lt 1){throw 'Configuracao do backup incompleta.'}
        $ExternalPath=$config.externalPath; $RetentionDays=[int]$config.retentionDays
    }
    if($Scheduled -and (Test-Path (Join-Path $script:PdvRoot '.pdv-local/backup-status.json'))){
        $recent=Get-Content (Join-Path $script:PdvRoot '.pdv-local/backup-status.json') -Raw|ConvertFrom-Json
        if($recent.externalCopied -and ([DateTime]::UtcNow-[DateTime]::Parse($recent.lastSuccessUtc).ToUniversalTime()).TotalHours -lt 18){$successful=$true;Write-Host 'Backup externo recente; nova copia dispensada neste login.';return}
    }
    $Password=Get-PdvPassword $Password -Scheduled:$Scheduled -ConfirmNew
    $destination=Join-Path $script:PdvRoot '.pdv-local/backups'
    Protect-PdvDirectory $destination
    if($ExternalPath){$ExternalPath=Resolve-PdvExternalPath $ExternalPath}
    $working=Join-Path $script:PdvRoot ('.pdv-local/recovery-'+[guid]::NewGuid().ToString('N'))
    Protect-PdvDirectory $working
    $bundle=Join-Path $working 'bundle'; New-Item -ItemType Directory $bundle | Out-Null
    $null=Invoke-PdvDocker -Arguments @('compose','exec','-T','database','pg_isready','-U','postgres')
    $running=@(Invoke-PdvDocker -Arguments @('compose','ps','--status','running','--services'))
    if('provision' -in $running -or 'prepare' -in $running){throw 'Aguarde o provisionamento terminar antes de fazer backup.'}
    $resume=@($running|Where-Object{$_ -in @('backend','frontend')})
    if($resume.Count){$stopped=$true;$null=Invoke-PdvDocker -Arguments (@('compose','stop')+$resume)}
    $null=Invoke-PdvDocker -Arguments @('compose','cp','provision:/state',(Join-Path $bundle 'state'))
    $null=Invoke-PdvDocker -Arguments @('compose','cp','provision:/secrets',(Join-Path $bundle 'secrets'))
    # A previous failed provisioning lock cannot be carried to a fresh installation.
    if(Test-Path (Join-Path $bundle 'state/platform.json.lock')){throw 'Plataforma ocupada ou provisionamento incompleto. Confira o lock antes de continuar.'}
    $platform=Get-Content (Join-Path $bundle 'state/platform.json') -Raw | ConvertFrom-Json
    $names=@($platform.central.database)+@($platform.connections.PSObject.Properties.Value.database)
    if(!$names.Count -or @($names|Sort-Object -Unique).Count -ne $names.Count){throw 'Cadastro de bancos inconsistente.'}
    $databases=@();New-Item -ItemType Directory (Join-Path $bundle 'databases')|Out-Null
    $temporary='/tmp/pdv-backup-'+[guid]::NewGuid().ToString('N')
    $null=Invoke-PdvDocker -Arguments @('compose','exec','-T','database','mkdir',$temporary)
    $null=Invoke-PdvDocker -Arguments @('compose','exec','-T','database','pg_dumpall','-U','postgres','--globals-only','-f',($temporary+'/globals.sql'))
    $null=Invoke-PdvDocker -Arguments @('compose','cp',('database:'+$temporary+'/globals.sql'),(Join-Path $bundle 'globals.sql'))
    $index=0
    foreach($name in $names){
        if($name -notmatch '^[a-zA-Z0-9_]+$' -or $name -in @('postgres','template0','template1')){throw 'Banco inesperado na configuracao.'}
        $file='db-'+$index+'.dump';$index++
        $null=Invoke-PdvDocker -Arguments @('compose','exec','-T','database','pg_dump','-U','postgres','-Fc','--create','-f',($temporary+'/'+$file),$name)
        $null=Invoke-PdvDocker -Arguments @('compose','cp',('database:'+$temporary+'/'+$file),(Join-Path $bundle ('databases/'+$file)))
        $databases+=@{name=$name;file='databases/'+$file}
    }
    $null=Invoke-PdvDocker -Arguments @('compose','exec','-T','database','rm','-rf',$temporary);$temporary=$null
    if($stopped){$null=Invoke-PdvDocker -Arguments (@('compose','start')+$resume);$stopped=$false}
    $mail=Join-Path $script:PdvRoot '.pdv-local/mail.env'
    if(Test-Path $mail){New-Item -ItemType Directory (Join-Path $bundle 'host')|Out-Null;Copy-Item -LiteralPath $mail -Destination (Join-Path $bundle 'host/mail.env')}
    $installation=(Get-PdvHash (Join-Path $bundle 'state/jwt-secret')).Substring(0,16)
    $files=@(Get-ChildItem -LiteralPath $bundle -Recurse -File | ForEach-Object{
        @{path=$_.FullName.Substring($bundle.Length+1).Replace('\','/');sha256=(Get-PdvHash $_.FullName)}
    })
    $release=Get-Content (Join-Path $script:PdvRoot 'bar-frontend/src/release.json') -Raw|ConvertFrom-Json
    @{format=1;createdAt=[DateTime]::UtcNow.ToString('o');installation=$installation;version=$release.version;databases=$databases;files=$files}|ConvertTo-Json -Depth 8|Set-Content -Encoding UTF8 (Join-Path $bundle 'manifest.json')
    $null=Test-PdvBundle $bundle
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip=Join-Path $working 'bundle.zip';[IO.Compression.ZipFile]::CreateFromDirectory($bundle,$zip)
    $name='pdv-backup-'+$installation+'-'+[DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')+'-'+[guid]::NewGuid().ToString('N').Substring(0,8)+'.pdvbkp'
    $pending=Join-Path $destination ($name+'.partial');$archive=Join-Path $destination $name
    Protect-PdvArchive $zip $pending $Password
    # Round trip before publishing the archive; verifies the password and signature.
    $check=Join-Path $working 'check.zip';Expand-PdvArchive $pending $check $Password
    if((Get-PdvHash $zip) -ne (Get-PdvHash $check)){throw 'Falha na verificacao do arquivo criptografado.'}
    Move-Item -LiteralPath $pending -Destination $archive
    $externalCopied=$false
    if($ExternalPath){
        if(!(Test-Path -LiteralPath $ExternalPath -PathType Container)){throw 'Copia local preservada, mas a pasta externa nao esta disponivel.'}
        $externalPending=Join-Path $ExternalPath ($name+'.partial')
        Copy-Item -LiteralPath $archive -Destination $externalPending
        if((Get-PdvHash $archive) -ne (Get-PdvHash $externalPending)){throw 'A copia externa nao passou na verificacao.'}
        Move-Item -LiteralPath $externalPending -Destination (Join-Path $ExternalPath $name)
        $externalCopied=$true
    }
    Remove-PdvExpired $destination $installation $RetentionDays
    if($externalCopied){Remove-PdvExpired $ExternalPath $installation $RetentionDays}
    $status=@{lastSuccessUtc=[DateTime]::UtcNow.ToString('o');archive=$name;externalCopied=$externalCopied;version=$release.version;databaseCount=$databases.Count}
    $status|ConvertTo-Json|Set-Content -Encoding UTF8 (Join-Path $script:PdvRoot '.pdv-local/backup-status.json')
    $successful=$true
    Write-Host ('Backup criptografado e verificado: '+$archive)
    if($externalCopied){Write-Host 'Copia externa verificada. Confirme a sincronizacao no aplicativo de nuvem, se utilizado.'}else{Write-Host 'Copia apenas local. Configure um destino externo antes de depender desta rotina.'}
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
} finally {
    if($temporary){try{$null=Invoke-PdvDocker -Arguments @('compose','exec','-T','database','rm','-rf',$temporary)}catch{}}
    if($stopped){try{$null=Invoke-PdvDocker -Arguments (@('compose','start')+$resume)}catch{Write-Host 'Nao foi possivel reiniciar a interface/API. Inicie-os com docker compose start backend frontend.'}}
    if($working -and (Test-Path $working)){Remove-Item -LiteralPath $working -Recurse -Force}
    if($pending -and (Test-Path $pending)){Remove-Item -LiteralPath $pending -Force}
    if($externalPending -and (Test-Path -LiteralPath $externalPending)){try{Remove-Item -LiteralPath $externalPending -Force}catch{Write-Host 'Arquivo parcial na pasta externa; nao o utilize como backup.'}}
    if($null -ne $lock){
        if(!$successful){@{lastFailureUtc=[DateTime]::UtcNow.ToString('o');message='Backup nao concluido. Consulte o log local.'}|ConvertTo-Json|Set-Content -Encoding UTF8 (Join-Path $script:PdvRoot '.pdv-local/backup-failure.json')}
        $lock.Dispose()
    }
    if($transcript){Stop-Transcript|Out-Null}
}
