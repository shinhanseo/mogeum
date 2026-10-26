/** Package the existing Figma Mogu vector; no new illustration or generated photo. */
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
 for(const [name,width,background] of [['icon',700,true],['adaptive-foreground',600,false],['splash',820,false]]) {
  const height=width*153/170;
  const inner=original.replace('<svg ',`<svg x="${(1024-width)/2}" y="${(1024-height)/2}" `).replace('width="170" height="153"',`width="${width}" height="${height}"`);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${background?'<rect width="1024" height="1024" fill="#FAF7F2"/>':''}${inner}</svg>`;
  const target=path.join(directory,`${name}.svg`);fs.writeFileSync(target,svg);
  const image=new Resvg(svg,{fitTo:{mode:'width',value:1024}}).render();
  fs.writeFileSync(path.join(directory,`${name}.png`),image.asPng());
 }
 console.log('Existing Mogu vector packaged as 1024px app assets.');
}
main().catch(()=>{console.error('Brand asset export failed.');process.exitCode=1;});
