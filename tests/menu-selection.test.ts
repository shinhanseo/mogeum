import test from "node:test";
import assert from "node:assert/strict";
import {menuSelectionCandidates, validateMenuSelection, orderSelectedMenu, runMenuSelection, MENU_SELECTION_VERSION, type MenuSelection} from "../supabase/functions/_shared/menu-selection";
import type {MenuRecommendation} from "../supabase/functions/_shared/menu-domain";
const a:MenuRecommendation={itemId:"menu-a",productId:"verified-a",status:"similar",similar:[{factId:"향:과일",label:"과일",recordIds:["private-id"],negativeIds:[]}],other:[],knownRecordIds:[],score:1};
const b={...a,itemId:"menu-b",productId:"verified-b"};
const unknown={...a,itemId:"unknown",productId:null,status:"unverified" as const,score:0,similar:[]};
const selection: MenuSelection={version:MENU_SELECTION_VERSION,itemIds:[b.itemId]};
test("menu selection rejects invented, unsupported and repeated IDs, preserving all factual rows",()=>{
 const rows=[a,unknown,b];assert.deepEqual(menuSelectionCandidates(rows),[a,b]);
 const ranked=orderSelectedMenu(rows,selection);assert.deepEqual(ranked,[b,a,unknown]);assert.equal(ranked[0],b);
 for(const itemIds of [["invented"],["unknown"],[a.itemId,a.itemId],[]]) assert.throws(()=>validateMenuSelection({version:MENU_SELECTION_VERSION,itemIds},[a,b]));
});
test("cache and blocked reservations never invoke provider and preserve the base comparison",async()=>{
 for(const state of ["cached","running","backoff","daily-limit"]) {
  let called=0;
  const r=await runMenuSelection([a,b,unknown],{begin:async()=>({state,result:selection}),finish:async()=>{throw Error("unexpected finish");},select:async()=>{called++;throw Error("unexpected provider");}});
  assert.equal(called,0);assert.equal(r.modelUsed,state==="cached");assert.deepEqual(r.recommendations,state==="cached"?[b,a,unknown]:[a,b,unknown]);
 }
 let calls=0;const empty=await runMenuSelection([unknown],{begin:async()=>{calls++;return {state:"acquired"};},finish:async()=>true,select:async()=>{calls++;return selection;}});
 assert.equal(empty.state,"insufficient");assert.equal(calls,0);
});
test("invalid model output releases lease, successful selection is idempotently committed",async()=>{
 const finishes:unknown[]=[];
 await assert.rejects(runMenuSelection([a,b],{begin:async()=>({state:"acquired"}),finish:async(_lease,result)=>{finishes.push(result);return true;},select:async()=>({...selection,itemIds:["invented"]})}));
 assert.deepEqual(finishes,[null]);
 const ok=await runMenuSelection([a,b],{begin:async()=>({state:"acquired"}),finish:async(_lease,result)=>{assert.deepEqual(result,selection);return true;},select:async()=>selection});
 assert.equal(ok.state,"generated");assert.equal(ok.modelUsed,true);assert.deepEqual(ok.recommendations,[b,a]);
});
