import json,sqlite3,tempfile,unittest
from pathlib import Path
from import_catalog import plan
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
