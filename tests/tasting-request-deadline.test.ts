import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createClient } from '@supabase/supabase-js';
import { tastingRepository } from '../src/features/tasting/repository';
import { newTastingDraft, setAnswer } from '../src/features/tasting/draft';

async function serverFixture() {
  let stall = true;
  const payloads: unknown[] = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      if (req.method === 'POST') payloads.push(JSON.parse(body));
      res.setHeader('content-type', 'application/json');
      if (stall) { res.writeHead(200); res.flushHeaders(); res.write(' '); return; }
      res.end(JSON.stringify(req.method === 'POST'
        ? { recordId: 'qa-record', revision: 2, replayed: true }
        : { id: 'qa-record', category: 'whisky', revision: 1, entered_name: 'QA' }));
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('Expected TCP address');
  const client = createClient(`http://127.0.0.1:${address.port}`, 'qa-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return { repository: tastingRepository(client, 250), payloads,
    recover: () => { stall = false; },
    close: () => { server.closeAllConnections(); server.close(); },
  };
}

test('note context stops when response body stalls and can be fetched after recovery', async () => {
  const fixture = await serverFixture();
  try {
    await assert.rejects(fixture.repository.context('qa-record'));
    fixture.recover();
    assert.equal((await fixture.repository.context('qa-record')).category, 'whisky');
  } finally { fixture.close(); }
});

test('note response loss preserves serialized observations and operation ID for retry', async () => {
  const fixture = await serverFixture();
  const draft = setAnswer(newTastingDraft('qa-owner', 'qa-record', 'whisky', 'light'), 'nose', {
    status: 'answered', descriptors: ['fruit'], intensity: null, freeText: '',
  });
  const before = JSON.stringify(draft);
  const operation = 'c96b1532-5328-424b-b561-bd1bbd5a3ab5';
  try {
    await assert.rejects(fixture.repository.save(draft, operation, 1, '과일 향.', false));
    assert.equal(JSON.stringify(draft), before);
    fixture.recover();
    const result = await fixture.repository.save(draft, operation, 1, '과일 향.', false);
    assert.equal(result.replayed, true);
    assert.equal(fixture.payloads.length, 2);
    assert.deepEqual(fixture.payloads[0], fixture.payloads[1]);
  } finally { fixture.close(); }
});
