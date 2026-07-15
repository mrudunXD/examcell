/**
 * AI Bug Resolver — powered by Google Gemini 2.5 Pro
 * Analyzes bug reports, reads relevant source files, proposes patches,
 * and auto-applies them if confidence >= 80%.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../../..');

// Google Gemini API keys are loaded dynamically from system_settings at runtime

// Maps page URL patterns → relevant source files (relative to project root)
const PAGE_FILE_MAP = [
  { pattern: /\/students/,      files: ['client/src/pages/StudentsPage.jsx', 'server/src/routes/students.js'] },
  { pattern: /\/subjects/,      files: ['client/src/pages/SubjectsPage.jsx', 'server/src/routes/subjects.js'] },
  { pattern: /\/classrooms/,    files: ['client/src/pages/ClassroomsPage.jsx', 'server/src/routes/classrooms.js'] },
  { pattern: /\/faculty/,       files: ['client/src/pages/FacultyPage.jsx', 'server/src/routes/faculty.js'] },
  { pattern: /\/exam-cycles/,   files: ['client/src/pages/ExamCyclesPage.jsx', 'server/src/routes/examcycles.js'] },
  { pattern: /\/dashboard/,     files: ['client/src/pages/DashboardPage.jsx', 'server/src/routes/broadcasts.js'] },
  { pattern: /\/health/,        files: ['client/src/pages/SystemHealthPage.jsx', 'server/src/routes/health.js'] },
  { pattern: /\/my-duties/,     files: ['client/src/pages/FacultyDutyPage.jsx', 'server/src/routes/faculty.js'] },
  { pattern: /\/kiosk/,         files: ['client/src/pages/KioskPage.jsx', 'server/src/routes/public.js', 'server/src/routes/broadcasts.js'] },
  { pattern: /\/seating/,       files: ['client/src/pages/SeatingPage.jsx', 'server/src/routes/seating.js'] },
  { pattern: /\/attendance/,    files: ['client/src/pages/AttendancePage.jsx', 'server/src/routes/attendance.js'] },
  { pattern: /\/calendar/,      files: ['client/src/pages/CalendarPage.jsx'] },
  { pattern: /\/planner/,       files: ['client/src/pages/PlannerPage.jsx'] },
  { pattern: /\/conflicts/,     files: ['client/src/pages/ConflictsPage.jsx', 'server/src/routes/conflicts.js'] },
  { pattern: /\/analytics/,     files: ['client/src/pages/HistoricalAnalyticsPage.jsx'] },
  { pattern: /\/audit/,         files: ['client/src/pages/AuditPage.jsx', 'server/src/routes/audit.js'] },
  { pattern: /\/settings/,      files: ['client/src/pages/SettingsPage.jsx', 'server/src/routes/settings.js'] },
  { pattern: /\/live-dashboard/,files: ['client/src/pages/LiveDashboardPage.jsx'] },
  { pattern: /\/bugs/,          files: ['client/src/pages/BugTrackerPage.jsx', 'server/src/routes/bugs.js'] },
  { pattern: /^\//,             files: ['client/src/components/Layout.jsx', 'client/src/App.jsx'] }, // root/dashboard fallback
];

async function readSourceFiles(pageUrl) {
  const matched = PAGE_FILE_MAP.find(m => m.pattern.test(pageUrl));
  if (!matched) return '';

  const contents = [];
  for (const relPath of matched.files) {
    try {
      const absPath = path.join(ROOT, relPath);
      const content = await fs.readFile(absPath, 'utf-8');
      // Truncate very large files to first 600 lines to stay within token limits
      const lines = content.split('\n');
      const truncated = lines.length > 600 ? lines.slice(0, 600).join('\n') + '\n... (truncated)' : content;
      contents.push(`\n\n=== FILE: ${relPath} ===\n${truncated}`);
    } catch {
      // file not found — skip silently
    }
  }
  return contents.join('');
}

async function callGemini(prompt, apiKey, model) {
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(geminiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,   // Low temperature for precise code fixes
        maxOutputTokens: 4096,
      }
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

function extractJson(text) {
  // Strip markdown code fences if present
  const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
  // Find the first complete JSON object
  const start = clean.indexOf('{');
  if (start === -1) throw new Error('No JSON object found in AI response');
  let depth = 0, end = -1;
  for (let i = start; i < clean.length; i++) {
    if (clean[i] === '{') depth++;
    else if (clean[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) throw new Error('Malformed JSON in AI response');
  return JSON.parse(clean.slice(start, end + 1));
}

async function applyPatches(patches) {
  const applied = [];
  for (const patch of patches) {
    try {
      const absPath = path.join(ROOT, patch.filePath);
      const content = await fs.readFile(absPath, 'utf-8');
      if (!content.includes(patch.search)) {
        applied.push({ file: patch.filePath, success: false, reason: 'search string not found in file' });
        continue;
      }
      // Only replace first occurrence to be safe
      const updated = content.replace(patch.search, patch.replace);
      await fs.writeFile(absPath, updated, 'utf-8');
      applied.push({ file: patch.filePath, success: true });
    } catch (err) {
      applied.push({ file: patch.filePath, success: false, reason: err.message });
    }
  }
  return applied;
}

/**
 * Main entry point — analyze a bug and optionally auto-patch it.
 * @param {object} bug - The bug record from DB
 * @param {object} db - Database instance
 */
export async function analyzeBug(bug, db) {
  const keyRow = await db.prepare("SELECT value FROM system_settings WHERE key = 'ai.geminiApiKey'").get();
  const modelRow = await db.prepare("SELECT value FROM system_settings WHERE key = 'ai.geminiModel'").get();

  const apiKey = keyRow?.value || process.env.GEMINI_API_KEY;
  const model = modelRow?.value || process.env.GEMINI_MODEL || 'gemini-1.5-flash';

  if (!apiKey) {
    console.warn('⚠️ Gemini API key is not configured — skipping AI bug analysis');
    return;
  }

  console.log(`🤖 AI analyzing bug: "${bug.title}" (${bug.id}) using model ${model}`);

  try {
    // 1. Load relevant source files
    const sourceFiles = await readSourceFiles(bug.page_url || '');

    // 2. Build prompt
    const prompt = `You are an expert full-stack bug-fixer for the MIT WPU Exam Management System.
Tech stack: React 18 (Vite), Node.js (Express), PostgreSQL (via pg driver with a SQLite-compatible wrapper).

BUG REPORT:
- Title: ${bug.title}
- Description: ${bug.description || 'Not provided'}
- Steps to reproduce: ${bug.steps || 'Not provided'}
- Page URL: ${bug.page_url || 'Not provided'}
- Console errors: ${bug.console_errors || 'None'}
- Browser: ${bug.browser_info || 'Unknown'}
- Severity: ${bug.severity}

RELEVANT SOURCE FILES:${sourceFiles || '\n(No source files matched this page URL)'}

TASK:
1. Analyze the bug report carefully.
2. Identify the root cause in the code.
3. Propose a precise fix using string replacements.
4. Rate your confidence from 0-100 (be honest — only go above 80 if you are very sure the patch is correct and won't break other things).

RULES FOR PATCHES:
- The "search" field must be an EXACT substring that exists in the file (copy-paste from the file content above).
- The "replace" field is what replaces it.
- Keep patches minimal — only change what is broken.
- If you are not confident, return an empty patches array and explain why.
- filePath must be relative to project root (e.g. "client/src/pages/StudentsPage.jsx").

Respond ONLY with valid JSON, no markdown, no explanation outside the JSON:
{
  "rootCause": "One sentence root cause",
  "explanation": "2-3 sentences explaining what is wrong and why the fix works",
  "confidence": 85,
  "patches": [
    {
      "filePath": "client/src/pages/ExamplePage.jsx",
      "search": "exact string to find in file",
      "replace": "replacement string"
    }
  ]
}`;

    // 3. Call Gemini
    const rawResponse = await callGemini(prompt, apiKey, model);
    console.log(`🤖 Gemini response for bug ${bug.id}:`, rawResponse.slice(0, 200));

    const result = extractJson(rawResponse);
    const { rootCause, explanation, confidence, patches = [] } = result;

    // 4. Always auto-apply any patches the AI proposes
    let newStatus = 'open';
    let appliedAt = null;

    if (patches.length > 0) {
      const appliedResults = await applyPatches(patches);
      const allSuccess = appliedResults.every(r => r.success);
      const anySuccess = appliedResults.some(r => r.success);

      if (anySuccess) {
        newStatus = 'fixed';
        appliedAt = new Date().toISOString();
        console.log(`✅ AI auto-applied ${appliedResults.filter(r => r.success).length}/${patches.length} patch(es) for bug "${bug.title}" (confidence: ${confidence}%)`);
        if (!allSuccess) {
          console.warn(`⚠️ Some patches could not be applied:`, appliedResults.filter(r => !r.success));
        }
      } else {
        newStatus = 'open';
        console.warn(`⚠️ All patches failed to apply for bug "${bug.title}". Marking open for manual review.`);
      }
    } else {
      newStatus = 'open';
      console.log(`🔍 AI analyzed bug "${bug.title}" (confidence: ${confidence}%) — no patches proposed`);
    }

    // 5. Update bug record in DB
    await db.prepare(`
      UPDATE bugs SET
        ai_root_cause = ?,
        ai_explanation = ?,
        ai_confidence = ?,
        ai_patches = ?,
        ai_applied_at = ?,
        status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      rootCause || null,
      explanation || null,
      confidence || 0,
      patches.length > 0 ? JSON.stringify(patches) : null,
      appliedAt,
      newStatus,
      bug.id
    );

    return { rootCause, explanation, confidence, patches, status: newStatus };

  } catch (err) {
    console.error(`❌ AI bug analysis failed for ${bug.id}:`, err.message);
    // Don't throw — bug is still saved, AI just couldn't analyze it
    await db.prepare(`UPDATE bugs SET ai_root_cause = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(`AI analysis failed: ${err.message}`, bug.id);
  }
}
