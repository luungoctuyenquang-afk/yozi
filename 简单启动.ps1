# 设置控制台编码
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "正在启动虚拟手机服务器..." -ForegroundColor Green
Set-Location "E:\柚子机\yoyo"
Write-Host "当前目录: $(Get-Location)" -ForegroundColor Yellow
Write-Host "Node.js版本: $(node --version)" -ForegroundColor Yellow
Write-Host "启动服务器..." -ForegroundColor Green
npm start
