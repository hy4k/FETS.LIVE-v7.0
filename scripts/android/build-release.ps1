param(
    [string]$KeystorePath = 'C:\Users\mithu\fets-upload-key\upload-keystore.jks',
    [string]$KeyAlias = 'upload',
    [int]$PreviousVersionCode = 34,
    [int]$VersionCode = 35,
    [string]$VersionName = '7.1.0',
    [string]$FirebaseConfigPath = ''
)

$ErrorActionPreference = 'Stop'
$repoDir = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$appDir = Join-Path $repoDir 'fets-point'
$firebasePath = Join-Path $appDir 'android/app/google-services.json'
if ($VersionCode -le $PreviousVersionCode) { throw 'Version code must exceed the highest uploaded Play Console code.' }
if (-not (Test-Path -LiteralPath $KeystorePath -PathType Leaf)) { throw "Existing upload keystore not found: $KeystorePath" }
if (-not (Test-Path -LiteralPath $firebasePath -PathType Leaf)) {
    if (-not $FirebaseConfigPath -and [Environment]::OSVersion.Platform -eq 'Win32NT') {
        Add-Type -AssemblyName System.Windows.Forms
        $picker = New-Object System.Windows.Forms.OpenFileDialog
        $picker.Title = 'Select google-services.json from the existing FETS Android project'
        $picker.Filter = 'Firebase Android configuration (google-services.json)|google-services.json'
        try {
            if ($picker.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $FirebaseConfigPath = $picker.FileName }
        } finally { $picker.Dispose() }
    }
    if (-not $FirebaseConfigPath) { throw "Restore the existing Firebase google-services.json to $firebasePath before building." }
    $selectedFirebase = Get-Content -LiteralPath $FirebaseConfigPath -Raw | ConvertFrom-Json
    if (-not @($selectedFirebase.client | Where-Object { $_.client_info.android_client_info.package_name -eq 'com.fets.staffapp' }).Count) {
        throw 'The selected Firebase file does not contain com.fets.staffapp.'
    }
    Copy-Item -LiteralPath $FirebaseConfigPath -Destination $firebasePath
}
$firebase = Get-Content -LiteralPath $firebasePath -Raw | ConvertFrom-Json
$matchingClient = @($firebase.client | Where-Object { $_.client_info.android_client_info.package_name -eq 'com.fets.staffapp' })
if ($matchingClient.Count -eq 0) { throw 'Firebase configuration does not contain com.fets.staffapp.' }
foreach ($tool in @('node', 'pnpm', 'java', 'javac')) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "Missing $tool. Install Node.js, pnpm and JDK 21 (including javac) and reopen PowerShell." }
}

function Invoke-Checked {
    param([string]$Command, [string[]]$Arguments)
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Command failed with exit code $LASTEXITCODE. Signing and publication have not completed." }
}

$variableNames = @('FETS_PREVIOUS_VERSION_CODE', 'FETS_VERSION_CODE', 'FETS_VERSION_NAME', 'FETS_UPLOAD_KEYSTORE', 'FETS_UPLOAD_KEY_ALIAS', 'FETS_UPLOAD_STORE_PASSWORD', 'FETS_UPLOAD_KEY_PASSWORD')
$previousValues = @{}
foreach ($name in $variableNames) { $previousValues[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
$startingDirectory = Get-Location
try {
    Set-Location $repoDir
    Invoke-Checked 'pnpm' @('install', '--frozen-lockfile')
    Invoke-Checked 'pnpm' @('--filter', 'fets-point', 'build')
    Set-Location $appDir
    Invoke-Checked 'node' @('node_modules/@capacitor/cli/bin/capacitor', 'sync', 'android')

    $env:FETS_PREVIOUS_VERSION_CODE = "$PreviousVersionCode"
    $env:FETS_VERSION_CODE = "$VersionCode"
    $env:FETS_VERSION_NAME = $VersionName
    $env:FETS_UPLOAD_KEYSTORE = (Resolve-Path -LiteralPath $KeystorePath).Path
    $env:FETS_UPLOAD_KEY_ALIAS = $KeyAlias
    $storeSecret = Read-Host 'Existing keystore password (entered locally, hidden)' -AsSecureString
    $keySecret = Read-Host 'Existing upload key password (entered locally, hidden)' -AsSecureString
    $env:FETS_UPLOAD_STORE_PASSWORD = [System.Net.NetworkCredential]::new('', $storeSecret).Password
    $env:FETS_UPLOAD_KEY_PASSWORD = [System.Net.NetworkCredential]::new('', $keySecret).Password
    Invoke-Checked (Join-Path $appDir 'android/gradlew.bat') @('-p', 'android', '--no-daemon', '--max-workers=4', 'bundleRelease')
    $bundlePath = Join-Path $appDir 'android/app/build/outputs/bundle/release/app-release.aab'
    if (-not (Test-Path -LiteralPath $bundlePath)) { throw 'Gradle completed but no release bundle was found.' }
    Write-Host "Signed bundle: $bundlePath"
    Write-Host 'No upload or rollout has occurred. Test the upgrade and review before production.'
} finally {
    foreach ($name in $variableNames) { [Environment]::SetEnvironmentVariable($name, $previousValues[$name], 'Process') }
    if ($storeSecret) { $storeSecret.Dispose() }
    if ($keySecret) { $keySecret.Dispose() }
    Set-Location $startingDirectory
}
