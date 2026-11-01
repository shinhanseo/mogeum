/** Package the approved icon unchanged; retain the existing splash illustration. */
const fs = require('node:fs');
const path = require('node:path');
const { Resvg } = require('@resvg/resvg-js');
async function main() {
 const root=path.resolve(__dirname,'..');
 const source=fs.readFileSync(path.join(root,'src/components/Mogu.tsx'),'utf8');
 const match=source.match(/const xml = ("(?:\\.|[^"\\])*");/);
 if(!match)throw Error('Existing Mogu SVG not found');
 const original=JSON.parse(match[1]);
 const directory=path.join(root,'assets/brand');fs.mkdirSync(directory,{recursive:true});
 const master=fs.readFileSync(path.join(directory,'icon-master-approved.png')).toString('base64');
 for(const name of ['icon','adaptive-foreground']) {
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><image width="1024" height="1024" href="data:image/png;base64,${master}"/></svg>`;
  fs.writeFileSync(path.join(directory,`${name}.svg`),svg);
  fs.writeFileSync(path.join(directory,`${name}.png`),new Resvg(svg).render().asPng());
 }
 for(const [name,width,background] of [['splash',820,false]]) {
  const height=width*153/170;
  const inner=original.replace('<svg ',`<svg x="${(1024-width)/2}" y="${(1024-height)/2}" `).replace('width="170" height="153"',`width="${width}" height="${height}"`);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${background?'<rect width="1024" height="1024" fill="#FAF7F2"/>':''}${inner}</svg>`;
  const target=path.join(directory,`${name}.svg`);fs.writeFileSync(target,svg);
  const image=new Resvg(svg,{fitTo:{mode:'width',value:1024}}).render();
  fs.writeFileSync(path.join(directory,`${name}.png`),image.asPng());
 }
 console.log('Approved icon packaged at 1024px; existing splash retained.');
}
main().catch(()=>{console.error('Brand asset export failed.');process.exitCode=1;});
