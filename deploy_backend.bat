@echo off
echo ==========================================
echo   Adventure Forge - Deploy to Render
echo ==========================================
echo.
echo This script will push your changes to GitHub.
echo Render will automatically detect this and start a new deployment.
echo.

cd /d "%~dp0"

echo [1/3] Staging changes...
git add .

echo.
set /p commit_msg="[2/3] Enter a commit message (e.g., 'updates'): "
git commit -m "%commit_msg%"

echo.
echo [3/3] Pushing to GitHub...
git push origin main

echo.
echo ==========================================
echo   SUCCESS! 
echo   Check your Render dashboard to see the build progress.
echo ==========================================
pause
