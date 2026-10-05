"""Network-free DOM harness. Does not change browser policy or app source.
Navigation is blocked by this environment, so local assets are provided via
Playwright's DOM test interfaces on about:blank. Real serving is not tested here.
"""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
def mount(page,slug,storage=None):
    path=ROOT
    html=(path/'index.html').read_text()
    html=re.sub(r'<script\b[^>]*>[\s\S]*?</script>','',html)
    html=re.sub(r'<link\b[^>]*>','',html)
    page.set_content(html,wait_until='domcontentloaded')
    page.add_style_tag(content=(path/'shared.css').read_text()+'\n'+(path/'app.css').read_text())
    # Optional Web Storage test double, used explicitly in persistence scenarios.
    if storage is not None:
        page.evaluate('''entries=>{const mem=new Map(Object.entries(entries));Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(String(k),String(v)),removeItem:k=>mem.delete(k),clear:()=>mem.clear(),get length(){return mem.size},key:i=>[...mem.keys()][i]??null}});window.__testStorage=mem;}''',storage)
    for filename in ['common.js','core.js','app.js']:
        page.evaluate((path/filename).read_text())
