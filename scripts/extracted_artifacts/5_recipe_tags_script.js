
var R = {
  bc:{n:'Buttercream', cpg:6.7305, batch:1387, app:'spread', over:2.4,
      jobs:{fill:true, crumb:true, cover:true}, g:{fill:85, crumb:170, cover:338},
      ing:[['Unsalted butter',450,15.56],['Icing sugar',900,2.40],['Whole milk',30,3.699],['Vanilla extract',5,12.22],['Salt',2,0.60]]},
  fd:{n:'Fondant', cpg:2.4983, batch:1113, app:'rolled', over:2.4,
      jobs:{fill:false, crumb:false, cover:true}, g:{fill:0, crumb:0, cover:937},
      ing:[['Icing sugar',900,2.40],['Gelatine',10,17.50],['Water',60,0],['Glucose syrup',100,3.00],['Glycerine',10,3.50],['CMC / Tylose',10,5.00],['White margarine',20,1.20],['Vanilla extract',3,12.22]]},
  cm:{n:'Caramel sauce', cpg:4.20, batch:600, app:'spread', over:0,
      jobs:{fill:true, crumb:false, cover:false}, g:{fill:60, crumb:0, cover:0},
      ing:[['Granulated sugar',300,1.50],['Unsalted butter',100,15.56],['Whole milk',180,3.699],['Salt',3,0.60]]},
  gn:{n:'Dark ganache', cpg:9.50, batch:900, app:'spread', over:0,
      jobs:{fill:false, crumb:true, cover:true}, g:{fill:0, crumb:156, cover:301},
      ing:[['Dark chocolate',500,14.00],['Powdered whipping cream',300,13.00],['Water',150,0],['Unsalted butter',50,15.56]]}
};
var cur = 'bc';

/* 6in, 2 layers: the calibration cake */
var A6 = Math.PI*36/4, GAP6 = A6, SURF6 = A6 + Math.PI*6*4;
function sheet6(ov){ return (Math.PI/4)*Math.pow(6 + 8 + ov, 2); }
/* 10in, 3 layers at 2in: the worked example */
var A10 = Math.PI*100/4, H10 = 6;
var GAP10 = A10*2, SURF10 = A10 + Math.PI*10*H10;
function sheet10(ov){ return (Math.PI/4)*Math.pow(10 + 2*H10 + ov, 2); }

function g(n){ return Math.round(n).toLocaleString('en-US'); }
function naira(n){ return '₦' + Math.round(n).toLocaleString('en-US'); }
function num(id){ return parseFloat(document.getElementById(id).value) || 0; }

function draw(){
  var r = R[cur];
  document.getElementById('crumb').innerHTML = 'Recipes &rsaquo; ' + r.n + ' &rsaquo; Edit';

  var tot = 0, html = '';
  r.ing.forEach(function(it){
    var c = it[1]*it[2]; tot += c;
    html += '<tr><td>'+it[0]+'</td><td>'+g(it[1])+' g</td><td>'+it[2].toFixed(2)+'</td><td>'+naira(c)+'</td></tr>';
  });
  document.getElementById('ingb').innerHTML = html;
  var yield_ = r.ing.reduce(function(s,i){ return s + i[1]; }, 0);
  document.getElementById('bq').textContent = g(yield_) + ' g';
  document.getElementById('bc').textContent = naira(tot);
  document.getElementById('dy').textContent = g(yield_) + ' g';
  document.getElementById('dc').textContent = '₦' + (tot/yield_).toFixed(2);

  ['fill','crumb','cover'].forEach(function(k){
    document.getElementById('j-'+k).classList.toggle('on', !!r.jobs[k]);
    document.getElementById('q-'+k).value = r.g[k] || 0;
  });
  var n = ['fill','crumb','cover'].filter(function(k){ return r.jobs[k]; }).length;
  document.getElementById('tagct').textContent = n + (n === 1 ? ' job' : ' jobs');

  document.getElementById('how').classList.toggle('off', !r.jobs.cover);
  document.querySelectorAll('#app button').forEach(function(b){
    b.setAttribute('aria-pressed', b.dataset.v === r.app);
  });
  document.getElementById('ovr').classList.toggle('on', r.app === 'rolled');
  document.getElementById('q-over').value = r.over;

  calc();
}

function calc(){
  var r = R[cur];
  var rate = {
    fill:  r.jobs.fill  ? num('q-fill')  / GAP6  : 0,
    crumb: r.jobs.crumb ? num('q-crumb') / SURF6 : 0,
    cover: r.jobs.cover ? num('q-cover') / (r.app === 'rolled' ? sheet6(num('q-over')) : SURF6) : 0
  };
  var out = {
    fill:  rate.fill  * GAP10,
    crumb: rate.crumb * SURF10,
    cover: rate.cover * (r.app === 'rolled' ? sheet10(num('q-over')) : SURF10)
  };
  var rows = '', sum = 0;
  [['fill','Between the layers'],['crumb','Crumb coat'],['cover','On the outside']].forEach(function(p){
    if (!r.jobs[p[0]]) return;
    sum += out[p[0]];
    rows += '<tr><td>'+p[1]+'</td><td>'+g(out[p[0]])+' g</td></tr>';
  });
  if (!rows) {
    document.getElementById('exb').innerHTML = '<p class="none">Tick at least one job above.</p>';
  } else {
    rows += '<tr class="em"><td>Altogether &middot; '+(sum/r.batch).toFixed(2)+' batches</td><td>'+naira(sum*r.cpg)+'</td></tr>';
    document.getElementById('exb').innerHTML = '<table>'+rows+'</table>';
  }

  var d = '';
  [['fill','Filling, per square inch of gap'],['crumb','Crumb coat, per square inch of surface'],
   ['cover','Covering, per square inch of ' + (r.app === 'rolled' ? 'sheet' : 'surface')]].forEach(function(p){
    if (!r.jobs[p[0]]) return;
    d += '<div><span>'+p[1]+'</span><span>'+rate[p[0]].toFixed(3)+' g</span></div>';
  });
  d += '<div><span>Cost per gram</span><span>₦'+r.cpg.toFixed(2)+'</span></div>';
  document.getElementById('det').innerHTML = d;
}

document.getElementById('sw').addEventListener('click', function(e){
  var b = e.target.closest('button'); if (!b) return;
  document.querySelectorAll('#sw button').forEach(function(x){ x.setAttribute('aria-pressed', x === b); });
  cur = b.dataset.r; draw();
});
['fill','crumb','cover'].forEach(function(k){
  document.querySelector('#j-'+k+' .jh').addEventListener('click', function(){
    var r = R[cur]; r.jobs[k] = !r.jobs[k];
    if (r.jobs[k] && !r.g[k]) r.g[k] = k === 'fill' ? 85 : (k === 'crumb' ? 170 : 338);
    draw();
  });
  document.getElementById('q-'+k).addEventListener('input', function(e){
    R[cur].g[k] = parseFloat(e.target.value) || 0; calc();
  });
});
document.getElementById('app').addEventListener('click', function(e){
  var b = e.target.closest('button'); if (!b) return;
  R[cur].app = b.dataset.v; draw();
});
document.getElementById('q-over').addEventListener('input', function(e){
  R[cur].over = parseFloat(e.target.value) || 0; calc();
});

draw();
