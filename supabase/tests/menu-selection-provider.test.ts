import {menuSelector} from '../functions/menu-recommend/select.ts';
import type {MenuRecommendation} from '../functions/_shared/menu-domain.ts';
const candidate:MenuRecommendation={itemId:'menu-one',productId:'verified-product',status:'similar',similar:[{factId:'향:과일 향',label:'과일 향',recordIds:['PRIVATE_RECORD_ID'],negativeIds:['PRIVATE_NEGATIVE_ID']}],other:[],knownRecordIds:['PRIVATE_KNOWN_ID'],score:1};
Deno.test('menu SDK sends aggregate evidence only and returns verified candidate IDs',async()=>{
 let calls=0;const select=menuSelector({apiKey:'synthetic',model:'synthetic-model',transport:async(_url,init)=>{
  calls++;const body=String(init?.body);if(body.includes('PRIVATE_')||JSON.parse(body).tools?.length)throw Error('PRIVATE_INPUT_OR_SEARCH');
  return Response.json({candidates:[{content:{role:'model',parts:[{text:JSON.stringify({itemIds:['menu-one']})}]},finishReason:'STOP'}]});
 }});
 const result=await select([candidate],AbortSignal.timeout(5000));if(calls!==1||JSON.stringify(result)!==JSON.stringify({version:'menu-selection-v1',itemIds:['menu-one']}))throw Error('BAD_RESULT');
});
Deno.test('menu SDK rejects off-menu IDs even when output schema is valid',async()=>{
 const select=menuSelector({apiKey:'synthetic',model:'synthetic-model',transport:async()=>Response.json({candidates:[{content:{role:'model',parts:[{text:JSON.stringify({itemIds:['invented']})}]},finishReason:'STOP'}]})});
 let rejected=false;try{await select([candidate],AbortSignal.timeout(5000));}catch{rejected=true;}if(!rejected)throw Error('INVENTED_ACCEPTED');
});
