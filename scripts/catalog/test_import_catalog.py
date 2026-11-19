import json,sqlite3,tempfile,unittest
from pathlib import Path
from import_catalog import plan,import_phases
class ImportPlanTests(unittest.TestCase):
 def test_pending_collection_blocks_publication(self):
  with tempfile.TemporaryDirectory() as name:
   root=Path(name)
   with sqlite3.connect(root/'catalog.sqlite') as db:
    db.executescript("create table jobs(state);insert into jobs values('pending');create table images(state);create table products(id);")
   with self.assertRaisesRegex(RuntimeError,'COLLECTION_STILL_RUNNING'):plan(root)
 def test_stale_normalization_blocks_publication(self):
  with tempfile.TemporaryDirectory() as name:
   root=Path(name)
   with sqlite3.connect(root/'catalog.sqlite') as db:
    db.executescript("create table jobs(state);create table images(state);create table products(id);insert into products values('source');")
   (root/'normalization-report.json').write_text(json.dumps({'sourceRecords':0}))
   with self.assertRaisesRegex(RuntimeError,'STALE_NORMALIZATION'):plan(root)

 def test_parallel_phases_preserve_foreign_key_dependencies(self):
  with tempfile.TemporaryDirectory() as name:
   root=Path(name);source=root/'inventory-sql';canonical=root/'canonical-sql'
   source.mkdir();canonical.mkdir()
   product=source/'000.sql';product.write_text('insert into private.product_inventory(id) values(1);')
   mixed=source/'001.sql';mixed.write_text('insert into private.product_inventory(id) values(2);insert into private.product_inventory_images(product_id) values(1);')
   image=source/'002.sql';image.write_text('insert into private.product_inventory_images(product_id) values(2);')
   result=canonical/'000.sql';result.write_text('insert into public.catalog_products(id) values(1);')
   self.assertEqual(import_phases([result,image,mixed,product]),[[product],[mixed],[image],[result]])
