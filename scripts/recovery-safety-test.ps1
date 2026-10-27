# No Docker or customer data is used here.
. (Join-Path (Split-Path -Parent $PSScriptRoot) 'docker/recovery-common.ps1')
$ErrorActionPreference='Stop'
$root=Join-Path $script:PdvRoot ('.pdv-local/recovery-tests-'+[guid]::NewGuid().ToString('N'))
Protect-PdvDirectory $root
$script:checks=0
function Check {param([bool]$Condition) if(!$Condition){throw 'Verificacao de seguranca falhou.'};$script:checks++}
function Reject {param([scriptblock]$Action) $failed=$false;try{& $Action}catch{$failed=$true};Check $failed}
try {
    $password=ConvertTo-SecureString 'Senha sintetica de teste 2026!' -AsPlainText -Force
    $wrong=ConvertTo-SecureString 'Outra senha sintetica 2026!' -AsPlainText -Force
    $original=Join-Path $root 'original'
    [IO.File]::WriteAllText($original,('Joao, café, pizza e peças: R$ 1.234,56; '*4000),[Text.Encoding]::UTF8)
    $archive=Join-Path $root 'archive.pdvbkp';Protect-PdvArchive $original $archive $password
    $restored=Join-Path $root 'restored';Expand-PdvArchive $archive $restored $password
    Check ((Get-PdvHash $original) -eq (Get-PdvHash $restored))
    Reject {Expand-PdvArchive $archive (Join-Path $root 'wrong') $wrong}
    Check (!(Test-Path (Join-Path $root 'wrong')))
    $bytes=[IO.File]::ReadAllBytes($archive);$bytes[60]=$bytes[60] -bxor 1
    $bad=Join-Path $root 'bad';[IO.File]::WriteAllBytes($bad,$bytes)
    Reject {Expand-PdvArchive $bad (Join-Path $root 'modified') $password}
    Check (!(Test-Path (Join-Path $root 'modified')))
    [IO.File]::WriteAllBytes($bad,[byte[]]$bytes[0..70])
    Reject {Expand-PdvArchive $bad (Join-Path $root 'truncated') $password}
    Reject {Protect-PdvArchive $original (Join-Path $root 'short') (ConvertTo-SecureString 'curta' -AsPlainText -Force)}
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip=Join-Path $root 'slip.zip';$z=[IO.Compression.ZipFile]::Open($zip,'Create')
    try{$entry=$z.CreateEntry('../escaped');$stream=$entry.Open();$stream.WriteByte(65);$stream.Dispose()}finally{$z.Dispose()}
    Reject {Expand-PdvZip $zip (Join-Path $root 'out')}
    Check (!(Test-Path (Join-Path $root 'escaped')))
    $bundle=Join-Path $root 'bundle'
    foreach($directory in @('state','secrets','databases')){New-Item -ItemType Directory -Force (Join-Path $bundle $directory)|Out-Null}
    @{central=@{database='test_central'};connections=@{first=@{database='test_tenant'}}}|ConvertTo-Json -Depth 6|Set-Content (Join-Path $bundle 'state/platform.json')
    foreach($file in @('state/jwt-secret','secrets/postgres-password','secrets/admin-password','secrets/support-password','secrets/master-password','globals.sql','databases/central.dump','databases/tenant.dump')){[IO.File]::WriteAllText((Join-Path $bundle $file),'Synthetic test only')}
    $files=@(Get-ChildItem $bundle -Recurse -File|ForEach-Object{@{path=$_.FullName.Substring($bundle.Length+1).Replace('\','/');sha256=(Get-PdvHash $_.FullName)}})
    $manifest=@{format=1;installation='0123456789abcdef';files=$files;databases=@(@{name='test_central';file='databases/central.dump'},@{name='test_tenant';file='databases/tenant.dump'})}
    $manifest|ConvertTo-Json -Depth 8|Set-Content (Join-Path $bundle 'manifest.json')
    Check ((Test-PdvBundle $bundle).databases.Count -eq 2)
    [IO.File]::AppendAllText((Join-Path $bundle 'databases/tenant.dump'),'tamper')
    Reject {Test-PdvBundle $bundle}
    [IO.File]::WriteAllText((Join-Path $bundle 'databases/tenant.dump'),'Synthetic test only')
    New-Item -ItemType Directory (Join-Path $bundle 'host')|Out-Null
    $mail=Join-Path $bundle 'host/mail.env';[IO.File]::WriteAllText($mail,'SMTP_PASS=synthetic-only')
    $manifest.files=$files+@(@{path='host/mail.env';sha256=(Get-PdvHash $mail)})
    $manifest|ConvertTo-Json -Depth 8|Set-Content (Join-Path $bundle 'manifest.json')
    $mailZip=Join-Path $root 'mail.zip';[IO.Compression.ZipFile]::CreateFromDirectory($bundle,$mailZip)
    $mailArchive=Join-Path $root 'mail.pdvbkp';Protect-PdvArchive $mailZip $mailArchive $password
    $mailOutput=Join-Path $root 'mail-output'
    & (Join-Path $script:PdvRoot 'docker/extrair-configuracao.ps1') -BackupFile $mailArchive -OutputDirectory $mailOutput -Password $password
    Check ([IO.File]::ReadAllText((Join-Path $mailOutput 'mail.env')) -eq 'SMTP_PASS=synthetic-only')
    $retention=Join-Path $root 'retention';New-Item -ItemType Directory $retention|Out-Null
    for($i=0;$i -lt 6;$i++){$file=Join-Path $retention ('pdv-backup-0123456789abcdef-'+$i+'.pdvbkp');[IO.File]::WriteAllText($file,'test');(Get-Item $file).LastWriteTimeUtc=[DateTime]::UtcNow.AddDays(-100-$i)}
    $foreign=Join-Path $retention 'pdv-backup-fedcba9876543210-other.pdvbkp';[IO.File]::WriteAllText($foreign,'test');(Get-Item $foreign).LastWriteTimeUtc=[DateTime]::UtcNow.AddDays(-200)
    Remove-PdvExpired $retention '0123456789abcdef' 30
    Check (@(Get-ChildItem $retention -Filter 'pdv-backup-0123456789abcdef-*').Count -eq 3)
    Check (Test-Path $foreign)
    $definition=[pscustomobject]@{volumes=[pscustomobject]@{data=[pscustomobject]@{name='pdv-recovery-safety_data';external=$false}};networks=[pscustomobject]@{default=[pscustomobject]@{name='pdv-recovery-safety_default';external=$false}};services=[pscustomobject]@{database=[pscustomobject]@{volumes=@([pscustomobject]@{target='/var/lib/postgresql/data';type='volume'})}}}
    Assert-PdvIsolatedTarget $definition 'pdv-recovery-safety' @()
    Check $true
    Reject {Assert-PdvIsolatedTarget $definition 'pdv-recovery-safety' @('pdv-recovery-safety_data')}
    $definition.volumes.data.external=$true
    Reject {Assert-PdvIsolatedTarget $definition 'pdv-recovery-safety' @()}
    $definition.volumes.data.external=$false;$definition.services.database.volumes[0].type='bind'
    Reject {Assert-PdvIsolatedTarget $definition 'pdv-recovery-safety' @()}
    foreach($file in Get-ChildItem (Join-Path $script:PdvRoot 'docker') -Filter '*.ps1'){$tokens=$null;$errors=$null;$null=[Management.Automation.Language.Parser]::ParseFile($file.FullName,[ref]$tokens,[ref]$errors);Check ($errors.Count -eq 0)}
    Write-Host ($script:checks.ToString()+' verificacoes aprovadas: criptografia, senha incorreta, adulteracao, arquivo incompleto, zip traversal, manifesto, retencao e sintaxe.')
} finally {if(Test-Path $root){Remove-Item -LiteralPath $root -Recurse -Force}}
