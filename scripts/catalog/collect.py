#!/usr/bin/env python3
"""Resumable, rate-limited public product inventory. Never promotes tasting facts."""
import argparse
import fcntl
import hashlib
import io
import math
import json
import re
import sqlite3
import threading
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

from bs4 import BeautifulSoup
from PIL import Image, ImageOps

USER_AGENT = 'MogeumCatalog/1.0'
DAILYSHOT = 'https://dailyshot.co'
THESOOL = 'https://thesool.com'
MAX_BODY = 12 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 40_000_000
LIMITER_LOCK = threading.Lock()
NEXT_REQUEST = {}
POLICIES = {}


def now():
    return datetime.now(timezone.utc).isoformat()


def normalize(value):
    return re.sub(r'[^\w.]', '', unicodedata.normalize('NFKC', value).casefold())


def fetch(url, delay=1.0):
    host = urllib.parse.urlsplit(url).hostname
    with LIMITER_LOCK:
        scheduled = max(time.monotonic(), NEXT_REQUEST.get(host, 0))
        NEXT_REQUEST[host] = scheduled + delay
    time.sleep(max(0, scheduled - time.monotonic()))
    request = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        # Do not follow redirects into an unrelated host.
        if urllib.parse.urlsplit(response.url).hostname != host:
            raise ValueError('Cross-host redirect requires source review')
        data = response.read(MAX_BODY + 1)
        if len(data) > MAX_BODY:
            raise ValueError('Response exceeds 12 MiB')
        return data, response.headers.get_content_type()


def connect(root):
    db = sqlite3.connect(root / 'catalog.sqlite', timeout=60)
    db.execute('pragma journal_mode=WAL')
    db.execute('pragma foreign_keys=ON')
    db.executescript('''
    create table if not exists jobs (
      url text primary key, source text not null, state text not null default 'pending',
      attempts integer not null default 0, error text, updated_at text
    );
    create table if not exists products (
      id text primary key, source text not null, source_id text not null,
      name text not null, normalized_name text not null, category text not null,
      source_url text not null, document text not null, collected_at text not null,
      unique(source, source_id)
    );
    create index if not exists product_names on products(normalized_name);
    create index if not exists product_categories on products(category);
    create table if not exists images (
      product_id text primary key references products(id), source_url text not null,
      original_path text, preview_path text, sha256 text, width integer, height integer,
      state text not null, rights_status text not null default 'permission_unconfirmed',
      error text, updated_at text not null
    );
    create table if not exists source_policies (
      source text primary key, robots_url text not null, robots_text text not null,
      checked_at text not null
    );
    create virtual table if not exists product_search using fts5(id unindexed, name, aliases);
    ''')
    return db


def policy(db, source, base):
    robots_url = base + '/robots.txt'
    data, _ = fetch(robots_url)
    robots = urllib.robotparser.RobotFileParser()
    text = data.decode('utf-8', errors='replace')
    robots.parse(text.splitlines())
    POLICIES[source] = robots
    db.execute('insert or replace into source_policies values(?,?,?,?)',
               (source, robots_url, text, now()))
    db.commit()
    return robots


def allowed(source, url):
    if source not in POLICIES or not POLICIES[source].can_fetch(USER_AGENT, url):
        raise ValueError('Robots policy does not allow this URL')


def seed_dailyshot(db, root):
    url = DAILYSHOT + '/sitemap-items.xml'
    allowed('dailyshot', url)
    data, _ = fetch(url)
    (root / 'sitemap-items.xml').write_bytes(data)
    urls = [node.text for node in ET.fromstring(data).iter()
            if node.tag.endswith('}loc') and node.text]
    rows = [(url, 'dailyshot') for url in urls
            if re.fullmatch(r'https://dailyshot\.co/m/item/\d+', url)]
    db.executemany('insert or ignore into jobs(url,source) values(?,?)', rows)
    db.commit()
    print(json.dumps({'dailyshot_discovered': len(rows)}), flush=True)


def seed_thesool(db, root):
    page = 1
    seen = set()
    while True:
        url = THESOOL + '/front/find/M000000082/list.do?pageIndex=' + str(page)
        allowed('thesool', url)
        data, _ = fetch(url)
        soup = BeautifulSoup(data, 'html.parser')
        ids = set(re.findall(r"move\('(PR\d+)'\)", str(soup)))
        fresh = ids - seen
        if not fresh:
            break
        seen.update(fresh)
        rows = [(THESOOL + '/front/find/M000000082/view.do?productId=' + item,
                 'thesool') for item in sorted(fresh)]
        db.executemany('insert or ignore into jobs(url,source) values(?,?)', rows)
        db.commit()
        if page % 10 == 0:
            print(json.dumps({'thesool_pages': page, 'discovered': len(seen)}), flush=True)
        page += 1
    print(json.dumps({'thesool_discovered': len(seen)}), flush=True)


def category_for(kind, country=''):
    kind = kind.casefold()
    if any(word in kind for word in ('위스키', 'whisky', 'whiskey', '버번')):
        return 'whisky'
    if any(word in kind for word in ('맥주', 'beer', '스타우트', 'ipa', '라거')):
        return 'beer'
    if any(word in kind for word in ('와인', 'wine', '샴페인', '스파클링', '포트와인')):
        return 'wine'
    if any(word in kind for word in ('막걸리', '탁주', '약주', '청주', '전통주')):
        return 'traditional'
    if '대한민국' in country or country in ('한국', 'South Korea'):
        if any(word in kind for word in ('소주', '증류주', '과실주', '리큐르')):
            return 'traditional'
    return 'other'


def parse_dailyshot(data, url):
    soup = BeautifulSoup(data, 'html.parser')
    public_details = {}
    hydration = soup.find('script', id='__NEXT_DATA__')
    if hydration:
        state = json.loads(hydration.get_text()).get('props', {}).get('pageProps', {}).get('dehydratedState', {})
        for query in state.get('queries', []):
            data = query.get('state', {}).get('data')
            if isinstance(data, dict) and str(data.get('id')) == url.rsplit('/', 1)[-1]:
                public_details = data
                break
    product = None
    for script in soup.select('script[type="application/ld+json"]'):
        parsed = json.loads(script.get_text())
        nodes = parsed if isinstance(parsed, list) else [parsed]
        for node in nodes:
            if node.get('@type') == 'Product':
                product = node
    if not product or not product.get('name'):
        title = soup.select_one('meta[property="og:title"]')
        image = soup.select_one('meta[property="og:image"]')
        product_type = soup.select_one('meta[property="og:type"]')
        if not title or not title.get('content') or not product_type or product_type.get('content') != 'product':
            raise ValueError('No public product title')
        name = title['content'].split(' 전국 가격비교')[0].strip()
        product = {'name': name, 'image': [image['content']] if image else [],
                   'category': [], 'additionalProperty': [], 'keywords': []}
    declared_url = product.get('url')
    og_url = soup.select_one('meta[property="og:url"]')
    declared_url = declared_url or (og_url.get('content') if og_url else None)
    if declared_url and urllib.parse.urlsplit(declared_url).path.rstrip('/') != urllib.parse.urlsplit(url).path.rstrip('/'):
        raise ValueError('Product URL does not match the requested item')
    props = {p['name']: p.get('value') for p in (product.get('additionalProperty') or [])
             if isinstance(p, dict) and 'name' in p}
    for attribute in public_details.get('information', []):
        if isinstance(attribute, dict) and attribute.get('label'):
            props.setdefault(attribute['label'], attribute.get('value'))
    for section in soup.find_all(string=re.compile(r'^Information$')):
        parent = section.parent.parent
        tokens = list(parent.stripped_strings)
        for key in ('종류', '국가', '용량', '도수', '품종', '지역', '케이스'):
            if key in tokens and tokens.index(key) + 1 < len(tokens):
                props.setdefault(key, tokens[tokens.index(key) + 1])
    categories = product.get('category', [])
    if isinstance(categories, str):
        categories = [categories]
    categories = [value for value in categories if isinstance(value, str)]
    source_id = url.rsplit('/', 1)[-1]
    offers = product.get('offers') or {}
    if not offers and isinstance(public_details.get('price'), (int, float)):
        offers = {'price': public_details['price'], 'priceCurrency': 'KRW'}
    price = {key: offers[key] for key in ('price', 'lowPrice', 'highPrice', 'priceCurrency')
             if key in offers and (key == 'priceCurrency' or
                (isinstance(offers[key], (int, float)) and math.isfinite(offers[key]) and offers[key] >= 0))}
    keywords = product.get('keywords') or []
    if isinstance(keywords, str):
        keywords = [keywords]
    if public_details.get('en_name'):
        keywords.append(public_details['en_name'])
    keywords = [value for value in keywords if isinstance(value, str)]
    images = product.get('image') or []
    if isinstance(images, str):
        images = [images]
    # Never ingest customer review names, review bodies, or marketing prose.
    document = {
        'id': 'dailyshot-' + source_id, 'name': product['name'],
        'category': category_for(' '.join(categories + [str(props.get('종류', ''))]),
                                 str(props.get('국가', ''))),
        'sourceCategories': categories, 'attributes': props,
        'sourceProductId': public_details.get('top_product_id'),
        'retailerProvidedNotes': [
            {'dimension': note.get('label_ko'), 'terms': note.get('value')}
            for note in (public_details.get('tasting_notes') or [])
            if isinstance(note, dict) and note.get('label_ko') in ('향', '맛', '여운')
        ],
        'editionFields': {'yearMentionInName': (re.search(r'(?<!\d)(?:19|20)\d{2}(?!\d)', product['name']).group(0)
                          if re.search(r'(?<!\d)(?:19|20)\d{2}(?!\d)', product['name']) else None)},
        'aliases': list(dict.fromkeys([product['name']] + [word for word in keywords
                    if word not in categories and word != '데일리샷'])),
        'prices': [{**price, 'observedAt': now(), 'sourceUrl': url,
                    'kind': 'retailer_listing', 'personalSpending': False}] if price else [],
        'source': {'provider': 'dailyshot', 'url': url, 'checkedAt': now()},
        'imageSourceUrl': images[0] if images else None,
        'rightsStatus': 'permission_unconfirmed', 'tasteVerification': 'not_reviewed',
    }
    return document, source_id


def parse_thesool(data, url):
    soup = BeautifulSoup(data, 'html.parser')
    info = soup.select_one('.product-view .info') or soup.select_one('.info')
    if not info:
        raise ValueError('Missing product info')
    title = soup.select_one('.product-view > dl > dt.subject')
    if not title:
        raise ValueError('Missing product name')
    attributes = {}
    for li in soup.select('.product-view .info-list > li, .product-view .place li'):
        label = li.find('strong')
        if label and label.get_text(' ', strip=True) != '문의':
            key = label.get_text(' ', strip=True)
            value = li.get_text(' ', strip=True)[len(key):].strip()
            attributes[key] = value
    source_id = urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)['productId'][0]
    return {
        'id': 'thesool-' + source_id.lower(), 'name': title.get_text(' ', strip=True),
        'category': 'traditional', 'attributes': attributes, 'aliases': [], 'prices': [],
        'source': {'provider': 'thesool', 'url': url, 'checkedAt': now()},
        'imageSourceUrl': THESOOL + '/common/imageView.do?targetId=' + source_id + '&targetNm=PRODUCT',
        'rightsStatus': 'permission_unconfirmed', 'tasteVerification': 'not_reviewed',
    }, source_id


def store_product(db, document, source_id, source, url):
    product_id = document['id']
    db.execute('''insert into products values(?,?,?,?,?,?,?,?,?)
        on conflict(id) do update set name=excluded.name,normalized_name=excluded.normalized_name,
        category=excluded.category,document=excluded.document,collected_at=excluded.collected_at''',
        (product_id, source, source_id, document['name'], normalize(document['name']),
         document['category'], url, json.dumps(document, ensure_ascii=False), now()))
    db.execute('delete from product_search where id=?', (product_id,))
    db.execute('insert into product_search values(?,?,?)',
               (product_id, document['name'], ' '.join(document['aliases'])))
    if document['imageSourceUrl']:
        db.execute('''insert into images(product_id,source_url,state,updated_at) values(?,?,'pending',?)
          on conflict(product_id) do update set source_url=excluded.source_url,
          state=case when images.source_url=excluded.source_url then images.state else 'pending' end''',
          (product_id, document['imageSourceUrl'], now()))
    db.execute("update jobs set state='done',error=null,updated_at=? where url=?", (now(), url))
    db.commit()


def product_job(root, row):
    url, source = row
    db = connect(root)
    try:
        allowed(source, url)
        data, content_type = fetch(url)
        if content_type != 'text/html':
            raise ValueError('Expected product HTML')
        document, source_id = (parse_dailyshot if source == 'dailyshot' else parse_thesool)(data, url)
        store_product(db, document, source_id, source, url)
    except Exception as error:
        status = 'gone' if isinstance(error, urllib.error.HTTPError) and error.code in (404, 410) else 'failed'
        db.execute('update jobs set state=?,error=?,updated_at=? where url=?',
                   (status, str(error)[:500], now(), url))
        db.commit()
    finally:
        db.close()


def image_job(root, row):
    product_id, url = row
    db = connect(root)
    try:
        host = urllib.parse.urlsplit(url).hostname
        if host not in ('thesool.com', 'd1e2y5wc27crnp.cloudfront.net'):
            raise ValueError('Image origin requires review: ' + str(host))
        data, content_type = fetch(url, delay=0.5)
        if not (content_type.startswith('image/') or content_type == 'application/octet-stream'):
            raise ValueError('Expected image content type')
        digest = hashlib.sha256(data).hexdigest()
        image = Image.open(io.BytesIO(data))
        if image.width * image.height > Image.MAX_IMAGE_PIXELS:
            raise ValueError('Image exceeds 40 million pixels')
        image.load()
        source_format = image.format
        image = ImageOps.exif_transpose(image)
        if min(image.size) < 80:
            raise ValueError('Image too small')
        extension = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
                     'image/gif': 'gif'}.get(content_type) or {
                         'JPEG': 'jpg', 'PNG': 'png', 'WEBP': 'webp', 'GIF': 'gif'
                     }.get(source_format, 'img')
        original = Path('images/original') / (digest + '.' + extension)
        preview = Path('images/preview') / (digest + '.webp')
        (root / original).parent.mkdir(parents=True, exist_ok=True)
        (root / preview).parent.mkdir(parents=True, exist_ok=True)
        (root / original).write_bytes(data)
        width, height = image.size
        image.thumbnail((768, 768), Image.Resampling.LANCZOS)
        image.convert('RGBA').save(root / preview, 'WEBP', quality=90)
        db.execute('''update images set original_path=?,preview_path=?,sha256=?,width=?,height=?,
          state='downloaded',error=null,updated_at=? where product_id=?''',
          (str(original), str(preview), digest, width, height, now(), product_id))
    except Exception as error:
        db.execute("update images set state='failed',error=?,updated_at=? where product_id=?",
                   (str(error)[:500], now(), product_id))
    db.commit()
    db.close()


def report(db, root):
    counts = dict(db.execute('select category,count(*) from products group by category'))
    sources = dict(db.execute('select source,count(*) from products group by source'))
    jobs = dict(db.execute('select state,count(*) from jobs group by state'))
    images = dict(db.execute('select state,count(*) from images group by state'))
    result = {'at': now(), 'products': sum(counts.values()), 'categories': counts, 'sources': sources,
              'jobs': jobs, 'images': images, 'publicImageReuseApproved': 0,
              'recommendationFactsAutoPromoted': 0}
    (root / 'report.json.tmp').write_text(json.dumps(result, ensure_ascii=False, indent=2))
    (root / 'report.json.tmp').replace(root / 'report.json')
    print(json.dumps(result, ensure_ascii=False), flush=True)
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, default=Path('artifacts/catalog-ingestion'))
    parser.add_argument('--seed', choices=('dailyshot', 'thesool', 'all'))
    parser.add_argument('--limit', type=int, default=200)
    parser.add_argument('--images', type=int, default=0)
    parser.add_argument('--workers', type=int, default=3)
    parser.add_argument('--retry', action='store_true')
    parser.add_argument('--continuous', action='store_true')
    args = parser.parse_args()
    if args.limit < 0 or args.images < 0 or args.workers < 1:
        parser.error('Counts must be non-negative and workers positive')
    if args.continuous and (args.limit == 0 or args.images == 0):
        parser.error('Continuous mode needs positive product and image batch sizes')
    args.root.mkdir(parents=True, exist_ok=True)
    lock = (args.root / 'collector.lock').open('a')
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    db = connect(args.root)
    for source, base in [('dailyshot', DAILYSHOT), ('thesool', THESOOL)]:
        policy(db, source, base)
    if args.seed in ('dailyshot', 'all'):
        seed_dailyshot(db, args.root)
    if args.seed in ('thesool', 'all'):
        seed_thesool(db, args.root)
    if args.retry:
        db.execute("update jobs set state='pending' where state='failed' and attempts<3")
        db.execute("update images set state='pending' where state='failed'")
        db.commit()
    while True:
        # Alternate sources so smaller domestic catalog is not starved by the retailer queue.
        rows = db.execute('''select url,source from
          (select url,source,row_number() over(partition by source order by url) as n
           from jobs where state='pending') order by n,source limit ?''', (args.limit,)).fetchall()
        for url, _ in rows:
            db.execute("update jobs set attempts=attempts+1,updated_at=? where url=?", (now(), url))
        db.commit()
        with ThreadPoolExecutor(max_workers=min(args.workers, 4)) as pool:
            for index, _ in enumerate(pool.map(lambda row: product_job(args.root, row), rows), 1):
                if index % 50 == 0:
                    report(db, args.root)
        rows = db.execute("select product_id,source_url from images where state='pending' limit ?",
                          (args.images,)).fetchall()
        with ThreadPoolExecutor(max_workers=min(args.workers, 4)) as pool:
            for index, _ in enumerate(pool.map(lambda row: image_job(args.root, row), rows), 1):
                if index % 50 == 0:
                    report(db, args.root)
        report(db, args.root)
        if args.continuous:
            import subprocess
            import sys
            subprocess.run([sys.executable, str(Path(__file__).with_name('export.py')),
                            '--root', str(args.root)], check=True)
        if not args.continuous or (not db.execute("select 1 from jobs where state='pending' limit 1").fetchone()
                                   and not db.execute("select 1 from images where state='pending' limit 1").fetchone()):
            break
    db.close()


if __name__ == '__main__':
    main()
