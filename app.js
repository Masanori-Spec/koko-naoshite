'use strict';
(() => {
const Q=Quiet,C=ReviewCore,$=Q.$,canvas=$('reviewCanvas'),ctx=canvas.getContext('2d');
const labels={fix:'修正する',protect:'変更しない',ignore:'比較から除外'},colors={fix:'#c65333',protect:'#2467cc',ignore:'#667487'};
let before=null,after=null,regions=[],selectedId=null,mode='fix',view='before',diff=null,drag=null,history=[],requestId=0,compareToken=0;
let title='',threshold=24;
const selected=()=>regions.find(r=>r.id===selectedId);
const ratio=(n)=>n===null?'対象なし':`${(n*100).toFixed(2)}%`;
function snapshot(){history.push(Q.clone(regions));if(history.length>30)history.shift();$('undoBtn').disabled=false;}
function invalidate(){diff=null;compareToken++;regions.forEach(r=>r.verified=false);$('diffBadge').textContent='再比較が必要';$('diffBadge').className='badge';$('diffStats').textContent='';$('diffSummary').textContent='画像・範囲・しきい値を変更しました。「差分をチェック」で結果を更新してください。';if(view==='diff')view='before';}
function draw(){
 if(!before){canvas.hidden=true;$('stageEmpty').hidden=false;return;}
 canvas.hidden=false;$('stageEmpty').hidden=true;if(canvas.width!==before.width||canvas.height!==before.height){canvas.width=before.width;canvas.height=before.height;}
 ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
 if(view==='diff'&&diff){ctx.putImageData(new ImageData(diff.heatmap,canvas.width,canvas.height),0,0);}
 else if(view==='after'&&after){ctx.drawImage(after.canvas,0,0,canvas.width,canvas.height);}
 else {ctx.drawImage(before.canvas,0,0);if(view==='overlay'&&after){ctx.globalAlpha=Number($('opacity').value)/100;ctx.drawImage(after.canvas,0,0,canvas.width,canvas.height);ctx.globalAlpha=1;}}
 drawRegions(ctx,regions,canvas.width,canvas.height,selectedId);
 if(drag){const r=C.rectFromPoints(drag.start,drag.end);ctx.strokeStyle=colors[mode];ctx.lineWidth=Math.max(2,canvas.width/400);ctx.setLineDash([7,5]);ctx.strokeRect(r.x*canvas.width,r.y*canvas.height,r.w*canvas.width,r.h*canvas.height);ctx.setLineDash([]);}
}
function drawRegions(context,rs,w,h,selection=null){
 const scale=Math.max(1,w/700);
 rs.forEach((r,i)=>{context.save();context.strokeStyle=colors[r.type];context.fillStyle=colors[r.type]+'13';context.lineWidth=(r.id===selection?3:2)*scale;const x=r.x*w,y=r.y*h,rw=r.w*w,rh=r.h*h;context.fillRect(x,y,rw,rh);if(r.type==='ignore')context.setLineDash([6*scale,4*scale]);context.strokeRect(x,y,rw,rh);context.setLineDash([]);const bw=24*scale,bh=23*scale,bx=Math.min(x,w-bw),by=Math.max(0,y-bh);context.fillStyle=colors[r.type];context.fillRect(bx,by,bw,bh);context.fillStyle='#fff';context.font=`bold ${12*scale}px sans-serif`;context.textBaseline='middle';context.textAlign='center';context.fillText(String(i+1),bx+bw/2,by+bh/2);context.restore();});
}
function setView(next){
 if(!before&&next!=='before')return Q.toast('先に修正前の画像を読み込んでください。');
 if(['after','overlay'].includes(next)&&!after)return Q.toast('修正後の画像を読み込んでください。');
 if(['after','overlay'].includes(next)&&!matching())return Q.toast('修正前後の元画像サイズが違うため、この表示は使えません。');
 if(next==='diff'&&!diff)return Q.toast('先に「差分をチェック」を押してください。');
 view=next;renderView();draw();
}
function renderView(){document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));$('overlayControl').hidden=view!=='overlay';canvas.style.cursor=view==='before'?'crosshair':'default';$('viewHint').textContent=view==='before'?'ドラッグまたは指で範囲を追加できます。範囲の編集は右側（スマホでは下）の一覧から。':'この表示では範囲を追加しません。「修正前」に戻すと追加できます。';}
function renderEditor(){const r=selected();$('regionEditor').hidden=!r;$('editorEmpty').hidden=!!r;$('selectionBadge').textContent=r?`#${regions.indexOf(r)+1} ${labels[r.type]}`:'範囲を選択';if(r){$('regionTitle').value=r.title;$('regionNote').value=r.note;$('regionCriteria').value=r.criteria;$('regionVerified').checked=!!r.verified;$('regionVerified').disabled=!after||!matching();$('verifyLabel').hidden=r.type==='ignore';}}
function renderList(){
 $('regionCount').textContent=`${regions.length} / ${C.MAX_REGIONS} 範囲`;
 $('regionList').innerHTML=regions.length?regions.map((r,i)=>`<button class="region-card" data-id="${Q.esc(r.id)}" aria-pressed="${r.id===selectedId}"><span class="region-number ${r.type}">${i+1}</span><div class="grow"><strong>${Q.esc(r.title||labels[r.type])}</strong><small>${labels[r.type]}${r.verified?' · 自分で確認済み':''}</small><span class="coord mono muted">x ${(r.x*100).toFixed(1)}% / y ${(r.y*100).toFixed(1)}%</span></div></button>`).join(''):'<p class="help">範囲はまだありません。</p>';
}
function render(){renderEditor();renderList();renderView();draw();refreshReport();$('undoBtn').disabled=!history.length;}
function addRegion(rect){if(!before)return Q.toast('先に修正前の画像を読み込んでください。');if(regions.length>=C.MAX_REGIONS)return Q.toast('範囲は60個までです。');if(!C.validRect(rect))return Q.toast('画像内に収まる位置と大きさを指定してください。');snapshot();const r={id:Q.id(),type:mode,...rect,title:'',note:'',criteria:'',verified:false};regions.push(r);selectedId=r.id;invalidate();view='before';render();Q.toast(`${labels[mode]}範囲を追加しました。指示と合格条件を記入できます。`);}
function point(e){const b=canvas.getBoundingClientRect();return {x:C.clamp((e.clientX-b.left)/b.width),y:C.clamp((e.clientY-b.top)/b.height)};}
canvas.addEventListener('pointerdown',e=>{if(!before||view!=='before'||e.button!==0)return;e.preventDefault();canvas.setPointerCapture(e.pointerId);drag={start:point(e),end:point(e),pointer:e.pointerId};});
canvas.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.pointer)return;drag.end=point(e);draw();});
canvas.addEventListener('pointerup',e=>{if(!drag||e.pointerId!==drag.pointer)return;const p=point(e),r=C.rectFromPoints(drag.start,p);drag=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(r.w*canvas.width<4||r.h*canvas.height<4){const hit=[...regions].reverse().find(r=>p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h);if(hit)selectedId=hit.id;render();return;}addRegion(r);});
canvas.addEventListener('pointercancel',()=>{drag=null;draw();});
function fileData(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('ファイルを読み込めません。'));r.readAsDataURL(file);});}
async function decode(data,name){
 const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('画像を読み込めません。PNG / JPEG / WebPを選んでください。'));img.src=data;});
 const size=C.workSize(img.naturalWidth,img.naturalHeight),c=document.createElement('canvas');c.width=size.width;c.height=size.height;const x=c.getContext('2d',{willReadFrequently:true});x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(img,0,0,c.width,c.height);
 return {data,name,canvas:c,width:c.width,height:c.height,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight};
}
function metadata(){for(const [key,img]of [['before',before],['after',after]])$(key+'Meta').textContent=img?`${img.name} · ${img.naturalWidth}×${img.naturalHeight}px${img.naturalWidth!==img.width?' / 縮小表示':''}`:(key==='before'?'ここへドロップもできます':'比較するときに追加します');}
async function loadImage(file,which){if(!file)return;const ticket=++requestId;try{if(file.size>C.MAX_FILE)throw new Error('画像は1枚10MBまでです。');if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('PNG / JPEG / WebPの画像を選んでください。');const img=await decode(await fileData(file),file.name);if(ticket!==requestId)return;if(which==='before'){if(before&&regions.length&&!confirm('修正前の画像を変更すると、範囲と修正後画像をリセットします。続けますか？'))return;before=img;after=null;regions=[];selectedId=null;history=[];}else after=img;invalidate();view='before';metadata();render();Q.toast('画像を読み込みました。');}catch(err){if(ticket===requestId)Q.toast(err.message);}}
function matching(){return !!before&&!!after&&before.naturalWidth===after.naturalWidth&&before.naturalHeight===after.naturalHeight;}
function compare(){
 if(!before||!after)return Q.toast('修正前と修正後の画像を両方読み込んでください。');
 if(!matching()){$('diffBadge').textContent='サイズ不一致';$('diffBadge').className='badge bad';$('diffSummary').textContent=`元画像のサイズが異なります（修正前 ${before.naturalWidth}×${before.naturalHeight} / 修正後 ${after.naturalWidth}×${after.naturalHeight}）。同じ画面幅・高さで撮影し直してください。`;diff=null;refreshReport();return;}
 const ticket=++compareToken;$('compareBtn').disabled=true;$('compareBtn').textContent='比較中…';
 setTimeout(()=>{try{if(ticket!==compareToken)return;const a=before.canvas.getContext('2d').getImageData(0,0,before.width,before.height).data,b=after.canvas.getContext('2d').getImageData(0,0,after.width,after.height).data;diff=C.comparePixels(a,b,before.width,before.height,regions,threshold);const protectedChanges=diff.stats.filter(s=>s.type==='protect'&&s.changed>0).length,protectedCount=regions.filter(r=>r.type==='protect').length;
 $('diffBadge').textContent=protectedChanges?'変更禁止範囲に違いあり':'比較完了';$('diffBadge').className='badge '+(protectedChanges?'bad':'ok');
 $('diffSummary').textContent=`比較対象の${ratio(diff.ratio)}に色の違いがあります。${protectedCount?`変更禁止 ${protectedCount}範囲中、${protectedChanges}範囲で違いを検出。`:'変更禁止範囲は未設定です。'} 除外: ${Q.fmt(diff.ignored)}画素。`;
 $('diffStats').innerHTML=diff.stats.filter(s=>s.type!=='ignore').map(s=>{const r=regions.find(r=>r.id===s.id),warn=s.type==='protect'&&s.changed>0;return `<div class="status-item ${warn?'fail':s.total===0?'wait':'pass'}"><span class="status-dot" aria-hidden="true">${warn?'!':s.total===0?'–':'✓'}</span><div><strong>${Q.esc(r.title||labels[r.type])} · ${ratio(s.ratio)}</strong><small>${s.total===0?'すべて除外範囲と重なっています。比較対象がありません。':s.type==='fix'?'変化の量です。修正の合否は自分で確認してください。':s.changed?'変更禁止範囲に違いがあります。意図した変更か確認してください。':'設定したしきい値を超える違いはありません。'}</small></div></div>`;}).join('');view='diff';renderView();draw();refreshReport();
 }catch(err){Q.toast(err.message);}finally{$('compareBtn').disabled=false;$('compareBtn').textContent='差分をチェック';}},30);
}
function report(){
 const out=[`# ${Q.md(title||'修正指示書')}`,'',`修正前: ${Q.md(before?.name||'未設定')}`,`修正後: ${Q.md(after?.name||'未設定')}`,`元画像サイズ: ${before?`${before.naturalWidth} × ${before.naturalHeight}px`:'未設定'}`,'','以下は利用者が指定した修正範囲・維持範囲です。指示にない場所は変更せず、修正後は同じ画面サイズの画像で確認してください。',''];
 for(const type of ['fix','protect','ignore']){out.push(`## ${labels[type]}`);const rs=regions.filter(r=>r.type===type);if(!rs.length)out.push('指定なし。');for(const r of rs){const w=before?.naturalWidth||100,h=before?.naturalHeight||100,b=C.bounds(r,w,h);out.push(`### #${regions.indexOf(r)+1} ${Q.md(r.title||labels[type])}`,`位置: 左 ${b.x0}px / 上 ${b.y0}px / 幅 ${b.x1-b.x0}px / 高さ ${b.y1-b.y0}px`,`指示: ${Q.md(r.note||'未記入')}`,`合格条件: ${Q.md(r.criteria||'未記入')}`,`手動確認: ${r.verified?'確認済み':'未確認'}`,'');}}
 out.push('## 比較結果');if(diff){out.push(`しきい値: ${threshold}/255。長辺2,000px以内の処理画像で比較。`,`比較対象の差分率: ${ratio(diff.ratio)} / 除外 ${diff.ignored}画素`);for(const s of diff.stats.filter(s=>s.type!=='ignore')){const r=regions.find(r=>r.id===s.id);out.push(`- #${regions.indexOf(r)+1} ${Q.md(r.title||labels[r.type])}: ${ratio(s.ratio)}`);}}
 else out.push(before&&after&&!matching()?'画像サイズが不一致のため比較できません。':'未比較、または変更後の再比較が必要です。');
 out.push('','差分は色の違いであり、正しさや修正完了を保証しません。細かな差は縮小やしきい値で見えなくなることがあります。');return out.join('\n');
}
function refreshReport(){$('reportPreview').value=report();}
function project(){return {app:'koko-naoshite',version:1,title,before:before?{name:before.name,data:before.data}:null,after:after?{name:after.name,data:after.data}:null,regions:Q.clone(regions),threshold};}
function clear(){requestId++;compareToken++;before=after=diff=drag=null;regions=[];history=[];selectedId=null;title='';view='before';threshold=24;$('projectTitle').value='';$('threshold').value='24';$('thresholdValue').textContent='24';metadata();$('diffBadge').textContent='比較前';$('diffBadge').className='badge';$('diffStats').textContent='';$('diffSummary').textContent='修正前と修正後の画像を読み込むと比較できます。';render();}
async function sample(){
 if(before&&!confirm('このタブの画像と指示をサンプルに置き換えますか？未保存の内容は失われます。'))return;
 const ticket=++requestId;
 const make=(changed)=>{const c=document.createElement('canvas');c.width=960;c.height=600;const g=c.getContext('2d');g.fillStyle='#f3f5f7';g.fillRect(0,0,960,600);g.fillStyle='#fff';g.fillRect(35,28,890,92);g.fillStyle=changed?'#16459b':'#26323e';g.font='bold 24px sans-serif';g.fillText('PORTFOLIO / sample',65,84);g.font='14px sans-serif';g.fillStyle='#647181';g.fillText('WORK    ABOUT    CONTACT',615,81);g.fillStyle='#fff';g.fillRect(55,150,850,390);g.fillStyle='#b44b30';g.font='bold 14px sans-serif';g.fillText('NEW PROJECT',90,205);g.fillStyle='#24303c';g.font='bold 38px sans-serif';g.fillText('小さな道具で、',90,269);g.fillText('作業に余白を。',90,320);g.font='17px sans-serif';g.fillStyle='#647181';g.fillText('誰かの困りごとを、ひとつずつ解いていく。',90,373);g.fillStyle='#eee5df';g.fillRect(620,180,240,208);g.fillStyle='#c9aea0';g.fillRect(648,208,120,128);g.fillStyle='#9f8070';g.fillRect(721,263,110,97);g.fillStyle='#26323e';g.fillRect(changed?650:790,432,210,55);g.fillStyle='#fff';g.font='bold 17px sans-serif';g.fillText('作品を見る  →',changed?693:823,466);g.fillStyle='#7b8794';g.font='12px sans-serif';g.fillText(changed?'UPDATED 10:32':'UPDATED 10:30',783,576);return c.toDataURL('image/png');};
 try{const b=await decode(make(false),'sample-before.png'),a=await decode(make(true),'sample-after.png');if(ticket!==requestId)return;before=b;after=a;title='スマホ画面ではみ出すボタンを修正';$('projectTitle').value=title;regions=[{id:Q.id(),type:'fix',x:.65,y:.69,w:.34,h:.16,title:'右端のボタン',note:'ボタン全体が画像内に収まるようにしてください。文言は変更しません。',criteria:'右側の余白を取り、文字が欠けていないこと。',verified:false},{id:Q.id(),type:'protect',x:.05,y:.06,w:.87,h:.12,title:'ヘッダーの配色と文言',note:'ヘッダーの色・文字・配置を変更しないでください。',criteria:'修正前と同じ見た目であること。',verified:false},{id:Q.id(),type:'ignore',x:.8,y:.92,w:.18,h:.06,title:'更新時刻',note:'更新時刻は比較から除外します。',criteria:'',verified:false}];selectedId=regions[0].id;history=[];threshold=24;$('threshold').value='24';$('thresholdValue').textContent='24';invalidate();metadata();render();compare();Q.toast('サンプルでは、ボタンは移動していますが、変更禁止のヘッダーにも色の違いがあります。');}catch(err){Q.toast(err.message);}
}
$('helpBtn').onclick=Q.help;$('closeHelp').onclick=()=>$('helpDialog').close();$('sampleBtn').onclick=sample;
for(const which of ['before','after']){$(which+'Btn').onclick=()=>$(which+'File').click();$(which+'File').onchange=e=>{const f=e.target.files[0];e.target.value='';loadImage(f,which);};const b=$(which+'Btn');b.addEventListener('dragover',e=>{e.preventDefault();b.classList.add('dragover');});b.addEventListener('dragleave',()=>b.classList.remove('dragover'));b.addEventListener('drop',e=>{e.preventDefault();b.classList.remove('dragover');loadImage(e.dataTransfer.files[0],which);});}
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.mode===mode)));setView('before');});
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));$('opacity').oninput=()=>{$('opacityValue').textContent=$('opacity').value+'%';draw();};
$('rectForm').onsubmit=e=>{e.preventDefault();addRegion({x:Number($('rectX').value)/100,y:Number($('rectY').value)/100,w:Number($('rectW').value)/100,h:Number($('rectH').value)/100});};
$('regionList').onclick=e=>{const b=e.target.closest('[data-id]');if(b){selectedId=b.dataset.id;render();}};
for(const [id,key]of [['regionTitle','title'],['regionNote','note'],['regionCriteria','criteria']])$(id).addEventListener('input',()=>{const r=selected();if(!r)return;r[key]=$(id).value;r.verified=false;$('regionVerified').checked=false;renderList();refreshReport();});
$('regionVerified').onchange=()=>{const r=selected();if(r){r.verified=$('regionVerified').checked;renderList();refreshReport();}};
$('deleteRegion').onclick=()=>{if(!selected())return;snapshot();regions=regions.filter(r=>r.id!==selectedId);selectedId=regions[0]?.id||null;invalidate();render();};
$('undoBtn').onclick=()=>{if(!history.length)return;regions=history.pop();selectedId=regions[regions.length-1]?.id||null;invalidate();render();Q.toast('範囲の追加・削除をひとつ戻しました。');};
$('projectTitle').oninput=()=>{title=$('projectTitle').value;refreshReport();};$('threshold').oninput=()=>{threshold=Number($('threshold').value);$('thresholdValue').textContent=threshold;invalidate();render();};$('compareBtn').onclick=compare;
$('copyReport').onclick=()=>Q.copy(report(),$('reportPreview'));$('exportReport').onclick=()=>Q.download((title||'ここ直して_指示書')+'.md',report());
$('exportPng').onclick=()=>{if(!before)return Q.toast('修正前の画像を読み込んでください。');const c=document.createElement('canvas');c.width=before.width;c.height=before.height;const g=c.getContext('2d');g.drawImage(before.canvas,0,0);drawRegions(g,regions,c.width,c.height);c.toBlob(blob=>{if(blob)Q.download('ここ直して_注釈.png',blob);else Q.toast('PNGを書き出せませんでした。');},'image/png');};
$('saveProject').onclick=()=>Q.json('ここ直して_プロジェクト.json',project());$('openProject').onclick=()=>$('projectFile').click();$('projectFile').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;const ticket=++requestId;try{const data=C.validateProject(await Q.readJSON(file,32*1024*1024));const b=data.before?await decode(data.before.data,data.before.name):null,a=data.after?await decode(data.after.data,data.after.name):null;if(ticket!==requestId)return;if(!confirm('現在の画像と指示を、保存ファイルの内容に置き換えますか？手動確認は未確認に戻ります。'))return;before=b;after=a;regions=data.regions;title=data.title;threshold=data.threshold;$('projectTitle').value=title;$('threshold').max=Math.max(80,threshold);$('threshold').value=threshold;$('thresholdValue').textContent=threshold;selectedId=regions[0]?.id||null;history=[];invalidate();view='before';metadata();render();Q.toast('プロジェクトを読み込みました。');}catch(err){if(ticket===requestId)Q.toast(err.message);}};
$('clearAll').onclick=()=>{if(confirm('このタブの画像と指示をすべて消去しますか？保存済みのファイルは消えません。'))clear();};
window.addEventListener('beforeunload',e=>{if(before||regions.length){e.preventDefault();e.returnValue='';}});
metadata();render();
})();
