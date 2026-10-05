from pathlib import Path
import os, shutil
from playwright.sync_api import sync_playwright
import json, sys, traceback
from browser_harness import mount
OUT=Path(__file__).resolve().parent; results=[]

def check(app,name,condition):
    ok=bool(condition);results.append({'app':app,'test':name,'pass':ok})
    print(('PASS' if ok else 'FAIL')+' '+app+' '+name,flush=True)
    if not ok: raise AssertionError(name)

def spy(page):
    page.evaluate('''()=>{window.__exports=[];Quiet.download=async(name,content,type)=>{const blob=content instanceof Blob?content:new Blob([content]);window.__exports.push({name,type:type||blob.type,text:blob.type==='image/png'?null:await blob.text(),signature:blob.type==='image/png'?Array.from(new Uint8Array(await blob.arrayBuffer()).slice(0,8)):null});};}''')

def exported(page,button,parse=True):
    old=page.evaluate('__exports.length');page.click(button)
    for _ in range(40):
        if page.evaluate('__exports.length')>old: break
        page.wait_for_timeout(50)
    x=page.evaluate('__exports.at(-1)');return json.loads(x['text']) if parse else x

def import_json(page,selector,data,name='backup.json'):
    buf=data if isinstance(data,bytes) else json.dumps(data,ensure_ascii=False).encode()
    page.locator(selector).set_input_files({'name':name,'mimeType':'application/json','buffer':buf})
    page.wait_for_timeout(180)

def boot(b,slug,storage=None):
    p=b.new_page(viewport={'width':1440,'height':1050})
    p.set_default_timeout(7000);errs=[];p.on('pageerror',lambda e:errs.append(str(e)))
    p.on('dialog',lambda d:d.accept());mount(p,slug,storage={} if storage is None else storage);spy(p)
    return p,errs

def storage(p):return p.evaluate('Object.fromEntries(__testStorage)')

def review(b):
    s='koko-naoshite';p,errs=boot(b,s)
    p.click('#sampleBtn');p.wait_for_timeout(600)
    check(s,'sample detects changes in protected region','変更禁止' in p.locator('#diffBadge').inner_text())
    check(s,'clock exclusion is counted','6,228' in p.locator('#diffSummary').inner_text())
    check(s,'canvas has actual rendered pixels',p.evaluate("(()=>{const c=document.getElementById('reviewCanvas');return c.width===960 && c.height===600 && c.getContext('2d').getImageData(100,100,1,1).data[3]===255})()"))
    project=exported(p,'#saveProject');check(s,'project export includes images and three regions',len(project['regions'])==3 and project['before']['data'].startswith('data:image/png;'))
    p.locator('#regionVerified').check();p.locator('#regionNote').fill('Keep wording')
    check(s,'instruction edit clears verification',not p.locator('#regionVerified').is_checked())
    p.locator('#regionVerified').check();p.locator('#threshold').fill('30');p.locator('#threshold').dispatch_event('input')
    check(s,'threshold edit invalidates diff and verification',p.locator('#diffBadge').inner_text()=='再比較が必要' and not p.locator('#regionVerified').is_checked())
    p.click('[data-mode="protect"]');p.locator('#rectForm').evaluate('e=>e.closest("details")?.setAttribute("open","")')
    for k,v in [('rectX','10'),('rectY','40'),('rectW','20'),('rectH','20')]:p.locator('#'+k).fill(v)
    p.locator('#rectForm').evaluate('e=>e.requestSubmit()')
    check(s,'keyboard coordinate form adds rectangle',p.locator('#regionList button').count()==4)
    p.locator('#regionTitle').fill('<b>Literal title</b>')
    check(s,'region title is not interpreted as HTML',p.locator('#regionList b').count()==0)
    p.click('#deleteRegion');check(s,'region deletion works',p.locator('#regionList button').count()==3)
    p.click('#undoBtn');check(s,'undo restores removed region',p.locator('#regionList button').count()==4)
    p.click('[data-view="before"]');box=p.locator('#reviewCanvas').bounding_box()
    p.mouse.move(box['x']+box['width']*.12,box['y']+box['height']*.45);p.mouse.down();p.mouse.move(box['x']+box['width']*.25,box['y']+box['height']*.55,steps=5);p.mouse.up()
    check(s,'pointer drag creates rectangle',p.locator('#regionList button').count()==5)
    png=exported(p,'#exportPng',False);check(s,'annotated PNG is valid PNG bytes',png['signature']==[137,80,78,71,13,10,26,10])
    instruction=exported(p,'#exportReport',False);check(s,'instruction file includes protected and fix intent','変更しない' in instruction['text'] and '修正する' in instruction['text'])
    import_json(p,'#projectFile',project);p.wait_for_timeout(500)
    check(s,'saved project restores images and regions',p.locator('#regionList button').count()==3 and 'sample-before.png' in p.locator('#beforeMeta').inner_text())
    check(s,'imported verification starts unchecked',not p.locator('#regionVerified').is_checked())
    bad=dict(project);bad['before']={'name':'external','data':'https://example.invalid/image.png'}
    import_json(p,'#projectFile',bad)
    check(s,'external URL import rejected without losing current state',p.locator('#regionList button').count()==3 and 'sample-before.png' in p.locator('#beforeMeta').inner_text())
    mismatched=dict(project);mismatched['after']=dict(project['after']);mismatched['after']['data']=p.evaluate("(()=>{const c=document.createElement('canvas');c.width=100;c.height=80;return c.toDataURL('image/png')})()")
    import_json(p,'#projectFile',mismatched);p.wait_for_timeout(300);p.click('#compareBtn')
    check(s,'different image dimensions prevent false comparison',p.locator('#diffBadge').inner_text()=='サイズ不一致')
    p.locator('#afterFile').set_input_files({'name':'no.svg','mimeType':'image/svg+xml','buffer':b'<svg/>'});p.wait_for_timeout(100)
    check(s,'SVG upload is rejected','PNG / JPEG / WebP' in p.locator('#toast').inner_text())
    p.click('#clearAll');check(s,'clear removes images and regions',p.locator('#reviewCanvas').is_hidden() and p.locator('#regionList button').count()==0)
    check(s,'no JavaScript errors',not errs);p.close()

with sync_playwright() as tool:
    executable=os.environ.get('QUIET_CHROMIUM') or shutil.which('chromium')
    kwargs={'headless':True}
    if executable: kwargs['executable_path']=executable
    browser=tool.chromium.launch(**kwargs)
    try:
        review(browser)
    except Exception as e:
        results.append({'app':'koko-naoshite','test':'unexpected harness error','pass':False,'detail':str(e)});traceback.print_exc()
    finally:
        browser.close()
(OUT/'integration-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
print('TOTAL',len(results),'PASS',sum(r['pass'] for r in results),'FAIL',sum(not r['pass'] for r in results),flush=True)
sys.exit(int(any(not r['pass'] for r in results)))
