#!/usr/bin/env python3
"""Resume a completed, validated catalog import using the authenticated Supabase CLI.
Dry-run by default. Source data and image files remain outside git.
"""
import argparse,fcntl,hashlib,json,sqlite3,subprocess
from pathlib import Path
PROJECT='vsckzjfgzdpzkzuumldf'

def plan(root):
    with sqlite3.connect(root/'catalog.sqlite') as db:
        if db.execute('pragma integrity_check').fetchone()[0]!='ok':raise RuntimeError('INVENTORY_INTEGRITY_FAILED')
        if db.execute("select count(*) from jobs where state='pending'").fetchone()[0]:raise RuntimeError('COLLECTION_STILL_RUNNING')
        if db.execute("select count(*) from images where state='pending'").fetchone()[0]:raise RuntimeError('IMAGES_STILL_PENDING')
        count=db.execute('select count(*) from products').fetchone()[0]
    report=json.loads((root/'normalization-report.json').read_text())
    if report['sourceRecords']!=count:raise RuntimeError('STALE_NORMALIZATION')
    canonical=[json.loads(line) for line in (root/'canonical-products.jsonl').read_text().splitlines() if line]
    if len(canonical)!=report['canonicalProducts'] or len({row['id'] for row in canonical})!=len(canonical):raise RuntimeError('INVALID_CANONICAL_EXPORT')
    files=sorted((root/'inventory-sql').glob('*.sql'))+sorted((root/'canonical-sql').glob('*.sql'))
    if not files:raise RuntimeError('MISSING_SQL_BATCHES')
    return files,report

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--root',type=Path,required=True)
    parser.add_argument('--project-ref',choices=[PROJECT],default=PROJECT);parser.add_argument('--execute',action='store_true')
    args=parser.parse_args();root=args.root.resolve();files,report=plan(root)
    print(json.dumps({'project':args.project_ref,'batches':len(files),'execute':args.execute,**report}),flush=True)
    if not args.execute:return
    lock=(root/'import.lock').open('a');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    checkpoint_path=root/'production-import-checkpoint.json'
    checkpoint=json.loads(checkpoint_path.read_text()) if checkpoint_path.exists() else {'project':args.project_ref,'completed':[]}
    if checkpoint['project']!=args.project_ref:raise RuntimeError('CHECKPOINT_PROJECT_MISMATCH')
    completed=set(checkpoint['completed'])
    for index,file in enumerate(files):
        digest=hashlib.sha256(file.read_bytes()).hexdigest()
        key=str(file.relative_to(root))+':'+digest
        if key in completed:continue
        result=subprocess.run(['node_modules/.bin/supabase','db','query','--linked','--project-ref',args.project_ref,'--file',str(file)],capture_output=True,text=True,timeout=120)
        if result.returncode:raise RuntimeError('IMPORT_BATCH_FAILED: '+str(file.relative_to(root))+' '+result.stderr[-1000:])
        completed.add(key);checkpoint['completed']=sorted(completed)
        temporary=checkpoint_path.with_suffix('.tmp');temporary.write_text(json.dumps(checkpoint,indent=2));temporary.replace(checkpoint_path)
        print(json.dumps({'batch':index+1,'total':len(files)}),flush=True)
    (root/'production-import-finished.json').write_text(json.dumps({'project':args.project_ref,**report,'batches':len(files)},indent=2))

if __name__=='__main__':main()
