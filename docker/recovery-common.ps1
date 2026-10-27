# Shared recovery functions. Windows PowerShell 5.1 / PowerShell 7.
$ErrorActionPreference = 'Stop'
$script:PdvRoot = Split-Path -Parent $PSScriptRoot
function Invoke-PdvDocker {
    param([string[]]$Arguments)
    $previousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $output = & docker @Arguments 2>&1
        $code = $LASTEXITCODE
    } finally { $ErrorActionPreference = $previousPreference }
    if ($code -ne 0) { throw ('Docker falhou: ' + ($Arguments -join ' ') + '. Confira se o Docker Desktop esta iniciado.') }
    return $output
}
function Initialize-PdvRecovery {
    Set-Location $script:PdvRoot
    $directory = Join-Path $script:PdvRoot '.pdv-local'
    New-Item -ItemType Directory -Force $directory | Out-Null
    return [IO.File]::Open((Join-Path $directory 'update.lock'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
}
function Protect-PdvDirectory {
    param([string]$Directory)
    New-Item -ItemType Directory -Force $Directory | Out-Null
    if ([Environment]::OSVersion.Platform -eq 'Win32NT') {
        $acl = Get-Acl $Directory
        $acl.SetAccessRuleProtection($true, $false)
        $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
        $rule = [Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
        $acl.SetAccessRule($rule)
        Set-Acl -Path $Directory -AclObject $acl
    } else { & chmod 700 $Directory; if ($LASTEXITCODE -ne 0) { throw 'Falha ao proteger a pasta temporaria.' } }
}
function Get-PdvHash {
    param([string]$File)
    return (Get-FileHash -Algorithm SHA256 -LiteralPath $File).Hash.ToLowerInvariant()
}
function Get-PdvKeyMaterial {
    param([Security.SecureString]$Password, [byte[]]$Salt)
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)
    try {
        $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
        if ($plain.Length -lt 16) { throw 'Use uma senha de backup com ao menos 16 caracteres. Guarde-a fora do computador.' }
        $kdf = [Security.Cryptography.Rfc2898DeriveBytes]::new($plain, $Salt, 300000, [Security.Cryptography.HashAlgorithmName]::SHA256)
        try { return ,($kdf.GetBytes(64)) } finally { $kdf.Dispose(); $plain = $null }
    } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}
function Get-PdvMac {
    param([IO.FileStream]$Stream, [byte[]]$Key, [long]$Length)
    $hmac = [Security.Cryptography.HMACSHA256]::new($Key)
    try {
        $Stream.Position = 0
        $buffer = New-Object byte[] 65536
        while ($Length -gt 0) {
            $read = $Stream.Read($buffer, 0, [int][Math]::Min($Length, $buffer.Length))
            if ($read -eq 0) { throw 'Arquivo de backup incompleto.' }
            $null = $hmac.TransformBlock($buffer, 0, $read, $buffer, 0)
            $Length -= $read
        }
        $null = $hmac.TransformFinalBlock((New-Object byte[] 0), 0, 0)
        return ,($hmac.Hash)
    } finally { $hmac.Dispose() }
}
function Protect-PdvArchive {
    param([string]$InputFile, [string]$OutputFile, [Security.SecureString]$Password)
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    $salt = New-Object byte[] 32; $iv = New-Object byte[] 16
    $rng.GetBytes($salt); $rng.GetBytes($iv); $rng.Dispose()
    $keys = Get-PdvKeyMaterial $Password $salt
    $aes = [Security.Cryptography.Aes]::Create(); $aes.Key = [byte[]]$keys[0..31]; $aes.IV = $iv
    $output = [IO.File]::Open($OutputFile, 'CreateNew', 'ReadWrite', 'None')
    try {
        $header = [Text.Encoding]::ASCII.GetBytes('PDVBKP01')
        $output.Write($header,0,8); $output.Write($salt,0,32); $output.Write($iv,0,16)
        $transform = $aes.CreateEncryptor()
        $crypto = [Security.Cryptography.CryptoStream]::new($output,$transform,[Security.Cryptography.CryptoStreamMode]::Write,$true)
        try { $input = [IO.File]::OpenRead($InputFile); try { $input.CopyTo($crypto) } finally { $input.Dispose() }; $crypto.FlushFinalBlock() } finally { $crypto.Dispose(); $transform.Dispose() }
        $output.Flush()
        $signature = Get-PdvMac $output ([byte[]]$keys[32..63]) $output.Length
        $output.Position = $output.Length; $output.Write($signature,0,32); $output.Flush()
    } finally { $output.Dispose(); $aes.Dispose(); [Array]::Clear($keys,0,$keys.Length) }
}
function Expand-PdvArchive {
    param([string]$InputFile, [string]$OutputFile, [Security.SecureString]$Password)
    $input = [IO.File]::OpenRead($InputFile)
    try {
        if ($input.Length -lt 104) { throw 'Backup invalido ou incompleto.' }
        $header = New-Object byte[] 56; $null = $input.Read($header,0,56)
        if ([Text.Encoding]::ASCII.GetString($header,0,8) -ne 'PDVBKP01') { throw 'Formato de backup desconhecido.' }
        $keys = Get-PdvKeyMaterial $Password ([byte[]]$header[8..39])
        try {
            $mac = Get-PdvMac $input ([byte[]]$keys[32..63]) ($input.Length-32)
            $expected = New-Object byte[] 32; $null = $input.Read($expected,0,32)
            $different = 0; for($i=0;$i -lt 32;$i++){ $different = $different -bor ($mac[$i] -bxor $expected[$i]) }
            if ($different -ne 0) { throw 'Senha incorreta ou backup alterado/incompleto. Nenhum banco foi modificado.' }
            $aes = [Security.Cryptography.Aes]::Create(); $aes.Key=[byte[]]$keys[0..31]; $aes.IV=[byte[]]$header[40..55]
            $output = [IO.File]::Open($OutputFile,'CreateNew','Write','None')
            try {
                $transform=$aes.CreateDecryptor(); $crypto=[Security.Cryptography.CryptoStream]::new($output,$transform,[Security.Cryptography.CryptoStreamMode]::Write,$true)
                try {
                    $input.Position=56; $remaining=$input.Length-88; $buffer=New-Object byte[] 65536
                    while($remaining -gt 0){ $n=$input.Read($buffer,0,[int][Math]::Min($remaining,$buffer.Length)); if(!$n){throw 'Backup incompleto.'};$crypto.Write($buffer,0,$n);$remaining-=$n }
                    $crypto.FlushFinalBlock()
                } finally { $crypto.Dispose(); $transform.Dispose() }
            } finally { $output.Dispose(); $aes.Dispose() }
        } finally { [Array]::Clear($keys,0,$keys.Length) }
    } finally { $input.Dispose() }
}
function Expand-PdvZip {
    param([string]$Zip, [string]$Directory)
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive=[IO.Compression.ZipFile]::OpenRead($Zip)
    try {
        if($archive.Entries.Count -gt 4096){throw 'Quantidade de arquivos inesperada.'}
        foreach($entry in $archive.Entries){
            if($entry.FullName -match '(^[/\\]|(^|[/\\])\.\.([/\\]|$)|:)' -or $entry.Length -gt 1099511627776){throw 'Caminho ou tamanho invalido no backup.'}
        }
    } finally { $archive.Dispose() }
    [IO.Compression.ZipFile]::ExtractToDirectory($Zip,$Directory)
}
function Test-PdvBundle {
    param([string]$Directory)
    $manifest=Get-Content -LiteralPath (Join-Path $Directory 'manifest.json') -Raw | ConvertFrom-Json
    if($manifest.format -ne 1 -or !$manifest.files -or !$manifest.databases -or $manifest.installation -notmatch '^[a-f0-9]{16}$'){throw 'Manifesto de backup invalido.'}
    foreach($item in $manifest.files){
        if($item.path -notmatch '^(state|secrets|databases|host)/[a-zA-Z0-9_.-]+$' -and $item.path -ne 'globals.sql'){throw 'Caminho invalido no manifesto.'}
        $file=Join-Path $Directory $item.path
        if(!(Test-Path -LiteralPath $file -PathType Leaf) -or (Get-PdvHash $file) -ne $item.sha256){throw 'Falha de integridade do backup.'}
    }
    foreach($required in @('state/platform.json','state/jwt-secret','secrets/postgres-password','secrets/admin-password','secrets/support-password','secrets/master-password','globals.sql')){if($required -notin @($manifest.files.path)){throw 'Backup incompleto.'}}
    $config=Get-Content -LiteralPath (Join-Path $Directory 'state/platform.json') -Raw | ConvertFrom-Json
    $names=@($config.central.database)+@($config.connections.PSObject.Properties.Value.database)
    if(@($names|Sort-Object -Unique).Count -ne $names.Count -or $names.Count -ne @($manifest.databases).Count){throw 'Cadastro de bancos inconsistente.'}
    if(@($manifest.databases.name|Sort-Object -Unique).Count -ne @($manifest.databases).Count -or @($manifest.files.path|Sort-Object -Unique).Count -ne @($manifest.files).Count){throw 'Manifesto com arquivos ou bancos repetidos.'}
    foreach($db in $manifest.databases){
        if($db.name -notmatch '^[a-zA-Z0-9_]+$' -or $db.name -in @('postgres','template0','template1') -or $db.name -notin $names -or $db.file -notmatch '^databases/[a-zA-Z0-9_-]+\.dump$' -or $db.file -notin @($manifest.files.path)){throw 'Banco de dados invalido no manifesto.'}
    }
    return $manifest
}
function Get-PdvPassword {
    param([Security.SecureString]$Password, [switch]$Scheduled, [switch]$ConfirmNew)
    if($null -ne $Password){if($Password.Length -lt 16){throw 'Use uma senha de backup com ao menos 16 caracteres.'};return $Password}
    if($Scheduled){
        $file=Join-Path $script:PdvRoot '.pdv-local/backup-key.txt'
        if(!(Test-Path $file)){throw 'Configure a senha do backup antes de ativar o agendamento.'}
        return ((Get-Content -LiteralPath $file -Raw).Trim() | ConvertTo-SecureString)
    }
    $value=Read-Host 'Senha de criptografia do backup (minimo 16 caracteres)' -AsSecureString
    if($value.Length -lt 16){$value.Dispose();throw 'Use uma senha de backup com ao menos 16 caracteres.'}
    if($ConfirmNew){
        $confirm=Read-Host 'Repita a senha de criptografia' -AsSecureString
        $a=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($value);$b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($confirm)
        try{if([Runtime.InteropServices.Marshal]::PtrToStringBSTR($a) -cne [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)){$value.Dispose();throw 'As senhas nao conferem.'}}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($a);[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b);$confirm.Dispose()}
    }
    return $value
}
function Remove-PdvExpired {
    param([string]$Directory,[string]$Installation,[int]$Days)
    $files=@(Get-ChildItem -LiteralPath $Directory -Filter ('pdv-backup-'+$Installation+'-*.pdvbkp') -File | Sort-Object LastWriteTimeUtc -Descending)
    $cutoff=[DateTime]::UtcNow.AddDays(-$Days)
    for($i=3;$i -lt $files.Count;$i++){if($files[$i].LastWriteTimeUtc -lt $cutoff){Remove-Item -LiteralPath $files[$i].FullName -Force}}
}

function Resolve-PdvExternalPath {
    param([string]$Directory)
    if(Test-Path -LiteralPath $Directory -PathType Container){$Directory=(Resolve-Path -LiteralPath $Directory).Path}
    $remote=[IO.Path]::GetFullPath($Directory).TrimEnd([IO.Path]::DirectorySeparatorChar)+[IO.Path]::DirectorySeparatorChar
    $repository=[IO.Path]::GetFullPath($script:PdvRoot).TrimEnd([IO.Path]::DirectorySeparatorChar)+[IO.Path]::DirectorySeparatorChar
    if($remote.StartsWith($repository,[StringComparison]::OrdinalIgnoreCase)){throw 'Escolha uma pasta externa ao repositorio para a segunda copia.'}
    return $remote.TrimEnd([IO.Path]::DirectorySeparatorChar)
}
function Assert-PdvIsolatedTarget {
    param($Definition,[string]$Project,[string[]]$ExistingVolumes)
    foreach($volume in $Definition.volumes.PSObject.Properties.Value){
        if($volume.external -or !$volume.name.StartsWith($Project+'_') -or $volume.name -in $ExistingVolumes){throw 'O destino usa um volume existente ou compartilhado. Recuperacao recusada.'}
    }
    foreach($network in $Definition.networks.PSObject.Properties.Value){if($network.external -or !$network.name.StartsWith($Project+'_')){throw 'O destino usa uma rede compartilhada. Recuperacao recusada.'}}
    foreach($service in $Definition.services.PSObject.Properties.Value){foreach($mount in $service.volumes){if($mount.target -in @('/state','/secrets','/var/lib/postgresql/data') -and $mount.type -ne 'volume'){throw 'Os dados de recuperacao precisam de volumes novos do projeto, sem pastas de producao montadas.'}}}
}
