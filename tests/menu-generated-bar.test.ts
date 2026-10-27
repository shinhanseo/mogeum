import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {parseMenu,validateItems,type MenuPhoto,type MenuLine} from '../supabase/functions/_shared/menu-domain';
import {benchmarkMetrics,type BenchmarkCase} from '../src/features/menu/benchmark-metrics';
test('captured Apple Vision menu keeps all eight name/price/serving associations and separate wine offers',()=>{
 const report=JSON.parse(readFileSync('docs/verification/generated-menu-ocr/ios-before.json','utf8'));
 const fixture=JSON.parse(readFileSync('assets/fixtures/ocr-benchmark/generated-bar.json','utf8')) as BenchmarkCase;
 const raw=report.cases[0].rawNative;
 const id='90000000-0000-4000-8000-000000000001';
 const photo:MenuPhoto={...raw,id,imageRevision:1,lines:raw.lines.map((line:MenuLine,index:number)=>({...line,id:`${id}:1:${index}`}))};
 const unchanged=structuredClone(photo), items=parseMenu([photo]);validateItems(items,[photo]);
 assert.deepEqual(photo,unchanged);
 assert.deepEqual(items.map(i=>({name:i.name,price:i.price,serving:i.serving})),fixture.expected);
 assert.equal(new Set(items.map(i=>i.id)).size,8);
 const metrics=benchmarkMetrics(fixture,photo,items);
 assert.equal(metrics.matchedNames,8);assert.equal(metrics.correctPrices,8);assert.equal(metrics.correctServings,8);assert.equal(metrics.unmatchedParsedItems,0);
 assert.ok(items.every(i=>i.productId===null&&!i.confirmed),'OCR is not automatic product confirmation');
});
