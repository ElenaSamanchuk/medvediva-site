# -*- coding: utf-8 -*-
"""Зеркало medvediva.kg: из выгрузки Тильды .kg (проект 9469007) берём только документы и футер (19.10.2026).
Остальные страницы зеркала — страницы .ru, их правит build-site.mjs (VITE_SITE=kg). Source JS не исполняется."""
import json,hashlib,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import normalize_export as ne

EXPORT=ne.ROOT/'sources/export/kg-2026-10-19/project9469007'
SOURCE=EXPORT.relative_to(ne.ROOT)
# Путь при нормализации — с префиксом /kg, чтобы не подхватить снимки и SEO-правки одноимённых страниц .ru
PAGES=[
 {'path':'/offer','pageId':'kg54435763','file':'page54435763.html'},
 {'path':'/personaldata','pageId':'kg54435745','file':'page54435745.html'},
 {'path':'/footer','pageId':'kg54435731','file':'page54435731.html'},
]

# В public/media кладём только картинки, на которые ссылаются эти страницы (не всю выгрузку)
pending={}
for p in sorted((EXPORT/'images').glob('*')):
 if not p.is_file() or p.suffix.lower() not in ('.jpg','.jpeg','.png','.webp','.gif','.svg','.ico','.avif'):continue
 name=hashlib.sha256(p.read_bytes()).hexdigest()[:24]+p.suffix.lower();pending['/media/'+name]=p
 ne.media.setdefault('images/'+p.name,'/media/'+name)
 ne.media_lower.setdefault(('images/'+p.name).lower(),'/media/'+name)

routes=[]
for page in PAGES:
 route={'path':'/kg'+page['path'],'canonical':'https://medvediva.kg'+page['path'],'file':str(SOURCE/page['file']),'pageId':page['pageId']}
 record=ne.compile_page(route)
 out=ne.OUT/(page['pageId']+'.json')
 data=json.loads(out.read_text());data['path']=page['path'];out.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
 record['path']=page['path'];routes.append(record)
used=''.join((ne.OUT/(page['pageId']+ext)).read_text() for page in PAGES for ext in ('.json','.css'))
for url,src in pending.items():
 dest=ne.MEDIA/url[len('/media/'):]
 if url in used and not dest.exists():dest.write_bytes(src.read_bytes())
(ne.OUT/'routes-kg.json').write_text(json.dumps(routes,ensure_ascii=False))
print(json.dumps({'pages':[r['path'] for r in routes],'unsupported':sum(len(r['unsupported']) for r in routes),'missingMedia':sum(r['missingMediaCount'] for r in routes)}))
