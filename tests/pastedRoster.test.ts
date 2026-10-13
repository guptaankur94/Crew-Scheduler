import { test } from 'node:test';
import assert from 'node:assert/strict';
import { looksLikeAiAnswer, readAiAnswer } from '../src/services/pastedRoster';
import { ownAiPrompt, rosterInstructions } from '../src/services/rosterPrompt';

/* "Read with your own AI app": an answer pasted from ChatGPT/Claude/Gemini is read on the device, with the server's checks. */

const answer = `Sure! Here is your roster:

\`\`\`json
{
  "airline": "IndiGo",
  "homeBase": "BLR",
  "homeBaseTzOffset": 5.5,
  "flights": [
    { "flightNumber": "6E 6168", "origin": "BLR", "destination": "GOI", "date": "2026-10-12", "depTime": "16:15", "arrTime": "17:30", "depKind": "scheduled", "arrKind": "scheduled", "arrDate": "", "reportTime": "", "releaseTime": "", "aircraftType": "A320", "isRedEye": false, "isPositioning": false },
    { "flightNumber": "6E 1486", "origin": "DXB", "destination": "BLR", "date": "2026-10-02", "depTime": "00:07", "arrTime": "05:20", "depKind": "actual", "arrKind": "actual", "arrDate": "", "reportTime": "", "releaseTime": "", "aircraftType": "A321", "isRedEye": true, "isPositioning": false },
  ],
  "standby": [],
  "otherDuties": [{ "type": "off", "date": "2026-10-11", "code": "OFF" }],
  "timeConvention": "local",
  "notes": ""
}
\`\`\`
Let me know if you need anything else.`;

test('an AI app answer wrapped in chat and a json block is read on the device, with the same checks as the server', () => {
  assert.ok(looksLikeAiAnswer(answer));
  const read = readAiAnswer(answer, { timeConvention: 'local', homeBase: 'BLR' }, new Date('2026-10-13T00:00:00Z'));
  assert.ok(read.success);
  if (!read.success) return;
  assert.equal(read.data.flights.length, 2, 'trailing comma tolerated');
  const dxb = read.data.flights.find((f) => f.flightNumber === '6E 1486')!;
  assert.equal(dxb.departureTimeUtc, '2026-10-01T20:07:00.000Z', '00:07 Dubai time on 2 Oct');
  assert.deepEqual(dxb.timeKinds, { dep: 'actual', arr: 'actual' });
  assert.equal(read.data.otherDuties?.[0].kind, 'off');
});

test('plain roster lines are not mistaken for an AI answer (they go to the server reader)', () => {
  assert.equal(looksLikeAiAnswer('01 OCT 6E 205 DEL 06:30 BOM 08:45'), false);
});

test('a reply with no data, or with no complete flights, says what to do', () => {
  const none = readAiAnswer('I could not see any attachment.');
  assert.equal(none.success, false);
  if (!none.success) assert.match(none.error, /Paste the whole reply/);
  const empty = readAiAnswer('{"flights": [{"flightNumber": "6E 1"}]}');
  assert.equal(empty.success, false);
  if (!empty.success) assert.match(empty.error, /no complete flights/);
});

test('the prompt to copy is the server prompt plus an instruction to read every attachment', () => {
  const p = ownAiPrompt('2026-10-13');
  assert.ok(p.startsWith(rosterInstructions('2026-10-13').trim()));
  assert.match(p, /Today's date is 2026-10-13/);
  assert.match(p, /"date" is always the DEPARTURE date/);
  assert.match(p, /Read every roster screenshot/);
});
