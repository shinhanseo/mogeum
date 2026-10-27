/** Offline, deterministic seed from the checked 32 products; no keys or provider calls. */
import { products, normalizeProductName } from '../supabase/functions/_shared/product-catalog';
import { parseCatalogDocument } from '../supabase/functions/_shared/catalog-contract';
import { writeFileSync } from 'node:fs';
const documents=products.map(p=>parseCatalogDocument({...p,familyId:p.id.replace(/-(?:19|20)\d{2}$/, '')}));
const quote=(v:string)=>"'"+v.replaceAll("'","''")+"'";
const rows=documents.map(p=>`(${quote(p.id)},${quote(p.familyId)},${quote(p.category)},${quote(normalizeProductName(p.name))},${quote(JSON.stringify(p))}::jsonb,'verified',${quote(p.source.checkedAt)}::timestamptz)`);
writeFileSync('/tmp/mogeum-catalog-seed.sql',`insert into public.product_catalog(id,family_id,category,normalized_name,document,status,verified_at) values\n${rows.join(',\n')};\n`);
console.log(JSON.stringify({products:documents.length,families:new Set(documents.map(p=>p.familyId)).size}));
