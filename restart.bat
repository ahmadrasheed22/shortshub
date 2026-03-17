@echo off
cd /d %~dp0
echo Stopping all PM2 processes...
pm2 stop all
pm2 delete all
echo Starting ShortsHub server...
pm2 start server.js --name shortshub
echo Starting Cloudflare tunnel...
pm2 start start-tunnel.js --name shortshub-tunnel
pm2 save
echo.
echo ✅ Done! ShortsHub is running.
pm2 list
pause
