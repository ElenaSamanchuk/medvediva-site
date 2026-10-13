# -*- coding: utf-8 -*-
"""Compile exported design data into independent scene/content models. Never execute source JS."""
from pathlib import Path
from bs4 import BeautifulSoup, Comment, ProcessingInstruction
import json,re,hashlib,shutil
from urllib.parse import urlsplit
from typography import typograf_html
ROOT=Path(__file__).resolve().parents[1]
EXPORT=ROOT/'sources/export/2026-10-09/alenamedvedeva'
OUT=ROOT/'public/content';MEDIA=ROOT/'public/media'
OUT.mkdir(parents=True,exist_ok=True);MEDIA.mkdir(parents=True,exist_ok=True)
media={}
for p in sorted((EXPORT/'images').glob('*')):
 if not p.is_file() or p.suffix.lower() not in ('.jpg','.jpeg','.png','.webp','.gif','.svg','.ico','.avif'):continue
 b=p.read_bytes();name=hashlib.sha256(b).hexdigest()[:24]+p.suffix.lower();dest=MEDIA/name
 if not dest.exists():dest.write_bytes(b)
 media['images/'+p.name]='/media/'+name

extra_path=ROOT/'sources/remote-media.json'
if extra_path.exists():media.update(json.loads(extra_path.read_text()))
unavailable=json.loads((ROOT/'sources/missing-media-status.json').read_text()) if (ROOT/'sources/missing-media-status.json').exists() else []
unavailable={i['source'] for i in unavailable if i['status']=='unavailable' and i['source'] not in media}
asset_issues={}
current_path='/'
tooltip_hooks={}
media_lower={k.lower():v for k,v in media.items()}

def localize(v):
 for url in re.findall(r'(?:images/|https://static\.tildacdn\.com/|https://figma-alpha-api\.s3\.us-west-2\.amazonaws\.com/images/|https://s3-alpha-sig\.figma\.com/)[^\s\"\'\)<>]+',v):
  replacement=media.get(url)
  if not replacement and url.startswith('https:'):
   # Export filenames combine CDN UUID and original filename.
   parts=url.split('/');replacement=media.get('images/'+parts[-2]+'__'+parts[-1]) or media_lower.get(('images/'+parts[-2]+'__'+parts[-1]).lower())
  if not replacement and (url in unavailable or 'static.tildacdn.com/19ac890c-4bb1-41b7-9c59-d93bc550cc72/' in url or 's3-alpha-sig.figma.com/' in url):
   asset_issues.setdefault(current_path,set()).add(url.split('?',1)[0]);replacement='data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='
  if replacement:v=v.replace(url,replacement)
 v=re.sub(r'var\(--t-text-font,[^)]*\)','Inter',v)
 v=v.replace('https://tilda.ws/img/imgfishsquare.gif','data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=')
 return v.replace('--t396-','--scene-').replace('..//media/','/media/')

def clean_html(atom):
 clone=BeautifulSoup(str(atom),'html.parser')
 for x in clone.find_all(string=lambda t:isinstance(t,(Comment,ProcessingInstruction))):x.extract()
 for e in clone(['script','style','iframe','object','embed','form','input']):e.decompose()
 for e in clone.find_all(True):
  original_classes=e.get('class',[])
  if e.name=='img' and e.get('data-original'):e['src']=e['data-original']
  for k in list(e.attrs):
   if k.startswith('on') or k.startswith('data-') or k in ('class','field','id'):del e[k]
  mapped=[c.replace('tn-atom__','scene-atom__') for c in original_classes if c.startswith('tn-atom__button-')]
  if mapped:e['class']=mapped
  for k in ('href','xlink:href','src','style'):
   if e.has_attr(k):
    if re.match(r'\s*(javascript|vbscript):',e[k],re.I):del e[k]
    else:
     e[k]=localize(e[k])
     if k=='href':
      parsed=urlsplit(e[k])
      if parsed.hostname in ('medvediva.ru','www.medvediva.ru'):e[k]=parsed.path+('?' + parsed.query if parsed.query else '')+('#' + parsed.fragment if parsed.fragment else '')
  if e.name=='a':
   if e.get('href','').startswith(('https://','http://')):e['target']='_blank';e['rel']='noopener noreferrer'
   else:
    e.attrs.pop('target',None);e.attrs.pop('rel',None)
  if e.name=='img':
   if not e.get('src'):e['src']=''
   e['alt']=e.get('alt','')
 root=clone.find();return typograf_html(''.join(map(str,root.contents)),current_path) if root else ''

def rules(css,conditions=()):
 pos=0
 while pos<len(css):
  start=css.find('{',pos)
  if start<0:break
  selector=css[pos:start].strip();depth=1;end=start+1;quote=None
  while end<len(css) and depth:
   c=css[end]
   if quote:
    if c==quote and css[end-1]!='\\':quote=None
   elif c in ('"',"'"):quote=c
   elif c=='{':depth+=1
   elif c=='}':depth-=1
   end+=1
  body=css[start+1:end-1];pos=end
  if selector.startswith('@media'):
   yield from rules(body,conditions+(selector[6:].strip(),))
  elif not selector.startswith('@'):yield selector,body,conditions

def appearance(css,recid):
 result=[]
 for selectors,body,conditions in rules(css):
  for selector in selectors.split(','):
   selector=selector.strip()
   if not selector.startswith('#rec'+recid+' '):continue
   target=selector[len('#rec'+recid+' '):]
   target=target.replace('.t396__artboard','.scene-canvas').replace('.t396__carrier','.scene-background').replace('.t396__filter','.scene-filter')
   target=re.sub(r'\.tn-elem\[data-elem-id="([\d]+)"\]',r'[data-node="\1"]',target)
   target=re.sub(r'\.tn-group\[data-group-id="([\d]+)"\]',r'[data-node="\1"]',target)
   target=re.sub(r'\.tn-group__'+recid+r'([\d]+)',r'[data-node="\1"]',target)
   target=target.replace('#molecule-','#group-')
   target=target.replace('.t396__elem-flex','.scene-group-child')
   target=target.replace('.tn-atom__img','.scene-image').replace('.tn-atom','.scene-atom').replace('.tn-molecule','.scene-group-inner')
   if any(x in target for x in ('t396','tn-','t-bg','t-animate')):continue
   # Only declarative presentation/layout. No vendor behavior or stylesheet imported.
   body=localize(body)
   body=re.sub(r'(?:transition|animation-[a-z-]+):[^;]+;', '',body)
   rule='#scene-'+recid+' '+target+'{'+body+'}'
   for cond in reversed(conditions):rule='@media '+cond+'{'+rule+'}'
   result.append(rule)
 return '\n'.join(result)

def node(e):
 authored_classes=[c for c in e.get('class',[]) if c.startswith(('pf-','cd-'))]
 if e.has_attr('data-group-id'):
  inner=e.select_one(':scope > .tn-molecule') or e
  model={'id':e['data-group-id'],'type':'group','classes':authored_classes,'fields':{k[11:]:v for k,v in e.attrs.items() if k.startswith('data-group-')},'children':[node(n) for n in inner.find_all(recursive=False) if n.has_attr('data-elem-id') or n.has_attr('data-group-id')]}
  for marker in inner.find_all(class_=lambda c:c in tooltip_hooks):
   if marker.find_parent(attrs={'data-group-id':True}) is e:
    for cls in marker.get('class',[]):
     if cls in tooltip_hooks:model['tooltipHook']=tooltip_hooks[cls]
  return model
 atom=e.select_one('.tn-atom');kind=e.get('data-elem-type','shape')
 original=atom.get('data-original') if atom else None
 html=clean_html(atom) if atom else ''
 if kind=='image' and atom:
  img=atom.find('img');src=img.get('data-original') or img.get('src') if img else None
  if src:html='<img class="scene-image" src="'+localize(src)+'" alt="'+(img.get('alt','').replace('"','&quot;'))+'"/>'
 if kind=='vector' and atom:html=clean_html(atom)
 extra={'classes':authored_classes}
 if e.get('data-animate-style'):extra['animation']={k[13:]:v for k,v in e.attrs.items() if k.startswith('data-animate-')}
 if kind=='form':
  inputs=e.select_one('.tn-atom__inputs-data')
  definitions=json.loads(inputs.get('data-value','[]')) if inputs else []
  extra['inputs']=[{k:v for k,v in item.items() if k in ('li_type','li_title','li_ph','li_req','li_nm','li_rows','li_variants','li_label','li_checked')} for item in definitions]
 if kind=='html':
  iframe=e.find('iframe');extra['embed']=iframe.get('src','') if iframe else ''
 if kind=='gallery':
  pictures=json.loads(e.get('data-field-imgs-value','[]'));extra['pictures']=[{'src':localize(i.get('li_img','')),'alt':i.get('li_imgalt','')} for i in pictures]
 if e['data-elem-id']=='1731073040214':extra['href']='#popup_ed'
 return {'id':e['data-elem-id'],'type':kind,'html':html,'href':localize(atom.get('href','')) if atom else '', 'target':atom.get('target','') if atom else '', 'atomStyle':localize(atom.get('style','')) if atom else '', 'background':localize(original) if original else '', 'fields':{k[11:]:v for k,v in e.attrs.items() if k.startswith('data-field-') and not any(x in k for x in ('receivers','successurl','formmsgsuccess','imgs-value'))},**extra}

def compile_page(route):
 global current_path,tooltip_hooks
 current_path=route['path']
 current_sources_file=ROOT/'sources/current-page-sources.json'
 current_sources=json.loads(current_sources_file.read_text()) if current_sources_file.exists() else {}
 current=current_sources.get(route['path'])
 if current:
  raw=(ROOT/current['file']).read_bytes()
  if hashlib.sha256(raw).hexdigest()!=current['sha256']:raise ValueError('Current public source changed without refreshing its snapshot')
  s=BeautifulSoup(raw,'html.parser')
 else:
  s=BeautifulSoup((ROOT/route['file']).read_text(),'html.parser')
 # Targeted current author design overrides; never replace unrelated page content or execute source JS.
 override_file=ROOT/'sources/shared-source-overrides.json'
 if route['path']=='/' and not current and override_file.exists():
  override=json.loads(override_file.read_text())
  for item in override.get('blocks',[]):
   if item['id'] not in ('rec860237765','rec1063609261','rec2322512891'):raise ValueError('Unexpected shared override block')
   raw=(ROOT/item['file']).read_bytes()
   if hashlib.sha256(raw).hexdigest()!=item['sha256']:raise ValueError('Shared source override changed without updating evidence')
   fragment=BeautifulSoup(raw,'html.parser').find(id=item['id'])
   original=s.find(id=item['id'])
   if not original or not fragment:raise ValueError('Shared design override block missing')
   original.replace_with(fragment)
 scenes=[];css=[];popups=[];unsupported=[];anchors=[];blocks=[]
 tooltip_hooks={}
 for script in s.find_all('script'):
  for cls,hook in re.findall(r'''tooltip\.init\(\s*["']\.([\w-]+)["']\s*,\s*\{\s*link\s*:\s*["'](#[\w-]+)["']''',script.get_text()):
   tooltip_hooks[cls]=hook
 for r in s.select('[data-record-type]'):
  recid=r.get('id','rec')[3:];typ=r.get('data-record-type');board=r.select_one('.t396__artboard')
  for a in r.select('a[name]'):anchors.append({'name':a['name'],'scene':recid})
  if board:
   blocks.append({'kind':'scene','id':recid})
   scenes.append({'id':recid,'min':r.get('data-screen-min',''),'max':r.get('data-screen-max',''),'board':{k[14:]:v for k,v in board.attrs.items() if k.startswith('data-artboard-')},'nodes':[node(e) for e in board.find_all(recursive=False) if e.has_attr('data-elem-id') or e.has_attr('data-group-id')]})
   css.append(appearance('\n'.join(t.get_text() for t in r.find_all('style')),recid))
   minimum=re.match(r'^([\d.]+)',r.get('data-screen-min',''))
   maximum=re.match(r'^([\d.]+)',r.get('data-screen-max',''))
   if minimum:css.append('@media(max-width:%spx){#scene-%s,#rec%s{display:none!important}}'%(float(minimum.group(1))-0.02,recid,recid))
   if maximum:css.append('@media(min-width:%spx){#scene-%s,#rec%s{display:none!important}}'%(maximum.group(1),recid,recid))
  elif typ in ('390','702','1093','868','331','1013'):
   popup=r.select_one('[data-tooltip-hook]');title=r.select_one('[class*="__title"]');descr=r.select_one('[class*="__descr"]');button=r.select_one('a[class*="__btn"],a.t-btn')
   if popup:
    embed=r.find('iframe');video=r.select_one('[data-videolazy-id]');sceneids=popup.get('data-popup-rec-ids','')
    embedurl=embed.get('src','') if embed else ('https://www.youtube.com/embed/'+video['data-videolazy-id'] if video and video.get('data-videolazy-type')=='youtube' else '')
    popups.append({'scenes':[re.sub(r'^rec','',x.strip()) for x in sceneids.split(',')] if sceneids else [],'embed':embedurl,'hook':popup['data-tooltip-hook'],'title':title.get_text(' ',strip=True) if title else popup.get('aria-label',''),'html':clean_html(descr) if descr else '', 'button':{'text':button.get_text(' ',strip=True),'href':button.get('href','')} if button else None,'form':typ=='702'})
  elif typ in ('106','33','976','3'):
   content=r.select_one('[field="text"],.t017,.t976__wrapper,.t107')
   if content:
    for img in content.find_all('img'):
     if img.get('data-original'):img['src']=img['data-original']
    blocks.append({'kind':'article','id':recid,'type':typ,'html':clean_html(content),'style':localize(r.get('style',''))})
  elif typ=='215':blocks.append({'kind':'anchor','id':recid})
  elif typ not in ('131','270','674','890','360','113','875'):
   unsupported.append({'id':recid,'type':typ,'text':r.get_text(' ',strip=True)[:4000]})
 title=s.title.get_text() if s.title else ''
 robots=s.find('meta',attrs={'name':'robots'});structured=[]
 for item in s.find_all('script',attrs={'type':'application/ld+json'}):
  try:structured.append(json.loads(item.get_text()))
  except (ValueError,TypeError):pass
 desc=s.find('meta',attrs={'name':'description'});og=s.find('meta',attrs={'property':'og:image'})
 data={'robots':robots.get('content','') if robots else '', 'structuredData':structured,'path':route['path'],'title':title,'description':desc.get('content','') if desc else '', 'canonical':route['canonical'],'image':localize(og.get('content','')) if og else '', 'scenes':scenes,'blocks':blocks,'popups':popups,'anchors':anchors,'missingMediaCount':len(asset_issues.get(current_path,[])),'unsupported':unsupported}
 if route['path']=='/pit':
  promotion_file=ROOT/'sources/promotion-config-2026-10-13.json'
  if promotion_file.exists():
   captured=json.loads(promotion_file.read_text())
   data['promotion']={'config':captured['config'],'countdown':captured['countdown'],'bannerScenes':{'4482959301':'phase1','4482960101':'phase2','4482961001':'phase3'},'source':captured['source'],'capturedAt':captured['capturedAt']}
 (OUT/(route['pageId']+'.json')).write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
 (OUT/(route['pageId']+'.css')).write_text('\n'.join(css))
 return {'path':route['path'],'page':route['pageId'],'title':title,'scenes':len(scenes),'unsupported':unsupported,'missingMediaCount':len(asset_issues.get(current_path,[])),'state':'design-extracted-unverified'}
manifest=json.loads((ROOT/'sources/export-manifest.json').read_text())
# Start with the home page; --all compiles every canonical source for route-by-route acceptance.
import sys
selected_path=sys.argv[sys.argv.index('--path')+1] if '--path' in sys.argv else '/'
routes=manifest['routes'] if '--all' in sys.argv else [r for r in manifest['routes'] if r['path']==selected_path]
compiled=[]
for index,route in enumerate(routes,1):
 compiled.append(compile_page(route))
 if '--all' in sys.argv and index%20==0:print('Normalized %s/%s pages'%(index,len(routes)),flush=True)
if '--all' not in sys.argv and (OUT/'routes.json').exists():
 previous=json.loads((OUT/'routes.json').read_text());compiled=compiled+[p for p in previous if p['path'] not in {r['path'] for r in compiled}]
(OUT/'routes.json').write_text(json.dumps(compiled,ensure_ascii=False))
(ROOT/'sources/local-media.json').write_text(json.dumps(media,ensure_ascii=False,indent=2))
issue_path=ROOT/'sources/asset-issues.json'
previous_issues=json.loads(issue_path.read_text()) if issue_path.exists() and '--all' not in sys.argv else {}
for r in routes:previous_issues.pop(r['path'],None)
previous_issues.update({k:sorted(v) for k,v in asset_issues.items()})
issue_path.write_text(json.dumps(previous_issues,ensure_ascii=False,indent=2))
print(json.dumps({'pages':len(compiled),'media':len(media),'uniqueMedia':len(list(MEDIA.iterdir())),'unsupported':sum(len(r['unsupported']) for r in compiled)}))
