<#
.SYNOPSIS
    Builds a signed Android App Bundle (.aab) of FETS LIVE for the Play Store.

.DESCRIPTION
    Prompts for the upload keystore details, holds them only in this process's
    environment, and never writes them to disk or to the log. Nothing is
    uploaded — the resulting .aab is left for you to upload yourself.

    The published listing is com.fets.staffapp. app/build.gradle refuses to
    produce a release bundle unless every signing variable is set and the
    version code is above the template default, so a misconfigured build fails
    rather than producing something unusable.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\build-android-release.ps1 -VersionCode 35 -VersionName 7.1.0
#>
param(
    [Parameter(Mandatory = $true)][int]$VersionCode,
    [Parameter(Mandatory = $true)][string]$VersionName,
    [string]$JavaHome = 'C:\Program Files\Android\Android Studio\jbr'
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$android = Join-Path $repo 'fets-point\android'

if (-not (Test-Path $android)) { throw "Android project not found at $android. Run: pnpm run build; npx cap sync android" }
if (-not (Test-Path $JavaHome)) { throw "JDK not found at $JavaHome. Pass -JavaHome with the correct path." }

Write-Host ''
Write-Host 'FETS LIVE - signed release bundle' -ForegroundColor Cyan
Write-Host "  version code : $VersionCode"
Write-Host "  version name : $VersionName"
Write-Host ''
Write-Host 'Your keystore details are read into this process only.' -ForegroundColor Yellow
Write-Host 'They are not saved, logged, or sent anywhere.'
Write-Host ''

$ksPath = Read-Host 'Full path to your upload keystore (.jks)'
if (-not (Test-Path $ksPath)) { throw "Keystore not found: $ksPath" }
$alias = Read-Host 'Key alias'
$storePw = Read-Host 'Keystore password' -AsSecureString
$keyPw = Read-Host 'Key password' -AsSecureString

function Plain($secure) {
    [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
}

$env:JAVA_HOME = $JavaHome
$env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:FETS_VERSION_CODE = $VersionCode
$env:FETS_VERSION_NAME = $VersionName
$env:FETS_UPLOAD_KEYSTORE = $ksPath
$env:FETS_UPLOAD_KEY_ALIAS = $alias
$env:FETS_UPLOAD_STORE_PASSWORD = Plain $storePw
$env:FETS_UPLOAD_KEY_PASSWORD = Plain $keyPw

try {
    Push-Location $android
    Write-Host ''
    Write-Host 'Building. This takes a few minutes on a first run...' -ForegroundColor Cyan
    & .\gradlew.bat bundleRelease --no-daemon --console=plain
    $code = $LASTEXITCODE
} finally {
    Pop-Location
    # clear secrets from this process even if the build threw
    foreach ($v in 'FETS_UPLOAD_STORE_PASSWORD', 'FETS_UPLOAD_KEY_PASSWORD') {
        Remove-Item "env:$v" -ErrorAction SilentlyContinue
    }
}

if ($code -ne 0) { throw "Gradle failed with exit code $code." }

$aab = Join-Path $android 'app\build\outputs\bundle\release\app-release.aab'
if (-not (Test-Path $aab)) { throw "Build reported success but no bundle at $aab" }

$size = [math]::Round((Get-Item $aab).Length / 1MB, 1)
Write-Host ''
Write-Host 'Done.' -ForegroundColor Green
Write-Host "  $aab"
Write-Host "  $size MB"
Write-Host ''
Write-Host 'Upload this file in Play Console under Production > Create new release.'
