/* Geometry, project validation, and deterministic image-diff logic. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ReviewCore=api;})(typeof window==='undefined'?globalThis:window,function(){
'use strict';
const MAX_REGIONS=60,MAX_SIDE=2000,MAX_PIXELS=16000000,MAX_FILE=10*1024*1024;
const TYPES=['fix','protect','ignore'];
function clamp(n,min=0,max=1){return Math.max(min,Math.min(max,n));}
function rectFromPoints(a,b){const x=clamp(Math.min(a.x,b.x)),y=clamp(Math.min(a.y,b.y));return {x,y,w:clamp(Math.max(a.x,b.x))-x,h:clamp(Math.max(a.y,b.y))-y};}
function validRect(r){return !!r&&['x','y','w','h'].every(k=>typeof r[k]==='number'&&Number.isFinite(r[k]))&&r.x>=0&&r.y>=0&&r.w>0&&r.h>0&&r.x+r.w<=1.000001&&r.y+r.h<=1.000001;}
function bounds(r,w,h){return {x0:clamp(Math.floor(r.x*w),0,w),y0:clamp(Math.floor(r.y*h),0,h),x1:clamp(Math.ceil((r.x+r.w)*w),0,w),y1:clamp(Math.ceil((r.y+r.h)*h),0,h)};}
function workSize(w,h){if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w*h>MAX_PIXELS||Math.max(w,h)>16000)throw new Error('画像は1,600万画素以内、各辺16,000px以内にしてください。');const k=Math.min(1,MAX_SIDE/Math.max(w,h));return {width:Math.max(1,Math.round(w*k)),height:Math.max(1,Math.round(h*k)),scale:k};}
function text(v,max){if(typeof v!=='string'||v.length>max)throw new Error('プロジェクト内のテキストが不正です。');return v;}
function validateRegion(r){
 if(!r||!TYPES.includes(r.type)||!validRect(r))throw new Error('範囲情報の座標または種類が不正です。');
 return {id:text(r.id,100),type:r.type,x:r.x,y:r.y,w:r.w,h:r.h,title:text(r.title??'',200),note:text(r.note??'',5000),criteria:text(r.criteria??'',5000),verified:false};
}
function validateProject(data){
 if(!data||data.app!=='koko-naoshite'||data.version!==1)throw new Error('ここ直して v1のプロジェクトファイルを選んでください。');
 if(!Array.isArray(data.regions)||data.regions.length>MAX_REGIONS)throw new Error(`範囲は${MAX_REGIONS}個までです。`);
 const regions=data.regions.map(validateRegion);if(regions.some(r=>!r.id)||new Set(regions.map(r=>r.id)).size!==regions.length)throw new Error('範囲IDが重複または空です。');
 const image=(v)=>{if(v===null||v===undefined)return null;if(!v||typeof v!=='object')throw new Error('画像情報が不正です。');const src=text(v.data,16*1024*1024);if(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/\r\n]+=*$/.test(src))throw new Error('画像の形式が不正です。PNG / JPEG / WebPのみ対応します。');return {data:src,name:text(v.name,500)};};
 const before=image(data.before),after=image(data.after);if(regions.length&&!before)throw new Error('範囲に対応する修正前画像がありません。');
 const threshold=data.threshold??24;if(!Number.isInteger(threshold)||threshold<0||threshold>255)throw new Error('差分のしきい値が不正です。');
 return {app:'koko-naoshite',version:1,title:text(data.title??'',200),before,after,regions,threshold};
}
function comparePixels(before,after,width,height,regions,threshold=24){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>MAX_SIDE||height>MAX_SIDE)throw new Error('比較サイズが不正です。');
 const size=width*height;
 if(!before||!after||before.length!==size*4||after.length!==size*4)throw new Error('画像サイズが一致しません。');
 if(!Array.isArray(regions)||regions.length>MAX_REGIONS||regions.some(r=>!validRect(r)||!TYPES.includes(r.type)))throw new Error('範囲情報が不正です。');
 if(!Number.isInteger(threshold)||threshold<0||threshold>255)throw new Error('しきい値が不正です。');
 const ignored=new Uint8Array(size),changed=new Uint8Array(size),heatmap=new Uint8ClampedArray(size*4);
 for(const r of regions.filter(r=>r.type==='ignore')){const b=bounds(r,width,height);for(let y=b.y0;y<b.y1;y++)ignored.fill(1,y*width+b.x0,y*width+b.x1);}
 let total=0,different=0;
 for(let p=0;p<size;p++){
  const i=p*4,d=Math.max(Math.abs(before[i]-after[i]),Math.abs(before[i+1]-after[i+1]),Math.abs(before[i+2]-after[i+2]),Math.abs(before[i+3]-after[i+3]));
  if(!ignored[p]){total++;if(d>threshold){changed[p]=1;different++;}}
  const gray=Math.round(220+(before[i]*.2126+before[i+1]*.7152+before[i+2]*.0722)*.12);
  if(ignored[p]){heatmap[i]=201;heatmap[i+1]=207;heatmap[i+2]=218;}
  else if(changed[p]){heatmap[i]=226;heatmap[i+1]=93;heatmap[i+2]=55;}
  else heatmap[i]=heatmap[i+1]=heatmap[i+2]=gray;
  heatmap[i+3]=255;
 }
 const stats=regions.map(r=>{const b=bounds(r,width,height);let pixels=0,diff=0;for(let y=b.y0;y<b.y1;y++)for(let x=b.x0;x<b.x1;x++){const p=y*width+x;if(!ignored[p]){pixels++;diff+=changed[p];}}return {id:r.id,type:r.type,total:pixels,changed:diff,ratio:pixels?diff/pixels:null};});
 return {total,changed:different,ratio:total?different/total:null,ignored:size-total,stats,heatmap};
}
return {MAX_REGIONS,MAX_SIDE,MAX_PIXELS,MAX_FILE,TYPES,clamp,rectFromPoints,validRect,bounds,workSize,validateRegion,validateProject,comparePixels};
});
