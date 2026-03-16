@echo off
echo Starting ShortsHub...
pm2 stop all
pm2 delete all
pm2 start server.js --name shortshub
pm2 start start-tunnel.js --name shortshub-tunnel
pm2 save
echo Done! ShortsHub is running.
pause
