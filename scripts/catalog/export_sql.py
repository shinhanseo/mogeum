#!/usr/bin/env python3
"""Prepare an admin-only SQL import, preserving existing review decisions."""
import argparse
import json
import sqlite3
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--root', type=Path, default=Path('artifacts/catalog-ingestion'))
args = parser.parse_args()
db = sqlite3.connect(args.root/'catalog.sqlite')
db.execute('begin')
quote = lambda value: 'null' if value is None else "'"+str(value).replace("'","''")+"'"
folder=args.root/'inventory-sql'
folder.mkdir(exist_ok=True)
for old in folder.glob('*.sql'):old.unlink()
class BatchWriter:
    def __init__(self, stream):self.stream=stream;self.rows=[];self.index=0
    def flush(self):
        if not self.rows:return
        (folder/f'{self.index:05}.sql').write_text('begin;\n'+''.join(self.rows)+'commit;\n',encoding='utf-8')
        self.rows=[];self.index+=1
    def write(self, value):
        self.stream.write(value)
        if value.startswith('insert '):
            self.rows.append(value)
            if len(self.rows)>=100:self.flush()
with (args.root/'inventory-import.sql.tmp').open('w',encoding='utf-8') as stream:
    output=BatchWriter(stream)
    output.write('-- Apply 20261118010000_product_inventory.sql first. Admin-only source inventory.\nbegin;\n')
    for row in db.execute('select id,source,source_id,name,normalized_name,category,source_url,document,collected_at from products'):
        values = [quote(value) for value in row]
        values[7] += '::jsonb'
        output.write('insert into private.product_inventory(id,source,source_id,name,normalized_name,category,source_url,document,collected_at) values('+','.join(values)+') on conflict(id) do update set name=excluded.name,normalized_name=excluded.normalized_name,category=excluded.category,document=excluded.document,collected_at=excluded.collected_at where private.product_inventory.review_state=\'not_reviewed\';\n')
    for row in db.execute('select product_id,source_url,sha256,original_path,preview_path,width,height,state,rights_status,error,updated_at from images'):
        output.write('insert into private.product_inventory_images(product_id,source_url,sha256,original_path,preview_path,width,height,download_state,rights_status,error,updated_at) values('+','.join(quote(value) for value in row)+') on conflict(product_id) do update set source_url=excluded.source_url,sha256=excluded.sha256,original_path=excluded.original_path,preview_path=excluded.preview_path,width=excluded.width,height=excluded.height,download_state=excluded.download_state,error=excluded.error,updated_at=excluded.updated_at where private.product_inventory_images.rights_status=\'permission_unconfirmed\';\n')
    output.write('commit;\n')
    output.flush()
(args.root/'inventory-import.sql.tmp').replace(args.root/'inventory-import.sql')
print(json.dumps({'products':db.execute('select count(*) from products').fetchone()[0],'sql':str(args.root/'inventory-import.sql')}))
