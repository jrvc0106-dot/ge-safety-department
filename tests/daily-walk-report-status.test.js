import test from 'node:test';
import assert from 'node:assert/strict';
import { effectiveWalkStatus } from '../src/daily-walk-report-status.js';

test('open unsafe items cannot be shown as safe', () => {
  assert.equal(effectiveWalkStatus('safe', [{ status: 'unsafe' }]), 'unsafe');
});

test('an unsafe item with a correction is shown as needs attention', () => {
  assert.equal(effectiveWalkStatus('safe', [{ status: 'unsafe', correction: 'Fixed' }]), 'needs_attention');
});

test('pending checklist items cannot be shown as safe', () => {
  assert.equal(effectiveWalkStatus('safe', [{ status: 'safe' }, { status: null }]), 'needs_attention');
});

test('a selected unsafe status remains unsafe', () => {
  assert.equal(effectiveWalkStatus('unsafe', [{ status: 'safe' }]), 'unsafe');
});

test('safe and not applicable items may be shown as safe', () => {
  assert.equal(effectiveWalkStatus('safe', [{ status: 'safe' }, { status: 'na' }]), 'safe');
});
