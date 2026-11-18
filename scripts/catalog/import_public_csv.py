#!/usr/bin/env python3
"""Import the aT public dataset; preserve source-specific IDs and original field provenance."""
import argparse
import csv
import hashlib
import io
import json
from pathlib import Path
from collect import connect, now, store_product, fetch
import re
import urllib.request
import urllib.parse

parser = argparse.ArgumentParser()
parser.add_argument('--root', type=Path, default=Path('artifacts/catalog-ingestion'))
args = parser.parse_args()
path = args.root / 'raw/traditional-public.csv'
if not path.exists():
    page, _ = fetch('https://www.data.go.kr/data/15048755/fileData.do')
    match = re.search(rb"fn_fileDataDown\('15048755', '(uddi:[a-f0-9-]+)'", page)
    if not match:
        raise RuntimeError('Public CSV download reference changed')
    query = urllib.parse.urlencode({'publicDataDetailPk': match.group(1).decode(),
        'publicDataPk': '15048755', 'atchFileId': '', 'fileDetailSn': '1',
        'publicDataTyCode': 'PR0051'})
    response, _ = fetch('https://www.data.go.kr/tcs/dss/selectFileDataDownload.do?' + query)
    download = json.loads(response)
    if download.get('status') is not True:
        raise RuntimeError('Public CSV download unavailable')
    params = {'atchFileId':download['atchFileId'], 'fileDetailSn':download['fileDetailSn']}
    request = urllib.request.Request('https://www.data.go.kr/cmm/cmm/check-limit.json',
        data=urllib.parse.urlencode(params).encode(), headers={'User-Agent':'MogeumCatalog/1.0'})
    with urllib.request.urlopen(request, timeout=30) as response:
        limit = json.load(response)
    if limit.get('needCaptcha') is not False:
        raise RuntimeError('Public data portal requires manual download verification')
    query = urllib.parse.urlencode(params | {'dataNm':'전통주정보'})
    raw, _ = fetch('https://www.data.go.kr/cmm/cmm/fileDownload.do?' + query)
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_bytes(raw)
raw = path.read_bytes()
text = raw.decode('cp949')
rows = list(csv.DictReader(io.StringIO(text)))
db = connect(args.root)
for index, row in enumerate(rows):
    row = {key.strip(): value.strip() for key,value in row.items() if key and value}
    name = row.get('제품명', '')
    if not name:
        continue
    source_id = hashlib.sha256((name + '|' + row.get('양조장','') + '|' + '|'.join(
        row.get(key,'') for key in ['알콜도수1','알콜도수2','알콜도수3','용량1','용량2','용량3'])).encode()).hexdigest()[:24]
    existing = db.execute('select document from products where id=?', ('at-' + source_id,)).fetchone()
    if existing and json.loads(existing[0])['attributes'] != row:
        source_id += '-' + hashlib.sha256(json.dumps(row,sort_keys=True,ensure_ascii=False).encode()).hexdigest()[:8]
    url = 'https://www.data.go.kr/data/15048755/fileData.do#' + source_id
    document = {'id': 'at-' + source_id, 'name': name, 'category': 'traditional',
        'attributes': row, 'aliases': [name], 'prices': [], 'imageSourceUrl': None,
        'source': {'provider': 'at-public-data', 'url': url, 'checkedAt': now(),
                   'datasetDate': '2026-07-31', 'license': '이용허락범위 제한 없음',
                   'fileSha256': hashlib.sha256(raw).hexdigest()},
        'tasteVerification': 'not_reviewed', 'rightsStatus': 'public_data_unrestricted'}
    db.execute('insert or ignore into jobs(url,source) values(?,?)', (url,'at-public-data'))
    store_product(db,document,source_id,'at-public-data',url)
print({'inputRows':len(rows),'stored':db.execute("select count(*) from products where source='at-public-data'").fetchone()[0]})
db.close()
