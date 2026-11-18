import {MAX_CATALOG_PRODUCTS,parseCatalogDocument,type CatalogDocument} from './catalog-contract.ts';
import {normalizeProductName} from './product-catalog.ts';
type CatalogDatabase={rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>};
function documents(data:unknown):CatalogDocument[]{
 if(!Array.isArray(data)||data.length>MAX_CATALOG_PRODUCTS)throw Error('INVALID_DATABASE_CATALOG');
 return data.map(parseCatalogDocument);
}
export async function catalogDocuments(database:CatalogDatabase,ids:readonly string[]):Promise<CatalogDocument[]>{
 const result:CatalogDocument[]=[];
 for(let index=0;index<ids.length;index+=200){
  const {data,error}=await database.rpc('catalog_product_documents',{p_ids:ids.slice(index,index+200)});
  if(error)throw Error('CATALOG_LOOKUP_FAILED');
  result.push(...documents(data));
 }
 return result;
}
export async function catalogCandidates(database:CatalogDatabase,features:readonly string[]):Promise<CatalogDocument[]>{
 const {data,error}=await database.rpc('catalog_recommendation_candidates',{p_features:[...new Set(features)]});
 if(error)throw Error('CATALOG_CANDIDATES_FAILED');
 return documents(data);
}
export async function searchCatalog(database:CatalogDatabase,names:readonly string[],ids:readonly string[]=[]):Promise<CatalogDocument[]>{
 const chosen=await catalogDocuments(database,ids);
 const result=new Map(chosen.map(product=>[product.id,product]));
 const aliases=[...new Set(names.map(normalizeProductName).filter(Boolean))];
 for(let index=0;index<aliases.length;index+=500){
  const {data,error}=await database.rpc('catalog_search',{p_aliases:aliases.slice(index,index+500)});
  if(error)throw Error('CATALOG_SEARCH_FAILED');
  for(const product of documents(data)){
   if(result.size<950||result.has(product.id))result.set(product.id,product);
  }
 }
 return [...result.values()];
}
