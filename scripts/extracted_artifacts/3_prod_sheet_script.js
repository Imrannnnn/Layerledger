
var CM2=6.4516;
function g(n){return Math.round(n).toLocaleString('en-US');}
function kg(n){return n>=1000?(n/1000).toFixed(2)+' kg':g(n)+' g';}
function plan(s,a,b){return s==='round'?Math.PI*a*a/4:(s==='square'?a*a:a*b);}
function peri(s,a,b){return s==='round'?Math.PI*a:(s==='square'?4*a:2*(a+b));}
function perPan(W,L,w,l){return Math.max(Math.floor(L/l)*Math.floor(W/w),Math.floor(L/w)*Math.floor(W/l));}

/* ---------- base recipes, exactly as the Recipes tab holds them ---------- */
var REC={
 van:{n:'Vanilla sponge',cal:617,ra:Math.PI*9,rh:2,trim:0.08,
   ing:[['Unsalted butter',250],['Granulated sugar',250],['Eggs',250],['Plain flour',300],
        ['Whole milk',150],['Baking powder',10],['Salt',3],['Vanilla extract',8]]},
 cho:{n:'Chocolate',cal:627,ra:Math.PI*9,rh:2,trim:0.08,
   ing:[['Unsalted butter',250],['Granulated sugar',280],['Eggs',250],['Plain flour',250],
        ['Cocoa powder',70],['Whole milk',200],['Baking powder',12],['Salt',3],['Vanilla extract',8]]},
 rv:{n:'Red velvet',cal:741,ra:Math.PI*9,rh:2,trim:0.08,
   ing:[['Unsalted butter',230],['Granulated sugar',300],['Eggs',200],['Plain flour',300],
        ['Cocoa powder',25],['Buttermilk',240],['White vinegar',10],['Baking soda',8],
        ['Salt',3],['Red food colour',12],['Vanilla extract',8]]}
};
Object.keys(REC).forEach(function(k){var R=REC[k];
  R.d=R.cal/R.ra/R.rh; R.y=R.ing.reduce(function(s,x){return s+x[1];},0);});

var COV={
 bc:{n:'Buttercream',t:{f:4.5,c:1.0,n:4.9},den:0.90,was:0.15,
   ing:[['Unsalted butter',450],['Reconstituted cream',200],['Icing sugar',450],
        ['Milk powder',6],['Vanilla extract',5],['Salt',1.5]]},
 gn:{n:'Dark ganache',t:{f:3.0,c:1.2,n:4.0},den:1.10,was:0.10,
   ing:[['Dark compound chocolate',400],['Reconstituted cream',200],['Unsalted butter',30]]},
 fd:{n:'Fondant',t:{f:0,c:0,n:8.0},den:1.35,was:0.25,
   ing:[['Icing sugar',900],['Gelatine',10],['Water',60],['Glucose syrup',100],
        ['Glycerine',10],['CMC / Tylose',10],['Margarine',20],['Vanilla extract',3]]}
};
Object.keys(COV).forEach(function(k){var R=COV[k];
  R.y=R.ing.reduce(function(s,x){return s+x[1];},0);});
function covMass(area,mm,k){var R=COV[k];return area*CM2*(mm/10)*R.den*(1+R.was);}

var PAS={dn:{n:'Doughnuts',per:30,
  ing:[['Plain flour',1000],['Granulated sugar',150],['Instant yeast',20],['Whole milk',400],
       ['Eggs',100],['Unsalted butter',100],['Salt',10]]}};

var DEC=[['Edible gold leaf',3],['Sugar pearls',45]];

/* ---------- the confirmed order ---------- */
var ORDER={client:'Mrs Adeyemi',date:'Saturday 14 November',items:[
 {t:'cake',label:'Cake',sum:'3 tiers, 10&Prime; / 8&Prime; / 6&Prime; round',shape:'round',
  fill:'bc',crumb:'gn',fin:'fd',
  tiers:[{a:10,b:0,h:6,flav:[['van',1],['cho',1],['rv',1]]},
         {a:8, b:0,h:4,flav:[['van',2]]},
         {a:6, b:0,h:4,flav:[['cho',2]]}]},
 {t:'slab',label:'Portions',sum:'100 slices, 2&Prime; &times; 2&Prime; &times; 4&Prime;',
  n:100,w:2,l:2,ht:4,allow:5,pan:['12 &times; 18 tray',12,18],
  flav:[['van',2],['cho',1]],fill:'bc',top:'bc'},
 {t:'count',label:'Doughnuts',sum:'30 pieces',r:'dn',n:30}
]};

/* ---------- work it out ---------- */
var tins=[],groups=[],batNeed={},covNeed={},pasNeed={},ing={};
function addIng(list,mult){list.forEach(function(x){ing[x[0]]=(ing[x[0]]||0)+x[1]*mult;});}
function pushTin(rk,n,grams,where,note){
  for(var i=0;i<n;i++){tins.push({r:rk,g:grams,w:where,note:note});}
  batNeed[rk]=(batNeed[rk]||0)+grams*n;
  groups.push({r:rk,n:n,g:grams,w:where,note:note});
}
function needCov(k,area,mm,job){
  if(!k||!mm)return; var m=covMass(area,mm,k);
  covNeed[k]=covNeed[k]||{g:0,jobs:[]};
  covNeed[k].g+=m; if(covNeed[k].jobs.indexOf(job)<0) covNeed[k].jobs.push(job);
}

ORDER.items.forEach(function(it){
  if(it.t==='cake'){
    var gapA=0,surfA=0;
    it.tiers.forEach(function(T){
      var pa=plan(it.shape,T.a,T.b),pe=peri(it.shape,T.a,T.b);
      var nL=T.flav.reduce(function(s,f){return s+f[1];},0),th=T.h/nL;
      T.nL=nL; T.th=th;
      T.flav.forEach(function(f){
        var R=REC[f[0]];
        pushTin(f[0],f[1],R.d*pa*th*(1+R.trim),T.a+'″ round',th.toFixed(2)+'″ layer');
      });
      gapA+=pa*(nL-1); surfA+=pa+pe*T.h;
    });
    needCov(it.fill,gapA,COV[it.fill].t.f,'Between the layers');
    needCov(it.crumb,surfA,COV[it.crumb].t.c,'Crumb coat');
    needCov(it.fin,surfA,COV[it.fin].t.n,'Outside finish');
  }
  if(it.t==='slab'){
    var need=Math.ceil(it.n*(1+it.allow/100));
    var per=perPan(it.pan[1],it.pan[2],it.w,it.l);
    var slabs=Math.max(1,Math.ceil(need/per)),pa=it.pan[1]*it.pan[2];
    var nL=it.flav.reduce(function(s,f){return s+f[1];},0),th=it.ht/nL;
    it.th=th; it.nL=nL; it.slabs=slabs; it.per=per; it.needQty=need;
    it.flav.forEach(function(f){
      var R=REC[f[0]];
      pushTin(f[0],f[1]*slabs,R.d*pa*th*(1+R.trim),it.pan[0],th.toFixed(2)+'″ layer');
    });
    needCov(it.fill,pa*(nL-1)*slabs,COV[it.fill].t.f,'Between the layers');
    needCov(it.top,pa*slabs,COV[it.top].t.n,'On top');
  }
  if(it.t==='count'){ pasNeed[it.r]=(pasNeed[it.r]||0)+it.n; }
});

Object.keys(batNeed).forEach(function(k){addIng(REC[k].ing,batNeed[k]/REC[k].y);});
Object.keys(covNeed).forEach(function(k){addIng(COV[k].ing,covNeed[k].g/COV[k].y);});
Object.keys(pasNeed).forEach(function(k){addIng(PAS[k].ing,pasNeed[k]/PAS[k].per);});
DEC.forEach(function(x){ing[x[0]]=(ing[x[0]]||0)+x[1];});

/* stock: generous by default, two deliberate shortfalls */
var STOCK={};
Object.keys(ing).forEach(function(k){STOCK[k]=Math.ceil(ing[k]*1.6/50)*50;});
STOCK['Unsalted butter']=8000; STOCK['Red food colour']=15;

/* ---------- shared bits ---------- */
var LIQ=['Whole milk','Buttermilk','Water','Reconstituted cream','White vinegar','Glucose syrup','Glycerine'];
function sub(name,grams,n){
  var all=n>1?' in all':'';
  if(name==='Eggs') return Math.round(grams/50)+' eggs at 50 g'+all;
  if(LIQ.indexOf(name)>=0 && grams>=400) return (grams/1000).toFixed(2)+' litres'+all;
  return '';
}
function perPanTable(list,scale,n,totG){
  var h='<table class="t"><thead><tr><th>Ingredient</th><th>Into each pan</th><th>'
    +(n>1?'× '+n+' pans':'1 pan')+'</th></tr></thead><tbody>';
  list.forEach(function(x){
    var per=x[1]*scale,tot=per*n,s=sub(x[0],tot,n);
    h+='<tr><td>'+x[0]+(s?'<span class="mut">'+s+'</span>':'')+'</td><td>'+g(per)+' g</td><td>'+kg(tot)+'</td></tr>';
  });
  return h+'</tbody><tfoot><tr><td>Batter</td><td>'+g(totG)+' g</td><td>'+kg(totG*n)+'</td></tr></tfoot></table>';
}
function flatTable(list,scale,totLabel,totG){
  var h='<table class="t"><thead><tr><th>Ingredient</th><th>Weight</th></tr></thead><tbody>';
  list.forEach(function(x){var w=x[1]*scale,s=sub(x[0],w,1);
    h+='<tr><td>'+x[0]+(s?'<span class="mut">'+s+'</span>':'')+'</td><td>'+kg(w)+'</td></tr>';});
  return h+'</tbody><tfoot><tr><td>'+totLabel+'</td><td>'+kg(totG)+'</td></tr></tfoot></table>';
}

/* ---------- shopping list ---------- */
document.getElementById('sub').innerHTML=ORDER.client+' &middot; for '+ORDER.date+' &middot; '
  +ORDER.items.map(function(i){return i.label.toLowerCase();}).join(', ');
document.querySelectorAll('.oc').forEach(function(e){e.textContent=ORDER.client;});

function usesOf(k){
  var u=[];
  Object.keys(batNeed).forEach(function(r){if(REC[r].ing.some(function(x){return x[0]===k;}))u.push(REC[r].n);});
  Object.keys(covNeed).forEach(function(r){if(COV[r].ing.some(function(x){return x[0]===k;}))u.push(COV[r].n);});
  Object.keys(pasNeed).forEach(function(r){if(PAS[r].ing.some(function(x){return x[0]===k;}))u.push(PAS[r].n);});
  return u;
}
var names=Object.keys(ing).sort(),shorts=[];
document.getElementById('sIng').innerHTML=names.map(function(k){
  var need=ing[k],have=STOCK[k]||0,sh=Math.max(0,need-have);
  if(sh>0)shorts.push(k+' '+kg(sh));
  var u=usesOf(k);
  var extra=k==='Eggs'?Math.ceil(need/50)+' eggs at 50 g':(u.length>1?u.length+' recipes: '+u.join(', '):u[0]||'decoration');
  return '<tr'+(sh>0?' class="short"':'')+'><td>'+k+'<span class="mut">'+extra+'</span></td>'
    +'<td>'+kg(need)+'</td><td>'+kg(have)+'</td><td>'+(sh>0?kg(sh):'—')+'</td></tr>';
}).join('');
document.getElementById('sN').textContent=names.length+' ingredients';
document.getElementById('sWhy').textContent=
  'Butter alone is '+kg(ing['Unsalted butter'])+' across '+usesOf('Unsalted butter').length
  +' recipes on this one order. Icing sugar runs through two, cocoa through two.';
document.getElementById('alerts').innerHTML=shorts.length
  ? '<div class="alert"><b>Not enough in store for '+shorts.length+' ingredient'+(shorts.length>1?'s':'')+'</b>'
    +shorts.join(' &middot; ')+'. Buy before the bake day, or the sheet will not balance against inventory.</div>'
  : '';

var bb='';
Object.keys(batNeed).forEach(function(k){
  bb+='<tr><td>'+REC[k].n+'<span class="mut">cake layer</span></td><td>'+kg(batNeed[k])+'</td><td>'
    +kg(REC[k].y)+'</td><td>'+(batNeed[k]/REC[k].y).toFixed(2)+'</td></tr>';});
Object.keys(covNeed).forEach(function(k){
  bb+='<tr><td>'+COV[k].n+'<span class="mut">'+covNeed[k].jobs.join(', ').toLowerCase()+'</span></td><td>'
    +kg(covNeed[k].g)+'</td><td>'+kg(COV[k].y)+'</td><td>'+(covNeed[k].g/COV[k].y).toFixed(2)+'</td></tr>';});
Object.keys(pasNeed).forEach(function(k){
  bb+='<tr><td>'+PAS[k].n+'<span class="mut">counted</span></td><td>'+pasNeed[k]+' pcs</td><td>'
    +PAS[k].per+' pcs</td><td>'+(pasNeed[k]/PAS[k].per).toFixed(2)+'</td></tr>';});
document.getElementById('bbs').innerHTML=bb;
document.getElementById('bbN').textContent=
  (Object.keys(batNeed).length+Object.keys(covNeed).length+Object.keys(pasNeed).length)+' recipes';

/* ---------- bake sheet ---------- */
document.getElementById('tins').innerHTML=tins.map(function(t,i){
  return '<div class="tin"><span class="no">'+(i+1)+'</span>'
    +'<span><b>'+REC[t.r].n+'</b><em>'+t.w+' &middot; '+t.note+'</em></span>'
    +'<span class="wt">'+g(t.g)+' g</span></div>';}).join('');
document.getElementById('tN').textContent=tins.length+' pans';
var tg=tins.reduce(function(s,t){return s+t.g;},0);
document.getElementById('tWhy').textContent=
  kg(tg)+' of batter in all, trim included. Three pan sizes on this order, and the same pan still takes a different weight '
  +'for each flavour, because vanilla, chocolate and red velvet pour to their own calibration.';

document.getElementById('groups').innerHTML=groups.map(function(G){
  var R=REC[G.r],sc=G.g/R.y;
  return '<div class="card"><div class="chead"><span class="ctitle">'+R.n+'</span>'
    +'<span class="cnote">'+G.w+' &middot; '+G.note+'<br>'+G.n+' pan'+(G.n>1?'s':'')+' at '+g(G.g)+' g</span></div>'
    +'<div class="cbody">'+perPanTable(R.ing,sc,G.n,G.g)
    +'<p class="why">Base recipe scaled '+sc.toFixed(2)+'&times;. Trim of '+(R.trim*100)+'% is already inside the pan weight.</p>'
    +'</div></div>';
}).join('');

var oth='';
Object.keys(covNeed).forEach(function(k){
  var R=COV[k],sc=covNeed[k].g/R.y;
  oth+='<div class="card"><div class="chead"><span class="ctitle">'+R.n+'</span>'
    +'<span class="cnote">'+covNeed[k].jobs.join(', ').toLowerCase()+'<br>make '+kg(covNeed[k].g)+'</span></div>'
    +'<div class="cbody">'+flatTable(R.ing,sc,R.n,covNeed[k].g)
    +'<p class="why">Base recipe scaled '+sc.toFixed(2)+'&times;. Waste of '+(R.was*100)+'% is already inside this weight.</p>'
    +'</div></div>';
});
Object.keys(pasNeed).forEach(function(k){
  var R=PAS[k],sc=pasNeed[k]/R.per;
  oth+='<div class="card"><div class="chead"><span class="ctitle">'+R.n+'</span>'
    +'<span class="cnote">'+pasNeed[k]+' pieces<br>'+sc.toFixed(2)+' batches</span></div>'
    +'<div class="cbody">'+flatTable(R.ing,sc,'Dough',R.ing.reduce(function(s,x){return s+x[1]*sc;},0))+'</div></div>';
});
oth+='<div class="card"><div class="chead"><span class="ctitle">Decoration materials</span>'
  +'<span class="cnote">weighed per gram</span></div><div class="cbody">'
  +'<table class="t"><tbody>'+DEC.map(function(x){
    return '<tr><td>'+x[0]+'</td><td>'+g(x[1])+' g</td></tr>';}).join('')
  +'</tbody></table></div></div>';
document.getElementById('others').innerHTML=oth;

/* ---------- build order ---------- */
var cake=ORDER.items[0],slab=ORDER.items[1];
var steps=[
 ['Two days before','Make the fondant',
  (covNeed.fd.g/COV.fd.y).toFixed(2)+' batches, '+kg(covNeed.fd.g)+'. It needs to rest overnight before it will roll.'],
 ['Day before','Bake every pan off the weigh-out list',
  tins.length+' pans, '+kg(tg)+' of batter, three pan sizes. Weigh each one, do not fill by eye. Cool, wrap, chill.'],
 ['Day before','Make the ganache',
  kg(covNeed.gn.g)+' for the crumb coat. Leave it to firm up at room temperature.'],
 ['Bake day','Make the buttercream',
  kg(covNeed.bc.g)+' across '+covNeed.bc.jobs.join(' and ').toLowerCase()+'. Make it fresh.'],
 ['Bake day','Fill and stack the three tiers',
  cake.tiers.map(function(T){return T.a+'″ at '+T.nL+' × '+T.th.toFixed(2)+'″';}).join(', ')
  +'. Buttercream between the layers, ganache crumb coat, chill until firm.'],
 ['Bake day','Cover and stack',
  kg(covNeed.fd.g)+' of fondant rolled to 8 mm, tier by tier. Dowel the lower two, then the gold leaf and pearls.'],
 ['Bake day','Build the slabs',
  slab.slabs+' slabs, each '+slab.nL+' layers at '+slab.th.toFixed(2)+'″. Fill, top, chill hard, then cut '
  +slab.needQty+' slices at '+slab.w+'″ × '+slab.l+'″.'],
 ['Delivery day','Fry the doughnuts',
  pasNeed.dn+' pieces. Same day only, they do not keep.'],
 ['Delivery day','Pack and check off',
  'Box the tiers, tray the slices, bag the doughnuts. Marking the order delivered is what posts these ingredients out of inventory.']
];
document.getElementById('steps').innerHTML=steps.map(function(s){
  return '<li><i>'+s[0]+'</i><b>'+s[1]+'</b><span>'+s[2]+'</span></li>';}).join('');
document.getElementById('mN').textContent=steps.length+' steps';

document.querySelectorAll('.tabs button').forEach(function(t){
  t.addEventListener('click',function(){
    document.querySelectorAll('.tabs button').forEach(function(x){x.setAttribute('aria-selected',x===t);});
    ['s','b','m'].forEach(function(k){
      document.getElementById('pane-'+k).classList.toggle('on',k===t.dataset.t);});
    window.scrollTo(0,0);
  });
});
