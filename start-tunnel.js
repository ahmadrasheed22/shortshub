const { spawn } = require('child_process');
const cp = spawn('npx.cmd', ['cloudflared', 'tunnel', '--url', 'http://localhost:3000'], { shell: true });
cp.stdout.pipe(process.stdout);
cp.stderr.pipe(process.stderr);
cp.on('exit', (code) => {
  console.log(`Tunnel exited with code ${code}`);
  process.exit(code);
});
