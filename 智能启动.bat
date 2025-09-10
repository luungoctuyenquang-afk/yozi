@echo off
chcp 65001 >nul
title 虚拟手机服务器启动器

echo.
echo ========================================
echo    🚀 虚拟手机服务器启动器
echo ========================================
echo.

cd /d "E:\柚子机\yoyo"

echo 📍 当前目录: %CD%
echo.

echo 🔍 检查Node.js环境...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js未安装或未添加到PATH
    echo 请先安装Node.js: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js环境正常
echo.

echo 🔍 检查端口3000是否被占用...
netstat -ano | findstr :3000 >nul 2>&1
if %errorlevel% equ 0 (
    echo ⚠️  端口3000已被占用，正在尝试停止现有服务...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do (
        taskkill /F /PID %%a >nul 2>&1
    )
    timeout /t 2 >nul
)

echo 🚀 启动虚拟手机服务器...
echo.
echo 📱 服务器启动后，请在浏览器中访问:
echo    http://localhost:3000
echo.
echo 💡 按 Ctrl+C 可停止服务器
echo.

npm start

echo.
echo 👋 服务器已停止
pause
