
/* ---- batter recipes: density g per sq in per inch, from calibration ---- */
var B = {
  van:{n:'Vanilla sponge', cal:617, ra:Math.PI*9, rh:2, trim:0.08, cpg:5.527},
  cho:{n:'Chocolate',      cal:627, ra:Math.PI*9, rh:2, trim:0.08, cpg:5.669},
  rv: {n:'Red velvet',     cal:741, ra:Math.PI*9, rh:2, trim:0.08, cpg:5.150}
};
Object.keys(B).forEach(function(k){ B[k].d = B[k].cal / B[k].ra / B[k].rh; });

/* ---- coverings: jobs, density g/cm3, waste, thickness mm ---- */
var C = {
  bc:{n:'Buttercream',   fill:4.5, crumb:1.0, fin:4.9, den:0.90,  waste:0.15, cpg:8.947},
  gn:{n:'Dark ganache',  fill:3.0, crumb:1.2, fin:4.0, den:1.10,  waste:0.10, cpg:12.381},
  fd:{n:'Fondant',       fill:0,   crumb:0,   fin:8.0, den:1.35,  waste:0.25, cpg:2.498},
  wc:{n:'Whipped cream', fill:4.0, crumb:0,   fin:4.9, den:0.452, waste:0.15, cpg:8.667},
  cm:{n:'Caramel sauce', fill:1.5, crumb:0,   fin:0,   den:1.30,  waste:0.05, cpg:4.586}
};
var D = {
  pearl:{n:'Edible pearls', cpg:18}, leaf:{n:'Gold leaf', cpg:450},
  dust:{n:'Lustre dust', cpg:120}, glit:{n:'Edible glitter', cpg:60}, spr:{n:'Sprinkles', cpg:9}
};

var SC = [
  {fills:[{r:'bc'}], crumb:'bc', fin:'bc', dec:[{r:'spr',g:40}]},
  {fills:[{r:'bc'}], crumb:'gn', fin:'fd', dec:[{r:'pearl',g:60},{r:'dust',g:8}]},
  {fills:[{r:'bc'},{r:'cm'}], crumb:'gn', fin:'fd', dec:[{r:'leaf',g:3},{r:'pearl',g:45}]}
];
var st = {shape:'round', layers:[{r:'van',n:1},{r:'cho',n:1},{r:'rv',n:1}], lh:7/3, fills:[{r:'bc'}], crumb:'bc', fin:'bc',
          dec:[{r:'spr',g:40}], oh:'pct'};

var CM2 = 6.4516;
function plan(s,a,b){ return s==='round' ? Math.PI*a*a/4 : (s==='square' ? a*a : a*b); }
function peri(s,a,b){ return s==='round' ? Math.PI*a : (s==='square' ? 4*a : 2*(a+b)); }
function g(n){ return Math.round(n).toLocaleString('en-US'); }
function kg(n){ return n>=1000 ? (n/1000).toFixed(2)+' kg' : g(n)+' g'; }
function naira(n){ return '₦'+Math.round(n).toLocaleString('en-US'); }
function num(id){ return parseFloat(document.getElementById(id).value)||0; }
function setIf(id,v){ var el=document.getElementById(id); if(el && document.activeElement!==el) el.value=v; }
function seg(id){ return document.querySelector('#'+id+' button[aria-pressed="true"]').dataset.v; }
function opts(obj,sel,test){ return Object.keys(obj).filter(function(k){ return !test||test(obj[k]); })
  .map(function(k){ return '<option value="'+k+'"'+(k===sel?' selected':'')+'>'+obj[k].n+'</option>'; }).join(''); }
function mass(areaIn2, mm, den, waste){ return areaIn2*CM2*(mm/10)*den*(1+waste); }

function draw(){
  var s = st.shape, a = num('sa'), b = num('sb');
  document.getElementById('laA').textContent = s==='round' ? 'Diameter' : (s==='square' ? 'Side' : 'Length');
  document.getElementById('wrapB').style.display = s==='rect' ? '' : 'none';
  var pa = plan(s,a,b), pe = peri(s,a,b);

  /* layers */
  var lh='', nL=0, batG=0, batC=0;
  st.layers.forEach(function(L){ nL += L.n; });
  var H = nL*st.lh, nat = B[st.layers[0].r];
  st.layers.forEach(function(L,i){
    var r=B[L.r];
    var gpl = r.d*pa*st.lh*(1+r.trim);
    batG += gpl*L.n; batC += gpl*L.n*r.cpg;
    lh += '<div class="lyr" data-i="'+i+'"><span class="tag">F'+(i+1)+'</span>'
      + '<select class="lr">'+opts(B,L.r)+'</select>'
      + '<input type="number" class="ln" value="'+L.n+'" min="1" step="1">'
      + '<button class="del" type="button">&times;</button></div>';
  });
  document.getElementById('layers').innerHTML = lh;
  var gap = pa*Math.max(nL-1,0), surf = pa + pe*H;
  document.getElementById('geo').innerHTML = g(surf)+' in&sup2; outside &middot; '+(+H.toFixed(1))+'&Prime; tall';
  setIf('cakeH', +(nL*st.lh).toFixed(2));
  setIf('eachH', +st.lh.toFixed(2));


  /* fillings */
  var fh='', filG=0, filC=0;
  st.fills.forEach(function(F,i){
    var r=C[F.r], m=mass(gap,r.fill,r.den,r.waste); filG+=m; filC+=m*r.cpg;
    fh += '<div class="mat" data-i="'+i+'"><select class="fr">'+opts(C,F.r,function(x){return x.fill>0;})+'</select>'
      + '<div class="out">'+g(m)+' g<small>'+naira(m*r.cpg)+'</small></div>'
      + '<button class="del" type="button">&times;</button></div>'
      + '<p class="why">'+r.fill+' mm over '+g(gap)+' in² of gap · density '+r.den+'</p>';
  });
  document.getElementById('fills').innerHTML = fh || '<p class="why">None</p>';

  /* crumb */
  var cr = st.crumb?C[st.crumb]:null, crG = cr?mass(surf,cr.crumb,cr.den,cr.waste):0;
  document.getElementById('crumbs').innerHTML =
    '<div class="mat"><select id="crsel"><option value=""'+(st.crumb?'':' selected')+'>None</option>'
    + opts(C,st.crumb,function(x){return x.crumb>0;})+'</select>'
    + '<div class="out">'+(cr?g(crG)+' g':'—')+'<small>'+(cr?naira(crG*cr.cpg):'')+'</small></div><span></span></div>'
    + (cr?'<p class="why">'+cr.crumb+' mm over '+g(surf)+' in² of surface</p>':'');

  /* finish */
  var fi = st.fin?C[st.fin]:null, fiG = fi?mass(surf,fi.fin,fi.den,fi.waste):0;
  document.getElementById('finishes').innerHTML =
    '<div class="mat"><select id="fisel"><option value=""'+(st.fin?'':' selected')+'>None</option>'
    + opts(C,st.fin,function(x){return x.fin>0;})+'</select>'
    + '<div class="out">'+(fi?g(fiG)+' g':'—')+'<small>'+(fi?naira(fiG*fi.cpg):'')+'</small></div><span></span></div>'
    + (fi?'<p class="why">'+fi.fin+' mm over '+g(surf)+' in² · density '+fi.den+' · '+Math.round(fi.waste*100)+'% waste</p>':'');

  var ff = document.getElementById('flagCrumb');
  if (fi && (st.fin==='fd'||st.fin==='wc') && !st.crumb) {
    ff.classList.add('on');
    document.getElementById('flagCrumbT').textContent =
      fi.n+' needs something underneath to seal the crumbs. This cake will not hold.';
  } else ff.classList.remove('on');

  /* decoration */
  var dh='', decC=0;
  st.dec.forEach(function(X,i){
    var r=D[X.r]; decC += X.g*r.cpg;
    dh += '<div class="mat" data-i="'+i+'"><select class="dr">'+opts(D,X.r)+'</select>'
      + '<div class="out" style="display:flex;gap:6px;align-items:center"><input type="number" class="dg" value="'+X.g+'" min="0" step="1" style="width:62px;text-align:right">'
      + '<span style="font-weight:400;font-size:12px">g &middot; '+naira(X.g*r.cpg)+'</span></div>'
      + '<button class="del" type="button">&times;</button></div>';
  });
  document.getElementById('decs').innerHTML = dh || '<p class="why">None</p>';

  var crC = cr?crG*cr.cpg:0, fiC = fi?fiG*fi.cpg:0;
  document.getElementById('cakeCost').textContent = naira(batC+filC+crC+fiC);

  /* quote */
  var extras = num('pack')+num('topp');
  var direct = batC+filC+crC+fiC+decC+extras;
  var acc = direct*0.15;
  var oh = st.oh==='pct' ? (direct+acc)*0.27 : (st.oh==='hr' ? num('hrs')*5997 : 44979);
  document.getElementById('whyOh').textContent = st.oh==='pct'
    ? '27% of cost. What the app does today. Overcharges ingredient-heavy jobs, undercharges time-heavy ones.'
    : (st.oh==='hr' ? num('hrs')+' hours × ₦5,997, from your shop costs ÷ 1,800 production hours a year'
                    : '₦899,583 a month ÷ 20 orders. Only sensible if every order is a similar size.');
  var total = direct+acc+oh, price = total/0.5;
  var charge = Math.ceil(price*(1+num('rush')/100+num('seas')/100)/500)*500;

  function put(i,v,m){ document.getElementById('t'+i).textContent=v; if(m!==undefined) document.getElementById('m'+i).textContent=m; }
  put(1,naira(batC), kg(batG));
  put(2, filC?naira(filC):'—', st.fills.map(function(F){return C[F.r].n;}).join(' + ') || 'none');
  put(3, cr?naira(crC):'—', cr?cr.n+' · '+g(crG)+' g':'none');
  put(4, fi?naira(fiC):'—', fi?fi.n+' · '+kg(fiG):'none');
  put(5, decC?naira(decC):'—', st.dec.map(function(X){return D[X.r].n;}).join(' + ') || 'none');
  put(6,naira(extras));
  put(7,naira(direct)); put(8,naira(acc));
  put(9,naira(oh), st.oh==='hr'?num('hrs')+' hours':(st.oh==='ord'?'per order':'27% of cost'));
  put(10,naira(total)); put(11,naira(price-total)); put(12,naira(charge));
  wire();
}

function wire(){
  document.querySelectorAll('#layers .lyr').forEach(function(el){
    var i=+el.dataset.i;
    el.querySelector('.lr').onchange=function(e){ st.layers[i].r=e.target.value; draw(); };
    el.querySelector('.ln').oninput=function(e){ st.layers[i].n=Math.max(1,parseInt(e.target.value)||1); draw(); };
    el.querySelector('.del').onclick=function(){ if(st.layers.length>1){st.layers.splice(i,1); draw();} };
  });
  document.querySelectorAll('#fills .mat').forEach(function(el){
    var i=+el.dataset.i;
    el.querySelector('.fr').onchange=function(e){ st.fills[i].r=e.target.value; draw(); };
    el.querySelector('.del').onclick=function(){ st.fills.splice(i,1); draw(); };
  });
  document.querySelectorAll('#decs .mat').forEach(function(el){
    var i=+el.dataset.i;
    el.querySelector('.dr').onchange=function(e){ st.dec[i].r=e.target.value; draw(); };
    el.querySelector('.dg').oninput=function(e){ st.dec[i].g=parseFloat(e.target.value)||0; draw(); };
    el.querySelector('.del').onclick=function(){ st.dec.splice(i,1); draw(); };
  });
  var cs=document.getElementById('crsel'); if(cs) cs.onchange=function(e){ st.crumb=e.target.value; draw(); };
  var fs=document.getElementById('fisel'); if(fs) fs.onchange=function(e){ st.fin=e.target.value; draw(); };
}

document.getElementById('addLayer').onclick=function(){ st.layers.push({r:'van',n:1}); draw(); };
document.getElementById('cakeH').addEventListener('input',function(e){
  var n=st.layers.reduce(function(s,L){return s+L.n;},0);
  var v=parseFloat(e.target.value); if(v>0&&n>0){ st.lh=v/n; draw(); }
});
document.getElementById('eachH').addEventListener('input',function(e){
  var v=parseFloat(e.target.value); if(v>0){ st.lh=v; draw(); }
});
document.getElementById('addFill').onclick=function(){ st.fills.push({r:'bc'}); draw(); };
document.getElementById('addDec').onclick=function(){ st.dec.push({r:'dust',g:5}); draw(); };
document.querySelectorAll('.seg').forEach(function(sg){
  sg.addEventListener('click',function(e){
    var b=e.target.closest('button'); if(!b) return;
    sg.querySelectorAll('button').forEach(function(x){ x.setAttribute('aria-pressed',x===b); });
    if(sg.id==='shape') st.shape=b.dataset.v;
    if(sg.id==='ohm') st.oh=b.dataset.v;
    draw();
  });
});
document.getElementById('sw').addEventListener('click',function(e){
  var b=e.target.closest('button'); if(!b) return;
  document.querySelectorAll('#sw button').forEach(function(x){ x.setAttribute('aria-pressed',x===b); });
  var p=SC[+b.dataset.s];
  st.fills=p.fills.map(function(x){return{r:x.r};}); st.crumb=p.crumb; st.fin=p.fin;
  st.dec=p.dec.map(function(x){return{r:x.r,g:x.g};});
  draw();
});
document.querySelectorAll('input').forEach(function(el){ el.addEventListener('input',draw); });
draw();
