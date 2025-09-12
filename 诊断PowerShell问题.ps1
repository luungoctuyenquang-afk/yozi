# PowerShell 问题诊断脚本
# 帮助识别Claude Code无法运行的原因

Write-Host "🔍 PowerShell 问题诊断工具" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# 1. 检查PowerShell版本
Write-Host "`n1. PowerShell 版本信息:" -ForegroundColor Yellow
Write-Host "   版本: $($PSVersionTable.PSVersion)" -ForegroundColor White
Write-Host "   平台: $($PSVersionTable.Platform)" -ForegroundColor White
Write-Host "   操作系统: $($PSVersionTable.OS)" -ForegroundColor White

# 2. 检查执行策略
Write-Host "`n2. 执行策略:" -ForegroundColor Yellow
$policy = Get-ExecutionPolicy
Write-Host "   当前策略: $policy" -ForegroundColor White
if ($policy -eq "Restricted") {
    Write-Host "   ⚠️  执行策略过于严格，可能影响脚本运行" -ForegroundColor Red
} else {
    Write-Host "   ✅ 执行策略正常" -ForegroundColor Green
}

# 3. 检查Node.js
Write-Host "`n3. Node.js 环境:" -ForegroundColor Yellow
$nodeVersion = node --version 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Node.js 版本: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "   ❌ Node.js 未安装或不在PATH中" -ForegroundColor Red
}

# 4. 检查npm
Write-Host "`n4. npm 环境:" -ForegroundColor Yellow
$npmVersion = npm --version 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ npm 版本: $npmVersion" -ForegroundColor Green
} else {
    Write-Host "   ❌ npm 未安装或不在PATH中" -ForegroundColor Red
}

# 5. 检查项目文件
Write-Host "`n5. 项目文件检查:" -ForegroundColor Yellow
$files = @("package.json", "server.js", "index.html", "js/main.js")
foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "   ✅ $file 存在" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $file 缺失" -ForegroundColor Red
    }
}

# 6. 检查依赖
Write-Host "`n6. 依赖检查:" -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "   ✅ node_modules 目录存在" -ForegroundColor Green
    $packageCount = (Get-ChildItem "node_modules" -Directory).Count
    Write-Host "   已安装包数量: $packageCount" -ForegroundColor White
} else {
    Write-Host "   ❌ node_modules 目录不存在" -ForegroundColor Red
    Write-Host "   建议运行: npm install" -ForegroundColor Yellow
}

# 7. 检查端口占用
Write-Host "`n7. 端口检查:" -ForegroundColor Yellow
$port = 3000
$portInUse = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Host "   ⚠️  端口 $port 已被占用" -ForegroundColor Yellow
    $processes = Get-Process | Where-Object {$_.ProcessName -eq "node"}
    if ($processes) {
        Write-Host "   占用进程: Node.js (PID: $($processes.Id))" -ForegroundColor White
    }
} else {
    Write-Host "   ✅ 端口 $port 可用" -ForegroundColor Green
}

# 8. 检查网络连接
Write-Host "`n8. 网络连接测试:" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -Method Head -TimeoutSec 5 -ErrorAction Stop
    Write-Host "   ✅ 本地服务器响应正常 (状态码: $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "   ❌ 本地服务器无响应: $($_.Exception.Message)" -ForegroundColor Red
}

# 9. 提供建议
Write-Host "`n9. 建议和解决方案:" -ForegroundColor Yellow
Write-Host "   📝 如果遇到问题，请尝试以下解决方案:" -ForegroundColor White
Write-Host "   1. 使用修复版启动脚本: .\启动-修复版.ps1" -ForegroundColor Cyan
Write-Host "   2. 使用批处理文件: .\启动-修复版.bat" -ForegroundColor Cyan
Write-Host "   3. 直接运行: npm start" -ForegroundColor Cyan
Write-Host "   4. 访问测试页面: http://localhost:3000/test-claude-code.html" -ForegroundColor Cyan

Write-Host "`n🔍 诊断完成！" -ForegroundColor Green
Read-Host "按任意键退出"
