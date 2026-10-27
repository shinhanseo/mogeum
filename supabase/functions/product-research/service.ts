import { runProductResearch } from '../_shared/research-runner.ts';
import { researchProduct } from './provider.ts';
type RpcPort={rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>};
/** Internal service-role caller only. No public endpoint or client-supplied budget overrides. */
export function budgetedProductResearch(database:RpcPort,config:{apiKey:string;model:string;transport?:typeof fetch}){
 return async(input:unknown)=>{
  if(!config.apiKey||!config.model)throw new Error('PRODUCT_RESEARCH_NOT_CONFIGURED');
  return runProductResearch(input,{
   version:`grounded-research-v1:${config.model}`,
   async begin(hash,lease){
    const {data,error}=await database.rpc('begin_product_research',{p_hash:hash,p_lease:lease});
    if(error||!data||typeof data!=='object'||typeof (data as {state?:unknown}).state!=='string')throw new Error('RESEARCH_BUDGET_UNAVAILABLE');
    return data as {state:string;result?:unknown};
   },
   async finish(hash,lease,result){
    const {data,error}=await database.rpc('finish_product_research',{p_hash:hash,p_lease:lease,p_result:result});
    if(error||typeof data!=='boolean')throw new Error('RESEARCH_COMPLETION_FAILED');
    return data;
   },
   research:(query,signal)=>researchProduct(query,{...config,signal}),
  });
 };
}
