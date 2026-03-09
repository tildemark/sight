@echo off
REM Build script for Production Agent (sight.avegabros.org)
REM This builds the agent with production server configuration

echo Building Sight Agent for Production...
echo Server: wss://sight.avegabros.org/ws

cd ..\agent-desktop

npm run tauri build ^
  -- --env SIGHT_SERVER_URL=wss://sight.avegabros.org/ws ^
  -- --env SIGHT_FALLBACK_URL=https://sight.avegabros.org/config.json

if %ERRORLEVEL% EQU 0 (
    echo.
    echo Build successful!
    echo Output: agent-desktop\src-tauri\target\release\bundle\msi\
    echo.
    echo Copy to production server:
    echo   copy agent-desktop\src-tauri\target\release\bundle\msi\*.msi ..\server\releases\agent-prod.msi
) else (
    echo Build failed!
    exit /b 1
)
