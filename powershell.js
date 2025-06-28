// powershell.js
const { spawn } = require('child_process');

function executeCommand(command) {
  return new Promise((resolve, reject) => {
    const ps = spawn('powershell.exe', ['-NoProfile', '-Command', command]);

    let stdout = '';
    let stderr = '';

    ps.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ps.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ps.on('error', (err) => {
      reject(err);
    });

    ps.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(stderr || `Process exited with code ${code}`);
      }
    });
  });
}

module.exports = { executeCommand };

