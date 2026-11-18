import json,tempfile,unittest
from pathlib import Path
from export_canonical_sql import alias,export
class ExportTests(unittest.TestCase):
 def test_alias_matches_client_nfkd_and_decimal_rules(self):
  self.assertEqual(alias('테스트 4,5%'), '테스트4decimal5')
  self.assertEqual(alias('Château 12.5'), 'chateau12decimal5')
 def test_export_is_bounded_quoted_and_preserves_held(self):
  with tempfile.TemporaryDirectory() as name:
   root=Path(name)
   row={'id':'inventory-'+'a'*32,'familyId':'family','normalizedName':'drink','identity':[], 'state':'ready','primaryInventoryId':'source-1','mappingVersion':'v1','inventoryIds':['source-1'], 'document':{'name':"O'Brien",'category':'whisky','aliases':["O'Brien"],'features':[{'id':'향:과일 향'}]}}
   (root/'canonical-products.jsonl').write_text(json.dumps(row)+'\n')
   self.assertEqual(export(root),{'products':1,'batches':1})
   sql=(root/'canonical-sql/00000.sql').read_text()
   self.assertIn("O''Brien",sql);self.assertIn("state<>'held'",sql)
   self.assertTrue(sql.startswith('begin;'));self.assertTrue(sql.endswith('commit;\n'))
