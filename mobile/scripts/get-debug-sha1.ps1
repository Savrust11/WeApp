# Prints SHA-1 (and certificate fingerprints) for the Android debug keystore.
# Requires: JDK (keytool on PATH or JAVA_HOME), and a debug.keystore (created on first local Android build).

$ErrorActionPreference = "Stop"

function Find-Keytool {
    $which = Get-Command keytool -ErrorAction SilentlyContinue
    if ($which -and (Test-Path -LiteralPath $which.Source)) { return $which.Source }

    if ($env:JAVA_HOME) {
        $p = Join-Path $env:JAVA_HOME "bin\keytool.exe"
        if (Test-Path -LiteralPath $p) { return (Resolve-Path -LiteralPath $p).Path }
    }

    foreach ($p in @(
        "${env:ProgramFiles}\Android\Android Studio\jbr\bin\keytool.exe",
        "${env:ProgramFiles(x86)}\Android\Android Studio\jbr\bin\keytool.exe",
        "${env:LocalAppData}\Programs\Android Studio\jbr\bin\keytool.exe"
    )) {
        if ($p -and (Test-Path -LiteralPath $p)) { return (Resolve-Path -LiteralPath $p).Path }
    }

    foreach ($pattern in @(
        "${env:ProgramFiles}\Java\*",
        "${env:ProgramFiles}\Eclipse Adoptium\*",
        "${env:ProgramFiles}\Microsoft\jdk-*"
    )) {
        $dirs = @(Get-ChildItem -Path $pattern -Directory -ErrorAction SilentlyContinue)
        foreach ($dir in $dirs) {
            $kt = Join-Path $dir.FullName "bin\keytool.exe"
            if (Test-Path -LiteralPath $kt) { return (Resolve-Path -LiteralPath $kt).Path }
        }
    }

    return $null
}

$keytool = Find-Keytool
if (-not $keytool) {
    Write-Host ""
    Write-Host "keytool was not found. Install a JDK and ensure JAVA_HOME / PATH include it." -ForegroundColor Yellow
    Write-Host "Options:" -ForegroundColor Yellow
    Write-Host "  - Install Android Studio (includes JBR + keytool)" -ForegroundColor Yellow
    Write-Host "  - Or install Microsoft OpenJDK / Eclipse Temurin 17+, then set JAVA_HOME" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

$keystore = Join-Path $env:USERPROFILE ".android\debug.keystore"
if (-not (Test-Path -LiteralPath $keystore)) {
    Write-Host ""
    Write-Host "Debug keystore not found at:" -ForegroundColor Yellow
    Write-Host "  $keystore" -ForegroundColor Yellow
    Write-Host "Create it by running a local Android build once, e.g.:" -ForegroundColor Yellow
    Write-Host "  npx expo run:android" -ForegroundColor Cyan
    Write-Host "(Expo Go does not create this file on your PC.)" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host "Using keytool: $keytool" -ForegroundColor DarkGray
Write-Host "Keystore:      $keystore" -ForegroundColor DarkGray
Write-Host ""
# Default Android debug keystore password is "android" (non-interactive).
& $keytool -list -v -keystore $keystore -storepass android
