
var B = {
  van:{n:'Vanilla sponge',cal:640,cd:6,cs:'round',chh:2,batch:1221,cpg:5.52707,ing:[['Unsalted butter',250],['Granulated sugar',250],['Eggs',250],['Plain flour',300],['Whole milk',150],['Baking powder',10],['Salt',3],['Vanilla extract',8]]},
  choc:{n:'Chocolate',cal:630,cd:6,cs:'round',chh:2,batch:1293,cpg:5.66862,ing:[['Unsalted butter',250],['Granulated sugar',280],['Eggs',250],['Plain flour',250],['Cocoa powder',60],['Whole milk',180],['Baking powder',8],['Baking soda',4],['Salt',3],['Vanilla extract',8]]},
  rv:{n:'Red velvet',cal:740,cd:6,cs:'round',chh:2,batch:1262,cpg:5.14981,ing:[['Unsalted butter',200],['Granulated sugar',280],['Eggs',200],['Plain flour',300],['Cocoa powder',15],['Whole milk',220],['Baking soda',6],['Salt',3],['Vinegar',10],['Vanilla extract',8],['Red food colour',20]]}
};
var C = {
  bc:{n:'Buttercream',app:'spread',fill:3.00,crumb:1.64,cover:3.263,cpg:6.7305,batch:1387,over:0,ing:[['Unsalted butter',450],['Icing sugar',900],['Whole milk',30],['Vanilla extract',5],['Salt',2]]},
  fd:{n:'Fondant',app:'rolled',fill:null,crumb:0,cover:4.435,cpg:2.4983,batch:1113,over:2.4,ing:[['Icing sugar',900],['Gelatine',10],['Water',60],['Glucose syrup',100],['Glycerine',10],['CMC / Tylose',10],['White margarine',20],['Vanilla extract',3]]},
  wc:{n:'Whipped cream',app:'spread',fill:1.68,crumb:0,cover:1.344,cpg:8.6667,batch:1500,over:0,ing:[['Powdered whipping cream',1000],['Water',500]]}
};
var STOCK = {'Unsalted butter':1200,'Granulated sugar':8000,'Eggs':3000,'Plain flour':10000,'Whole milk':2000,'Baking powder':500,'Baking soda':400,'Salt':1000,'Vanilla extract':400,'Icing sugar':5000,'Gelatine':300,'Glucose syrup':1500,'Glycerine':400,'CMC / Tylose':250,'White margarine':900,'Cocoa powder':2000,'Vinegar':500,'Red food colour':300,'Powdered whipping cream':2500};

function area(d,s){ return s === 'square' ? d*d : Math.PI*d*d/4; }
function g(n){ return Math.round(n).toLocaleString('en-US'); }
function kg(n){ return n >= 1000 ? (n/1000).toFixed(2) + ' kg' : g(n) + ' g'; }
function naira(n){ return '₦' + Math.round(n).toLocaleString('en-US'); }
function seg(id){ return document.querySelector('#'+id+' button[aria-pressed="true"]').dataset.v; }
function num(id){ return parseFloat(document.getElementById(id).value) || 0; }
function set(id,v){ document.getElementById(id).textContent = v; }

function draw(){
  /* ---- Base recipe ---- */
  var cv = area(num('cd'), seg('cshape')) * num('ch');
  var den = cv > 0 ? num('cg') / cv : 0;
  set('dens', den.toFixed(2) + ' g per cubic inch');
  set('d1', den.toFixed(2));
  var eg = den * area(10,'round') * 3 * 2;
  set('e1', g(eg) + ' g');
  set('e2', g(eg/3) + ' g × 3');
  set('e4', naira(eg * 5.52707));

  /* ---- Order ---- */
  var b = B[document.getElementById('fl').value];
  var bden = b.cal / (area(b.cd, b.cs) * b.chh);
  var d = num('od'), s = seg('oshape'), L = num('ol'), h = num('oh');
  var H = L * h, A = area(d, s), bg = bden * A * H;
  var gap = A * (L - 1);
  var surface = A + (s === 'square' ? 4*d*H : Math.PI*d*H);

  var fk = document.getElementById('fi').value, fr = fk ? C[fk] : null;
  var fg = fr ? (fr.fill || 0) * gap + fr.crumb * surface : 0;
  var ck = document.getElementById('co').value, cr = ck ? C[ck] : null;
  var cg2 = 0;
  if (cr) {
    var sheet = (s === 'square') ? Math.pow(d + 2*H + cr.over, 2) : (Math.PI/4) * Math.pow(d + 2*H + cr.over, 2);
    cg2 = cr.cover * (cr.app === 'rolled' ? sheet : surface);
  }

  var ff = document.getElementById('flag');
  if (d > 16) {
    ff.classList.add('on');
    set('flagt', 'A ' + d + ' inch pan will not fit most domestic ovens, and a cake this wide bakes raw in the middle without a heating core. Offer tiers or a sheet cake instead. The price below is still correct.');
  } else { ff.classList.remove('on'); }

  var bc2 = bg * b.cpg, fc = fg * (fr ? fr.cpg : 0), cc = cg2 * (cr ? cr.cpg : 0);
  set('t1', naira(bc2));              set('t1m', b.n);
  set('t2', fr ? naira(fc) : '—'); set('t2m', fr ? fr.n : 'none');
  set('t3', cr ? naira(cc) : '—'); set('t3m', cr ? cr.n : 'none');
  set('t4', naira(bc2 + fc + cc));

  /* ---- Production sheet ---- */
  set('pk', d + '″ ' + s + ' · ' + L + ' layers at ' + (+h.toFixed(2)) + '″ · ' + b.n);
  document.getElementById('pk2').innerHTML =
    (fr ? 'Filled with ' + fr.n.toLowerCase() : 'No filling') + ' · ' +
    (cr ? 'covered in ' + cr.n.toLowerCase() : 'no covering') + ' · needed Fri 14 Nov';

  var jobs = [{r:b, grams:bg, role:'Batter', pans:L}];
  if (fr) jobs.push({r:fr, grams:fg, role:'Filling and crumb coat', pans:0});
  if (cr) jobs.push({r:cr, grams:cg2, role:'Covering', pans:0});

  var pull = {};
  var html = '';
  jobs.forEach(function(j){
    var f = j.grams / j.r.batch;
    html += '<div class="rsec"><h5>' + j.r.n + '</h5><p class="sub">' + j.role + ' · ' + kg(j.grams) +
      ' · ' + f.toFixed(2) + ' × your base recipe' +
      (j.pans ? ' · ' + j.pans + ' pans at ' + g(j.grams/j.pans) + ' g each' : '') +
      '</p><table class="prod"><thead><tr><th>Ingredient</th><th>Weigh out</th></tr></thead><tbody>';
    j.r.ing.forEach(function(it){
      var need = it[1] * f;
      pull[it[0]] = (pull[it[0]] || 0) + need;
      var hint = it[0] === 'Eggs' ? '<span class="hint"> · about ' + Math.ceil(need/50) + ' eggs</span>' : '';
      html += '<tr><td>' + it[0] + '</td><td>' + g(need) + ' g' + hint + '</td></tr>';
    });
    html += '</tbody></table></div>';
  });
  document.getElementById('recipes').innerHTML = html;

  var tb = '', shorts = [];
  Object.keys(pull).forEach(function(k){
    if (k === 'Water') return;
    var need = pull[k], have = STOCK[k];
    var lack = have !== undefined && have < need;
    if (lack) shorts.push(k + ', short by ' + g(need - have) + ' g');
    tb += '<tr><td>' + k + '</td><td' + (lack ? ' class="short"' : '') + '>' + g(need) + ' g</td><td>' +
      (have === undefined ? '—' : g(have) + ' g') + '</td></tr>';
  });
  document.querySelector('#pull tbody').innerHTML = tb;
  var sn = document.getElementById('short');
  if (shorts.length) { sn.style.display = 'block'; sn.innerHTML = '<b>Not enough in store.</b> ' + shorts.join('. ') + '. Buy before Thursday.'; }
  else { sn.style.display = 'none'; }
}

function showTab(t){
  document.querySelectorAll('.tabs button').forEach(function(x){ x.setAttribute('aria-selected', x.dataset.t === t); });
  document.getElementById('pane-r').classList.toggle('on', t === 'r');
  document.getElementById('pane-o').classList.toggle('on', t === 'o');
  document.getElementById('pane-p').classList.toggle('on', t === 'p');
  window.scrollTo(0,0);
}
document.querySelectorAll('.tabs button').forEach(function(t){
  t.addEventListener('click', function(){ showTab(t.dataset.t); });
});
document.getElementById('confirm').addEventListener('click', function(){ showTab('p'); });
document.querySelectorAll('.seg').forEach(function(sg){
  sg.addEventListener('click', function(e){
    var bt = e.target.closest('button'); if (!bt) return;
    sg.querySelectorAll('button').forEach(function(x){ x.setAttribute('aria-pressed', x === bt); });
    draw();
  });
});
document.querySelectorAll('.chips button').forEach(function(bt){
  bt.addEventListener('click', function(){
    var p = bt.dataset.p.split(',');
    document.getElementById('od').value = p[0];
    document.getElementById('ol').value = p[2];
    document.getElementById('oh').value = p[3];
    document.querySelectorAll('#oshape button').forEach(function(x){
      x.setAttribute('aria-pressed', x.dataset.v === p[1]);
    });
    draw();
  });
});
document.querySelectorAll('input,select').forEach(function(el){ el.addEventListener('input', draw); });
draw();
