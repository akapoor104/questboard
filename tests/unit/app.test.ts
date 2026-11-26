import { test } from 'node:test';
import assert from 'node:assert/strict';
import { errorCode, errorText, isLocked } from '../../src/app/errors.ts';
import { ApiError } from '../../src/api/types.ts';
import { QbError } from '../../src/api/memoryBackend.ts';

test('errorText: a sentence for backend errors from either backend, never a raw message', () => {
  assert.equal(errorText(new QbError('past_date')), 'Pick today or a later day.');          // demo backend
  assert.equal(errorText(new ApiError('network', 'TypeError: Failed to fetch')), 'No connection. Check the internet and try again.');
  assert.equal(errorText({ message: 'QB:open_cards', code: 'P0001' }), 'Some cards for that day still need a percent.');   // Supabase error object
  assert.equal(errorText(new Error('permission denied for table cards')), 'Something went wrong. Try again.');
  assert.equal(errorText(new QbError('no_such_function')), 'Something went wrong. Try again.');
  assert.equal(errorText(undefined), 'Something went wrong. Try again.');
  assert.equal(errorCode(new QbError('locked')), 'locked');
  assert.equal(isLocked(new QbError('locked')), true);
  assert.equal(isLocked(new QbError('not_allowed')), false);
});
