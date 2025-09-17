# 双仓库推送脚本
# 使用方法：
# .\推送脚本.ps1 -target "origin"     # 只推送到 yoyo 仓库
# .\推送脚本.ps1 -target "yozi"       # 只推送到 yozi 仓库  
# .\推送脚本.ps1 -target "both"       # 推送到两个仓库
# .\推送脚本.ps1                      # 交互式选择

param(
    [string]$target = "interactive"
)

Write-Host "=== 双仓库推送工具 ===" -ForegroundColor Green
Write-Host "当前分支: $(git branch --show-current)" -ForegroundColor Yellow

# 检查是否有未提交的更改
$status = git status --porcelain
if ($status) {
    Write-Host "检测到未提交的更改:" -ForegroundColor Red
    Write-Host $status
    $commit = Read-Host "是否先提交这些更改? (y/n)"
    if ($commit -eq "y" -or $commit -eq "Y") {
        $message = Read-Host "请输入提交信息"
        git add .
        git commit -m $message
        Write-Host "已提交更改" -ForegroundColor Green
    }
}

# 交互式选择
if ($target -eq "interactive") {
    Write-Host "`n请选择推送目标:" -ForegroundColor Cyan
    Write-Host "1. 推送到 yoyo 仓库 (origin)"
    Write-Host "2. 推送到 yozi 仓库"  
    Write-Host "3. 推送到两个仓库"
    Write-Host "4. 取消"
    
    $choice = Read-Host "请输入选择 (1-4)"
    
    switch ($choice) {
        "1" { $target = "origin" }
        "2" { $target = "yozi" }
        "3" { $target = "both" }
        "4" { 
            Write-Host "已取消推送" -ForegroundColor Yellow
            exit 
        }
        default { 
            Write-Host "无效选择，已取消" -ForegroundColor Red
            exit 
        }
    }
}

# 执行推送
switch ($target) {
    "origin" {
        Write-Host "`n推送到 yoyo 仓库..." -ForegroundColor Blue
        git push origin main
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ 成功推送到 yoyo 仓库" -ForegroundColor Green
        } else {
            Write-Host "❌ 推送到 yoyo 仓库失败" -ForegroundColor Red
        }
    }
    "yozi" {
        Write-Host "`n推送到 yozi 仓库..." -ForegroundColor Blue
        git push yozi main
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ 成功推送到 yozi 仓库" -ForegroundColor Green
        } else {
            Write-Host "❌ 推送到 yozi 仓库失败" -ForegroundColor Red
        }
    }
    "both" {
        Write-Host "`n推送到两个仓库..." -ForegroundColor Blue
        
        Write-Host "推送到 yoyo 仓库..." -ForegroundColor Cyan
        git push origin main
        $originResult = $LASTEXITCODE
        
        Write-Host "推送到 yozi 仓库..." -ForegroundColor Cyan  
        git push yozi main
        $yoziResult = $LASTEXITCODE
        
        Write-Host "`n推送结果:" -ForegroundColor Yellow
        if ($originResult -eq 0) {
            Write-Host "✅ yoyo 仓库推送成功" -ForegroundColor Green
        } else {
            Write-Host "❌ yoyo 仓库推送失败" -ForegroundColor Red
        }
        
        if ($yoziResult -eq 0) {
            Write-Host "✅ yozi 仓库推送成功" -ForegroundColor Green
        } else {
            Write-Host "❌ yozi 仓库推送失败" -ForegroundColor Red
        }
    }
}

Write-Host "`n=== 推送完成 ===" -ForegroundColor Green
