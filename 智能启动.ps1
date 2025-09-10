# 虚拟手机服务器智能启动脚本
param(
    [switch]$Background = $false
)

# 设置控制台编码
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   🚀 虚拟手机服务器启动器" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 切换到项目目录
Set-Location "E:\柚子机\yoyo"
Write-Host "📍 当前目录: $(Get-Location)" -ForegroundColor Green
Write-Host ""

# 检查Node.js环境
Write-Host "🔍 检查Node.js环境..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js版本: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js未安装或未添加到PATH" -ForegroundColor Red
    Write-Host "请先安装Node.js: https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "按回车键退出"
    exit 1
}

Write-Host ""

# 检查端口占用
Write-Host "🔍 检查端口3000是否被占用..." -ForegroundColor Yellow
$portCheck = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($portCheck) {
    Write-Host "⚠️  端口3000已被占用，正在尝试停止现有服务..." -ForegroundColor Yellow
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep 2
}

# 启动服务器
Write-Host "🚀 启动虚拟手机服务器..." -ForegroundColor Green
Write-Host ""
Write-Host "📱 服务器启动后，请在浏览器中访问:" -ForegroundColor Cyan
Write-Host "   http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "💡 按 Ctrl+C 可停止服务器" -ForegroundColor Yellow
Write-Host ""

if ($Background) {
    Write-Host "🔄 后台模式启动..." -ForegroundColor Green
    Start-Process -FilePath "node" -ArgumentList "server.js" -WindowStyle Hidden
    Write-Host "✅ 服务器已在后台启动" -ForegroundColor Green
    Write-Host "📱 访问地址: http://localhost:3000" -ForegroundColor Cyan
} else {
    npm start
}

Write-Host ""
Write-Host "👋 服务器已停止" -ForegroundColor Yellow
Read-Host "按回车键退出"
