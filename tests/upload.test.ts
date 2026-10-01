import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUpload, extractJsonFromText } from '../server/upload';
import { createRateLimiter } from '../server/rateLimit';

test('strips data URL prefixes for images and PDFs', () => {
  assert.deepEqual(normalizeUpload('data:image/png;base64,QUJD', 'image/jpeg'), { data: 'QUJD', mimeType: 'image/png' });
  assert.deepEqual(normalizeUpload('data:application/pdf;base64,QUJD', 'image/png'), { data: 'QUJD', mimeType: 'application/pdf' });
  assert.deepEqual(normalizeUpload('QUJD\n', 'image/jpg'), { data: 'QUJD', mimeType: 'image/jpeg' });
});

test('rejects unsupported types and non-base64 payloads', () => {
  assert.equal(normalizeUpload('QUJD', 'text/html'), null);
  assert.equal(normalizeUpload('<script>', 'image/png'), null);
  assert.equal(normalizeUpload('', 'image/png'), null);
  assert.equal(normalizeUpload({ a: 1 }, 'image/png'), null);
});

test('extracts JSON from fenced, bare and messy model output', () => {
  assert.deepEqual(extractJsonFromText('Here:\n```json\n{"a": 1,}\n```'), { a: 1 });
  assert.deepEqual(extractJsonFromText('noise {"a": [1, 2,]} trailing'), { a: [1, 2] });
  assert.equal(extractJsonFromText('no json here'), null);
  assert.equal(extractJsonFromText(''), null);
});

test('rate limiter blocks after the limit and recovers in the next window', () => {
  let t = 0;
  const limiter = createRateLimiter(2, 1000, () => t);
  assert.equal(limiter.isAllowed('a'), true);
  assert.equal(limiter.isAllowed('a'), true);
  assert.equal(limiter.isAllowed('a'), false);
  assert.equal(limiter.isAllowed('b'), true);
  t = 1000;
  assert.equal(limiter.isAllowed('a'), true);
});
