import unittest
from normalize import canonicalize,mapped_features


def row(key,name='샘플 700ml',volume='700ml',abv='40%'):
    return {'id':key,'name':name,'category':'whisky','attributes':{'용량':volume,'도수':abv},
            'aliases':[],'retailerProvidedNotes':[{'dimension':'향','terms':'사과, 오크'}],
            'source':{'provider':'dailyshot','url':'https://dailyshot.co/m/item/1','checkedAt':'2026-11-19T00:00:00Z'}}


class NormalizationTests(unittest.TestCase):
    def test_volume_units_dedupe_but_different_strength_stays_separate(self):
        products,report=canonicalize([row('a'),row('b',name='샘플 0.7L',volume='0.7L'),row('c',abv='46%')])
        self.assertEqual(len(products),2)
        self.assertEqual(report['mergedRecords'],1)
        self.assertEqual(sorted(len(p['inventoryIds']) for p in products),[1,2])

    def test_aroma_never_becomes_sweetness_or_low_alcohol(self):
        document=row('a');document['retailerProvidedNotes']=[{'dimension':'향','terms':'바닐라, 꿀, 부드러운'}]
        features=mapped_features(document)
        self.assertEqual([f['id'] for f in features],['향:꿀·바닐라 향'])

    def test_unrecognized_terms_and_gift_sets_are_not_recommendations(self):
        document=row('a');document['retailerProvidedNotes']=[{'dimension':'향','terms':'달지 않은, 가벼운 도수'}]
        products,_=canonicalize([document,row('b',name='샘플 전용잔 세트')])
        self.assertTrue(all(p['state']=='identity-only' for p in products))

    def test_wine_years_are_kept_in_identity(self):
        a=row('a',name='샘플 2020');a['category']='wine'
        b=row('b',name='샘플 2021');b['category']='wine'
        products,_=canonicalize([a,b])
        self.assertEqual(len(products),2)
        self.assertTrue(all('제품명 표기 연도' in p['document']['edition'] for p in products))

if __name__=='__main__':unittest.main()
