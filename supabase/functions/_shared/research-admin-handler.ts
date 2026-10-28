import {readMenuBody} from './menu-body.ts';
import {researchQuery} from './product-research.ts';
type Ports={secret:string|undefined;run:(input:unknown)=>Promise<unknown>};
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
async function equalSecret(a:string,b:string){
 const bytes=new TextEncoder();const [x,y]=await Promise.all([a,b].map(s=>crypto.subtle.digest('SHA-256',bytes.encode(s))));
 const aa=new Uint8Array(x),bb=new Uint8Array(y);let difference=0;for(let i=0;i<aa.length;i++)difference|=aa[i]^bb[i];return difference===0;
}
/** Privileged operations endpoint. Ordinary signed-in users and publishable keys cannot trigger research. */
export function researchAdminHandler(ports:Ports){return async(request:Request)=>{
 if(request.method!=='POST')return reply({code:'METHOD_NOT_ALLOWED'},405);
 const token=request.headers.get('Authorization')?.match(/^Bearer (\S+)$/i)?.[1];
 if(!ports.secret||!token||token.length>4096||!await equalSecret(token,ports.secret))return reply({code:'UNAUTHENTICATED'},401);
 let input;
 try{input=researchQuery(JSON.parse(await readMenuBody(request,1024)));}catch{return reply({code:'INVALID_RESEARCH_QUERY'},400);}
 try{return reply(await ports.run(input));}catch(error){
  const code=error instanceof Error?error.message:'';
  const safeCodes=new Set(['RESEARCH_BUDGET_UNAVAILABLE','RESEARCH_COMPLETION_FAILED','RESEARCH_LEASE_EXPIRED','PRODUCT_RESEARCH_UNGROUNDED','INVALID_PRODUCT_RESEARCH','INVALID_RESEARCH_CLAIMS','INVALID_RESEARCH_CACHE','RESEARCH_PROVIDER_LIMITED']);
  const status=(error as {statusCode?:unknown})?.statusCode;
  return reply({code:code==='PRODUCT_RESEARCH_NOT_CONFIGURED'?'AI_NOT_CONFIGURED':safeCodes.has(code)?code:'PRODUCT_RESEARCH_FAILED',...(Number.isInteger(status)&&Number(status)>=400&&Number(status)<=599?{providerStatus:status}:{})},code==='PRODUCT_RESEARCH_NOT_CONFIGURED'?503:502);
 }
};}
