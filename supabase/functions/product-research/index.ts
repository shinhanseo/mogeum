import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {researchAdminHandler} from '../_shared/research-admin-handler.ts';
import {reviewResearchSources} from '../_shared/source-review.ts';
import {budgetedProductResearch} from './service.ts';
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const key=Deno.env.get('GOOGLE_GENERATIVE_AI_API_KEY');
// Search availability and billing differ from text generation; configure explicitly.
const model=Deno.env.get('MOGEUM_RESEARCH_MODEL')?.trim();
Deno.serve(researchAdminHandler({secret:Deno.env.get("MOGEUM_RESEARCH_ADMIN_SECRET")??serviceKey,async run(input){
 if(!serviceKey||!key||!model)throw Error('PRODUCT_RESEARCH_NOT_CONFIGURED');
 const signal=AbortSignal.timeout(40000);
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,serviceKey,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,init)=>fetch(url,{...init,signal})}});
 const result=await budgetedProductResearch(admin,{apiKey:key,model})(input);
 if(result.state!=='candidate')return result;
 const sourceReview=await reviewResearchSources(result.research,{signal});
 return {...result,sourceReview,reviewRequired:true,verified:false};
}}));
