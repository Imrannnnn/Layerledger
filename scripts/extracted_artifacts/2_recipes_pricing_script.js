
var CM2=6.4516;
function g(n){return Math.round(n).toLocaleString('en-US');}
function kg(n){return n>=1000?(n/1000).toFixed(2)+' kg':g(n)+' g';}
function N(n){return '₦'+Math.round(n).toLocaleString('en-US');}
function num(id){return parseFloat(document.getElementById(id).value)||0;}
function seg(id){return document.querySelector('#'+id+' button[aria-pressed="true"]').dataset.v;}
function plan(s,a,b){return s==='round'?Math.PI*a*a/4:(s==='square'?a*a:a*b);}
function peri(s,a,b){return s==='round'?Math.PI*a:(s==='square'?4*a:2*(a+b));}
function rows(el,list){
  var t=0,q=0,h='';
  list.forEach(function(x){ var c=x[1]*x[2]; t+=c; if(!x[3]) q+=x[1];
    h+='<tr><td>'+x[0]+'</td><td>'+(x[3]||g(x[1])+' g')+'</td><td>'+x[2].toFixed(2)+'</td><td>'+N(c)+'</td></tr>'; });
  document.getElementById(el).innerHTML=h; return {t:t,q:q};
}
var PANS=[['9 × 13 tray',9,13],['12 × 18 tray',12,18],['16 × 24 tray',16,24],['10 × 10 square',10,10]];
var oFlv=[{r:'van',n:2},{r:'cho',n:1}], oSig='';
function perPan(W,L,w,l){
  var a=Math.floor(L/l)*Math.floor(W/w), b=Math.floor(L/w)*Math.floor(W/l);
  return Math.max(a,b);
}

/* ---------- cake layers ---------- */
var bList=[['Unsalted butter',250,15.56],['Granulated sugar',250,1.50],['Eggs',250,5.83],
 ['Plain flour',300,1.14],['Whole milk',150,3.699],['Baking powder',10,3.00],['Salt',3,0.60],['Vanilla extract',8,12.22]];
var BAT={van:{n:'Vanilla sponge',cal:617},cho:{n:'Chocolate',cal:627},rv:{n:'Red velvet',cal:741}};
function drawB(){
  var r=rows('bIng',bList); var cpg=r.t/r.q;
  document.getElementById('bQ').textContent=g(r.q)+' g';
  document.getElementById('bC').textContent=N(r.t);
  document.getElementById('bY').textContent=g(r.q)+' g';
  document.getElementById('bG').textContent='₦'+cpg.toFixed(2);
  var s=seg('bShape'),a=num('bA'),b=num('bB');
  document.getElementById('bLabA').textContent=s==='round'?'Diameter':(s==='square'?'Side':'Length');
  document.getElementById('bWrapB').style.display=s==='rect'?'':'none';
  var ra=plan(s,a,b),d=num('bW')/ra/num('bH'),tr=num('bT')/100;
  document.getElementById('bD').textContent=d.toFixed(2)+' g per in² per inch';
  var pa=plan('round',10,0),perL=d*pa*num('bH')*(1+tr),tot=perL*3;
  document.getElementById('bEx').innerHTML=
    '<tr><td>In each pan</td><td>'+g(perL)+' g</td></tr>'
    +'<tr><td>Three pans</td><td>'+kg(tot)+'</td></tr>'
    +'<tr class="em"><td>Batter cost</td><td>'+N(tot*cpg)+'</td></tr>';
  document.getElementById('bWhy').textContent=
    'Trim of '+num('bT')+'% is in those grams, because the dome you level off still left your store.';
  Object.keys(BAT).forEach(function(k){ BAT[k].d=BAT[k].cal/(Math.PI*9)/2; BAT[k].cpg=cpg; BAT[k].tr=tr; });
  return {d:d,cpg:cpg,tr:tr,h:num('bH')};
}

/* ---------- coverings ---------- */
var C={
 bc:{n:'Buttercream',jobs:{f:1,c:1,n:1},t:{f:4.5,c:1.0,n:4.9},den:0.90,was:15,
     ing:[['Unsalted butter',450,15.56],['Reconstituted cream',200,8.667],['Icing sugar',450,2.40],['Milk powder',6,13.00],['Vanilla extract',5,12.22],['Salt',1.5,0.60]]},
 gn:{n:'Dark ganache',jobs:{f:1,c:1,n:1},t:{f:3.0,c:1.2,n:4.0},den:1.10,was:10,
     ing:[['Dark compound chocolate',400,14.00],['Reconstituted cream',200,8.667],['Unsalted butter',30,15.56]]},
 fd:{n:'Fondant',jobs:{f:0,c:0,n:1},t:{f:0,c:0,n:8.0},den:1.35,was:25,
     ing:[['Icing sugar',900,2.40],['Gelatine',10,17.50],['Water',60,0],['Glucose syrup',100,3.00],['Glycerine',10,3.50],['CMC / Tylose',10,5.00],['Margarine',20,1.20],['Vanilla extract',3,12.22]]},
 cm:{n:'Caramel sauce',jobs:{f:1,c:0,n:0},t:{f:1.5,c:0,n:0},den:1.30,was:5,
     ing:[['Granulated sugar',300,1.50],['Unsalted butter',100,15.56],['Whole milk',180,3.699],['Salt',3,0.60]]}
};
Object.keys(C).forEach(function(k){ var R=C[k],t=0,q=0;
  R.ing.forEach(function(x){t+=x[1]*x[2];q+=x[1];}); R.cpg=t/q; });
var cur='bc';
function drawC(){
  var R=C[cur];
  document.getElementById('cName').textContent=R.n;
  document.getElementById('cSw').innerHTML=Object.keys(C).map(function(k){
    return '<a href="#" data-k="'+k+'" style="color:'+(k===cur?'var(--ink)':'var(--accent)')+';font-weight:600;text-decoration:none;margin-right:10px">'+C[k].n+'</a>';}).join('');
  var r=rows('cIng',R.ing); var cpg=r.t/r.q; R.cpg=cpg;
  document.getElementById('cQ').textContent=g(r.q)+' g';
  document.getElementById('cC').textContent=N(r.t);
  document.getElementById('cY').textContent=g(r.q)+' g';
  document.getElementById('cG').textContent='₦'+cpg.toFixed(2);
  [['f','jf','tf'],['c','jc','tc'],['n','jn','tn']].forEach(function(p){
    document.getElementById(p[1]).classList.toggle('on',!!R.jobs[p[0]]);
    document.getElementById(p[2]).value=R.t[p[0]];
  });
  var nj=['f','c','n'].filter(function(k){return R.jobs[k];}).length;
  document.getElementById('cJobs').textContent=nj+(nj===1?' job':' jobs');
  document.getElementById('cDen').value=R.den;
  document.getElementById('cWas').value=R.was;
  var pa=plan('round',10,0),H=6,gap=pa*2,surf=pa+peri('round',10,0)*H;
  function m(area,mm){return area*CM2*(mm/10)*R.den*(1+R.was/100);}
  var h='';
  if(R.jobs.f) h+='<tr><td>Between the layers</td><td>'+g(m(gap,R.t.f))+' g</td></tr>';
  if(R.jobs.c) h+='<tr><td>Crumb coat</td><td>'+g(m(surf,R.t.c))+' g</td></tr>';
  if(R.jobs.n) h+='<tr><td>Outside finish</td><td>'+g(m(surf,R.t.n))+' g</td></tr>';
  var tot=(R.jobs.f?m(gap,R.t.f):0)+(R.jobs.c?m(surf,R.t.c):0)+(R.jobs.n?m(surf,R.t.n):0);
  h+='<tr class="em"><td>If it did every job it can</td><td>'+N(tot*cpg)+'</td></tr>';
  document.getElementById('cEx').innerHTML=h;
}
function covMass(area,mm,k){var R=C[k];return area*CM2*(mm/10)*R.den*(1+R.was/100);}

/* ---------- pastry & desserts ---------- */
var P={
 dn:{n:'Doughnuts',mode:'piece',per:30,was:5,
     ing:[['Plain flour',1000,1.14],['Granulated sugar',150,1.50],['Instant yeast',20,8.00],['Whole milk',400,3.699],['Eggs',100,5.83],['Unsalted butter',100,15.56],['Salt',10,0.60]]},
 mc:{n:'Chocolate mousse cup',mode:'piece',per:24,was:4,
     ing:[['Dark compound chocolate',1080,14.00],['Reconstituted cream',1440,8.667],['Eggs',480,5.83],['Granulated sugar',360,1.50],['Unsalted butter',240,15.56],['Serving cup with lid',24,45.00,'24 pcs']]},
 cc:{n:'Chin chin',mode:'weight',per:500,was:3,
     ing:[['Plain flour',1000,1.14],['Granulated sugar',200,1.50],['Unsalted butter',150,15.56],['Whole milk',200,3.699],['Eggs',100,5.83],['Nutmeg',5,20.00]]}
};
var pcur='dn';
function pEach(k){
  var R=P[k],t=0,q=0;
  R.ing.forEach(function(x){t+=x[1]*x[2]; if(!x[3]) q+=x[1];});
  return R.mode==='piece' ? t/R.per*(1+R.was/100) : t/q*R.per*(1+R.was/100);
}
function drawP(){
  var R=P[pcur];
  document.getElementById('pName').textContent=R.n;
  document.getElementById('pSw').innerHTML=Object.keys(P).map(function(k){
    return '<a href="#" data-pk="'+k+'" style="color:'+(k===pcur?'var(--ink)':'var(--accent)')+';font-weight:600;text-decoration:none;margin-right:10px">'+P[k].n+'</a>';}).join('');
  var r=rows('pIng',R.ing); var cpg=r.t/r.q;
  document.getElementById('pQ').textContent=g(r.q)+' g'+(r.q<r.t/cpg?'':'');
  document.getElementById('pC').textContent=N(r.t);
  document.getElementById('pY').textContent=g(r.q)+' g';
  document.getElementById('pG').textContent='₦'+cpg.toFixed(2);
  var mode=seg('pMode');
  document.getElementById('pWrapN').style.display=mode==='piece'?'':'none';
  document.getElementById('pWrapP').style.display=mode==='weight'?'':'none';
  R.mode=mode; R.was=num('pWas');
  var h='';
  if(mode==='piece'){
    R.per=num('pN');
    h='<tr><td>One piece weighs</td><td>'+g(r.q/R.per)+' g</td></tr>'
     +'<tr><td>Ingredients a piece</td><td>'+N(r.t/R.per)+'</td></tr>'
     +'<tr><td>With '+R.was+'% breakage</td><td>'+N(r.t/R.per*(1+R.was/100))+'</td></tr>'
     +'<tr class="em"><td>Cost a piece</td><td>'+N(pEach(pcur))+'</td></tr>';
  } else {
    R.per=num('pP');
    h='<tr><td>One pack</td><td>'+g(R.per)+' g</td></tr>'
     +'<tr><td>With '+R.was+'% waste</td><td>'+g(R.per*(1+R.was/100))+' g</td></tr>'
     +'<tr class="em"><td>Cost a pack</td><td>'+N(pEach(pcur))+'</td></tr>';
  }
  document.getElementById('pEx').innerHTML=h;
  document.getElementById('pD').textContent=mode==='piece'?R.per+' a batch':'sold by weight';
}

/* ---------- order: portions ---------- */
function drawO(){
  var route=seg('oRoute');
  document.getElementById('oSlab').style.display=route==='slab'?'':'none';
  document.getElementById('oCount').style.display=route==='count'?'':'none';
  var sel=document.getElementById('oPan');
  if(!sel.options.length) sel.innerHTML=PANS.map(function(p,i){
    return '<option value="'+i+'"'+(i===1?' selected':'')+'>'+p[0]+'</option>';}).join('');
  var csel=document.getElementById('oCr');
  if(!csel.options.length) csel.innerHTML=Object.keys(P).map(function(k){
    return '<option value="'+k+'"'+(k==='mc'?' selected':'')+'>'+P[k].n+'</option>';}).join('');

  if(route==='count'){
    var k=csel.value,n=num('oCn'),each=pEach(k);
    document.getElementById('oCex').innerHTML=
      '<tr><td>Cost each</td><td>'+N(each)+'</td></tr>'
      +'<tr><td>Batches to make</td><td>'+(n/P[k].per).toFixed(2)+'</td></tr>'
      +'<tr class="em"><td>'+n+' servings</td><td>'+N(each*n)+'</td></tr>';
    document.getElementById('oNote').textContent=n+' counted servings';
    return each*n;
  }

  var pIdx=+sel.value,pan=PANS[pIdx],W=pan[1],L=pan[2];
  var need=Math.ceil(num('oN')*(1+num('oAl')/100));
  var per=perPan(W,L,num('oW'),num('oL'));
  var slabs=Math.max(1,Math.ceil(need/per));
  var pa=W*L,Ht=num('oHt');
  var Ly=oFlv.reduce(function(s,F){return s+F.n;},0)||1, th=Ht/Ly;
  var frows='',batRows='',batG=0,batC=0;
  oFlv.forEach(function(F,i){
    var B=BAT[F.r], ppg=B.d*pa*th*(1+B.tr), np=F.n*slabs, fg=ppg*np;
    batG+=fg; batC+=fg*B.cpg;
    batRows+='<tr><td>'+B.n+'<span class="mut">'+np+' pan'+(np>1?'s':'')+' at '+g(ppg)+' g &middot; '
      +F.n+' layer'+(F.n>1?'s':'')+' of '+th.toFixed(2)+'″ &middot; '+kg(fg)+'</span></td><td>'+N(fg*B.cpg)+'</td></tr>';
    frows+='<div class="flv" data-i="'+i+'"><span class="tag">F'+(i+1)+'</span>'
      +'<select class="fr">'+Object.keys(BAT).map(function(k){
        return '<option value="'+k+'"'+(k===F.r?' selected':'')+'>'+BAT[k].n+'</option>';}).join('')+'</select>'
      +'<input type="number" class="fn" value="'+F.n+'" min="1" step="1">'
      +'<button class="del" type="button">&times;</button></div>';
  });
  var sig=oFlv.length+'|'+oFlv.map(function(F){return F.r;}).join(',');
  if(sig!==oSig){ document.getElementById('oFlv').innerHTML=frows; oSig=sig; }
  document.getElementById('oLh').textContent=
    'A slice is '+Ht+'″ tall with '+Ly+' layer'+(Ly>1?'s':'')+' inside, so every layer is cut to '+th.toFixed(2)+'″. '
    +'The height decides the batter and each flavour is weighed by its own calibration. '
    +Ly+' layers also means '+(Ly-1)+' gap'+(Ly-1===1?'':'s')+' of filling, so the buttercream moves whenever you change the layers.';
  var gapA=pa*Math.max(Ly-1,0)*slabs, topA=pa*slabs;
  var fk=document.getElementById('oFi').value, tk=document.getElementById('oTp').value;
  var filG=fk?covMass(gapA,C[fk].t.f,fk):0, filC=filG*(fk?C[fk].cpg:0);
  var topG=tk?covMass(topA,C[tk].t.n,tk):0, topC=topG*(tk?C[tk].cpg:0);

  document.getElementById('oPer').textContent=per;
  document.getElementById('oSlabs').textContent=slabs;
  document.getElementById('oPans').textContent=Ly*slabs;
  document.getElementById('oBat').textContent=kg(batG);
  document.getElementById('oWhy').textContent=
    'A '+pan[0]+' cuts '+per+' slices at '+num('oW')+'″ × '+num('oL')+'″. '
    +need+' needed with the allowance, so '+slabs+' slab'+(slabs>1?'s':'')+' of '+Ly+' layer'+(Ly>1?'s':'')
    +', which is '+(Ly*slabs)+' pans. The full scaled recipe for each pan prints on the production sheet.';
  var tot=batC+filC+topC;
  document.getElementById('oEx').innerHTML=
    batRows
    +(fk?'<tr><td>'+C[fk].n+' filling &middot; '+kg(filG)+'</td><td>'+N(filC)+'</td></tr>':'')
    +(tk?'<tr><td>'+C[tk].n+' on top &middot; '+kg(topG)+'</td><td>'+N(topC)+'</td></tr>':'')
    +'<tr class="em"><td>'+num('oN')+' servings &middot; '+N(tot/num('oN'))+' each</td><td>'+N(tot)+'</td></tr>';
  document.getElementById('oNote').textContent=num('oN')+' slices · '+pan[0];
  return tot;
}

/* ---------- pricing ---------- */
function drawZ(){
  var B=drawB();
  var pa=plan('round',10,0),H=6,gap=pa*2,surf=pa+peri('round',10,0)*H;
  var cake=B.d*pa*B.h*(1+B.tr)*3*B.cpg
    + covMass(gap,C.bc.t.f,'bc')*C.bc.cpg
    + covMass(surf,C.gn.t.c,'gn')*C.gn.cpg
    + covMass(surf,C.fd.t.n,'fd')*C.fd.cpg;
  var por=drawO(), pas=30*pEach('dn');
  var dec=3*450+45*18, pack=4500;
  var dir=cake+por+pas+dec+pack;
  document.getElementById('zCake').textContent=N(cake);
  document.getElementById('zPor').textContent=N(por);
  document.getElementById('zPas').textContent=N(pas);
  document.getElementById('zDec').textContent=N(dec);
  document.getElementById('zPack').textContent=N(pack);
  document.getElementById('zDir').textContent=N(dir);
  var acc=dir*num('zAcc')/100,ohm=seg('zOhm');
  var oh=ohm==='pct'?(dir+acc)*0.27:(ohm==='hr'?num('zHrs')*5997:44979);
  document.getElementById('zWhyOh').textContent=ohm==='pct'
    ?'27% of cost. What the app does today, and the default.'
    :(ohm==='hr'?num('zHrs')+' hours × ₦5,997 an hour, from your shop costs ÷ 1,800 production hours a year'
                :'₦899,583 a month ÷ 20 orders.');
  var tot=dir+acc+oh,mar=num('zMar')/100,price=tot/(1-mar);
  var up=price*(num('zRush')+num('zSea'))/100,charge=Math.ceil((price+up)/500)*500;
  document.getElementById('q1').textContent=N(dir);
  document.getElementById('q2').textContent=N(acc);
  document.getElementById('q3').textContent=N(oh);
  document.getElementById('q3m').textContent=ohm==='hr'?num('zHrs')+' hours':(ohm==='ord'?'per order':'27% of cost');
  document.getElementById('q4').textContent=N(tot);
  document.getElementById('q5').textContent=N(price-tot);
  document.getElementById('q6').textContent=up?N(up):'—';
  document.getElementById('q7').textContent=N(charge);
}

function all(){ drawB(); drawC(); drawP(); drawZ(); }
document.querySelectorAll('.tabs button').forEach(function(t){
  t.addEventListener('click',function(){
    document.querySelectorAll('.tabs button').forEach(function(x){x.setAttribute('aria-selected',x===t);});
    ['b','c','p','o','z'].forEach(function(k){
      document.getElementById('pane-'+k).classList.toggle('on',k===t.dataset.t);});
    window.scrollTo(0,0);
  });
});
document.querySelectorAll('.seg').forEach(function(sg){
  sg.addEventListener('click',function(e){
    var b=e.target.closest('button'); if(!b) return;
    sg.querySelectorAll('button').forEach(function(x){x.setAttribute('aria-pressed',x===b);});
    all();
  });
});
document.getElementById('cSw').addEventListener('click',function(e){
  var a=e.target.closest('a'); if(!a) return; e.preventDefault(); cur=a.dataset.k; drawC();
});
document.getElementById('pSw').addEventListener('click',function(e){
  var a=e.target.closest('a'); if(!a) return; e.preventDefault(); pcur=a.dataset.pk;
  document.querySelectorAll('#pMode button').forEach(function(x){x.setAttribute('aria-pressed',x.dataset.v===P[pcur].mode);});
  document.getElementById('pN').value=P[pcur].mode==='piece'?P[pcur].per:30;
  document.getElementById('pP').value=P[pcur].mode==='weight'?P[pcur].per:500;
  document.getElementById('pWas').value=P[pcur].was; all();
});
['tf','tc','tn','cDen','cWas'].forEach(function(id){
  document.getElementById(id).addEventListener('input',function(e){
    var R=C[cur],v=parseFloat(e.target.value)||0;
    if(id==='cDen') R.den=v; else if(id==='cWas') R.was=v;
    else R.t[{tf:'f',tc:'c',tn:'n'}[id]]=v;
    all();
  });
});
[['jf','f'],['jc','c'],['jn','n']].forEach(function(p){
  document.querySelector('#'+p[0]+' .jh').addEventListener('click',function(){
    C[cur].jobs[p[1]]=C[cur].jobs[p[1]]?0:1; drawC();
  });
});
var oflvEl=document.getElementById('oFlv');
oflvEl.addEventListener('change',function(e){
  var row=e.target.closest('.flv'); if(!row) return;
  if(e.target.classList.contains('fr')){ oFlv[+row.dataset.i].r=e.target.value; all(); }
});
oflvEl.addEventListener('input',function(e){
  var row=e.target.closest('.flv'); if(!row) return;
  if(e.target.classList.contains('fn')){ var v=parseInt(e.target.value,10); if(v>0){ oFlv[+row.dataset.i].n=v; all(); } }
});
oflvEl.addEventListener('click',function(e){
  if(!e.target.classList.contains('del')||oFlv.length<2) return;
  oFlv.splice(+e.target.closest('.flv').dataset.i,1); all();
});
document.getElementById('oAdd').addEventListener('click',function(){
  if(oFlv.length>3) return; oFlv.push({r:'rv',n:1}); all();
});
document.querySelectorAll('input,select').forEach(function(el){ el.addEventListener('input',all); el.addEventListener('change',all); });
all();
