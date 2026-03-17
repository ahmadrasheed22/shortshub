@echo off
cd /d %~dp0
echo Starting ShortsHub...
pm2 start server.js --name shortshub
pm2 start start-tunnel.js --name shortshub-tunnel
pm2 save
echo.
echo ✅ ShortsHub is running!
pm2 list
pause
