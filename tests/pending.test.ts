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
