# Build script for Production Agent (sight.avegabros.org)
# This builds the agent with production server configuration

Write-Host "Building Sight Agent for Production..." -ForegroundColor Cyan
Write-Host "Server: wss://sight.avegabros.org/ws" -ForegroundColor Yellow

$env:SIGHT_SERVER_URL = "wss://sight.avegabros.org/ws"
$env:SIGHT_FALLBACK_URL = "https://sight.avegabros.org/config.json"

Set-Location ..\agent-desktop
npm run tauri build -- --config src-tauri/tauri.prod.conf.json

if ($LASTEXITCODE -eq 0) {
    $msiOutDir = "src-tauri\target\release\bundle\msi"
    $builtMsi = Join-Path $msiOutDir "sight-agent-prod_1.1.0_x64_en-US.msi"
    $releaseMsi = "..\server\releases\agent-prod.msi"

    if (Test-Path $builtMsi) {
        Copy-Item $builtMsi $releaseMsi -Force
    }

    Write-Host ""
    Write-Host "Build successful!" -ForegroundColor Green
    Write-Host "Output: $builtMsi" -ForegroundColor White
    Write-Host "Release copy: $releaseMsi" -ForegroundColor White
    Write-Host ""
    Write-Host "Variant identity: sight-agent-prod / com.asanchez.sight-agent.prod" -ForegroundColor Yellow
} else {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}
