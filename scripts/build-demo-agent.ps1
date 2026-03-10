# Build script for Demo Agent (sight.sanchez.ph)
# This builds the agent with demo server configuration

Write-Host "Building Sight Agent for Demo..." -ForegroundColor Cyan
Write-Host "Server: wss://sight.sanchez.ph/ws" -ForegroundColor Yellow

$env:SIGHT_SERVER_URL = "wss://sight.sanchez.ph/ws"
$env:SIGHT_FALLBACK_URL = "https://sight.sanchez.ph/config.json"

Set-Location ..\agent-desktop
npm run tauri build -- --config src-tauri/tauri.demo.conf.json

if ($LASTEXITCODE -eq 0) {
    $msiOutDir = "src-tauri\target\release\bundle\msi"
    $builtMsi = Join-Path $msiOutDir "sight-agent-demo_1.1.0_x64_en-US.msi"
    $releaseMsi = "..\server\releases\agent-demo.msi"

    if (Test-Path $builtMsi) {
        Copy-Item $builtMsi $releaseMsi -Force
    }

    Write-Host ""
    Write-Host "Build successful!" -ForegroundColor Green
    Write-Host "Output: $builtMsi" -ForegroundColor White
    Write-Host "Release copy: $releaseMsi" -ForegroundColor White
    Write-Host ""
    Write-Host "Variant identity: sight-agent-demo / com.asanchez.sight-agent.demo" -ForegroundColor Yellow
} else {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}
