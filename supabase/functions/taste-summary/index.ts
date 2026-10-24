import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { tasteHandler,type TasteContext } from '../_shared/taste-handler.ts';
import { selectHighlights } from './provider.ts';
const url=Deno.env.get('SUPABASE_URL')!;
const publicKey=Deno.env.get('SUPABASE_ANON_KEY')??Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const key=Deno.env.get('GOOGLE_GENERATIVE_AI_API_KEY');
const model=Deno.env.get('GEMINI_MODEL')??'gemini-3.8-flash';
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const client=createClient(url,publicKey,options);
const admin=serviceKey?createClient(url,serviceKey,options):null;
Deno.serve(tasteHandler({model,
 async authenticate(token){const {data,error}=await client.auth.getUser(token);return error?null:data.user;},
 async context(token){const scoped=createClient(url,publicKey,{...options,global:{headers:{Authorization:`Bearer ${token}`}}});const {data,error}=await scoped.rpc('taste_summary_context');if(error)throw error;return data as TasteContext;},
 configured:()=>Boolean(key&&admin),
 async begin(owner,hash,lease){if(!admin)throw new Error('Not configured');const {data,error}=await admin.rpc('begin_taste_summary',{p_owner:owner,p_hash:hash,p_lease:lease});if(error)throw error;return data as string;},
 async finish(owner,hash,lease,result){if(!admin)throw new Error('Not configured');const {data,error}=await admin.rpc('finish_taste_summary',{p_owner:owner,p_hash:hash,p_lease:lease,p_result:result});if(error)throw error;return data===true;},
 select:(analysis,signal)=>selectHighlights(analysis,key!,model,signal),
}));
