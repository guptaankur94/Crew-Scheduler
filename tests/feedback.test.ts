import { test } from 'node:test';
import assert from 'node:assert/strict';
import { feedbackText } from '../src/services/feedback';

test('feedback message carries versions and screen, and leaves room for the person to write', () => {
  const t = feedbackText({ screen: 'Duty', appVersion: '0.1.0', screensVersion: '38d12c6ef017', platform: 'ios', device: 'iPhone' });
  assert.match(t, /What happened, or what would help\?/);
  assert.match(t, /App 0\.1\.0 · screens 38d12c6ef017 · ios/);
  assert.match(t, /Screen: Duty/);
  assert.match(t, /no roster data/);
});
