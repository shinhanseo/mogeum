import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { questionsFor } from '../src/features/tasting/questions';
import { aromaCatalogs, type TastingCategory } from '../src/features/tasting/catalog';
const contract: Record<string, unknown> = {};
for (const category of ['whisky','wine','beer','traditional'] as TastingCategory[]) for (const mode of ['light','deep'] as const) {
  const fields: Record<string, unknown> = {};
  for (const q of questionsFor(category,mode)) for (const field of q.fields) {
    if (field.kind === 'aroma') {
      const families = aromaCatalogs[category];
      fields[field.id] = { kind:'aroma', max:100, codes:Object.entries(families).flatMap(([family, codes])=>[`family.${family}`,...codes.map((code:string)=>`detail.${family}.${code}`)]) };
      fields[`${field.id}.clarity`] = { kind:'choice', max:1, codes:['subtle','moderate','clear'] };
    } else fields[field.id] = { kind:field.kind, max:field.max??0, codes:field.options?.filter(o=>o.code!=='unknown').map(o=>o.code)??[], when:field.when??null, unless:field.unless??null, intensities:Object.fromEntries(field.options?.filter(o=>o.intensity!==undefined).map(o=>[o.code,o.intensity])??[]) };
  }
  contract[`${category}.${mode}`]=fields;
}
// v2 is applied: verification only; a semantic change requires a new catalog/migration.
assert.deepEqual(contract,JSON.parse(readFileSync('supabase/tasting-catalog-v2.json','utf8')));
const migration=readFileSync('supabase/migrations/20261021100000_tasting_notes.sql','utf8');
assert.deepEqual(contract,JSON.parse(migration.match(/select '([^']*)'::jsonb;/)![1]));
console.log('Tasting catalog v2: app, snapshot and migration match');
