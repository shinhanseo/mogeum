#!/usr/bin/env python3
"""Exact edition grouping and literal, provenance-preserving tasting term mapping."""
import argparse
import hashlib
import json
import re
import sqlite3
from decimal import Decimal
from collections import defaultdict
from pathlib import Path
from collect import normalize

FRUIT = {'사과','배','복숭아','살구','자두','체리','딸기','라즈베리','블랙베리','블루베리','블랙커런트','레몬','라임','자몽','오렌지','감귤','시트러스','파인애플','망고','바나나','열대 과일','열대과일','과일','말린 과일','건포도','청사과','풋사과'}
FLOWER = {'꽃','꽃 향','꽃향','플로럴','장미','제비꽃','아카시아','흰 꽃','흰꽃','재스민'}
WOOD = {'오크','나무','삼나무','참나무','오크 나무','우디'}
VANILLA = {'바닐라','꿀','허니','바닐라빈'}
SMOKE = {'스모키','훈연','연기','스모크'}
GRAIN = {'쌀','곡물','맥아','보리','밀','빵','비스킷','구운 빵','곡물 향'}
ROAST = {'커피','초콜릿','다크 초콜릿','코코아','에스프레소','로스팅'}
BERRY = {'딸기','체리','블랙베리','라즈베리','블루베리','블랙커런트','베리','붉은 과일','검은 과일'}
CITRUS = {'레몬','자몽','라임','오렌지','감귤','시트러스'}
APPLE = {'사과','배','청사과','풋사과'}
TROPICAL = {'파인애플','망고','바나나','열대과일','열대 과일','패션프루트'}
BASIC = {'과일':'과일 향','꽃':'꽃 향','꿀·바닐라':'꿀·바닐라 향','나무':'나무 향','연기':'연기 향'}


def mapped_features(document):
    found = {}
    category = document['category']
    for note in document.get('retailerProvidedNotes', []):
        dimension = note.get('dimension')
        terms = re.split(r'[,，/]', note.get('terms') or '')
        for raw in terms:
            term = raw.strip()
            labels = []
            if dimension == '향':
                if term in FRUIT: labels.append('과일 향')
                if term in FLOWER: labels.append('꽃 향')
                if term in WOOD: labels.append('나무 향')
                if term in VANILLA: labels.append('꿀·바닐라 향')
                if term in SMOKE: labels.append('연기 향')
                if category == 'wine':
                    if term in BERRY: labels.append('베리·체리 향')
                    if term in APPLE: labels.append('사과·배 향')
                    if term in CITRUS: labels.append('레몬·자몽 향')
                    if term in WOOD | VANILLA: labels.append('나무·바닐라 향')
                if category == 'beer':
                    if term in CITRUS: labels.append('레몬·자몽 향')
                    if term in TROPICAL: labels.append('열대과일 향')
                    if term in FLOWER | {'풀','풀내음'}: labels.append('꽃·풀 향')
                    if term in GRAIN: labels.extend(['빵·곡물 향','곡물·맥아 향'])
                    if term in ROAST: labels.append('커피·초콜릿 향')
                if category == 'traditional':
                    if term in GRAIN: labels.append('쌀·곡물 향')
                    if term in {'견과류','아몬드','호두'}: labels.append('견과류 향')
            elif dimension == '맛':
                label = {'달콤한':'달콤한 맛','단맛':'달콤한 맛','쌉쌀한':'쌉쌀한 맛',
                         '쓴맛':'쌉쌀한 맛','고소한':'고소한 맛'}.get(term)
                if label: labels.append(label)
                if category != 'whisky' and term in {'새콤한','신맛','산미'}: labels.append('새콤한 맛')
            for label in labels:
                feature_id = dimension + ':' + label
                found.setdefault(feature_id, {'id':feature_id,'label':label,'dimension':dimension,
                    'evidence':f"판매처가 제공한 {dimension} 항목의 ‘{term}’ 표현을 분류했어요. 실제 느낌은 다를 수 있어요."})
    return list(found.values())


def numeric_value(value, volume=False):
    raw=str(value).strip().lower()
    match=re.fullmatch(r'(\d+(?:\.\d+)?)\s*(ml|cl|l|%|도)?',raw)
    if not match:
        return normalize(raw)
    amount=Decimal(match.group(1));unit=match.group(2)
    if volume:
        amount *= {'l':1000,'cl':10,'ml':1,None:1}.get(unit,1)
        return format(amount.normalize(),'f')+'ml'
    return format(amount.normalize(),'f')+'%'


def identity(document):
    attrs = document['attributes']
    def values(keys,volume=False):
        return sorted(set(numeric_value(attrs[key],volume) for key in keys if attrs.get(key)))
    abv = values(['도수','알콜도수','알콜도수1','알콜도수2','알콜도수3'])
    volume = values(['용량','용량1','용량2','용량3'],True)
    # Only remove explicitly written volume, never years, proof, strength or cask edition.
    base_name = re.sub(r'(?<!\d)\d+(?:\.\d+)?\s*(?:ml|cl|l)(?![a-zA-Z])','',document['name'],flags=re.I).strip()
    pack = bool(re.search(r'세트|패키지|전용잔|잔포함|잔 포함|\d+병|\d+본', document['name']))
    producer=next((normalize(str(attrs[key])) for key in ['양조장','양조장명','제조사','생산자','브랜드'] if attrs.get(key)),None)
    scope=producer or 'source:'+document['source']['provider']
    signature = [document['category'],normalize(base_name),abv,volume,pack,scope,normalize(str(attrs.get('종류','')))]
    family = [document['category'],normalize(base_name),abv,pack,scope]
    return signature, family, base_name, pack


def canonicalize(rows):
    groups = defaultdict(list)
    skipped = 0
    for document in rows:
        if document['category'] not in ('whisky','wine','beer','traditional') or not document['name'].strip() or len(document['name'])>300:
            skipped += 1
            continue
        signature, family, base_name, pack = identity(document)
        key = json.dumps(signature,ensure_ascii=False,separators=(',',':'))
        groups[key].append((document,family,base_name,pack))
    output = []
    for key, members in sorted(groups.items()):
        # Prefer a source with direct structured tasting terms. Other source observations stay linked.
        members.sort(key=lambda member:(-len(mapped_features(member[0])),member[0]['id']))
        primary,family,base_name,pack=members[0]
        features=[] if pack or len(json.loads(key)[2])>1 else mapped_features(primary)
        product_id='inventory-'+hashlib.sha256(key.encode()).hexdigest()[:32]
        family_id='inventory-'+hashlib.sha256(json.dumps(family,ensure_ascii=False).encode()).hexdigest()[:32]
        aliases=sorted(set(value for member,_,base,_ in members for value in [member['name'],base]+member.get('aliases',[]) if isinstance(value,str) and 0<len(value)<=300))[:60]
        attrs=primary['attributes']
        edition_parts=[str(attrs[key]) for key in ['도수','알콜도수','알콜도수1','용량','용량1'] if attrs.get(key)]
        year=re.search(r'(?<!\d)(?:19|20)\d{2}(?!\d)',primary['name']) if primary['category']=='wine' else None
        if year: edition_parts.insert(0,'제품명 표기 연도 '+year.group(0))
        elif primary['category']=='wine': edition_parts.insert(0,'빈티지 미확인')
        source_kind='retailer' if primary['source']['provider']=='dailyshot' else 'public-dataset'
        source_title='데일리샷 · 제품 정보' if source_kind=='retailer' else 'aT·더술 · 전통주 제품 정보'
        document={'id':product_id,'familyId':family_id,'name':primary['name'],'category':primary['category'],
            'edition':' · '.join(edition_parts)[:300] or '출처 제품명 기준 · 세부 판본 확인',
            'aliases':aliases,'baseAliases':[],'features':features,
            'source':{'url':primary['source']['url'],'title':source_title,
                      'checkedAt':primary['source']['checkedAt'][:10],'kind':source_kind},
            'description':'출처에서 제공한 제품 정보예요. '+ ('향과 맛은 판매처 테이스팅 표현을 분류한 것으로 실제 경험과 다를 수 있어요.' if features else '맛 특징이 확인되지 않아 개인화 추천 근거로 사용하지 않아요.')}
        output.append({'id':product_id,'familyId':family_id,'identity':json.loads(key),
            'normalizedName':normalize(base_name),'state':'ready' if features else 'identity-only',
            'document':document,'inventoryIds':[member[0]['id'] for member in members],
            'primaryInventoryId':primary['id'],'mappingVersion':'literal-terms-v1'})
    return output,{'sourceRecords':len(rows),'canonicalProducts':len(output),'mergedRecords':sum(len(row['inventoryIds'])-1 for row in output),'skippedOtherOrInvalid':skipped,'recommendable':sum(row['state']=='ready' for row in output)}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--root',type=Path,default=Path('artifacts/catalog-ingestion'))
    args=parser.parse_args()
    db=sqlite3.connect(args.root/'catalog.sqlite');db.execute('begin')
    rows=[json.loads(row[0]) for row in db.execute('select document from products')]
    products,report=canonicalize(rows)
    with (args.root/'canonical-products.jsonl.tmp').open('w',encoding='utf-8') as stream:
        for product in products:stream.write(json.dumps(product,ensure_ascii=False)+'\n')
    (args.root/'canonical-products.jsonl.tmp').replace(args.root/'canonical-products.jsonl')
    (args.root/'normalization-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps(report,ensure_ascii=False))

if __name__=='__main__':main()
