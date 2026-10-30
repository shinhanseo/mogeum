import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {parseCatalogDocument,catalogProduct} from "../supabase/functions/_shared/catalog-contract";
import {products,productCandidates,normalizeProductName} from "../supabase/functions/_shared/product-catalog";
import {recommendMenu,type MenuItem} from "../supabase/functions/_shared/menu-domain";
const documents=JSON.parse(readFileSync("supabase/catalog/2026-10-30-reviewed.json","utf8")).map(parseCatalogDocument) as ReturnType<typeof parseCatalogDocument>[];
const expanded=[...products,...documents.map(catalogProduct)];
test("reviewed additions preserve edition boundaries and use supported, source-linked sensory features",()=>{
 const ids=new Set(products.map(p=>p.id)),aliases=new Map(products.flatMap(p=>p.aliases.map(a=>[normalizeProductName(a),p.id])));
 for(const p of documents){
  assert.ok(!ids.has(p.id));ids.add(p.id);assert.equal(p.source.kind,"producer");assert.equal(p.source.checkedAt,"2026-10-30");assert.ok(p.features.length);
  const known=new Set(products.filter(row=>row.category===p.category).flatMap(row=>row.features.map(f=>f.id)));
  for(const f of p.features){assert.ok(known.has(f.id));assert.equal(f.id,`${f.dimension}:${f.label}`);assert.ok(f.evidence);}
  for(const a of p.aliases){const key=normalizeProductName(a);assert.ok(!aliases.has(key)||aliases.get(key)===p.id);aliases.set(key,p.id);assert.equal(productCandidates(a,expanded).find(row=>row.id===p.id)?.id,p.id);}
 }
 for(const name of ["Talisker 18","Oban Distillers Edition","Duvel 6.66","Duvel Single Fermented","Blue Moon Light","Blue Moon Non Alcoholic"]){assert.deepEqual(productCandidates(name,expanded),[],name);}
 const blue=documents.find(p=>p.id==="blue-moon-belgian-white-54")!;
 assert.ok(!blue.features.some(f=>f.label.includes("레몬")||f.label.includes("자몽")),"Citrus source must not turn into unsupported lemon/grapefruit claims");
});
test("new IDs resolve through real menu comparison without inferring a preference from an empty record",()=>{
 for(const p of documents){
  const item:MenuItem={id:"synthetic-menu",photoId:"synthetic-photo",imageRevision:1,lineIds:[],name:p.name,productId:p.id,price:15000,serving:"30ml",confirmed:true};
  const row=recommendMenu([item],{hash:"empty",records:[],totalRecords:0,omittedCount:0},expanded)[0];
  assert.equal(row.productId,p.id);assert.equal(row.status,"unmatched");assert.equal(row.score,0);assert.deepEqual(row.similar,[]);
 }
});
test("committed SQL is generated from the reviewed documents and cannot overwrite held products",()=>{
 execFileSync(process.execPath,["node_modules/tsx/dist/cli.mjs","scripts/build-reviewed-catalog.ts","--check"],{stdio:"pipe"});
 const sql=readFileSync("supabase/migrations/20261030020000_reviewed_catalog_expansion.sql","utf8");assert.match(sql,/on conflict\(id\) do nothing/);
});
