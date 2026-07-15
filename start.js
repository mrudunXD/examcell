const { spawn } = require('child_process');
const path = require('path');

console.log('\n==========================================');
console.log('   MIT WPU Exam Management System');
console.log('==========================================\n');
console.log('Starting backend and frontend in a single terminal...\n');

const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const BLUE = '\x1b[34m';
const RED = '\x1b[31m';

function startProcess(name, command, args, cwd, prefixColor) {
  const child = spawn(command, args, { 
    cwd, 
    shell: true,
    stdio: ['inherit', 'pipe', 'pipe'] 
  });

  child.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        console.log(`${prefixColor}[${name}]${RESET} ${line}`);
      }
    });
  });

  child.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        console.error(`${RED}[${name} ERROR]${RESET} ${line}`);
      }
    });
  });

  child.on('close', (code) => {
    console.log(`[${name}] process exited with code ${code}`);
  });

  return child;
}

const serverProcess = startProcess(
  'Backend',
  'npm',
  ['run', 'dev'],
  path.join(__dirname, 'server'),
  GREEN
);

const clientProcess = startProcess(
  'Frontend',
  'npm',
  ['run', 'dev'],
  path.join(__dirname, 'client'),
  BLUE
);

function cleanup() {
  console.log('\nStopping servers...');
  serverProcess.kill();
  clientProcess.kill();
  process.exit();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
