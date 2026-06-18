# Verifies Android SDK + adb for `npx expo run:android` / Gradle.
# Install SDK first: Android Studio (recommended) or command-line tools from developer.android.com

$ErrorActionPreference = "Continue"

function Read-DotEnvValue {
    param([string]$Path, [string]$Key)
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    foreach ($line in Get-Content -LiteralPath $Path -ErrorAction SilentlyContinue) {
        $t = $line.Trim()
        if ($t -match "^\s*#" -or $t -eq "") { continue }
        if ($t -match "^$([regex]::Escape($Key))=(.*)$") {
            return $Matches[1].Trim().Trim('"')
        }
    }
    return $null
}

# This file lives in mobile/scripts/
$mobileRoot = Split-Path $PSScriptRoot -Parent

$envFile = Join-Path $mobileRoot ".env"
$sdkFromEnvFile = Read-DotEnvValue -Path $envFile -Key "ANDROID_HOME"

$sdk = $env:ANDROID_HOME
if (-not $sdk -and $sdkFromEnvFile) {
    $sdk = $sdkFromEnvFile
    $env:ANDROID_HOME = $sdk
}

if (-not $sdk) {
    $sdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
}

Write-Host ""
Write-Host "ANDROID_HOME (effective): $sdk" -ForegroundColor DarkGray

if (-not (Test-Path -LiteralPath $sdk)) {
    Write-Host ""
    Write-Host "Android SDK folder not found." -ForegroundColor Red
    Write-Host "Install Android Studio, then open SDK Manager and install:" -ForegroundColor Yellow
    Write-Host "  - Android SDK Platform (match your target API)" -ForegroundColor Yellow
    Write-Host "  - Android SDK Build-Tools" -ForegroundColor Yellow
    Write-Host "  - Android SDK Platform-Tools (provides adb)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Default SDK path is usually:" -ForegroundColor Yellow
    Write-Host "  $($sdk)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Then set ANDROID_HOME in mobile\.env (see env.example) or User environment variable." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

$adb = Join-Path $sdk "platform-tools\adb.exe"
if (-not (Test-Path -LiteralPath $adb)) {
    Write-Host ""
    Write-Host "SDK exists but adb was not found at:" -ForegroundColor Red
    Write-Host "  $adb" -ForegroundColor Yellow
    Write-Host "Open Android Studio > SDK Manager > SDK Tools > Android SDK Platform-Tools (install)." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host "adb:           $adb" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Android SDK OK." -ForegroundColor Green
& $adb version
exit 0
