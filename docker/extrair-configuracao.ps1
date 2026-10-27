# Extract only the optional SMTP file after verifying an encrypted backup.
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$BackupFile,
    [Parameter(Mandatory=$true)][string]$OutputDirectory,
    [Security.SecureString]$Password
)
. (Join-Path $PSScriptRoot 'recovery-common.ps1')
$lock=$null;$working=$null
try {
    $BackupFile=(Resolve-Path -LiteralPath $BackupFile).Path
    $OutputDirectory=[IO.Path]::GetFullPath($OutputDirectory)
    if(Test-Path -LiteralPath $OutputDirectory){throw 'Escolha uma pasta de saida nova; arquivos existentes nao serao sobrescritos.'}
    $lock=Initialize-PdvRecovery
    $Password=Get-PdvPassword $Password
    $working=Join-Path $script:PdvRoot ('.pdv-local/extract-'+[guid]::NewGuid().ToString('N'));Protect-PdvDirectory $working
    $zip=Join-Path $working 'bundle.zip';Expand-PdvArchive $BackupFile $zip $Password
    $bundle=Join-Path $working 'bundle';Expand-PdvZip $zip $bundle
    $null=Test-PdvBundle $bundle
    $mail=Join-Path $bundle 'host/mail.env'
    if(!(Test-Path -LiteralPath $mail -PathType Leaf)){throw 'Este backup nao possui configuracao SMTP.'}
    Protect-PdvDirectory $OutputDirectory
    Copy-Item -LiteralPath $mail -Destination (Join-Path $OutputDirectory 'mail.env')
    Write-Host ('Configuracao extraida sem exibir credenciais: '+(Join-Path $OutputDirectory 'mail.env'))
    Write-Host 'Revise e aplique somente na instalacao recuperada. Mantenha esta pasta privada.'
} catch {Write-Host $_.Exception.Message -ForegroundColor Red;exit 1} finally {
    if($working -and (Test-Path $working)){Remove-Item -LiteralPath $working -Recurse -Force}
    if($lock){$lock.Dispose()}
}
