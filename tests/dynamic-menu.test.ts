import { menuCatalog, validateMenuResult } from "../src/features/menu/result-contract";
import test from 'node:test';
import assert from 'node:assert/strict';
import { products, productCandidates } from '../supabase/functions/_shared/product-catalog';
import { parseMenu, validateItems, recommendMenu, type MenuPhoto } from '../supabase/functions/_shared/menu-domain';
import { stableMenuRecommendation } from '../supabase/functions/_shared/menu-recommendation';
import { SHARED_CATALOG_VERSION } from '../supabase/functions/_shared/catalog-contract';
const product={...products[0],id:'synthetic-new-menu',familyId:'synthetic-new-menu',name:'합성 새 술',aliases:['합성 새 술'],baseAliases:['합성 새 술']};
const photo:MenuPhoto={id:'90000000-0000-4000-8000-000000000001',imageRevision:1,width:1200,height:1600,engine:'apple-vision-v1',lines:[{id:'90000000-0000-4000-8000-000000000001:1:0',text:'합성 새 술 30ml 15,000원',confidence:0.9,polygon:[{x:0.1,y:0.1},{x:0.9,y:0.1},{x:0.9,y:0.15},{x:0.1,y:0.15}]}]};
const snapshot={hash:'synthetic',records:[],totalRecords:0,omittedCount:0};
test('new server catalog identity resolves only matching aliases and preserves OCR price/serving/location',async()=>{
 assert.equal(productCandidates(product.name).length,0);
 assert.equal(productCandidates(product.name,[product])[0].id,product.id);
 const parsed=parseMenu([photo],[product]);
 assert.equal(parsed.length,1);
 assert.equal(parsed[0].price,15000);assert.equal(parsed[0].serving,'30ml');
 assert.deepEqual(parsed[0].lineIds,[photo.lines[0].id]);
 const items=[{...parsed[0],confirmed:true,productId:product.id}];
 validateItems(items,[photo],'catalog',false,[product]);
 assert.throws(()=>validateItems(items,[photo]));
 assert.throws(()=>validateItems([{...items[0],name:'다른 술'}],[photo],'catalog',false,[product]));
 const result=await stableMenuRecommendation(items,async()=>snapshot,[product]);
 assert.equal(result.catalogVersion,SHARED_CATALOG_VERSION);
 assert.equal(menuCatalog(result)[0].id,product.id);
 assert.equal(validateMenuResult(result,items).catalog?.[0].id,product.id);
 assert.throws(()=>menuCatalog({...result,catalog:[{...product,source:{...product.source,url:"https://localhost/private"}}]}));
 assert.equal(result.catalogSize,1);
 assert.equal(result.recommendations[0].productId,product.id);
 assert.equal(result.recommendations[0].status,'unmatched');
 assert.deepEqual(result.recommendations[0].similar,[]);
 assert.equal(recommendMenu(items,snapshot,[])[0].status,'unverified');
});
test('ambiguous editions remain candidates, explicit unsupported vintage never falls back',()=>{
 const wine={...product,category:'wine' as const,edition:'2024',aliases:['합성 와인 2024'],baseAliases:['합성 와인']};
 const older={...wine,id:'synthetic-wine-2023',edition:'2023',aliases:['합성 와인 2023']};
 assert.equal(productCandidates('합성 와인',[wine,older]).length,2);
 assert.deepEqual(productCandidates('합성 와인 2022',[wine,older]),[]);
});
test('Gemini menu contract changes only selection, never product facts or OCR prices',async()=>{
 const items=[{...parseMenu([photo],[product])[0],confirmed:true,productId:product.id}];
 const liked={...snapshot,totalRecords:1,records:[{id:'positive',entryId:'entry',revision:1,name:product.name,category:product.category,date:'2026-10-30',revisit:'again' as const,rating:null,note:null}]};
 const base=await stableMenuRecommendation(items,async()=>liked,[product]);
 const selected={...base,method:'gemini-menu-selection-v1',modelUsed:true,selectionState:'generated'};
 assert.equal(validateMenuResult(selected,items).modelUsed,true);
 assert.equal(items[0].price,15000);
 for(const bad of [
  {...selected,modelUsed:false}, {...selected,selectionState:'daily-limit'},
  {...selected,recommendations:[{...selected.recommendations[0],productId:'invented'}]},
  {...selected,recommendations:[{...selected.recommendations[0],status:'similar',score:50}]},
 ])assert.throws(()=>validateMenuResult(bad,items));
 assert.equal(validateMenuResult({...base,modelUsed:false,selectionState:'daily-limit'},items).modelUsed,false);
 assert.throws(()=>validateMenuResult({...base,modelUsed:true,selectionState:'generated'},items));
});
