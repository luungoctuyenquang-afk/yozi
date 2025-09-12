# 虚拟手机服务器启动脚本
# 修复版 - 解决PowerShell兼容性问题

Write-Host "🚀 启动虚拟手机服务器..." -ForegroundColor Green

# 检查Node.js是否安装
try {
    $nodeVersion = node --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Node.js 版本: $nodeVersion" -ForegroundColor Green
    } else {
        Write-Host "❌ Node.js 未安装或不在PATH中" -ForegroundColor Red
        Write-Host "请先安装 Node.js: https://nodejs.org/" -ForegroundColor Yellow
        Read-Host "按任意键退出"
        exit 1
    }
} catch {
    Write-Host "❌ 无法检查Node.js版本" -ForegroundColor Red
    Read-Host "按任意键退出"
    exit 1
}

# 检查package.json是否存在
if (-not (Test-Path "package.json")) {
    Write-Host "❌ 未找到 package.json 文件" -ForegroundColor Red
    Write-Host "请确保在正确的项目目录中运行此脚本" -ForegroundColor Yellow
    Read-Host "按任意键退出"
    exit 1
}

# 检查node_modules是否存在
if (-not (Test-Path "node_modules")) {
    Write-Host "⚠️  未找到 node_modules 目录，正在安装依赖..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ 依赖安装失败" -ForegroundColor Red
        Read-Host "按任意键退出"
        exit 1
    }
}

# 检查端口是否被占用
$port = 3000
$portInUse = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Host "⚠️  端口 $port 已被占用，正在尝试停止现有进程..." -ForegroundColor Yellow
    $processes = Get-Process | Where-Object {$_.ProcessName -eq "node"}
    if ($processes) {
        $processes | Stop-Process -Force
        Start-Sleep -Seconds 2
        Write-Host "✅ 已停止现有Node.js进程" -ForegroundColor Green
    }
}

# 启动服务器
Write-Host "🚀 正在启动服务器..." -ForegroundColor Green
Write-Host "📱 服务器启动后，请在浏览器中访问: http://localhost:$port" -ForegroundColor Cyan
Write-Host "⏹️  按 Ctrl+C 停止服务器" -ForegroundColor Yellow
Write-Host ""

try {
    npm start
} catch {
    Write-Host "❌ 服务器启动失败: $($_.Exception.Message)" -ForegroundColor Red
    Read-Host "按任意键退出"
    exit 1
}
