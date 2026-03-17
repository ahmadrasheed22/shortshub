const { spawn } = require('child_process');

const tunnel = spawn('"C:\\Users\\Ahmad Rasheed\\AppData\\Roaming\\npm\\cloudflared.cmd"', [
  'tunnel', '--url', 'http://localhost:3000'
], {
  windowsHide: true,
  detached: false,
  shell: true,
  stdio: 'inherit'
});

tunnel.on('error', (err) => {
  if (err.code === 'ENOENT') {
    console.error('❌ cloudflared is not installed or not in PATH.');
    console.error('Download from: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/');
    process.exit(1);
  }
  console.error('Tunnel error:', err.message);
  process.exit(1);
});

tunnel.on('exit', (code) => {
  console.log('Tunnel exited with code', code);
  process.exit(code || 0);
});
