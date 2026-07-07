import { EventEmitter } from 'events';

const maxLines = 500;
export const consoleLogs = [];
export const consoleEmitter = new EventEmitter();

const originalWrite = process.stdout.write;
const originalErrWrite = process.stderr.write;

function addLog(text, type = 'info') {
  // Strip ANSI color codes
  const cleanText = text.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
  if (!cleanText.trim()) return;

  const logEntry = {
    id: Math.random().toString(36).substring(7),
    timestamp: new Date().toISOString(),
    text: cleanText,
    type
  };

  consoleLogs.push(logEntry);
  if (consoleLogs.length > maxLines) {
    consoleLogs.shift();
  }

  consoleEmitter.emit('log', logEntry);
}

process.stdout.write = function (chunk, encoding, callback) {
  const text = chunk.toString();
  addLog(text, 'info');
  return originalWrite.apply(process.stdout, arguments);
};

process.stderr.write = function (chunk, encoding, callback) {
  const text = chunk.toString();
  addLog(text, 'error');
  return originalErrWrite.apply(process.stderr, arguments);
};
