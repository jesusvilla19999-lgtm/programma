// ---- variazione del programma da screenshot ----
var TESS_URL='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
var varWorker=null;
function varLoadTess(){
  if(window.Tesseract) return Promise.resolve();
  return new Promise(function(res,rej){ var s=document.createElement('script'); s.src=TESS_URL; s.onload=res; s.onerror=function(){ rej(new Error('Non riesco a scaricare il lettore di testo: serve internet.')); }; document.head.appendChild(s); });
}
function varGetWorker(){
  if(varWorker) return Promise.resolve(varWorker);
  return varLoadTess().then(function(){ return Tesseract.createWorker('ita'); }).then(function(w){ varWorker=w; return w.setParameters({tessedit_pageseg_mode:'6'}).then(function(){ return w; }); });
}
function varImage(file){
  return new Promise(function(res,rej){ var u=URL.createObjectURL(file), im=new Image(); im.onload=function(){ var c=document.createElement('canvas'); c.width=im.naturalWidth; c.height=im.naturalHeight; c.getContext('2d').drawImage(im,0,0); URL.revokeObjectURL(u); res(c); }; im.onerror=function(){ rej(new Error('Immagine non leggibile')); }; im.src=u; });
}
function varGrid(c){
  // righe della tabella: linee orizzontali; colonne: linee verticali cercate riga per riga (le celle unite cambiano da riga a riga)
  var W=c.width, H=c.height, d=c.getContext('2d').getImageData(0,0,W,H).data;
  function dark(x,y){ var k=(y*W+x)*4, r=d[k], g=d[k+1], b=d[k+2]; return (r+g+b)/3<175 && Math.max(r,g,b)-Math.min(r,g,b)<60; }
  function ink(x,y){ var k=(y*W+x)*4, r=d[k], g=d[k+1], b=d[k+2]; return (r+g+b)/3<235 || Math.max(r,g,b)-Math.min(r,g,b)>40; }
  function rowInk(y,x0,x1){ var n=0; for(var x=x0;x<x1;x++) if(ink(x,y)) n++; return n; }
  function group(v){ var g=[]; v.forEach(function(a){ if(g.length && a-g[g.length-1][1]<=2) g[g.length-1][1]=a; else g.push([a,a]); }); return g; }
  var lines=[]; for(var y=0;y<H;y++){ var n=0; for(var x=0;x<W;x++) if(dark(x,y)) n++; if(n>W*0.6) lines.push(y); }
  var R=group(lines);
  // bordo mancante sopra o sotto (screenshot tagliato): uso il bordo dell'immagine
  var top=0; while(top<H && rowInk(top,0,W)<=W*0.01) top++;
  var bot=H-1; while(bot>0 && rowInk(bot,0,W)<=W*0.01) bot--;
  if(!R.length || R[0][0]-top>8) R.unshift([top-1,top-1]);
  if(R[R.length-1][1]<bot-8) R.push([bot+1,bot+1]);
  var out=[];
  for(var i=0;i<R.length-1;i++){
    var ya=R[i][1]+1, yb=R[i+1][0]-1;
    while(ya<yb && rowInk(ya,0,W)<=W*0.01) ya++;
    while(yb>ya && rowInk(yb,0,W)<=W*0.01) yb--;
    if(yb-ya<8) continue;
    var cols=[]; for(var x2=0;x2<W;x2++){ var m=0; for(var y2=ya;y2<=yb;y2++) if(dark(x2,y2)) m++; if(m>(yb-ya+1)*0.7) cols.push(x2); }
    var C=group(cols), left=0, right=W-1;
    while(left<W-1){ var s=0; for(var y3=ya;y3<=yb;y3++) if(ink(left,y3)) s++; if(s) break; left++; }
    while(right>0){ var s2=0; for(var y4=ya;y4<=yb;y4++) if(ink(right,y4)) s2++; if(s2) break; right--; }
    if(!C.length || C[0][0]-left>8) C.unshift([left-1,left-1]);
    if(C[C.length-1][1]<right-8) C.push([right+1,right+1]);
    var row=[];
    for(var j=0;j<C.length-1;j++){ var xa=C[j][1]+1, xb=C[j+1][0]-1; if(xb-xa<8) continue;
      var has=false; for(var y5=ya+2;y5<=yb-2 && !has;y5++) for(var x5=xa+2;x5<=xb-2;x5++){ var k5=(y5*W+x5)*4; if((d[k5]+d[k5+1]+d[k5+2])/3<160){ has=true; break; } }
      row.push(has?[xa+1,ya,xb,yb+1]:null); }
    out.push(row);
  }
  return out;
}
function varCell(c,x0,y0,x1,y1){
  var w=x1-x0, h=y1-y0, k=3, o=document.createElement('canvas'); o.width=w*k; o.height=h*k;
  var ctx=o.getContext('2d'); ctx.imageSmoothingQuality='high'; ctx.drawImage(c,x0,y0,w,h,0,0,w*k,h*k);
  var id=ctx.getImageData(0,0,o.width,o.height), p=id.data;
  for(var i=0;i<p.length;i+=4){ var l=0.299*p[i]+0.587*p[i+1]+0.114*p[i+2]; p[i]=p[i+1]=p[i+2]=l; }
  ctx.putImageData(id,0,0); return o;
}
function varOCR(file, prog){
  var canvas;
  return varImage(file).then(function(c){ canvas=c; return varGetWorker(); }).then(function(wk){
    var jobs=varGrid(canvas);
    var total=jobs.reduce(function(s,r){ return s+r.filter(Boolean).length; },0), done=0, out=[];
    var p=Promise.resolve();
    jobs.forEach(function(row){ var cells=[]; out.push(cells);
      row.forEach(function(b){
        if(!b){ p=p.then(function(){ cells.push(''); }); return; }
        p=p.then(function(){ return wk.recognize(varCell(canvas,b[0],b[1],b[2],b[3])); }).then(function(r){ cells.push((r.data.text||'').replace(/\n+/g,' | ').replace(/[ \t]+/g,' ').trim()); done++; if(prog) prog(done,total); }); }); });
    return p.then(function(){ return out; });
  });
}
function varLev(a,b){ var m=a.length,n=b.length,d=[],i,j; for(i=0;i<=m;i++){ d[i]=[i]; } for(j=0;j<=n;j++) d[0][j]=j;
  for(i=1;i<=m;i++) for(j=1;j<=n;j++) d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1)); return d[m][n]; }
function varNorm(s){ return (s||'').toLowerCase().replace(/[^a-z0-9àèéìòù]+/g,' ').trim(); }
function varDice(a,b){ a=varNorm(a); b=varNorm(b); if(!a||!b) return 0; if(a===b) return 1;
  function bg(s){ var o={}; for(var i=0;i<s.length-1;i++){ var k=s.substr(i,2); o[k]=(o[k]||0)+1; } return o; }
  var A=bg(a), B=bg(b), inter=0, na=0, nb=0, k; for(k in A){ na+=A[k]; if(B[k]) inter+=Math.min(A[k],B[k]); } for(k in B) nb+=B[k]; return 2*inter/(na+nb||1); }
function varKnown(){
  var ps={}, acts={};
  Object.keys(S.cache).forEach(function(id){ var w=S.cache[id]; if(!w||!w.giorni) return; w.giorni.forEach(function(g){ g.turni.forEach(function(t){ t.attivita.forEach(function(a){ if(a.attivita) acts[a.attivita]=1; a.persone.forEach(function(p){ ps[p]=1; }); }); }); }); });
  NUCLEO_UD.forEach(function(n){ var t=n.replace(/(^|\s)\S/g,function(c){ return c.toUpperCase(); }); if(!Object.keys(ps).some(function(p){ return p.toLowerCase()===n; })) ps[t]=1; });
  return {people:Object.keys(ps), acts:Object.keys(acts)};
}
function varName(raw, known){
  var s=(raw||'').replace(/[^A-Za-zÀ-ÿ' ]+/g,' ').replace(/\s+/g,' ').trim(); if(s.length<3) return null;
  var best=null, bd=99, l=s.toLowerCase();
  known.forEach(function(k){ var dd=varLev(l,k.toLowerCase()); if(dd<bd){ bd=dd; best=k; } });
  if(best && bd<=Math.max(1,Math.floor(s.length/4))) return fixName(best);
  return fixName(s.replace(/(^|\s|')\S/g,function(c){ return c.toUpperCase(); }));
}
function varRows(cells){
  var kn=varKnown(), rows=[];
  cells.forEach(function(cs){
    var act='', odl=[], ps=[];
    cs.forEach(function(t,j){
      if(!t) return;
      if(/\d{5,}/.test(t)){ odl.push(t.replace(/\s*\|\s*/g,' ').replace(/[{\[]/g,'(').replace(/[}\]]/g,')')); return; }
      if(!act && j===0){ act=t.replace(/\s*\|\s*/g,' '); return; }
      t.split(/\s*[|¦]\s*|\s{2,}/).forEach(function(part){ var n=varName(part,kn.people); if(n && ps.indexOf(n)<0) ps.push(n); });
    });
    if(!ps.length && !act) return;
    if(/^attivit/i.test(act) && !ps.length) return;
    if(act){ var best='', bs=0; kn.acts.forEach(function(a){ var s=varDice(act,a); if(s>bs){ bs=s; best=a; } }); if(bs>=0.85) act=best; }
    rows.push({attivita:act, odl:odl.join(' - '), persone:ps});
  });
  return rows;
}
function varSim(r,a){
  var n1=(r.odl||'').match(/\d{6,}/g)||[], n2=(a.odl||'').match(/\d{6,}/g)||[];
  if(n1.some(function(x){ return n2.indexOf(x)>=0; })) return 1;
  return varDice(r.attivita,a.attivita);
}
function varPlan(w0,i,rows,turno){
  var w=JSON.parse(JSON.stringify(w0)), g=w.giorni[i], ch=[], now=new Date().toISOString(), movers={}, used=[], dropped=[], old=[];
  // mattina/giornaliero, pomeriggio e notte sono separati: una persona si sposta solo dentro la stessa fascia
  function fascia(l){ var k=turnoInfo(l).k; return k==='N'?'N':(k==='P'?'P':'D'); }
  rows.forEach(function(r){ r._t=null; r._f=fascia(turno); var best=null, bs=0, bt=null;
    g.turni.forEach(function(t){ t.attivita.forEach(function(a){ if(used.indexOf(a)>=0) return; var s=varSim(r,a); if(s>bs){ bs=s; best=a; bt=t; } }); });
    if(best && bs>=0.7){ r._t=best; r._f=fascia(bt.turno); used.push(best); } });
  rows.forEach(function(r){ r.persone.forEach(function(p){ var k=p.toLowerCase(); movers[k]=movers[k]||{}; movers[k][r._f]=1; }); });
  g.turni.forEach(function(t){ var f=fascia(t.turno); t.attivita=t.attivita.filter(function(a){
    if(used.indexOf(a)>=0) return true;
    var mv=function(p){ var m=movers[p.toLowerCase()]; return m && m[f]; };
    var rem=a.persone.filter(mv); if(!rem.length) return true;
    a.persone=a.persone.filter(function(p){ return !mv(p); }); a.mod=now;
    if(!a.persone.length){ ch.push({k:'del',t:'Eliminata «'+(a.attivita||'attività')+'»: c\'erano solo '+rem.join(', ')+', ora spostati'}); return false; }
    ch.push({k:'rm',t:'Da «'+(a.attivita||'attività')+'» tolti: '+rem.join(', ')}); return true; }); });
  g.turni=g.turni.filter(function(t){ return t.attivita.length || !t._new; });
  rows.forEach(function(r){
    if(!r.persone.length && !r.attivita) return;
    if(r._t){ var a=r._t; old=a.persone.slice();
      var same=old.length===r.persone.length && old.every(function(p){ return r.persone.indexOf(p)>=0; });
      if(!same){ a.persone=r.persone.slice(); a.mod=now; ch.push({k:'set',t:'«'+a.attivita+'»: ora '+(r.persone.join(', ')||'nessuno')+(old.length?' (prima: '+old.join(', ')+')':'')}); }
      if(r.odl && !a.odl){ a.odl=r.odl; a.mod=now; }
    } else {
      var t=g.turni.filter(function(z){ return z.turno===turno; })[0]; if(!t){ t={turno:turno, attivita:[]}; g.turni.push(t); }
      t.attivita.push({attivita:r.attivita, odl:r.odl, persone:r.persone.slice(), note:'', mod:now});
      ch.push({k:'add',t:'Nuova «'+(r.attivita||'attività')+'» ('+turnoInfo(turno).nome+'): '+r.persone.join(', ')});
    }
    if(r._t) old.forEach(function(p){ if(r.persone.indexOf(p)<0) dropped.push(p); });
    delete r._t;
  });
  var still={}; g.turni.forEach(function(t){ t.attivita.forEach(function(a){ a.persone.forEach(function(p){ still[p]=1; }); }); });
  dropped.filter(function(p,k){ return !still[p] && dropped.indexOf(p)===k; }).forEach(function(p){ ch.push({k:'warn',t:p+' non compare più in nessuna attività di questo giorno'}); });
  return {w:w, ch:ch};
}
function varTurni(rec){
  var labels=rec.w.giorni[rec.i].turni.map(function(t){ return t.turno; });
  ['Turno M','Turno P','Turno N'].forEach(function(l){ if(!labels.some(function(z){ return turnoInfo(z).k===turnoInfo(l).k; })) labels.push(l); });
  return labels;
}
function varPanel(key,rec){
  var v=S.cal.vari; if(!v || v.key!==key) return '';
  if(v.stage==='ocr') return '<div class="mi varbox"><strong>Variazione da screenshot</strong><p class="hint" style="margin:0">'+esc(v.msg||'')+'</p><div><button class="btn small" type="button" data-vact="cancel">Annulla</button></div></div>';
  var labels=varTurni(rec); if(!v.turno) v.turno=labels[0];
  var rows=v.rows.map(function(r,n){
    return '<div class="varrow"><input data-vr="'+n+'" data-vf="attivita" value="'+esc(r.attivita)+'" placeholder="Attività"><input data-vr="'+n+'" data-vf="odl" value="'+esc(r.odl)+'" placeholder="OdL"><input data-vr="'+n+'" data-vf="persone" value="'+esc(r.persone.join(', '))+'" placeholder="Persone, separate da virgola"><button class="btn small" type="button" data-vrm="'+n+'" aria-label="Togli riga">✕</button></div>'; }).join('');
  return '<div class="mi varbox"><strong>Variazione da screenshot</strong>'+
    '<p class="hint" style="margin:0">'+(v.rows.length?'Ho letto queste righe. Controlla e correggi se serve:':'Non ho trovato una tabella nello screenshot. Ritaglia solo le righe della tabella e riprova, oppure scrivi tu le righe.')+'</p>'+
    rows+'<div><button class="btn small" type="button" data-vact="addrow">+ Riga</button></div>'+
    '<label class="eyebrow">Le attività nuove vanno nel turno<select id="varT">'+labels.map(function(l){ var ti=turnoInfo(l); return '<option value="'+esc(l)+'"'+(l===v.turno?' selected':'')+'>'+esc(ti.nome+(ti.sub?' '+ti.sub:''))+'</option>'; }).join('')+'</select></label>'+
    '<div id="varPrev">'+varPrevHtml(rec)+'</div>'+
    (lsGet('umte_pw')?'':'<label class="eyebrow">Password per salvare<input type="password" id="vPw" autocomplete="current-password"></label>')+
    '<div class="bar"><button class="btn primary" type="button" data-vact="save">Applica e salva</button><button class="btn" type="button" data-vact="cancel">Annulla</button></div></div>';
}
function varPrevHtml(rec){
  var v=S.cal.vari, pl=varPlan(rec.w,rec.i,v.rows,v.turno);
  if(!pl.ch.length) return '<p class="hint" style="margin:0">Nessuna modifica da fare: il programma è già così.</p>';
  return '<p class="eyebrow" style="margin:0">Cosa cambierà ('+pl.ch.length+')</p><ul class="varch">'+pl.ch.map(function(c){ return '<li class="'+c.k+'">'+esc(c.t)+'</li>'; }).join('')+'</ul>';
}
function varPick(){
  var f=document.createElement('input'); f.type='file'; f.accept='image/*'; f.style.display='none'; document.body.appendChild(f);
  var key=S.cal.sel;
  f.addEventListener('change',function(){
    var file=f.files[0]; f.remove(); if(!file) return;
    S.cal.edit=null; S.cal.vari={key:key, stage:'ocr', msg:'Leggo lo screenshot… la prima volta può volerci un minuto.'}; render();
    varOCR(file,function(d,t){ if(S.cal.vari && S.cal.vari.stage==='ocr'){ S.cal.vari.msg='Leggo lo screenshot… '+d+' di '+t+' caselle'; render(); } })
      .then(function(cells){ if(!S.cal.vari || S.cal.vari.key!==key) return; S.cal.vari={key:key, stage:'edit', rows:varRows(cells)}; render(); })
      .catch(function(e){ S.cal.vari=null; setStatus('Lettura dello screenshot non riuscita: '+errMsg(e), true); render(); });
  });
  f.click();
}
function varSave(){
  var v=S.cal.vari, rec=calMap()[v.key]; if(!rec) return;
  var pw=lsGet('umte_pw') || ($('vPw')&&$('vPw').value) || '';
  if(!pw){ setStatus('Inserisci la password per salvare.', true); if($('vPw')) $('vPw').focus(); return; }
  var pl=varPlan(rec.w,rec.i,v.rows,v.turno);
  if(!pl.ch.length){ S.cal.vari=null; setStatus('Nessuna modifica da salvare.'); render(); return; }
  setStatus('Salvataggio in corso…');
  server('saveWeek', pw, JSON.stringify(pl.w)).then(function(id){
    lsSet('umte_pw', pw); S.cache[id]=fixWeek(pl.w); S.cal.vari=null;
    setStatus('Variazione applicata: '+pl.ch.length+(pl.ch.length===1?' modifica.':' modifiche.')); render();
  }).catch(function(e){ var m=errMsg(e); if(/password/i.test(m)) lsSet('umte_pw',''); setStatus('Salvataggio non riuscito: '+m, true); render(); });
}
function varClick(e){
  var c=e.target.closest('[data-cvar],[data-vact],[data-vrm]'); if(!c) return false;
  var v=S.cal.vari;
  if(c.dataset.cvar) varPick();
  else if(c.dataset.vrm!=null && v){ v.rows.splice(+c.dataset.vrm,1); render(); }
  else if(c.dataset.vact==='addrow' && v){ v.rows.push({attivita:'',odl:'',persone:[]}); render(); }
  else if(c.dataset.vact==='cancel'){ S.cal.vari=null; render(); }
  else if(c.dataset.vact==='save') varSave();
  return true;
}
document.addEventListener('input',function(e){
  var t=e.target, v=S.cal&&S.cal.vari; if(!v || v.stage!=='edit') return;
  if(t.dataset && t.dataset.vr!=null){ var r=v.rows[+t.dataset.vr]; if(!r) return;
    if(t.dataset.vf==='persone') r.persone=t.value.split(',').map(function(s){ return fixName(s.trim()); }).filter(Boolean); else r[t.dataset.vf]=t.value; }
  else if(t.id==='varT') v.turno=t.value; else return;
  var rec=calMap()[v.key]; if(rec && $('varPrev')) $('varPrev').innerHTML=varPrevHtml(rec);
});
document.addEventListener('change',function(e){ if(e.target.id==='varT' && S.cal && S.cal.vari){ S.cal.vari.turno=e.target.value; var rec=calMap()[S.cal.vari.key]; if(rec && $('varPrev')) $('varPrev').innerHTML=varPrevHtml(rec); } });
