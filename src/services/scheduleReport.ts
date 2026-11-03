import type { PdfTextItem } from './pdfText';
import { standbyKindForCode, dayKindForCode } from './rosterCodes';

/*
 * IndiGo "Personal Crew Schedule Report" (InterGlobe Aviation, the PDF exported from the crew portal), read
 * exactly from the PDF's own text on the device: no AI, nothing sent anywhere.
 *
 * Layout: one row per date (Date, Duties, Details, Report times, Actual times/Delays, Debrief times, Indicators,
 * Crew). A flying day's sectors are printed one per line in a block, and the date, check-in and debrief sit on the
 * block's middle line, so some sectors are printed above their date and some below. Times are in base time
 * ("All times in Local Base"); "⁺¹" marks the next day. The crew lists, hotels and transfers are not read.
 *
 * The result is the same JSON the AI reader returns, so it goes through the same checks (sanitizeParsedRoster)
 * and the same "Check what was read" screen.
 */

const COLUMNS = ['Date', 'Duties', 'Details', 'Report times', 'Actual times/Delays', 'Debrief times', 'Indicators', 'Crew'] as const;
type Column = (typeof COLUMNS)[number];

/** Items on one line share a baseline; allow for rounding. */
const SAME_LINE = 1.5;
/** Sectors of one duty are printed on consecutive lines (about 10 pt apart); a larger gap starts another duty. */
const MAX_SECTOR_GAP = 14;
/** Distance between pages when the document is laid out as one long column. */
const PAGE_HEIGHT = 10000;

const DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})\b/;
const SECTOR_RE = /^([A-Z0-9]{0,2}\s?\d{1,4}[A-Z]?)\s*\[([A-Z0-9]{2,4})\]$/;
const ROUTE_RE = /^([A-Z]{3})\s*-\s*([A-Z]{3})$/;
const SUPERSCRIPT: Record<string, number> = { '¹': 1, '²': 2, '³': 3 };
const TIME_SRC = String.raw`(\d{1,2}):(\d{2})\s*(?:[⁺+]\s*([¹²³1-3]))?`;
const TIME_RE = new RegExp(`^${TIME_SRC}$`);
const RANGE_RE = new RegExp(`${TIME_SRC}\\s*-\\s*${TIME_SRC}`);

/** "20:00", "00:50⁺¹" → clock and days after the duty's date. */
interface DayTime {
  clock: string;
  plus: number;
}
const dayTime = (h: string, m: string, plus?: string): DayTime => ({
  clock: `${h.padStart(2, '0')}:${m}`,
  plus: plus ? SUPERSCRIPT[plus] ?? Number(plus) : 0,
});
function readTime(text: string | undefined): DayTime | null {
  const m = text?.match(TIME_RE);
  return m ? dayTime(m[1], m[2], m[3]) : null;
}
function readRange(text: string | undefined): { start: DayTime; end: DayTime } | null {
  const m = text?.match(RANGE_RE);
  return m ? { start: dayTime(m[1], m[2], m[3]), end: dayTime(m[4], m[5], m[6]) } : null;
}

const isoDate = (d: string, m: string, y: string) => `${y}-${m}-${d}`;
function addDays(date: string, days: number): string {
  if (!days) return date;
  const t = new Date(`${date}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}
const hoursToMinutes = (text: string | undefined): number | null => {
  const m = text?.match(/^(\d{1,4}):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const fmtHours = (minutes: number) => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;

interface Line {
  page: number;
  y: number;
  /** Position in the document as one long column: grows downwards, page after page. */
  pos: number;
  cells: Partial<Record<Column, string>>;
}

/** True when the PDF text is an IndiGo Personal Crew Schedule Report. */
export function isScheduleReport(items: PdfTextItem[]): boolean {
  const texts = new Set(items.map((i) => i.text));
  return texts.has('Personal Crew Schedule Report') && texts.has('Report times') && texts.has('Debrief times') && texts.has('Duties');
}

/** The schedule table's lines, each item put in the column whose heading it sits under (per page). */
function scheduleLines(items: PdfTextItem[]): Line[] {
  const lines: Line[] = [];
  const pages = [...new Set(items.map((i) => i.page))].sort((a, b) => a - b);
  let ended = false;
  for (const page of pages) {
    if (ended) break;
    const onPage = items.filter((i) => i.page === page);
    // Column headings on this page (pages after the table have none)
    const headingY = onPage.find((i) => i.text === 'Report times')?.y;
    if (headingY === undefined) break;
    const headings = COLUMNS.map((name) => ({ name, x: onPage.find((i) => i.text === name && Math.abs(i.y - headingY) < SAME_LINE)?.x }))
      .filter((h): h is { name: Column; x: number } => h.x !== undefined)
      .sort((a, b) => a.x - b.x);
    if (!headings.some((h) => h.name === 'Date')) continue;
    // The table ends at the totals, or at the page footer
    const totalsY = onPage.find((i) => i.text === 'Total Hours and Statistics')?.y;
    if (totalsY !== undefined) ended = true;
    const footerY = Math.max(-Infinity, ...onPage.filter((i) => /^Generated on |^Page \d+ of \d+$/.test(i.text)).map((i) => i.y));
    const bottom = Math.max(totalsY ?? -Infinity, footerY);

    const body = onPage.filter((i) => i.y < headingY - SAME_LINE && i.y > bottom + SAME_LINE).sort((a, b) => b.y - a.y || a.x - b.x);
    for (const item of body) {
      // A few points of slack: values sit slightly left of their heading
      const column = [...headings].reverse().find((h) => item.x >= h.x - 4)?.name ?? 'Date';
      let line = lines.find((l) => l.page === page && Math.abs(l.y - item.y) < SAME_LINE);
      if (!line) {
        line = { page, y: item.y, pos: page * PAGE_HEIGHT - item.y, cells: {} };
        lines.push(line);
      }
      line.cells[column] = line.cells[column] ? `${line.cells[column]} ${item.text}` : item.text;
    }
  }
  return lines.sort((a, b) => a.pos - b.pos);
}

interface DateRow {
  line: Line;
  date: string;
  code?: string;
  details?: string;
}
interface SectorLine {
  line: Line;
  flight: string;
  aircraft: string;
  origin: string;
  destination: string;
  dep: DayTime;
  arr: DayTime;
}

/** Off, leave, sick or training from the printed description, for codes not in the dictionary. */
function kindFromDetails(details: string | undefined): 'off' | 'leave' | 'sick' | 'training' | 'other' {
  const d = (details ?? '').toLowerCase();
  if (/\boff\b|rest day|day off/.test(d)) return 'off';
  if (/leave|holiday|vacation/.test(d)) return 'leave';
  if (/sick|medical leave|unfit/.test(d)) return 'sick';
  if (/training|simulator|course|class|check|recurrent|\bsep\b|\bcrm\b/.test(d)) return 'training';
  return 'other';
}

export interface ScheduleReportRead {
  /** The roster in the AI reader's JSON shape, for sanitizeParsedRoster. */
  raw: Record<string, unknown>;
  /** Anything worth checking on the review screen. */
  warnings: string[];
}

/**
 * Reads an IndiGo Personal Crew Schedule Report from its PDF text. Returns null when the text is not one, or no
 * dated rows could be read.
 */
export function readScheduleReport(items: PdfTextItem[]): ScheduleReportRead | null {
  if (!isScheduleReport(items)) return null;
  const warnings: string[] = [];
  const all = items.map((i) => i.text);

  const airline = all.some((t) => /InterGlobe|IndiGo/i.test(t)) ? 'IndiGo' : 'Airline';
  const periodMatch = all.map((t) => t.match(/(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(\d{2})\/(\d{2})\/(\d{4})/)).find(Boolean);
  const rosterPeriod = periodMatch
    ? { start: isoDate(periodMatch[1], periodMatch[2], periodMatch[3]), end: isoDate(periodMatch[4], periodMatch[5], periodMatch[6]) }
    : undefined;
  const clockNote = all.find((t) => /All times in/i.test(t)) ?? '';
  const timeConvention = /Local Base|\bbase\b/i.test(clockNote) ? 'home' : /UTC|GMT|\bZ\b/.test(clockNote) ? 'utc' : /local/i.test(clockNote) ? 'local' : 'unknown';
  // "61442 Name, Given BLR-LD-320": staff number, name, base-rank-fleet
  const crewHeader = all.map((t) => t.match(/^(\d{3,7})\s+.+\s([A-Z]{3})-[A-Z]{1,3}-[A-Z0-9]+$/)).find(Boolean);
  const staffNumber = crewHeader?.[1];
  const homeBase = crewHeader?.[2] ?? '';

  const lines = scheduleLines(items);
  const dateRows: DateRow[] = [];
  const sectors: SectorLine[] = [];
  for (const line of lines) {
    const dm = line.cells.Date?.match(DATE_RE);
    const sm = line.cells.Duties?.match(SECTOR_RE);
    const route = line.cells.Details?.match(ROUTE_RE);
    const times = readRange(line.cells['Actual times/Delays']);
    if (sm && route && times) {
      sectors.push({ line, flight: sm[1].replace(/\s+/g, ' '), aircraft: sm[2], origin: route[1], destination: route[2], dep: times.start, arr: times.end });
    } else if (sm || route) {
      warnings.push(`A sector line (${[line.cells.Duties, line.cells.Details].filter(Boolean).join(' ')}) could not be read completely and was left out.`);
    }
    if (dm) {
      dateRows.push({ line, date: isoDate(dm[1], dm[2], dm[3]), code: sm ? undefined : line.cells.Duties, details: sm ? undefined : line.cells.Details });
    }
  }
  if (!dateRows.length) return null;

  // Sectors on consecutive lines belong to one duty; the duty's date row lies within its block
  const blocks: SectorLine[][] = [];
  for (const s of sectors) {
    const block = blocks[blocks.length - 1];
    if (block && s.line.pos - block[block.length - 1].line.pos <= MAX_SECTOR_GAP) block.push(s);
    else blocks.push([s]);
  }
  const used = new Set<DateRow>();
  const duties: { row: DateRow; sectors: SectorLine[] }[] = [];
  for (const block of blocks) {
    const top = block[0].line.pos - SAME_LINE;
    const bottom = block[block.length - 1].line.pos + SAME_LINE;
    const middle = (top + bottom) / 2;
    const byDistance = (a: DateRow, b: DateRow) => Math.abs(a.line.pos - middle) - Math.abs(b.line.pos - middle);
    let row = dateRows.filter((r) => !used.has(r) && r.line.pos >= top && r.line.pos <= bottom).sort(byDistance)[0];
    if (!row) {
      // Not inside its block (e.g. split by a page break): the nearest unused flying day's row
      row = dateRows.filter((r) => !used.has(r) && readTime(r.line.cells['Report times'])).sort(byDistance)[0];
      if (!row) {
        warnings.push(`Flights ${block.map((s) => s.flight).join(', ')} could not be matched to a date and were left out.`);
        continue;
      }
      warnings.push(`Flights ${block.map((s) => s.flight).join(', ')} were matched to ${row.date}; please check that day.`);
    }
    used.add(row);
    duties.push({ row, sectors: block });
  }

  // The crew member's own line in a duty's crew list says DHT when they travel as a passenger on it
  const crewLines = lines.filter((l) => l.cells.Crew);
  const positioningDuties = new Set<DateRow>();
  if (staffNumber) {
    for (const l of crewLines) {
      if (!new RegExp(`\\bDHT\\b.*\\b${staffNumber}\\b`).test(l.cells.Crew!)) continue;
      const nearest = [...duties].sort((a, b) => Math.abs(a.row.line.pos - l.pos) - Math.abs(b.row.line.pos - l.pos))[0];
      if (nearest) positioningDuties.add(nearest.row);
    }
  }

  const flights: Record<string, unknown>[] = [];
  for (const { row, sectors: block } of duties) {
    const report = readTime(row.line.cells['Report times']);
    const debrief = readTime(row.line.cells['Debrief times']);
    const positioning = positioningDuties.has(row);
    if (positioning) warnings.push(`${row.date}: the crew list shows you as DHT (positioning). Check which sectors you travel as a passenger.`);
    block.forEach((s, i) => {
      const date = addDays(row.date, s.dep.plus);
      const arrDate = addDays(row.date, Math.max(s.arr.plus, s.dep.plus));
      const isIndigo = airline === 'IndiGo';
      flights.push({
        flightNumber: isIndigo && /^\d+[A-Z]?$/.test(s.flight) ? `6E ${s.flight}` : s.flight,
        origin: s.origin,
        destination: s.destination,
        date,
        depTime: s.dep.clock,
        arrTime: s.arr.clock,
        arrDate: arrDate > date ? arrDate : '',
        reportTime: i === 0 && report ? report.clock : '',
        releaseTime: i === block.length - 1 && debrief ? debrief.clock : '',
        aircraftType: isIndigo && /^3\d\d$/.test(s.aircraft) ? `A${s.aircraft}` : s.aircraft,
        isPositioning: positioning,
      });
    });
  }

  // Days without flying: standby (with its times) or a day code
  const standby: Record<string, unknown>[] = [];
  const otherDuties: Record<string, unknown>[] = [];
  for (const row of dateRows) {
    if (used.has(row) || !row.code) continue;
    const code = row.code.trim();
    const details = row.details ?? '';
    const sbKind = standbyKindForCode(code) ?? (/stand\s?by|reserve/i.test(details) ? (/airport/i.test(details) ? 'airport' : 'home') : undefined);
    if (sbKind) {
      const range = readRange(row.line.cells['Actual times/Delays']) ?? readRange(row.line.cells['Report times']);
      if (!range) {
        warnings.push(`${row.date}: standby (${code}) has no readable times and was left out.`);
        continue;
      }
      standby.push({
        type: sbKind,
        code,
        airport: homeBase,
        date: addDays(row.date, range.start.plus),
        startTime: range.start.clock,
        endTime: range.end.clock,
        ...(range.end.plus > range.start.plus ? { endDate: addDays(row.date, range.end.plus) } : {}),
      });
      continue;
    }
    otherDuties.push({ type: dayKindForCode(code) ?? kindFromDetails(details), date: row.date, code });
  }

  // The report's own totals: a check that every sector was read
  const totals = readTotals(items);
  const blockMinutes = flights.length
    ? duties.flatMap((d) => d.sectors).reduce((sum, s) => {
        const [dh, dm] = s.dep.clock.split(':').map(Number);
        const [ah, am] = s.arr.clock.split(':').map(Number);
        return sum + (ah * 60 + am + s.arr.plus * 1440) - (dh * 60 + dm + s.dep.plus * 1440);
      }, 0)
    : 0;
  if (totals.landings !== null && totals.landings !== flights.length) {
    warnings.push(`The report counts ${totals.landings} landings but ${flights.length} sectors were read. Please check every flying day.`);
  }
  if (totals.blockMinutes !== null && totals.blockMinutes !== blockMinutes) {
    warnings.push(`The report's block hours are ${fmtHours(totals.blockMinutes)} but the sectors read add up to ${fmtHours(blockMinutes)}. Please check every flying day.`);
  }

  return {
    raw: {
      airline,
      homeBase,
      flights,
      standby,
      otherDuties,
      ...(rosterPeriod ? { rosterPeriod } : {}),
      visibleDates: [...new Set(dateRows.map((r) => r.date))].sort(),
      timeConvention,
      notes: `Read on this device from the ${airline === 'IndiGo' ? 'IndiGo ' : ''}Personal Crew Schedule Report: ${flights.length} sectors, ${standby.length} standby, ${otherDuties.length} other days.`,
    },
    warnings,
  };
}

/** "Block Hours" and "Landings" from the report's totals table, when printed. */
function readTotals(items: PdfTextItem[]): { blockMinutes: number | null; landings: number | null } {
  const valueBelow = (label: string): string | undefined => {
    const head = items.find((i) => i.text === label);
    if (!head) return undefined;
    return items
      .filter((i) => i.page === head.page && i.y < head.y - SAME_LINE && head.y - i.y < 40 && Math.abs(i.x - head.x) < 30)
      .sort((a, b) => b.y - a.y)[0]?.text;
  };
  const landings = valueBelow('Landings');
  return {
    blockMinutes: hoursToMinutes(valueBelow('Block Hours')),
    landings: landings && /^\d+$/.test(landings) ? Number(landings) : null,
  };
}
