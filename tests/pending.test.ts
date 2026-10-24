import assert from 'node:assert/strict';
import { test } from 'node:test';
import { submitPending, type PendingRecord, type SavePorts } from '../src/features/records/pending';
const draft: PendingRecord = { version:1, ownerId:'A', operationId:'fixed-operation', input:{ enteredName:'Synthetic wine' } };
const saved = { recordId:'record', cellarEntryId:'entry', revision:1, replayed:false };
function harness() {
  let owner: string | null = 'A'; let disk: PendingRecord | null = null; let saves = 0;
  const ports: SavePorts = { ownerId:()=>owner, read:async()=>disk, write:async value=>{disk=value;}, upload:async()=>{}, save:async()=>{saves++; return saved;} };
  return { ports, disk:()=>disk, saves:()=>saves, changeOwner:()=>{owner='B';} };
}
test('persists immutable operation before RPC; response loss reuses the same ID and input', async () => {
  const h=harness(); let first=true;
  h.ports.save=async(id,input)=>{assert.equal(id,draft.operationId);assert.deepEqual(input,draft.input);assert.equal(h.disk()?.operationId,id);if(first){first=false;throw Error('network');}return {...saved,replayed:true};};
  await assert.rejects(submitPending(draft,h.ports));
  assert.equal(h.disk()?.operationId,draft.operationId);
  assert.equal((await submitPending(h.disk()!,h.ports)).replayed,true);
  assert.equal(h.disk()?.saved?.recordId,'record');
});
test('different payload or operation cannot overwrite an uncertain save',async()=>{
  const h=harness();await h.ports.write(draft);
  await assert.rejects(submitPending({...draft,input:{enteredName:'changed'}},h.ports));
  await assert.rejects(submitPending({...draft,operationId:'other'},h.ports));
  assert.equal(h.saves(),0);
});
test('account change while uploading prevents record RPC',async()=>{
  const h=harness();h.ports.upload=async()=>{h.changeOwner();};
  await assert.rejects(submitPending({...draft,localPhoto:'local',input:{photo:{storagePath:'A/records/id/photo.jpg',width:1,height:1}}},h.ports));
  assert.equal(h.saves(),0);
});
test('saved receipt resumes cleanup without creating another experience',async()=>{
  const h=harness();const value={...draft,saved};await h.ports.write(value);
  assert.deepEqual(await submitPending(value,h.ports),saved);assert.equal(h.saves(),0);
});
test('repeat retry persists the same entry and cannot be redirected or detached',async()=>{
 const h=harness();const repeat={...draft,entryId:'entry-A'};let lost=true;
 h.ports.save=async(id,input,entryId)=>{assert.equal(entryId,'entry-A');assert.equal(h.disk()?.entryId,'entry-A');if(lost){lost=false;throw Error('lost response');}return {...saved,replayed:true};};
 await assert.rejects(submitPending(repeat,h.ports));
 await assert.rejects(submitPending({...repeat,entryId:'entry-B'},h.ports));
 await assert.rejects(submitPending({...repeat,entryId:undefined},h.ports));
 assert.equal((await submitPending(h.disk()!,h.ports)).replayed,true);
});
test('old new-drink pending records still submit a null entry',async()=>{
 const h=harness();h.ports.save=async(id,input,entryId)=>{assert.equal(entryId,null);return saved;};
 await submitPending(draft,h.ports);
});
test('a stale mounted draft reuses the durable receipt without overwriting it or uploading again',async()=>{
 const h=harness();const photoDraft={...draft,localPhoto:'synthetic-local',input:{photo:{storagePath:'A/records/fixed-operation/photo.jpg',width:1,height:1}}};
 const completed={...photoDraft,saved};await h.ports.write(completed);
 h.ports.upload=async()=>{throw Error('completed photo must not upload again');};
 h.ports.save=async()=>{throw Error('completed operation must not call RPC again');};
 let writes=0;h.ports.write=async()=>{writes++;throw Error('receipt must not be downgraded');};
 assert.deepEqual(await submitPending(photoDraft,h.ports),saved);
 assert.equal(writes,0);assert.deepEqual(h.disk(),completed);
 await assert.rejects(submitPending({...photoDraft,input:{enteredName:'changed'}},h.ports));
 assert.deepEqual(h.disk(),completed);
});
test('account changes during receipt lookup prevent even a completed result from escaping',async()=>{
 const h=harness();h.ports.read=async()=>{h.changeOwner();return {...draft,saved};};
 await assert.rejects(submitPending(draft,h.ports));assert.equal(h.saves(),0);
});
