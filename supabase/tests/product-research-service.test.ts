import {budgetedProductResearch} from '../functions/product-research/service.ts';
Deno.test('provider 429 ends its lease and opens a shared backoff without automatic retries',async()=>{
 const calls:string[]=[];let requests=0;
 const run=budgetedProductResearch({rpc:async(name,args)=>{
  calls.push(name);
  if(name==='begin_product_research')return {data:{state:'acquired'},error:null};
  if(name==='finish_product_research'){if(args.p_result!==null)throw Error('FAILURE_STORED_AS_SUCCESS');return {data:true,error:null};}
  if(name==='pause_product_research_provider'){if(args.p_seconds!==900)throw Error('BAD_BACKOFF');return {data:true,error:null};}
  throw Error('UNEXPECTED_RPC');
 }},{apiKey:'synthetic',model:'gemini-3.5-flash-lite',transport:async()=>{requests++;return Response.json({error:{code:429,message:'synthetic quota',status:'RESOURCE_EXHAUSTED'}},{status:429});}});
 let code='';try{await run({name:'Synthetic malt',category:'whisky',edition:null});}catch(e){code=(e as Error).message;}
 if(code!=='RESEARCH_PROVIDER_LIMITED'||requests!==1||calls.join(',')!=='begin_product_research,finish_product_research,pause_product_research_provider')throw Error('PROVIDER_BACKOFF_CONTRACT');
});
