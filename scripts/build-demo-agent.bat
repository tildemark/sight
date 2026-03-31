@echo off
REM Build script for Demo Agent (sight.sanchez.ph)
REM This builds the agent with demo server configuration
REM
REM CODE SIGNING (required to pass Windows Smart App Control on W11)
REM Set these env vars before running to sign the output:
REM   set SIGNING_CERT_PATH=C:\path\to\cert.pfx
REM   set SIGNING_CERT_PASSWORD=your-pfx-password

echo Building Sight Agent for Demo...
echo Server: wss://sight.sanchez.ph/ws

if not defined SIGNING_CERT_PATH (
    echo.
    echo  [WARNING] SIGNING_CERT_PATH is not set.
    echo            The output will NOT be code signed.
    echo            Windows Smart App Control will block unsigned builds on W11.
    echo            Set SIGNING_CERT_PATH and SIGNING_CERT_PASSWORD to sign.
    echo.
) else (
    echo [sign] Certificate: %SIGNING_CERT_PATH%
)

cd ..\agent-desktop

REM Set environment variables for the build
set SIGHT_SERVER_URL=wss://sight.sanchez.ph/ws
set SIGHT_FALLBACK_URL=https://sight.sanchez.ph/config.json

npm run tauri build -- --config src-tauri/tauri.demo.conf.json

if %ERRORLEVEL% EQU 0 (
    if exist src-tauri\target\release\bundle\msi\sight-agent-demo_1.1.0_x64_en-US.msi (
        copy /Y src-tauri\target\release\bundle\msi\sight-agent-demo_1.1.0_x64_en-US.msi ..\server\releases\agent-demo.msi >nul
    )
    echo.
    echo Build successful!
    echo Output: src-tauri\target\release\bundle\msi\sight-agent-demo_1.1.0_x64_en-US.msi
    echo Release copy: ..\server\releases\agent-demo.msi
    echo.
    echo Variant identity: sight-agent-demo / com.asanchez.sight-agent.demo
) else (
    echo Build failed!
    exit /b 1
)
