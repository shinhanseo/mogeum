import { researchProduct } from '../functions/product-research/provider.ts';
const ensure=(v:unknown)=>{if(!v)throw Error('RESEARCH_PROVIDER_EXPECTATION');};
Deno.test('real SDK sends product-only input and Google Search tool, preserves grounding, never claims verification',async()=>{
 let requests=0;
 const transport:typeof fetch=async(input,init)=>{
  requests++;
  ensure(String(input).startsWith('https://generativelanguage.googleapis.com/'));
  const body=JSON.parse(String(init?.body));
  ensure(JSON.stringify(body.tools).toLowerCase().includes('googlesearch'));
  ensure(JSON.stringify(body.contents).includes('Synthetic malt'));
  return Response.json({candidates:[{content:{role:'model',parts:[{text:'Producer describes fruit aroma.'}]},finishReason:'STOP',groundingMetadata:{webSearchQueries:['Synthetic malt producer'],groundingChunks:[{web:{uri:'https://producer.example/product',title:'Producer'}}],groundingSupports:[{segment:{text:'Producer describes fruit aroma.',startIndex:0,endIndex:31},groundingChunkIndices:[0]}]}}],usageMetadata:{promptTokenCount:20,candidatesTokenCount:20,totalTokenCount:40}});
 };
 const result=await researchProduct({name:'Synthetic malt',category:'whisky',edition:'12 years'},{apiKey:'synthetic-test-key',model:'gemini-3.5-flash-lite',signal:AbortSignal.timeout(5000),transport});
 ensure(requests===1);ensure(result.research.status==='candidate');ensure(result.research.supports.length===1);
 ensure(!('verified' in result.research));
});
Deno.test('invalid research context cannot initiate a model call',async()=>{
 let requests=0,failed=false;
 try{await researchProduct({name:'Synthetic malt',category:'whisky',edition:null,recordIds:['private']},{apiKey:'synthetic-test-key',model:'gemini-3.5-flash-lite',signal:AbortSignal.timeout(5000),transport:()=>{requests++;throw Error('UNEXPECTED');}});}catch{failed=true;}
 ensure(failed&&requests===0);
});
Deno.test('a provider answer without search evidence is not silently accepted',async()=>{
 let failed=false;
 try{await researchProduct({name:'Synthetic malt',category:'whisky',edition:null},{apiKey:'synthetic-test-key',model:'gemini-3.5-flash-lite',signal:AbortSignal.timeout(5000),transport:async()=>Response.json({candidates:[{content:{role:'model',parts:[{text:'Invented fruit aroma.'}]},finishReason:'STOP'}]})});}catch{failed=true;}
 ensure(failed);
});
