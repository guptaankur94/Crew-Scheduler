/**
 * Writes docs/RULE_BOOK.md from the rules the app actually uses (CITATIONS in src/services/circadianCalculator.ts), for review by a sleep physician. Run: npm run rulebook
 */
import { writeFileSync } from 'fs';
import { CITATIONS } from '../src/services/circadianCalculator';
import type { ScientificCitation } from '../src/types/circadian';
import { ALCOHOL_BEFORE_DUTY_HOURS, CAFFEINE_HOURS, DAYTIME_SLEEP_EXTRA_HOURS, EXERCISE_BEFORE_SLEEP_HOURS } from '../src/services/planEngine';

const rules: ScientificCitation[] = [...Object.values(CITATIONS)].sort((a, b) => a.ruleId.localeCompare(b.ruleId));
const cell = (t = '') => t.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const lines = [
  '# CrewCircadian rule book',
  '',
  'Every piece of advice in the app comes from one of these rules. This file is generated from the code (`npm run rulebook`), so it always matches what the app says. **Status: awaiting review by a sleep physician.**',
  '',
  'Evidence grades: **strong** (consistent trials or reviews), **moderate** (some trials or expert guidance), **limited** (early or mixed; shown as a gentle guide), **practical** (arithmetic on the roster and settings), **regulation** (a legal rule, not a health claim).',
  '',
  '## Numbers the engine uses',
  '',
  `- Caffeine cut-off before sleep, by usual amount: one coffee or a few chai ${CAFFEINE_HOURS.light} h, two coffees ${CAFFEINE_HOURS.moderate} h, three or more / energy drinks ${CAFFEINE_HOURS.strong} h; plus ${DAYTIME_SLEEP_EXTRA_HOURS} h before a daytime sleep (our margin).`,
  `- Hard exercise: finish ${EXERCISE_BEFORE_SLEEP_HOURS} h before a night's sleep (not shown before sleep after a night duty).`,
  `- Alcohol: none in the ${ALCOHOL_BEFORE_DUTY_HOURS} h before check-in or a home standby.`,
  '',
  '## Rules',
  '',
  '| Rule | Evidence | Source | What it says | Why | What to do | Link |',
  '|---|---|---|---|---|---|---|',
  ...rules.map((r) => `| ${r.ruleId} | ${r.evidence} | ${cell(r.studyTitle)} | ${cell(r.keyFinding)} | ${cell(r.explanation)} | ${cell(r.actionableTip)} | ${r.sourceUrl ? `[source](${r.sourceUrl})` : '—'} |`),
  '',
  '## Reviewer sign-off',
  '',
  '| Reviewer | Role | Date | Rules reviewed | Notes |',
  '|---|---|---|---|---|',
  '| | | | | |',
  '',
];
writeFileSync('docs/RULE_BOOK.md', lines.join('\n'));
console.log(`Wrote docs/RULE_BOOK.md (${rules.length} rules)`);
