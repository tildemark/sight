# Build script for Demo Agent (sight.sanchez.ph)
# This builds the agent with demo server configuration
#
# CODE SIGNING (required to pass Windows Smart App Control on W11)
# Set these env vars before running to sign the output:
#   $env:SIGNING_CERT_PATH     = "C:\path\to\cert.pfx"
#   $env:SIGNING_CERT_PASSWORD = "your-pfx-password"

Write-Host "Building Sight Agent for Demo..." -ForegroundColor Cyan
Write-Host "Server: wss://sight.sanchez.ph/ws" -ForegroundColor Yellow

if (-not $env:SIGNING_CERT_PATH) {
    Write-Host "`n[WARNING] SIGNING_CERT_PATH is not set." -ForegroundColor Yellow
    Write-Host "          The output will NOT be code signed." -ForegroundColor Yellow
    Write-Host "          Windows Smart App Control will block unsigned builds on W11." -ForegroundColor Yellow
    Write-Host "          Set SIGNING_CERT_PATH and SIGNING_CERT_PASSWORD to sign.`n" -ForegroundColor Yellow
} else {
    Write-Host "[sign] Certificate: $env:SIGNING_CERT_PATH" -ForegroundColor Green
}

$env:SIGHT_SERVER_URL = "wss://sight.sanchez.ph/ws"
$env:SIGHT_FALLBACK_URL = "https://sight.sanchez.ph/config.json"

Set-Location ..\agent-desktop
npm run tauri build -- --config src-tauri/tauri.demo.conf.json

if ($LASTEXITCODE -eq 0) {
    $msiOutDir = "src-tauri\target\release\bundle\msi"
    $builtMsi = Get-ChildItem -Path $msiOutDir -Filter "sight-agent-demo_*_x64_en-US.msi" |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    $releaseMsi = "..\server\releases\agent-demo.msi"

    if ($builtMsi) {
        Copy-Item $builtMsi.FullName $releaseMsi -Force
    }

    Write-Host ""
    Write-Host "Build successful!" -ForegroundColor Green
    Write-Host "Output: $($builtMsi.FullName)" -ForegroundColor White
    Write-Host "Release copy: $releaseMsi" -ForegroundColor White
    Write-Host ""
    Write-Host "Variant identity: sight-agent-demo / com.asanchez.sight-agent.demo" -ForegroundColor Yellow
} else {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}
