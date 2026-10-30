/** Offline SQL generation for the manually source-reviewed batch. No model, network or keys. */
import {readFileSync,writeFileSync} from "node:fs";
import {parseCatalogDocument} from "../supabase/functions/_shared/catalog-contract";
import {normalizeProductName} from "../supabase/functions/_shared/product-catalog";
const documents=JSON.parse(readFileSync("supabase/catalog/2026-10-30-reviewed.json","utf8")).map(parseCatalogDocument);
const quote=(v:string)=>"'"+v.replaceAll("'","''")+"'";
const rows=documents.map((p:ReturnType<typeof parseCatalogDocument>)=>`(${quote(p.id)},${quote(p.familyId)},${quote(p.category)},${quote(normalizeProductName(p.name))},${quote(JSON.stringify(p))}::jsonb,'verified',${quote(p.source.checkedAt)}::timestamptz)`);
const sql=`-- Manually reviewed manufacturer facts, 2026-10-30. Existing products/holds are never overwritten.\ninsert into public.product_catalog(id,family_id,category,normalized_name,document,status,verified_at) values\n${rows.join(',\n')}\non conflict(id) do nothing;\n`;
const path="supabase/migrations/20261030020000_reviewed_catalog_expansion.sql";
if(process.argv.includes("--check")){if(readFileSync(path,"utf8")!==sql)throw Error("REVIEWED_CATALOG_MIGRATION_OUTDATED");}
else writeFileSync(path,sql);
console.log(JSON.stringify({reviewedProducts:documents.length,sqlAligned:true}));
