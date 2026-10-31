import {identifyMenuResearch,validateMenuIdentities} from '../functions/menu-recommend/research-identify.ts';
import {researchMenu} from '../functions/menu-recommend/research-service.ts';
import type {MenuItem} from '../functions/_shared/menu-domain.ts';
const ensure=(v:unknown)=>{if(!v)throw Error('MENU_RESEARCH_EXPECTATION');};
const item:MenuItem={id:'menu-one',photoId:'photo',imageRevision:1,lineIds:['line'],name:'합성 위스키 12년',price:15000,serving:'30ml',productId:null,confirmed:true};
Deno.test('identification sends names only and rejects invented numeric editions',async()=>{
 let calls=0;
 const result=await identifyMenuResearch([item.name],{apiKey:'synthetic',model:'gemini-3.5-flash-lite',transport:async(_url,init)=>{
  calls++;const body=JSON.stringify(JSON.parse(String(init?.body)));ensure(body.includes(item.name)&&!body.includes(item.photoId)&&!body.includes('recordId')&&!body.includes('15000'));
  return Response.json({candidates:[{content:{role:'model',parts:[{text:JSON.stringify({identities:[{index:0,name:'Synthetic malt 12 years',category:'whisky'}]})}]},finishReason:'STOP'}]});
 }});ensure(calls===1&&result.length===1);
 for(const name of ['Synthetic malt 18 years','Synthetic malt','Synthetic malt 12 years 2026']){let failed=false;try{validateMenuIdentities([{index:0,name,category:'whisky'}],[item.name]);}catch{failed=true;}ensure(failed);}
});
Deno.test('owner budget blocks provider calls; invalid cached product data cannot bypass result validation',async()=>{
 let requests=0;
 const config={apiKey:'synthetic',model:'gemini-3.5-flash-lite',transport:async()=>{requests++;throw Error('UNEXPECTED_PROVIDER');}};
 const blocked=await researchMenu({rpc:async()=>({data:{state:'daily-limit'},error:null})},'owner',[item],config);ensure(blocked.entries[0].state==='daily-limit'&&requests===0);
 let failed=false;try{await researchMenu({rpc:async()=>({data:{state:'cached',result:{entries:[{itemId:item.id,state:'compared',productId:'forged'}],documents:[]}},error:null})},'owner',[item],config);}catch{failed=true;}ensure(failed&&requests===0);
 const known=await researchMenu({rpc:async()=>{throw Error('UNEXPECTED_RESERVATION');}},'owner',[{...item,productId:'known'}],config);ensure(known.entries.length===0&&requests===0);
});
Deno.test('classification failure closes both leases and never stores fabricated success',async()=>{
 const calls:string[]=[];
 const result=await researchMenu({rpc:async(name,args)=>{calls.push(name);if(name.startsWith('begin_'))return {data:{state:'acquired'},error:null};ensure(args.p_result===null);return {data:true,error:null};}},'owner',[item],{apiKey:'synthetic',model:'gemini-3.5-flash-lite',transport:async()=>Response.json({error:{code:500,message:'synthetic'}},{status:500})});
 ensure(result.entries[0].state==='unavailable');ensure(calls.join(',')==='begin_menu_selection,begin_product_research,finish_product_research,finish_menu_selection');
});

Deno.test('cached bounded investigation restores limit states for large menus without provider work',async()=>{
 const items=Array.from({length:100},(_,i)=>({...item,id:`menu-${i}`}));let calls=0;
 const result=await researchMenu({rpc:async()=>({data:{state:'cached',result:{entries:items.slice(0,2).map(i=>({itemId:i.id,state:'unresolved',productId:null})),documents:[]}},error:null})},'owner',items,{apiKey:'synthetic',model:'gemini-3.5-flash-lite',transport:async()=>{calls++;throw Error('UNEXPECTED_PROVIDER');}});
 ensure(result.entries.length===100&&result.entries.slice(2).every(e=>e.state==='limit')&&calls===0);
});
