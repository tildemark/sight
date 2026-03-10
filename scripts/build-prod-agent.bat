@echo off
REM Build script for Production Agent (sight.avegabros.org)
REM This builds the agent with production server configuration

echo Building Sight Agent for Production...
echo Server: wss://sight.avegabros.org/ws

cd ..\agent-desktop

set SIGHT_SERVER_URL=wss://sight.avegabros.org/ws
set SIGHT_FALLBACK_URL=https://sight.avegabros.org/config.json

npm run tauri build -- --config src-tauri/tauri.prod.conf.json

if %ERRORLEVEL% EQU 0 (
  if exist src-tauri\target\release\bundle\msi\sight-agent-prod_1.1.0_x64_en-US.msi (
    copy /Y src-tauri\target\release\bundle\msi\sight-agent-prod_1.1.0_x64_en-US.msi ..\server\releases\agent-prod.msi >nul
  )
    echo.
    echo Build successful!
  echo Output: src-tauri\target\release\bundle\msi\sight-agent-prod_1.1.0_x64_en-US.msi
  echo Release copy: ..\server\releases\agent-prod.msi
    echo.
  echo Variant identity: sight-agent-prod / com.asanchez.sight-agent.prod
) else (
    echo Build failed!
    exit /b 1
)
