import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readBackendConfig } from '../src/lib/env';

test('missing and placeholder settings keep the app in an explicit unconfigured state', () => {
  for (const [url, key] of [[undefined, undefined], ['https://YOUR_PROJECT.supabase.co', 'YOUR_PUBLISHABLE_KEY'], ['https://project.supabase.co', '']]) {
    assert.equal(readBackendConfig(url, key).configured, false);
  }
});
test('public endpoint permits HTTPS and local development HTTP', () => {
  for (const url of ['https://project.supabase.co', 'http://localhost:54321', 'http://127.0.0.1:54321']) assert.equal(readBackendConfig(url, 'sb_publishable_test').configured, true);
});
test('rejects unsafe endpoint and server secret configuration without echoing secrets', () => {
  for (const url of ['not-a-url', 'http://remote.example', 'https://user:password@example.com', 'https://example.com?token=secret']) assert.equal(readBackendConfig(url, 'sb_publishable_test').configured, false);
  for (const secret of ['sb_secret_private', 'ey.token.jwt']) {
    const result = readBackendConfig('https://project.supabase.co', secret);
    assert.equal(result.configured, false);
    assert.equal(JSON.stringify(result).includes(secret), false);
  }
});
