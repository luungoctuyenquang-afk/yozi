@echo off
chcp 65001 >nul
title 虚拟手机服务器

echo 🚀 启动虚拟手机服务器...
echo.

REM 检查Node.js是否安装
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js 未安装或不在PATH中
    echo 请先安装 Node.js: https://nodejs.org/
    pause
    exit /b 1
)

REM 检查package.json是否存在
if not exist "package.json" (
    echo ❌ 未找到 package.json 文件
    echo 请确保在正确的项目目录中运行此脚本
    pause
    exit /b 1
)

REM 检查node_modules是否存在
if not exist "node_modules" (
    echo ⚠️  未找到 node_modules 目录，正在安装依赖...
    npm install
    if %errorlevel% neq 0 (
        echo ❌ 依赖安装失败
        pause
        exit /b 1
    )
)

echo ✅ 环境检查通过
echo 🚀 正在启动服务器...
echo 📱 服务器启动后，请在浏览器中访问: http://localhost:3000
echo ⏹️  按 Ctrl+C 停止服务器
echo.

npm start

if %errorlevel% neq 0 (
    echo ❌ 服务器启动失败
    pause
    exit /b 1
)

