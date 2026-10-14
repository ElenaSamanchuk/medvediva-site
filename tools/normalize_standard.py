# -*- coding: utf-8 -*-
"""Native content models for the remaining standard export blocks; does not load vendor code."""
import sys,os
sys.path.insert(0,os.path.dirname(__file__))
import design_tokens
import importlib.util,json,re
from pathlib import Path
# Importing the design compiler would run compilation, so use the already localized models/map.
from bs4 import BeautifulSoup,Comment,ProcessingInstruction
from typography import typograf_html
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'public/content'
media=json.loads((ROOT/'sources/local-media.json').read_text());media.update(json.loads((ROOT/'sources/remote-media.json').read_text()))

def safe(element):
 if not element:return ''
 clone=BeautifulSoup(str(element),'html.parser')
 for x in clone.find_all(string=lambda t:isinstance(t,(Comment,ProcessingInstruction))):x.extract()
 for x in clone(['script','style','iframe','input','form','button','svg']):x.decompose()
 for e in clone.find_all(True):
  classes=e.get('class',[])
  if e.get('data-original'):e['src']=e['data-original']
  for k in list(e.attrs):
   if k not in ('href','src','alt','style'):del e[k]
  mapped=[]
  if 't-container' in classes:mapped.append('content-grid')
  if 't464__col' in classes:mapped.append('footer-column')
  if 't464__title' in classes:mapped.append('footer-title')
  if mapped:e['class']=mapped
  for k in ['src','href','style']:
   if e.get(k):
    value=e[k]
    for old,new in media.items():
     if old in value:value=value.replace(old,new)
    if re.match(r'\s*javascript:',value,re.I):value=''
    if value.startswith('https://medvediva.ru/'):value=value[len('https://medvediva.ru'):]
    e[k]=value
 root=clone.find();return typograf_html(''.join(map(str,root.contents)),route['path']) if root else ''

routes=json.loads((OUT/'routes.json').read_text());sources={r['path']:r for r in json.loads((ROOT/'sources/export-manifest.json').read_text())['routes']};count=0
for route in routes:
 existing=json.loads((OUT/(route['page']+'.json')).read_text())
 has_native=any(b.get('type') in ('456','464','585','726') for b in existing['blocks']) or any(p.get('pictures') or p.get('hook')=='#menuopen' for p in existing['popups'])
 if not route['unsupported'] and not has_native:continue
 current_file=ROOT/'sources/current-page-sources.json'
 current_sources=json.loads(current_file.read_text()) if current_file.exists() else {}
 source_path=current_sources.get(route['path'],{}).get('file',sources[route['path']]['file'])
 source=BeautifulSoup((ROOT/source_path).read_text(),'html.parser');model=json.loads((OUT/(route['page']+'.json')).read_text());remaining=[]
 candidates=[{'id':r['id'][3:],'type':r['data-record-type']} for r in source.select('[data-record-type]') if r['data-record-type'] in ('456','464','585','726','746','450','706')]
 for missing in candidates:
  model['blocks']=[b for b in model['blocks'] if b['id']!=missing['id']]
  r=source.find(id='rec'+missing['id']);typ=missing['type'];block={'id':missing['id'],'kind':'standard','type':typ,'style':r.get('style','')};handled=True
  if typ=='585':
   block['kind']='accordion';block['items']=[]
   for row in r.select('.t585__wrapper'):
    title=row.select_one('.t585__title');text=row.select_one('.t585__text')
    block['items'].append({'title':safe(title),'html':safe(text)})
  elif typ=='746':
   popup=r.select_one('[data-tooltip-hook]');pictures=[]
   for img in r.select('[data-original]'):
    src=media.get(img.get('data-original'))
    if src and src not in {i['src'] for i in pictures}:pictures.append({'src':src,'alt':img.get('alt','')})
   model['popups']=[p for p in model['popups'] if p['hook']!=popup['data-tooltip-hook']]
   model['popups'].append({'hook':popup['data-tooltip-hook'],'title':popup.get('aria-label',''),'html':'','form':False,'scenes':[],'pictures':pictures});block=None
  elif typ=='726':
   block['kind']='testimonials';block['items']=[]
   for slide in r.select('.t-slds__item'):
    text=slide.select_one('[field^="li_descr"], [field^="li_text"]');name=slide.select_one('[field^="li_title"]')
    if text:block['items'].append({'title':safe(name),'html':safe(text)})
   header=r.select_one('[field="btitle"]');block['title']=safe(header)
  elif typ in ('456','464'):
   brand=r.select_one('[field="title4"],.t456__logowrapper,.tmenu-mobile__burgerlogo__title');block['brand']=safe(brand)
   block['html']=safe(r.select_one('.t456__list,.t464'))
   block['min']=r.get('data-screen-min','');block['max']=r.get('data-screen-max','')
   if typ=='456':
    nav=r.select_one('.t456');block['style']=nav.get('style','') if nav else block['style']
  elif typ=='450':
   nav=r.select_one('.t450__menu');model['popups']=[p for p in model['popups'] if p['hook']!='#menuopen'];model['popups'].append({'hook':'#menuopen','title':'Меню','html':safe(nav),'form':False,'scenes':[]});block=None
  elif typ=='706':
   # The old payment container has no purchase triggers on these pages.
   # Sales remain in the external LK; do not revive a Tilda checkout in preview.
   retired=model.setdefault('retiredIntegrations',[])
   retired[:]=[item for item in retired if item.get('id')!=missing['id']]
   retired.append({'id':missing['id'],'type':typ,'kind':'legacy-cart','reason':'External LK sales; payments are not collected by this preview'})
   block=None
  else:handled=False
  if handled:
   if typ!='706':count+=1
   if block:
    # Insert at source record order, before the next rendered scene/article.
    order=[e.get('id','')[3:] for e in source.select('[data-record-type]')];index=order.index(missing['id']);nextids=set(order[index+1:]);pos=next((i for i,b in enumerate(model['blocks']) if b['id'] in nextids),len(model['blocks']));model['blocks'].insert(pos,block)
  else:remaining.append(missing)
 model['unsupported']=remaining;route['unsupported']=remaining
 (OUT/(route['page']+'.json')).write_text(design_tokens.tg_links(json.dumps(model,ensure_ascii=False,separators=(',',':'))))
(OUT/'routes.json').write_text(json.dumps(routes,ensure_ascii=False));print('Native standard block models:',count,'remaining:',sum(len(r['unsupported']) for r in routes))
