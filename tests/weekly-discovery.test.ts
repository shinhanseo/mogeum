import test from 'node:test';import assert from 'node:assert/strict';
import {restoreWeeklyDrinks,validateWeeklySelection,WEEKLY_DISCOVERY_VERSION} from '../supabase/functions/_shared/weekly-discovery';
import {discoverDrinks} from '../supabase/functions/_shared/next-drinks-domain';
import {products} from '../supabase/functions/_shared/product-catalog';
import type {TasteSnapshot} from '../supabase/functions/_shared/taste-domain';
const snapshot:TasteSnapshot={hash:'synthetic',totalRecords:1,omittedCount:0,records:[{id:'record',entryId:'entry',revision:1,category:'whisky',name:'Synthetic note',date:'2026-10-28',revisit:'again',rating:null,note:{mode:'light',version:2,inputRevision:1,confirmedInputRevision:1,confirmed:true,answers:[{questionId:'nose',status:'answered',descriptorCodes:['fruit']}]}}]};
test('weekly selection cannot add arbitrary products, prose or duplicate slots',()=>{
 const eligible=discoverDrinks(snapshot,[]);assert.ok(eligible.length>1);
 const base={version:WEEKLY_DISCOVERY_VERSION,productIds:[eligible[0].product.id]};
 assert.deepEqual(validateWeeklySelection(base,eligible),base);
 for(const value of [{...base,productIds:['invented']},{...base,productIds:[...base.productIds,...base.productIds]},{...base,reason:'invented taste'},{...base,productIds:[]}])assert.throws(()=>validateWeeklySelection(value,eligible));
});
test('weekly cache rechecks saved, consumed, retired and changed personal evidence without replacing slots',()=>{
 const eligible=discoverDrinks(snapshot,[]);const first=eligible[0].product,second=eligible[1].product;
 const batch={version:WEEKLY_DISCOVERY_VERSION,productIds:[first.id,second.id]};
 assert.deepEqual(restoreWeeklyDrinks(batch,snapshot,[],new Set([first.id]),products).map(r=>r.product.id),[second.id]);
 const history=[{entered_name:first.name,category:first.category,vintage_status:null,vintage_year:null}];
 if(first.category!=='wine')assert.deepEqual(restoreWeeklyDrinks(batch,snapshot,history,new Set(),products).map(r=>r.product.id),[second.id]);
 assert.deepEqual(restoreWeeklyDrinks(batch,snapshot,[],new Set(),products.filter(p=>p.id!==first.id)).map(r=>r.product.id),[second.id]);
 assert.deepEqual(restoreWeeklyDrinks(batch,{...snapshot,records:[]},[],new Set(),products),[]);
 assert.deepEqual(restoreWeeklyDrinks(batch,{...snapshot,records:snapshot.records.map(r=>({...r,revisit:'not_for_me'}))},[],new Set(),products),[]);
 for(const category of ['whisky','wine','beer','traditional'] as const)assert.ok(restoreWeeklyDrinks(batch,snapshot,[],new Set(),products,category).every(r=>r.product.category===category));
});
import {runWeeklyGeneration,type WeeklyPorts} from '../supabase/functions/_shared/weekly-generation';
test('weekly orchestration avoids unnecessary calls and rejects evidence changed during generation',async()=>{
 const eligible=discoverDrinks(snapshot,[]);let calls=0;const finishes:unknown[]=[];
 const ports:WeeklyPorts={begin:async()=>({state:'acquired'}),finish:async(_lease,value)=>{finishes.push(value);return true;},select:async()=>{calls++;return {version:WEEKLY_DISCOVERY_VERSION,productIds:[eligible[0].product.id]};},unchanged:async()=>true};
 assert.equal((await runWeeklyGeneration([],ports)).state,'insufficient');assert.equal(calls,0);
 for(const state of ['running','backoff','invalidated','daily-limit','cached'])assert.equal((await runWeeklyGeneration(eligible,{...ports,begin:async()=>({state})})).state,state);
 assert.equal(calls,0);assert.equal((await runWeeklyGeneration(eligible,ports)).state,'generated');assert.equal(calls,1);
 await assert.rejects(runWeeklyGeneration(eligible,{...ports,unchanged:async()=>false}),/TASTE_CONTEXT_CHANGED/);assert.equal(finishes.at(-1),null);
 await assert.rejects(runWeeklyGeneration(eligible,{...ports,select:async()=>{throw Error('PROVIDER_FAILURE');}}),/PROVIDER_FAILURE/);assert.equal(finishes.at(-1),null);
});
