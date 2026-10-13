# -*- coding: utf-8 -*-
"""Adapted from Popovich's export compiler; only visible prose is changed."""
import re
from bs4 import BeautifulSoup, NavigableString

SHORT_WORDS=r'(?:в|во|на|с|со|к|ко|о|об|у|от|до|по|за|из|и|а|но|да|не|ни|же|ли|бы|то)'
LEGAL_PATHS={'/data-consent','/privacy','/privacy-policy','/offer','/oferta','/policy','/personal-data','/personaldata','/part_oferta','/consent'}

def typograf_html(html,path=''):
    if not html or path in LEGAL_PATHS:return html
    soup=BeautifulSoup(html,'html.parser')
    for node in list(soup.find_all(string=True)):
        if not isinstance(node,NavigableString) or node.find_parent(['svg','style','script','code','pre','textarea']):continue
        text=str(node)
        # Preserve URL/email-like tokens and do not touch any attributes.
        if re.search(r'https?://|www\.|[\w.+-]+@[\w.-]+',text):continue
        text=re.sub(r'(?<![\w-])('+SHORT_WORDS+r')[ \t]+(?=[\wА-Яа-яЁё«(„"])',lambda m:m.group(1)+'\u00a0',text,flags=re.I)
        # Last visible text of an element: no dots after digits, initials or ellipses.
        following=[s for s in node.next_siblings if str(s).strip()]
        if not following:
            text=re.sub(r'(?<![.\d])(?<!\b[а-яa-z])\.(\s*)$',r'\1',text,flags=re.I)
        if text!=str(node):node.replace_with(text)
    return str(soup)
