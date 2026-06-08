import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.resolve(__dirname, 'src');

const txVars = ['upsert', 'insertAll', 'updateSubjects', 'saveSeating', 'swap', 'insertMany', 'saveDuties'];
const stmtVars = [
  'stmt', 'conflStmt', 'facultyClashStmt', 'overflowStmt', 'studentClashStmt', 
  'insertCycle', 'insertSlot', 'slotStmt', 'ssStmt', 'raStmt', 'seatStmt', 
  'cStmt', 'invStmt', 'roomsStmt', 'studentCountStmt', 'updatedRooms',
  'insertFaculty', 'insertSubject', 'insertTeaches', 'insertStmt'
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // 1. Convert db.prepare(...).all/get/run to await db.prepare(...).all/get/run
  // Using [\s\S]*? to handle multiline sql strings correctly
  content = content.replace(/(?<!await\s+)(db\.prepare\([\s\S]*?\)\s*\.\s*(?:all|get|run)\b)/g, 'await $1');

  // 2. Convert specific statement variable method calls (all/get/run) to await
  const stmtVarPattern = new RegExp(`(?<!await\\s+)(\\b(?:${stmtVars.join('|')})\\s*\\.\\s*(?:all|get|run)\\b)`, 'g');
  content = content.replace(stmtVarPattern, 'await $1');

  // 3. Convert db.transaction(...) to await db.transaction(...)
  content = content.replace(/(?<!await\s+)(db\.transaction\()/g, 'await $1');

  // 4. Convert transaction callbacks to async
  content = content.replace(/db\.transaction\(\s*\(\s*\)\s*=>/g, 'db.transaction(async () =>');
  content = content.replace(/db\.transaction\(\s*\(\s*(\w+)\s*\)\s*=>/g, 'db.transaction(async ($1) =>');
  content = content.replace(/db\.transaction\(\s*(\w+)\s*=>/g, 'db.transaction(async ($1) =>');

  // 5. Convert specific transaction variable calls to await
  for (const v of txVars) {
    const regex = new RegExp(`(?<!await\\s+)(?<!const\\s+)(?<!let\\s+)(?<!var\\s+)(\\b${v}\\b\\s*\\()`, 'g');
    content = content.replace(regex, 'await $1');
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Converted db calls in: ${filePath}`);
  }
}

function walk(dir) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath);
    } else if (file.endsWith('.js')) {
      processFile(fullPath);
    }
  }
}

const SCRIPTS_DIR = path.resolve(__dirname, 'scripts');

console.log('🔄 Converting database calls in server/src...');
walk(SRC_DIR);
console.log('🔄 Converting database calls in server/scripts...');
if (fs.existsSync(SCRIPTS_DIR)) {
  walk(SCRIPTS_DIR);
}
console.log('🔄 Converting database calls in server/audit_stress_test.js...');
if (fs.existsSync(path.resolve(__dirname, 'audit_stress_test.js'))) {
  processFile(path.resolve(__dirname, 'audit_stress_test.js'));
}
console.log('🎉 Done converting db calls!');
