@echo off
pm2 start server.js --name shortshub
pm2 start "cloudflared tunnel --url http://localhost:3000" --name shortshub-tunnel
pm2 save
