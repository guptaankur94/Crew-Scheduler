/**
 * Measures how accurately rosters are read. Needs the app server running with a Gemini key (npm run dev).
 *
 *   reading-eval/cases/<name>/roster.png (or .jpg, .pdf, .txt)   the roster, with names removed
 *   reading-eval/cases/<name>/expected.json                     { "convention": "local", "homeBase": "BLR", "flights": [...] }
 *
 *   npm run eval:reading                 reads every case and writes reading-eval/report.md
 *   npm run eval:reading -- --draft      also writes expected.draft.json for cases without expected.json,
 *                                        from what was read, to correct by hand against the roster
 *
 * The reading-eval folder is kept out of Git: rosters are personal data.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, extname } from 'path';
import { compareReading, overallAccuracy, CaseResult, ExpectedFlight, ReadFlight } from '../src/services/readingEval';

const ROOT = 'reading-eval/cases';
const SERVER = process.env.EVAL_SERVER ?? 'http://localhost:3000';
const draft = process.argv.includes('--draft');
const TYPES: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.pdf': 'application/pdf' };

if (!existsSync(ROOT)) {
  console.log(`Put each roster in ${ROOT}/<name>/ (see the comment at the top of scripts/reading-eval.ts).`);
  process.exit(0);
}

const rows: string[] = [];
const results: CaseResult[] = [];
for (const name of readdirSync(ROOT).sort()) {
  const dir = join(ROOT, name);
  const file = readdirSync(dir).find((f) => f.startsWith('roster.'));
  if (!file) continue;
  const expectedPath = join(dir, 'expected.json');
  const meta = existsSync(expectedPath) ? JSON.parse(readFileSync(expectedPath, 'utf8')) : {};
  const ext = extname(file).toLowerCase();
  const body =
    ext === '.txt'
      ? { rawText: readFileSync(join(dir, file), 'utf8') }
      : { imageBase64: readFileSync(join(dir, file)).toString('base64'), mimeType: TYPES[ext] ?? 'image/png' };
  const res = await fetch(`${SERVER}/api/roster/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, timeConvention: meta.convention ?? 'local', homeBase: meta.homeBase }),
  });
  const json = await res.json();
  if (!json.success) {
    rows.push(`| ${name} | could not read: ${json.error ?? res.status} | | | |`);
    continue;
  }
  const read: ReadFlight[] = json.data.flights ?? [];
  if (!existsSync(expectedPath)) {
    if (draft) {
      const flights: ExpectedFlight[] = read.map((f) => ({ date: f.printed?.date ?? '', flightNumber: f.flightNumber, origin: f.origin, destination: f.destination, dep: f.printed?.dep ?? '', arr: f.printed?.arr ?? '' }));
      writeFileSync(join(dir, 'expected.draft.json'), JSON.stringify({ convention: 'local', homeBase: json.data.homeBase, flights }, null, 1));
      rows.push(`| ${name} | draft written: check it against the roster, then rename to expected.json | | | |`);
    } else rows.push(`| ${name} | no expected.json yet (run with --draft) | | | |`);
    continue;
  }
  const r = compareReading(meta.flights, read);
  results.push(r);
  const issues = [...r.missing.map((m) => `missing ${m}`), ...r.extra.map((x) => `extra ${x}`), ...r.wrong.map((w) => `${w.flight}: ${w.fields.join(', ')}`)];
  rows.push(`| ${name} | ${r.exact}/${r.expected} exact | ${r.missing.length} | ${r.extra.length} | ${issues.join('; ') || '—'} |`);
}

const report = [
  '# Roster reading accuracy',
  '',
  `Run ${new Date().toISOString().slice(0, 16).replace('T', ' ')} against ${SERVER}. Overall: **${Math.round(overallAccuracy(results) * 1000) / 10}%** of flights read exactly right (${results.length} rosters).`,
  '',
  '| Roster | Exact | Missing | Extra | Problems |',
  '|---|---|---|---|---|',
  ...rows,
  '',
].join('\n');
writeFileSync('reading-eval/report.md', report);
console.log(report);
