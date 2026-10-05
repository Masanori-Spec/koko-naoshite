/* Local-only utilities. This script intentionally contains no network operations. */
(function (root) {
  'use strict';
  const Q = {};
  Q.$ = (id) => document.getElementById(id);
  Q.esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  Q.clone = (value) => JSON.parse(JSON.stringify(value));
  Q.id = () => (root.crypto && crypto.randomUUID) ? crypto.randomUUID() : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,12)}`;
  Q.toast = (message) => { const el=Q.$('toast'); if(!el)return; clearTimeout(Q.toastTimer); el.textContent=message; Q.toastTimer=setTimeout(()=>el.textContent='',5000); };
  Q.download = (name, content, type='text/plain;charset=utf-8') => {
    const blob=content instanceof Blob?content:new Blob([content],{type});
    const url=URL.createObjectURL(blob), a=document.createElement('a');
    a.href=url; a.download=Q.filename(name); document.body.append(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
  };
  Q.filename = (name) => String(name).replace(/[<>:"/\\|?*\u0000-\u001F]/g,'_').slice(0,150)||'download';
  Q.json = (name, data) => Q.download(name, JSON.stringify(data,null,2),'application/json;charset=utf-8');
  Q.readJSON = async (file, max=2*1024*1024) => {
    if(!file)throw new Error('ファイルを選択してください。');
    if(file.size>max)throw new Error(`ファイルが大きすぎます。上限は${Math.round(max/1024/1024)}MBです。`);
    try { return JSON.parse((await file.text()).replace(/^\uFEFF/,'')); } catch { throw new Error('JSONを読み込めません。書き出したJSONファイルを選んでください。'); }
  };
  Q.copy = async (text, fallback) => {
    try { if(!navigator.clipboard?.writeText)throw new Error('Unavailable'); await navigator.clipboard.writeText(text); Q.toast('コピーしました。'); return true; }
    catch {
      const ta=document.createElement('textarea'); ta.value=text; ta.setAttribute('aria-label','コピー用テキスト'); ta.style.cssText='position:fixed;top:0;left:0;opacity:0'; document.body.append(ta); ta.focus();ta.select();
      let done=false;try{done=document.execCommand('copy');}catch{}ta.remove();
      if(done){Q.toast('コピーしました。');return true;}
      if(fallback){fallback.focus();fallback.select?.();}
      Q.toast('自動コピーが許可されていません。プレビューを選択してコピーするか、ファイルとして保存してください。');return false;
    }
  };
  Q.load = (key, validate) => { try { const raw=localStorage.getItem(key); if(!raw)return null; return validate(JSON.parse(raw)); } catch { Q.toast('保存データを復元できませんでした。既存データは上書きしていません。');return null; } };
  Q.save = (key,data,enabled) => { try { if(enabled)localStorage.setItem(key,JSON.stringify(data));else localStorage.removeItem(key);return true; }catch{Q.toast('このブラウザでは保存できません。JSONを書き出して保管してください。');return false;} };
  Q.fmt = (n) => Number(n).toLocaleString('ja-JP');
  Q.date = (value=new Date()) => new Date(value).toLocaleString('ja-JP',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
  Q.md = (value) => String(value??'').replace(/([\\`*_{}\[\]<>#|])/g,'\\$1');
  Q.help = () => { Q.$('helpDialog')?.showModal(); };
  root.Quiet=Q;
})(typeof window==='undefined'?globalThis:window);
