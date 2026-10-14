# -*- coding: utf-8 -*-
"""Подставляет токены дизайн-системы (src/tokens.css) в сгенерированный CSS сцен.
Почти-дубли сводятся к одному значению; геометрия и кегли абсолютных раскладок не меняются. 14.10.2026, Claude."""
import re
# Почти одинаковые значения источника → одно значение системы
COLOR_MERGE={'#4369a3':'#4269a3','#f4f4f4':'#f5f5f5','#f6f6f6':'#f5f5f5','#f7f7f7':'#f5f5f5','#f5f5f4':'#f5f5f5'}
RADIUS_MERGE={'5':'6','7':'8','9':'10','15':'16'}
COLOR_TOKEN={'#262626':'--c-ink','#4c4c4c':'--c-ink-2','#2b2829':'--c-heading','#9c9d9f':'--c-muted','#c5c5c5':'--c-line','#eaeaea':'--c-line-soft',
 '#f5f5f5':'--c-surface','#303030':'--c-dark','#4269a3':'--c-pit','#315a94':'--c-pit-deep','#e6f0ff':'--c-pit-soft','#653a3f':'--c-tvg','#694448':'--c-tvg-2','#e7e3e3':'--c-tvg-soft','#fe8064':'--c-intensiv'}
RADIUS_TOKEN={'4':'--r-xs','6':'--r-sm','8':'--r-md','10':'--r-lg','12':'--r-xl','14':'--r-2xl','16':'--r-3xl','20':'--r-card','24':'--r-panel','3000':'--r-pill'}
FONT_TOKEN={'Bounded':'--font-display','Manrope':'--font-ui','Inter':'--font-text'}
def apply(css):
    def col(m):
        prop,val=m.group(1),m.group(2).lower()
        val=COLOR_MERGE.get(val,val);tok=COLOR_TOKEN.get(val)
        return f'{prop}:var({tok},{val})' if tok else f'{prop}:{val}'
    css=re.sub(r'((?:^|[;{\s])(?:color|background-color|border-color|fill|stroke))\s*:\s*(#[0-9a-fA-F]{6})\b',col,css)
    def rad(m):
        v=RADIUS_MERGE.get(m.group(1),m.group(1));tok=RADIUS_TOKEN.get(v)
        return f'border-radius:var({tok},{v}px)' if tok else f'border-radius:{v}px'
    css=re.sub(r'border-radius:\s*(\d+)px(?![\s\d])',rad,css)
    def fam(m):
        name=m.group(2);tok=FONT_TOKEN.get(name)
        return f'font-family:var({tok},{m.group(1)}{name}{m.group(1)},Arial,sans-serif)' if tok else m.group(0)
    css=re.sub(r"font-family:\s*(['\"]?)(Bounded|Manrope|Inter)\1\s*,\s*Arial\s*,\s*sans-serif",fam,css)
    return css

def round_line_heights(css,only_scenes=None):
    """Тильда (t396) округляет межстрочный до целых px: font-size × line-height → round. Повторяем это для всех правил сцен,
    включая медиа-правила, где меняется только кегль (межстрочный берётся из последнего известного для этого селектора). 14.10.2026"""
    last_lh={};last_fs={}
    def block(sel,body):
        key=sel.strip()
        if only_scenes is not None:
            m=re.search(r'#scene-(\d+)',key)
            if not m or m.group(1) not in only_scenes:return sel+'{'+body+'}'
        fs=re.search(r'font-size:\s*([\d.]+)px',body);lh=re.search(r'line-height:\s*([\d.]+)\s*(?=;|$)',body)
        if lh:last_lh[key]=float(lh.group(1))
        if fs:last_fs[key]=float(fs.group(1))
        size=last_fs.get(key);ratio=last_lh.get(key)
        if size and ratio and (fs or lh):
            px='%dpx'%int(size*ratio+0.5)
            if lh:body=body[:lh.start()]+'line-height:'+px+body[lh.end():]
            else:body=body.rstrip(';')+';line-height:'+px
        return sel+'{'+body+'}'
    def rules(text):
        return re.sub(r'([^{}@]+)\{([^{}]*)\}',lambda m:block(m.group(1),m.group(2)),text)
    return rules(css)
