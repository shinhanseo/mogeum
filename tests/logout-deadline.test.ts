import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createClient } from '@supabase/supabase-js';
import { createLogoutFetch } from '../src/lib/logout-fetch';
import { createLogoutAction } from '../src/features/auth/logout';

const owner = '6613383b-02a1-496d-958f-116e3b72c4b2';
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = () => `${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:owner,exp:Math.floor(Date.now()/1000)+3600})}.cWE`;

test('real SDK logout is bounded while local session clears; a later login survives the aborted response', async () => {
  let hung: import('node:http').ServerResponse | null = null;
  const paths: string[] = [];
  const server = createServer((req,res) => {
    paths.push(req.url!);
    req.resume();
    req.on('end',()=>{
      if(req.url?.startsWith('/auth/v1/logout')) { hung=res; return; }
      res.setHeader('content-type','application/json');
      res.end(JSON.stringify({access_token:token(),refresh_token:'qa-refresh',expires_in:3600,token_type:'bearer',user:{id:owner,email:'qa@example.test'}}));
    });
  });
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  const address=server.address(); if(!address||typeof address==='string')throw Error('TCP address required');
  const url=`http://127.0.0.1:${address.port}`;
  const client=createClient(url,'qa-public-key',{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{fetch:createLogoutFetch(fetch,url,250)},
  });
  const events: string[]=[];
  const observer=client.auth.onAuthStateChange(event=>{events.push(event);});
  try {
    assert.equal((await client.auth.signInWithPassword({email:'qa@example.test',password:'qa'})).error,null);
    const logout=createLogoutAction(client);
    await assert.rejects(logout(owner),/SIGNOUT_FAILED/);
    assert.ok(paths.includes('/auth/v1/logout?scope=local'));
    assert.ok(events.includes('SIGNED_OUT'));
    assert.equal((await client.auth.getSession()).data.session,null);
    assert.equal((await client.auth.signInWithPassword({email:'qa@example.test',password:'qa'})).error,null);
    // The former server response can arrive after re-login; its aborted fetch cannot clear the new session.
    (hung as import('node:http').ServerResponse | null)?.end();
    await new Promise<void>(resolve=>setImmediate(resolve));
    assert.equal((await client.auth.getSession()).data.session?.user.id,owner);
  } finally {observer.data.subscription.unsubscribe();server.closeAllConnections();server.close();}
});

test('only the configured logout origin/path is bounded; other requests keep the original signal', async () => {
  const caller=new AbortController();
  const signals: (AbortSignal|null|undefined)[]=[];
  const capture=async (_input: Parameters<typeof fetch>[0],init?: RequestInit)=>{signals.push(init?.signal);return new Response(null,{status:204});};
  const wrapped=createLogoutFetch(capture,'https://qa.example.test',1000);
  await wrapped('https://qa.example.test/auth/v1/token',{signal:caller.signal});
  await wrapped('https://other.example.test/auth/v1/logout',{signal:caller.signal});
  await wrapped('https://qa.example.test/rest/v1/tasting_records',{signal:caller.signal});
  assert.deepEqual(signals,[caller.signal,caller.signal,caller.signal]);
  await wrapped('https://qa.example.test/auth/v1/logout?scope=local',{signal:caller.signal});
  assert.notEqual(signals[3],caller.signal);
  const stopped=new AbortController();stopped.abort();
  await assert.rejects(wrapped(new Request('https://qa.example.test/auth/v1/logout',{signal:stopped.signal})));
  assert.equal(signals.length,4);
});
