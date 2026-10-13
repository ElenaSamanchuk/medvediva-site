# -*- coding: utf-8 -*-
"""Read-only public source acquisition. No JS execution, forms or private routes."""
from pathlib import Path
import json, subprocess, hashlib, datetime, urllib.parse
from html.parser import HTMLParser
ROOT=Path(__file__).resolve().parents[1]
class Inventory(HTMLParser):
 def __init__(self):
  super().__init__(); self.links=[]; self.assets=[]; self.ids=[]; self.meta=[]; self.forms=[]; self.canonical=None; self.title=''; self.intitle=False
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if a.get('id'): self.ids.append(a['id'])
  if tag=='title': self.intitle=True
  if tag=='a' and a.get('href'): self.links.append(a['href'])
  if tag=='meta': self.meta.append(a)
  if tag=='form': self.forms.append({k:v for k,v in a.items() if k in ['id','action','method','data-formactiontype']})
  if tag=='link' and a.get('rel')=='canonical': self.canonical=a.get('href')
  for key in ['src','data-original','data-src','poster']:
   if a.get(key): self.assets.append(a[key])
  if tag=='link' and a.get('href') and a.get('rel')!='canonical': self.assets.append(a['href'])
 def handle_endtag(self,tag):
  if tag=='title': self.intitle=False
 def handle_data(self,data):
  if self.intitle: self.title+=data
manifest=json.loads((ROOT/'sources/route-manifest.json').read_text())
for i,row in enumerate(manifest['routes']):
 path=urllib.parse.urlparse(row['url']).path
 target=ROOT/'sources/live'/('index.html' if path=='/' else path.strip('/').replace('/','__')+('.html' if not path.endswith('.html') else ''))
 if not target.exists():
  r=subprocess.run(['curl','--silent','--show-error','--location','--fail','--max-time','25',row['url'],'-o',str(target)],capture_output=True,text=True)
  if r.returncode:
   row.update(status='capture_failed',error=r.stderr[:200]); print(i+1,'FAIL',path,flush=True); continue
 data=target.read_bytes(); p=Inventory(); p.feed(data.decode('utf-8',errors='replace'))
 row.update(status='captured',file=str(target.relative_to(ROOT)),sha256=hashlib.sha256(data).hexdigest(),bytes=len(data),title=p.title,canonical=p.canonical,meta=p.meta,anchors=sorted(set(p.ids)),links=sorted(set(p.links)),assets=sorted(set(p.assets)),forms=p.forms)
 (ROOT/'sources/route-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
 print(i+1,path,len(data),flush=True)
manifest['capturedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
manifest['complete']=False
manifest['scopeNote']='Sitemap source capture only; linked routes, redirects, assets and integrations need reconciliation.'
(ROOT/'sources/route-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
