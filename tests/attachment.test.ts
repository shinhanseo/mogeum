import test from 'node:test';
import assert from 'node:assert/strict';
import { submitAttachment,decodePendingAttachment,type PendingAttachment,type AttachmentPorts } from '../src/features/records/attachment';
const owner='10000000-0000-4000-8000-000000000001';const operation='20000000-0000-4000-8000-000000000001';
const value:PendingAttachment={version:1,owner,recordId:'record',operationId:operation,expectedRevision:4,change:{kind:'split',name:null}};
const result={recordId:'record',cellarEntryId:'new',revision:5,replayed:true};
function harness(){let disk:PendingAttachment|null=null;let user:string|null=owner;const p:AttachmentPorts={owner:()=>user,read:async()=>disk,write:async v=>{disk=v;},upload:async()=>{},apply:async()=>result};return {p,disk:()=>disk,switch:()=>{user=null;}};}
test('attachment request survives response loss and does not accept a different destination',async()=>{
 const h=harness();let first=true;h.p.apply=async v=>{assert.deepEqual(h.disk(),v);if(first){first=false;throw Error('lost');}return result;};
 await assert.rejects(submitAttachment(value,h.p));await assert.rejects(submitAttachment({...value,change:{kind:'split',name:'Other'}},h.p));
 assert.deepEqual(await submitAttachment(h.disk()!,h.p),result);assert.deepEqual(h.disk()?.result,result);
});
test('upload account switch stops mutation; saved receipt retries never upload again',async()=>{
 const h=harness();let calls=0;h.p.apply=async()=>{calls++;return result;};h.p.upload=async()=>h.switch();
 await assert.rejects(submitAttachment({...value,change:{kind:'photo',storagePath:`${owner}/records/${operation}/photo.jpg`,width:900,height:1200},localPhoto:'file://photo'},h.p));assert.equal(calls,0);
 const next=harness();next.p.upload=async()=>{throw Error('should not upload');};assert.deepEqual(await submitAttachment({...value,result},next.p),result);
});
test('restoration rejects foreign owners, corrupt dimensions and unknown mutation kinds',()=>{
 const good={...value,change:{kind:'photo',storagePath:`${owner}/records/${operation}/photo.jpg`,width:900,height:1200},localPhoto:'file://photo'};
 assert.equal(decodePendingAttachment(JSON.stringify(good),owner,'record').change.kind,'photo');
 assert.throws(()=>decodePendingAttachment(JSON.stringify(good),'other','record'));
 assert.throws(()=>decodePendingAttachment(JSON.stringify({...good,change:{...good.change,width:0}}),owner,'record'));
 assert.throws(()=>decodePendingAttachment(JSON.stringify({...value,change:{kind:'delete'}}),owner,'record'));
});
