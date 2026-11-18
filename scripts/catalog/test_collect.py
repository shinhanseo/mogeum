import json
import tempfile
import unittest
from pathlib import Path

from collect import category_for, connect, normalize, parse_dailyshot, parse_thesool, store_product


class InventoryTests(unittest.TestCase):
    def test_retailer_import_excludes_reviews_and_description(self):
        product = {'@type': 'Product', 'name': 'Test Whisky 12 Years 700ml',
                   'category': ['싱글몰트 위스키'], 'keywords': ['Test Whisky', '싱글몰트 위스키', '데일리샷'],
                   'description': 'Do not publish this copied prose',
                   'review': [{'author': {'name': 'Private Person'}, 'reviewBody': 'Private review'}],
                   'image': ['https://example.com/bottle.webp'],
                   'offers': {'price': 75000, 'priceCurrency': 'KRW'},
                   'additionalProperty': [{'name': '도수', 'value': '40%'}]}
        html = '<script type="application/ld+json">' + json.dumps(product) + '</script>'
        parsed, source_id = parse_dailyshot(html, 'https://dailyshot.co/m/item/42')
        self.assertEqual(source_id, '42')
        self.assertEqual(parsed['category'], 'whisky')
        self.assertEqual(parsed['aliases'], [product['name'], 'Test Whisky'])
        self.assertEqual(parsed['tasteVerification'], 'not_reviewed')
        self.assertFalse(parsed['prices'][0]['personalSpending'])
        self.assertNotIn('Private', json.dumps(parsed))
        self.assertNotIn('copied prose', json.dumps(parsed))

    def test_domestic_title_uses_product_not_section_heading(self):
        html = '''<div class="product-view"><dl><dt class="subject">테스트 약주</dt>
        <dd><div class="info"><div class="title">상세 정보</div><ul class="info-list">
        <li><strong>알콜도수</strong><span>13%</span></li></ul></div></dd></dl></div>'''
        parsed, _ = parse_thesool(html, 'https://thesool.com/view.do?productId=PR000001')
        self.assertEqual(parsed['name'], '테스트 약주')
        self.assertEqual(parsed['attributes']['알콜도수'], '13%')

    def test_categories_preserve_unknown_and_foreign_spirits(self):
        self.assertEqual(category_for('위스키'), 'whisky')
        self.assertEqual(category_for('맥주'), 'beer')
        self.assertEqual(category_for('레드 와인'), 'wine')
        self.assertEqual(category_for('증류식 소주', '대한민국'), 'traditional')
        self.assertEqual(category_for('증류주', '중국'), 'other')
        self.assertEqual(category_for('리큐르', '멕시코'), 'other')

    def test_different_editions_are_not_merged_and_retries_are_idempotent(self):
        with tempfile.TemporaryDirectory() as directory:
            db = connect(Path(directory))
            for source_id in ['1', '1', '2']:
                url = 'https://dailyshot.co/m/item/' + source_id
                db.execute('insert or ignore into jobs(url,source) values(?,?)', (url, 'dailyshot'))
                document = {'id': 'dailyshot-' + source_id, 'name': 'Same Name', 'category': 'wine',
                            'aliases': [], 'imageSourceUrl': None, 'vintage': '2024' if source_id == '1' else '2023'}
                store_product(db, document, source_id, 'dailyshot', url)
            self.assertEqual(db.execute('select count(*) from products').fetchone()[0], 2)
            self.assertEqual(db.execute('select count(*) from product_search').fetchone()[0], 2)
            db.close()

    def test_name_normalization_preserves_strength_decimal(self):
        self.assertEqual(normalize('Test 11.5%'), 'test11.5')
        self.assertNotEqual(normalize('Test 11.5%'), normalize('Test 115%'))


if __name__ == '__main__':
    unittest.main()
