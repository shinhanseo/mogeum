import {selectWeeklyDrinks} from '../functions/next-drinks/select.ts';
import type {NextDrink} from '../functions/_shared/next-drinks-domain.ts';
import {products} from '../functions/_shared/product-catalog.ts';
const candidate:NextDrink={product:products[0],kind:'close',similar:[{factId:'향:과일 향',label:'과일 향',recordIds:['private-record-do-not-send'],negativeIds:[]}],cautions:[],unconfirmedFeatures:[],score:1};
Deno.test('weekly SDK selection uses counts without private IDs, prose or search',async()=>{
 let calls=0;
 const result=await selectWeeklyDrinks([candidate],{apiKey:'synthetic',model:'synthetic-model',signal:AbortSignal.timeout(5000),transport:async(_url,init)=>{
  calls++;const body=String(init?.body);const parsed=JSON.parse(body);
  if(body.includes('private-record-do-not-send')||parsed.tools?.length)throw Error('PRIVATE_INPUT_OR_SEARCH');
  return Response.json({candidates:[{content:{role:'model',parts:[{text:JSON.stringify({productIds:[candidate.product.id]})}]},finishReason:'STOP'}]});
 }});
 if(calls!==1||result.productIds[0]!==candidate.product.id)throw Error('BAD_SELECTION');
});
Deno.test('weekly SDK selection rejects invented product IDs after schema validation',async()=>{
 let failed=false;try{await selectWeeklyDrinks([candidate],{apiKey:'synthetic',model:'synthetic-model',signal:AbortSignal.timeout(5000),transport:async()=>Response.json({candidates:[{content:{role:'model',parts:[{text:JSON.stringify({productIds:['invented-product']})}]},finishReason:'STOP'}]})});}catch{failed=true;}
 if(!failed)throw Error('INVENTED_PRODUCT_ACCEPTED');
});
import {generateWeeklySelection} from '../functions/next-drinks/weekly-service.ts';
Deno.test('weekly service joins in-progress reservations and never sends a provider request',async()=>{
 let calls=0,requests=0;
 const result=await generateWeeklySelection({rpc:async(name,args)=>{calls++;if(name!=='begin_discovery_generation'||args.p_user!=='verified-owner')throw Error('BAD_RPC');return {data:{state:'running'},error:null};}},
 {owner:'verified-owner',hash:'a'.repeat(64),eligible:[candidate],unchanged:async()=>true},
 {apiKey:'synthetic',model:'synthetic-model',transport:async()=>{requests++;throw Error('UNEXPECTED_CALL');}});
 if(result.state!=='running'||calls!==1||requests!==0)throw Error('RESERVATION_NOT_JOINED');
});
Deno.test('weekly missing key fails before reservation',async()=>{
 let calls=0,failed=false;try{await generateWeeklySelection({rpc:async()=>{calls++;throw Error('UNEXPECTED_RPC');}},
 {owner:'verified-owner',hash:'a'.repeat(64),eligible:[candidate],unchanged:async()=>true},{apiKey:'',model:'synthetic-model'});}catch(e){failed=(e as Error).message==='WEEKLY_AI_NOT_CONFIGURED';}
 if(!failed||calls!==0)throw Error('MISSING_KEY_SPENT_RESERVATION');
});
