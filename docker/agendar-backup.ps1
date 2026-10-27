[CmdletBinding()]
param(
    [string]$ExternalPath,
    [ValidatePattern('^([01][0-9]|2[0-3]):[0-5][0-9]$')][string]$Time='03:00',
    [ValidateRange(1,3650)][int]$RetentionDays=30,
    [switch]$Disable
)
. (Join-Path $PSScriptRoot 'recovery-common.ps1')
$lock=$null
try {
    if([Environment]::OSVersion.Platform -ne 'Win32NT'){throw 'O agendamento utiliza o Agendador de Tarefas do Windows.'}
    $lock=Initialize-PdvRecovery
    $hash=[Security.Cryptography.SHA256]::Create()
    try{$id=([BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($script:PdvRoot.ToLowerInvariant())))).Replace('-','').Substring(0,12)}finally{$hash.Dispose()}
    $taskName='SistemaPDV-Backup-'+$id
    if($Disable){Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue;Write-Host 'Agendamento desativado. Arquivos de backup preservados.';return}
    if(!$ExternalPath -or !(Test-Path -LiteralPath $ExternalPath -PathType Container)){throw 'Informe uma pasta externa existente em -ExternalPath.'}
    $ExternalPath=Resolve-PdvExternalPath $ExternalPath
    $private=Join-Path $script:PdvRoot '.pdv-local';Protect-PdvDirectory $private
    $Password=Read-Host 'Crie uma senha de backup (minimo 16 caracteres; guarde fora do computador)' -AsSecureString
    $confirm=Read-Host 'Repita a senha de backup' -AsSecureString
    $a=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password);$b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($confirm)
    try{if([Runtime.InteropServices.Marshal]::PtrToStringBSTR($a).Length -lt 16 -or [Runtime.InteropServices.Marshal]::PtrToStringBSTR($a) -cne [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)){throw 'As senhas precisam ser iguais e ter ao menos 16 caracteres.'}}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($a);[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b);$confirm.Dispose()}
    $Password|ConvertFrom-SecureString|Set-Content -Encoding UTF8 (Join-Path $private 'backup-key.txt');$Password.Dispose()
    @{externalPath=$ExternalPath;retentionDays=$RetentionDays;time=$Time;task=$taskName}|ConvertTo-Json|Set-Content -Encoding UTF8 (Join-Path $private 'backup.json')
    $scriptPath=Join-Path $PSScriptRoot 'backup.ps1'
    $arguments='-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+$scriptPath+'" -Scheduled'
    $action=New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arguments -WorkingDirectory $script:PdvRoot
    $triggers=@((New-ScheduledTaskTrigger -Daily -At $Time),(New-ScheduledTaskTrigger -AtLogOn -User ([Security.Principal.WindowsIdentity]::GetCurrent().Name)))
    $settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::FromHours(2)) -RestartCount 3 -RestartInterval ([TimeSpan]::FromMinutes(10))
    $principal=New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
    $null=Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $triggers -Settings $settings -Principal $principal -Description 'Backup criptografado do Sistema PDV. Exige Docker Desktop e usuario conectado.' -Force
    Write-Host ('Backup agendado para '+$Time+' e para o login do Windows. Tarefa: '+$taskName)
    Write-Host 'O usuario deve estar conectado, com Docker Desktop iniciado. A senha salva usa a protecao do Windows (DPAPI).'
    Write-Host 'Guarde a senha fora deste computador: ela sera necessaria em uma recuperacao em outra maquina.'
    Write-Host 'Execute um backup agora e confira a copia externa antes de depender do agendamento.'
} catch {Write-Host $_.Exception.Message -ForegroundColor Red;exit 1} finally {if($lock){$lock.Dispose()}}
