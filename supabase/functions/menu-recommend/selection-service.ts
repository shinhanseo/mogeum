import {runMenuSelection, MENU_SELECTION_VERSION} from '../_shared/menu-selection.ts';
import type {MenuRecommendation} from '../_shared/menu-domain.ts';
import {menuSelector} from './select.ts';
type RpcPort={rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>};
export async function selectMenu(database:RpcPort, input:{owner:string;hash:string;rows:readonly MenuRecommendation[]}, config:{apiKey:string;model:string;transport?:typeof fetch}) {
 if(!config.apiKey||!config.model.trim())throw Error('MENU_AI_NOT_CONFIGURED');
 const version=`${MENU_SELECTION_VERSION}:${config.model}`;
 return runMenuSelection(input.rows,{
  async begin(lease){const {data,error}=await database.rpc('begin_menu_selection',{p_owner:input.owner,p_hash:input.hash,p_version:version,p_lease:lease});
   if(error||!data||typeof data!=='object'||typeof(data as {state?:unknown}).state!=='string')throw Error('MENU_SELECTION_BUDGET_UNAVAILABLE');
   return data as {state:string;result?:unknown};},
  async finish(lease,result){const {data,error}=await database.rpc('finish_menu_selection',{p_owner:input.owner,p_hash:input.hash,p_version:version,p_lease:lease,p_result:result});
   if(error||typeof data!=='boolean')throw Error('MENU_SELECTION_COMPLETION_FAILED');return data;},
  select:menuSelector(config),
 });
}
