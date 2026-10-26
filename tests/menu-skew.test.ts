import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseMenu,validateItems,type MenuPhoto,type MenuLine} from '../supabase/functions/_shared/menu-domain';
import {benchmarkMetrics,type BenchmarkCase} from '../src/features/menu/benchmark-metrics';
const id='90000000-0000-4000-8000-000000000001';
const fixtures=JSON.parse(readFileSync('assets/fixtures/ocr-benchmark/manifest.json','utf8')) as BenchmarkCase[];
const reports=['ios-geometry-v2','android-geometry-v2','android-galaxy-20261026-fixed'];
function nativePhoto(report:string,fixture:string):MenuPhoto {
  const data=JSON.parse(readFileSync(`docs/verification/ocr-benchmark/${report}.json`,'utf8'));
  const raw=data.cases.find((c:{id:string})=>c.id===fixture).rawNative;
  // The old iOS report omitted dimensions. Read the actual owned fixture PNG dimensions, never guess the aspect.
  const png=readFileSync(`assets/fixtures/ocr-benchmark/${fixture}.png`);
  return {...raw,width:raw.width??png.readUInt32BE(16),height:raw.height??png.readUInt32BE(20),id,imageRevision:1,
    lines:raw.lines.map((l:object,n:number)=>({...l,id:`${id}:1:${n}`}))};
}
for(const report of reports) {
 test(`${report}: native tilted source cells stay paired without rewriting OCR or polygons`,()=>{
  const photo=nativePhoto(report,'skew'),before=structuredClone(photo);
  const items=parseMenu([photo]);validateItems(items,[photo]);
  assert.deepEqual(photo,before);
  const expected=fixtures.find(f=>f.id==='skew')!;
  assert.equal(items.length,6);
  for(let n=0;n<6;n++){
    const nameIndex=report.startsWith('ios')?n*2+1:n+1;
    const priceIndex=report.startsWith('ios')?n*2+2:n+7;
    const item=items.find(i=>i.lineIds.includes(photo.lines[nameIndex].id))!;
    assert.ok(item);
    assert.deepEqual(item.lineIds,[photo.lines[nameIndex].id,photo.lines[priceIndex].id]);
    assert.equal(item.price,expected.expected[n].price);
    assert.equal(item.confirmed,false);
  }
  const metrics=benchmarkMetrics(expected,photo,items);
  assert.equal(metrics.correctPrices,report.startsWith('ios')?6:4);
 });
}
test('39 other pinned native cases preserve exact geometry-v3 output, including ambiguous and next-line prices',()=>{
 const baseline=JSON.parse(readFileSync('tests/fixtures/menu-skew-baseline.json','utf8'));
 assert.equal(baseline.cases.length,39);
 for(const c of baseline.cases){
  const photo=nativePhoto(c.report,c.id);
  assert.equal(createHash('sha256').update(JSON.stringify(parseMenu([photo]))).digest('hex'),c.itemsHash,`${c.report}/${c.id}`);
 }
});
function line(text:string,x:number,y:number,width=.3):MenuLine {
 return {id:'',text,confidence:1,polygon:[{x,y},{x:x+width,y},{x:x+width,y:y+.015},{x,y:y+.015}]};
}
function rotate(l:MenuLine,degrees:number):MenuLine {
 const radians=degrees*Math.PI/180;
 return {...l,polygon:l.polygon.map(p=>{
  const x=(p.x-.5)*800,y=(p.y-.5)*1200;
  return {x:(x*Math.cos(radians)-y*Math.sin(radians))/800+.5,y:(x*Math.sin(radians)+y*Math.cos(radians))/1200+.5};
 })};
}
function photo(lines:MenuLine[]):MenuPhoto {
 return {id,imageRevision:1,width:800,height:1200,engine:'manual',lines:lines.map((l,n)=>({...l,id:`${id}:1:${n}`}))};
}
const menu=()=>[.25,.45,.65].flatMap((y,n)=>[line(`Whisky Item ${n}`, .1,y),line(`${n+1}0,000원`,.72,y,.13)]);
for(const angle of [-8,8])test(`pixel-aspect-aware ${angle} degree layout keeps prices on their own rows`,()=>{
 const p=photo(menu().map(l=>rotate(l,angle)));
 assert.deepEqual(parseMenu([p]).map(i=>i.price),[10000,20000,30000]);
});
test('tilted headings alone do not rotate the horizontal menu layout',()=>{
 const headings=[.05,.09,.13].map(y=>rotate(line('Decorative slanted heading',.22,y,.4),8));
 const p=photo([...headings,...menu()]);
 assert.deepEqual(parseMenu([p]).filter(i=>i.price!==null).map(i=>i.price),[10000,20000,30000]);
});
test('conflicting directions and unsupported steep angles cannot manufacture a price link',()=>{
 for(const angle of [8,16]){
  const names=[.25,.45,.65].map((y,n)=>rotate(line(`Whisky Item ${n}`,.1,y),angle));
  const other=[.3,.5,.7].map((y,n)=>rotate(line(`Opposite heading ${n}`,.1,y),angle===8?-8:16));
  const p=photo([...names,...other,line('10,000원',.72,.88,.13)]);
  assert.ok(parseMenu([p]).every(i=>i.price===null));
 }
});
test('a price on the next line of a tilted menu remains unconfirmed instead of borrowed',()=>{
 const lines=[.25,.45,.65].flatMap((y,n)=>[line(`Whisky Item ${n}`,.1,y),line(`${n+1}0,000원`,.72,y+.06,.13)]);
 const p=photo(lines.map(l=>rotate(l,8)));
 assert.ok(parseMenu([p]).every(i=>i.price===null));
});
test('three decorative anchors near the top cannot impose their skew on short horizontal item labels',()=>{
 const headings=[.05,.09,.13].map(y=>rotate(line('Decorative heading',.22,y,.4),8));
 const rows=[.25,.45,.65].flatMap((y,n)=>[line(String.fromCharCode(65+n),.1,y,.02),line(`${n+1}0,000원`,.72,y,.13)]);
 assert.deepEqual(parseMenu([photo([...headings,...rows])]).filter(i=>i.price!==null).map(i=>i.price),[10000,20000,30000]);
});
test('rotated complete two-column rows retain each column source and price',()=>{
 const rows=[.25,.45,.65].flatMap((y,n)=>[
  line(`Left Item ${n}`,.07,y,.2),line(`${n*2+1}0,000원`,.34,y,.09),
  line(`Right Item ${n}`,.52,y,.22),line(`${n*2+2}0,000원`,.82,y,.09),
 ]);
 const p=photo(rows.map(l=>rotate(l,-8)));
 const items=parseMenu([p]);
 assert.deepEqual(items.map(i=>i.price),[10000,20000,30000,40000,50000,60000]);
 for(let n=0;n<6;n++)assert.deepEqual(items[n].lineIds,[p.lines[n*2].id,p.lines[n*2+1].id]);
});
test('two prices remain ambiguous after row deskew, including damaged currency',()=>{
 for(const suffix of ['원','%']){
  const rows=[.25,.45,.65].flatMap((y,n)=>[
   line(`Whisky Item ${n}`,.07,y,.25),line(`10,000${suffix}`,.5,y,.13),line('150,000원',.76,y,.14),
  ]);
  const items=parseMenu([photo(rows.map(l=>rotate(l,8)))]);
  assert.equal(items.length,3);
  assert.ok(items.every(i=>i.price===null&&!i.confirmed));
 }
});
