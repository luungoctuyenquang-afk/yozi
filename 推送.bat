@echo off
chcp 65001 >nul
echo === 双仓库推送工具 ===
echo.

echo 请选择推送目标:
echo 1. 推送到 yoyo 仓库 (origin)
echo 2. 推送到 yozi 仓库
echo 3. 推送到两个仓库
echo 4. 取消
echo.

set /p choice=请输入选择 (1-4): 

if "%choice%"=="1" goto push_origin
if "%choice%"=="2" goto push_yozi
if "%choice%"=="3" goto push_both
if "%choice%"=="4" goto cancel
echo 无效选择
goto end

:push_origin
echo.
echo 推送到 yoyo 仓库...
git push origin main
if %errorlevel%==0 (
    echo ✅ 成功推送到 yoyo 仓库
) else (
    echo ❌ 推送到 yoyo 仓库失败
)
goto end

:push_yozi
echo.
echo 推送到 yozi 仓库...
git push yozi main
if %errorlevel%==0 (
    echo ✅ 成功推送到 yozi 仓库
) else (
    echo ❌ 推送到 yozi 仓库失败
)
goto end

:push_both
echo.
echo 推送到两个仓库...
echo.
echo 推送到 yoyo 仓库...
git push origin main
set origin_result=%errorlevel%
echo.
echo 推送到 yozi 仓库...
git push yozi main
set yozi_result=%errorlevel%
echo.
echo 推送结果:
if %origin_result%==0 (
    echo ✅ yoyo 仓库推送成功
) else (
    echo ❌ yoyo 仓库推送失败
)
if %yozi_result%==0 (
    echo ✅ yozi 仓库推送成功
) else (
    echo ❌ yozi 仓库推送失败
)
goto end

:cancel
echo 已取消推送
goto end

:end
echo.
echo === 推送完成 ===
pause










