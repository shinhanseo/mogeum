import {extractProductClaims} from '../functions/product-research/extract.ts';
import type {GroundedResearch} from '../functions/_shared/product-research.ts';
const research:GroundedResearch={status:'candidate',query:{name:'Synthetic malt',category:'whisky',edition:'12 years'},text:'Synthetic malt 12 years has fruit aroma.',sources:[{index:0,url:'https://producer.example/product',title:'Synthetic producer'}],supports:[{text:'Synthetic malt 12 years has fruit aroma.',sourceIndices:[0]}],queries:['Synthetic malt'],searchEntryPointHtml:null};
const proposal={identity:{name:'Synthetic malt',edition:'12 years',supportIndex:0,sourceIndex:0,quote:research.text},features:[{factId:'향:과일 향',supportIndex:0,sourceIndex:0,quote:'fruit aroma'}]};
Deno.test('real extraction SDK uses structured schema without another search and returns cited review claims',async()=>{
 let calls=0;
 const result=await extractProductClaims(research,{apiKey:'synthetic',model:'gemini-3.5-flash-lite',signal:AbortSignal.timeout(5000),transport:async(_url,init)=>{
  calls++;const request=JSON.parse(String(init?.body));if(request.tools?.length)throw Error('UNEXPECTED_SEARCH');
  if(!JSON.stringify(request).includes('향:과일 향'))throw Error('MISSING_ONTOLOGY');
  return Response.json({candidates:[{content:{role:'model',parts:[{text:JSON.stringify(proposal)}]},finishReason:'STOP'}],usageMetadata:{promptTokenCount:20,candidatesTokenCount:20,totalTokenCount:40}});
 }});
 if(calls!==1||result.features[0].factId!=='향:과일 향')throw Error('EXTRACTION_FAILED');
});
Deno.test('invented quoted evidence is omitted while valid claims remain',async()=>{
 const result=await extractProductClaims(research,{apiKey:'synthetic',model:'gemini-3.5-flash-lite',signal:AbortSignal.timeout(5000),transport:async()=>Response.json({candidates:[{content:{role:'model',parts:[{text:JSON.stringify({...proposal,features:[proposal.features[0],{...proposal.features[0],factId:'향:꿀·바닐라 향',quote:'invented vanilla'}]})}]},finishReason:'STOP'}]})});
 if(result.features.length!==1||result.features[0].factId!=='향:과일 향'||!result.identity)throw Error('UNSUPPORTED_CLAIM_ACCEPTED');
});
