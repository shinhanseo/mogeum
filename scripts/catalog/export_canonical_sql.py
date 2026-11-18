#!/usr/bin/env python3
"""Export bounded, replay-safe imports. Run after inventory-import.sql."""
import argparse,json,re,unicodedata
from pathlib import Path

def alias(value):
    value=''.join(c for c in unicodedata.normalize('NFKD',value).lower() if not unicodedata.combining(c))
    value=re.sub(r'(?<=\d)[.,](?=\d)','decimal',value)
    return ''.join(c for c in value if unicodedata.category(c)[0] in 'LN')

def quote(value):return "'"+str(value).replace("'","''")+"'"
def export(root):
    rows=[json.loads(line) for line in (root/'canonical-products.jsonl').read_text().splitlines() if line]
    folder=root/'canonical-sql';folder.mkdir(exist_ok=True)
    for old in folder.glob('*.sql'):old.unlink()
    for start in range(0,len(rows),100):
        statements=['begin;']
        for row in rows[start:start+100]:
            document=row['document']
            values=[row['id'],row['familyId'],document['category'],row['normalizedName'],json.dumps(row['identity'],ensure_ascii=False),json.dumps(document,ensure_ascii=False),row['state'],row['primaryInventoryId'],row['mappingVersion']]
            encoded=[quote(v)+('::jsonb' if i in (4,5) else '') for i,v in enumerate(values)]
            statements.append('insert into public.catalog_products(id,family_id,category,normalized_name,identity,document,state,primary_inventory_id,mapping_version) values('+','.join(encoded)+") on conflict(id) do update set document=excluded.document,state=excluded.state,mapping_version=excluded.mapping_version,updated_at=now() where catalog_products.state<>'held';")
            for inventory_id in row['inventoryIds']:
                statements.append('insert into private.catalog_inventory_links(inventory_id,product_id) values('+quote(inventory_id)+','+quote(row['id'])+') on conflict(inventory_id) do nothing;')
            statements.append('delete from public.catalog_product_aliases where product_id='+quote(row['id'])+';')
            statements.append('delete from public.catalog_product_features where product_id='+quote(row['id'])+';')
            for name in sorted(set(alias(name) for name in [document['name']]+document['aliases'])):
                if name:statements.append('insert into public.catalog_product_aliases(alias,product_id) values('+quote(name)+','+quote(row['id'])+') on conflict do nothing;')
            for feature in document['features']:
                statements.append('insert into public.catalog_product_features(feature_id,product_id) values('+quote(feature['id'])+','+quote(row['id'])+') on conflict do nothing;')
        statements.append('commit;')
        (folder/f'{start//100:05}.sql').write_text('\n'.join(statements)+'\n')
    return {'products':len(rows),'batches':(len(rows)+99)//100}
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--root',type=Path,default=Path('artifacts/catalog-ingestion'))
    print(json.dumps(export(parser.parse_args().root)))
