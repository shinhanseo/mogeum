#!/usr/bin/env python3
"""Export the collected inventory without silently merging editions or approving images."""
import argparse
import csv
import html
import json
import sqlite3
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

parser = argparse.ArgumentParser()
parser.add_argument('--root', type=Path, default=Path('artifacts/catalog-ingestion'))
args = parser.parse_args()
db = sqlite3.connect(args.root / 'catalog.sqlite')
db.execute('begin')
rows = db.execute('''select p.document,i.preview_path,i.state from products p
 left join images i on i.product_id=p.id order by p.category,p.name''').fetchall()
with (args.root / 'products.jsonl.tmp').open('w',encoding='utf-8') as stream:
    for text, preview, state in rows:
        product = json.loads(text)
        product['image'] = {'localPreview': preview, 'state': state,
                            'publicReuse': 'permission_unconfirmed'}
        stream.write(json.dumps(product, ensure_ascii=False) + '\n')
(args.root/'products.jsonl.tmp').replace(args.root/'products.jsonl')
with (args.root / 'products.csv.tmp').open('w', newline='',encoding='utf-8-sig') as stream:
    writer = csv.writer(stream)
    writer.writerow(['id','name','category','type','abv','volume','source_url','image_path','image_state'])
    for text, preview, state in rows:
        product = json.loads(text)
        attrs = product['attributes']
        writer.writerow([product['id'],product['name'],product['category'],attrs.get('종류',''),
                         attrs.get('도수',attrs.get('알콜도수','')),attrs.get('용량',''),
                         product['source']['url'],preview or '',state or 'missing'])
(args.root/'products.csv.tmp').replace(args.root/'products.csv')
images = db.execute('''select name,preview_path from
 (select p.name,i.preview_path,p.category,row_number() over(partition by p.category order by p.id) n
  from products p join images i on i.product_id=p.id
  where i.state='downloaded' and p.category in ('whisky','beer','wine','traditional'))
 where n<=6 order by category,n''').fetchall()
if images:
    sheet = Image.new('RGB', (1440, ((len(images)+5)//6)*310), '#FAF7F2')
    draw = ImageDraw.Draw(sheet)
    font_paths = ['/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
                  '/System/Library/Fonts/AppleSDGothicNeo.ttc']
    font = next((ImageFont.truetype(p,16) for p in font_paths if Path(p).exists()),ImageFont.load_default())
    for index,(name,path) in enumerate(images):
        x,y=(index%6)*240,(index//6)*310
        image=Image.open(args.root/path).convert('RGBA')
        image.thumbnail((212,248))
        sheet.paste(image,(x+120-image.width//2,y+12+(248-image.height)//2),image)
        draw.text((x+12,y+269),name[:16],font=font,fill='#332D2B')
    sheet.save(args.root/'image-review.tmp.jpg',quality=94)
    (args.root/'image-review.tmp.jpg').replace(args.root/'image-review.jpg')
print(json.dumps({'exported':len(rows),'previewed':len(images)}))
