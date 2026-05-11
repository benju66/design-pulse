$ErrorActionPreference = 'Stop'
$vipsDir = "C:\libvips"
$zipPath = "$vipsDir\vips.zip"
$url = "https://github.com/libvips/build-win64-mxe/releases/download/v8.15.2/vips-dev-w64-all-8.15.2.zip"

if (-Not (Test-Path $vipsDir)) {
    New-Item -ItemType Directory -Force -Path $vipsDir | Out-Null
}

Write-Host "Downloading libvips..."
Invoke-WebRequest -Uri $url -OutFile $zipPath

Write-Host "Extracting libvips..."
Expand-Archive -Path $zipPath -DestinationPath $vipsDir -Force

$binPath = "$vipsDir\vips-dev-8.15\bin"

Write-Host "Adding to User PATH..."
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$binPath*") {
    $newPath = $userPath + ";$binPath"
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
}

Write-Host "Updating Current Session PATH..."
$env:Path += ";$binPath"

Write-Host "Running Verification Test..."
Set-Location "c:\Users\BUrness\Dev\design-pulse\designpulse-backend"
.\venv\Scripts\python.exe test_milestone_2.py
