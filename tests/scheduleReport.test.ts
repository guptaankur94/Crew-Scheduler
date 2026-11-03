import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { PdfTextItem } from '../src/services/pdfText';
import { isScheduleReport, readScheduleReport } from '../src/services/scheduleReport';
import { sanitizeParsedRoster } from '../server/rosterSanitizer';

/*
 * IndiGo "Personal Crew Schedule Report" PDF, read on the device from the PDF's own text. The fixture is the text
 * (with positions) of a real November 2026 report; names, staff numbers, flight numbers and phone numbers are
 * replaced with made-up ones and the training expiry table is left out.
 */

const items: PdfTextItem[] = JSON.parse(readFileSync(new URL('./fixtures/schedule-report-nov-2026.json', import.meta.url), 'utf8'));
const now = new Date('2026-11-03T09:00:00Z');

type RawFlight = Record<string, string | boolean>;
const read = () => {
  const r = readScheduleReport(items);
  assert.ok(r);
  return { ...r, raw: r.raw as { flights: RawFlight[]; standby: Record<string, string>[]; otherDuties: Record<string, string>[]; [k: string]: unknown } };
};
const flightsOn = (flights: RawFlight[], date: string) => flights.filter((f) => f.date === date).map((f) => f.flightNumber);

test('the report is recognised; other PDFs are not', () => {
  assert.ok(isScheduleReport(items));
  assert.equal(readScheduleReport([{ page: 1, x: 10, y: 10, text: 'Some other document' }]), null);
});

test('header: IndiGo, BLR base, the November period and base time ("All times in Local Base")', () => {
  const { raw } = read();
  assert.equal(raw.airline, 'IndiGo');
  assert.equal(raw.homeBase, 'BLR');
  assert.deepEqual(raw.rosterPeriod, { start: '2026-11-01', end: '2026-11-30' });
  assert.equal(raw.timeConvention, 'home');
});

test('every sector is read and the totals agree with the report (26 landings, 50:45 block)', () => {
  const { raw, warnings } = read();
  assert.equal(raw.flights.length, 26);
  assert.deepEqual(warnings, []);
});

test('sectors printed above and below their date row belong to that date, not the standby day before it', () => {
  const { raw } = read();
  // 14 Nov is a home standby; the 15 Nov duty's first two sectors are printed above the 15 Nov row
  assert.deepEqual(flightsOn(raw.flights, '2026-11-14'), []);
  assert.equal(flightsOn(raw.flights, '2026-11-15').length, 4);
  // 7 Nov is an airport standby followed by the 8 Nov four-sector day
  assert.deepEqual(flightsOn(raw.flights, '2026-11-07'), []);
  assert.equal(flightsOn(raw.flights, '2026-11-08').length, 4);
  // 22 Nov: the date row shares its line with the middle sector
  const day22 = raw.flights.filter((f) => f.date === '2026-11-22');
  assert.deepEqual(day22.map((f) => `${f.origin}-${f.destination}`), ['BLR-BOM', 'BOM-BLR', 'BLR-BOM']);
});

test('check-in on the first sector and debrief on the last; flight numbers and aircraft as IndiGo prints them', () => {
  const { raw } = read();
  const day = raw.flights.filter((f) => f.date === '2026-11-12');
  assert.deepEqual(day.map((f) => [f.reportTime, f.releaseTime]), [['15:30', ''], ['', ''], ['', ''], ['', '23:35']]);
  assert.match(String(day[0].flightNumber), /^6E \d+$/);
  assert.equal(day[0].aircraftType, 'A321');
  assert.ok(raw.flights.every((f) => f.isPositioning === false));
});

test('"⁺¹" times: an overnight turnaround lands and departs on the next day', () => {
  const { raw } = read();
  const [out, back] = raw.flights.filter((f) => f.origin === 'BLR' && f.destination === 'SIN' || f.origin === 'SIN');
  assert.deepEqual([out.date, out.depTime, out.arrTime, out.arrDate, out.reportTime], ['2026-11-19', '20:00', '00:50', '2026-11-20', '18:45']);
  assert.deepEqual([back.date, back.depTime, back.arrTime, back.arrDate, back.releaseTime], ['2026-11-20', '01:50', '06:30', '', '07:00']);
});

test('standby codes give home or airport standby with their times; day codes give leave and days off', () => {
  const { raw } = read();
  assert.deepEqual(
    raw.standby.map((s) => `${s.date} ${s.code} ${s.type} ${s.startTime}-${s.endTime}`),
    [
      '2026-11-05 ASBD airport 03:35-10:35',
      '2026-11-06 SBYP home 05:05-13:05',
      '2026-11-07 ASBD airport 08:05-14:05',
      '2026-11-11 ASBI airport 05:05-12:05',
      '2026-11-14 SBY home 04:05-09:10',
      '2026-11-21 SBY home 08:05-13:10',
      '2026-11-26 SBY home 04:05-09:10',
    ]
  );
  assert.deepEqual(
    raw.otherDuties.map((d) => `${d.date} ${d.code} ${d.type}`),
    [
      '2026-11-01 PL leave', '2026-11-02 PL leave', '2026-11-03 PL leave', '2026-11-04 ROFF off',
      '2026-11-09 OFG off', '2026-11-16 OFG off', '2026-11-17 OFG off', '2026-11-24 OFG off', '2026-11-27 OFG off',
    ]
  );
  // Dates with no row (e.g. 10 Nov) are not claimed as shown
  assert.ok(!(raw.visibleDates as string[]).includes('2026-11-10'));
  assert.equal((raw.visibleDates as string[]).length, 25);
});

test('the result passes the usual checks and converts base time (IST) to the right instants, wherever the flight lands', () => {
  const { raw } = read();
  const roster = sanitizeParsedRoster(raw, now);
  assert.ok(roster);
  assert.equal(roster.flights.length, 26);
  assert.equal(roster.standby.length, 7);
  assert.equal(roster.otherDuties.length, 9);
  assert.equal(roster.timeConvention, 'home');
  assert.ok(roster.timeConventionStated);
  assert.deepEqual(roster.warnings, []);
  // Mauritius: printed 04:05-10:00 in base time (IST) is 22:35-04:30 UTC
  const mru = roster.flights.find((f) => f.destination === 'MRU')!;
  assert.equal(mru.departureTimeUtc, '2026-11-28T22:35:00.000Z');
  assert.equal(mru.arrivalTimeUtc, '2026-11-29T04:30:00.000Z');
  assert.equal(mru.reportTimeUtc, '2026-11-28T21:20:00.000Z');
  // Singapore return: debrief 07:00⁺¹ IST
  const sin = roster.flights.find((f) => f.origin === 'SIN')!;
  assert.equal(sin.releaseTimeUtc, '2026-11-20T01:30:00.000Z');
});

test('a sector missing from the text is reported against the totals', () => {
  const sector = items.find((i) => /^\d+ \[321\]$/.test(i.text))!;
  const r = readScheduleReport(items.filter((i) => !(i.page === sector.page && i.y === sector.y && i.x < 600)));
  assert.ok(r);
  assert.equal(r.warnings.length, 2);
  assert.match(r.warnings[0], /counts 26 landings but 25 sectors/);
  assert.match(r.warnings[1], /block hours are 50:45/);
});

test('the crew member listed as DHT on a duty: its sectors are positioning, with a note to check', () => {
  const own = items.find((i) => /^LD - 10001 - /.test(i.text))!;
  const r = readScheduleReport(items.map((i) => (i === own ? { ...i, text: i.text.replace('LD - ', 'LD - DHT - ') } : i)));
  assert.ok(r);
  const positioning = (r.raw.flights as RawFlight[]).filter((f) => f.isPositioning);
  assert.ok(positioning.length > 0);
  assert.ok(positioning.every((f) => f.date === positioning[0].date));
  assert.match(r.warnings[0], /DHT/);
});
