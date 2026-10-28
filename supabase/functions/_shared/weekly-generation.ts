import {WEEKLY_DISCOVERY_VERSION,validateWeeklySelection,type WeeklySelection} from './weekly-discovery.ts';
import type {NextDrink} from './next-drinks-domain.ts';
export type WeeklyState='running'|'backoff'|'invalidated';
export type WeeklyPorts={
 begin:(lease:string)=>Promise<{state:string;result?:unknown;generatedAt?:string;nextGenerationAt?:string}>;
 finish:(lease:string,result:WeeklySelection|null)=>Promise<boolean>;
 select:(eligible:readonly NextDrink[],signal:AbortSignal)=>Promise<unknown>;
 unchanged:()=>Promise<boolean>;
};
/** No selection call on insufficient evidence, cache hit, running generation or cooldown. */
export async function runWeeklyGeneration(eligible:readonly NextDrink[],ports:WeeklyPorts){
 if(!eligible.length)return {state:'insufficient' as const};
 const lease=crypto.randomUUID(),job=await ports.begin(lease);
 if(job.state==='cached'){
  // Cached IDs may have become unavailable; restoration filters them against current facts.
  return {...job,state:'cached' as const};
 }
 if(['running','backoff','invalidated'].includes(job.state))return {...job,state:job.state as WeeklyState};
 if(job.state!=='acquired')throw Error('INVALID_WEEKLY_RESERVATION');
 try{
  const selection=validateWeeklySelection(await ports.select(eligible,AbortSignal.timeout(20000)),eligible);
  if(!await ports.unchanged())throw Error('TASTE_CONTEXT_CHANGED');
  if(!await ports.finish(lease,selection))throw Error('WEEKLY_LEASE_EXPIRED');
  return {state:'generated' as const,result:selection,version:WEEKLY_DISCOVERY_VERSION};
 }catch(error){try{await ports.finish(lease,null);}catch{/* Reservation expires; never log personal input. */}throw error;}
}
