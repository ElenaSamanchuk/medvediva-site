import test from 'node:test';
import assert from 'node:assert/strict';
import {analyticsAllowed} from '../src/lib/analytics.mjs';

test('аналитика только на боевом домене', () => {
  assert.equal(analyticsAllowed('medvediva.ru'), true);
  assert.equal(analyticsAllowed('www.medvediva.ru'), true);
  assert.equal(analyticsAllowed('elenasamanchuk.github.io'), false);
  assert.equal(analyticsAllowed('127.0.0.1'), false);
  assert.equal(analyticsAllowed('localhost'), false);
});
