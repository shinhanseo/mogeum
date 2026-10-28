import {runWeeklyGeneration} from '../_shared/weekly-generation.ts';
import {WEEKLY_DISCOVERY_VERSION} from '../_shared/weekly-discovery.ts';
import type {NextDrink} from '../_shared/next-drinks-domain.ts';
import {selectWeeklyDrinks} from './select.ts';
type Database={rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>};
/** Caller must supply owner from verified JWT and eligible candidates from current server evidence. */
export async function generateWeeklySelection(database:Database,input:{owner:string;hash:string;eligible:readonly NextDrink[];unchanged:()=>Promise<boolean>},config:{apiKey:string;model:string;transport?:typeof fetch}){
 // A missing provider must not consume even a failed reservation.
 if(!config.apiKey||!config.model.trim())throw Error('WEEKLY_AI_NOT_CONFIGURED');
 const version=`${WEEKLY_DISCOVERY_VERSION}:${config.model}`;
 if(version.length>100)throw Error('INVALID_WEEKLY_MODEL');
 return runWeeklyGeneration(input.eligible,{
  async begin(lease){
   const {data,error}=await database.rpc('begin_discovery_generation',{p_user:input.owner,p_hash:input.hash,p_version:version,p_lease:lease});
   if(error||!data||typeof data!=='object'||typeof (data as {state?:unknown}).state!=='string')throw Error('WEEKLY_RESERVATION_FAILED');
   return data as {state:string;result?:unknown;generatedAt?:string;nextGenerationAt?:string};
  },
  async finish(lease,result){
   const {data,error}=await database.rpc('finish_discovery_generation',{p_user:input.owner,p_hash:input.hash,p_version:version,p_lease:lease,p_result:result});
   if(error||typeof data!=='boolean')throw Error('WEEKLY_COMPLETION_FAILED');return data;
  },
  select:(eligible,signal)=>selectWeeklyDrinks(eligible,{...config,signal}),
  unchanged:input.unchanged,
 });
}
