
/* ===== shared ===== */
var ING = [
  ['Plain flour',1.14,10000],['Granulated sugar',1.50,8000],['Icing sugar',2.40,5000],
  ['Unsalted butter',15.56,1200],['Eggs',5.83,3000],['Whole milk',3.699,2000],
  ['Baking powder',3.00,500],['Baking soda',2.00,400],['Salt',0.60,1000],
  ['Vanilla extract',12.22,400],['Cocoa powder',8.00,2000],['Gelatine',17.50,300],
  ['Glucose syrup',3.00,1500],['Glycerine',3.50,400],['CMC / Tylose',5.00,250],
  ['White margarine',1.20,900],['Red food colour',20.00,300],['Vinegar',1.40,500],
  ['Powdered whipping cream',13.00,2500]
];
function naira(v){ return '₦' + Math.round(v).toLocaleString('en-US'); }
function nm(v){ return v.toLocaleString('en-US'); }

/* ===== form ===== */
var rows = [
  {n:'Plain flour', q:2000, d:'less'},
  {n:'Whole milk', q:37, d:'less'},
  {n:'Baking powder', q:15, d:'less'},
  {n:'Salt', q:8, d:'less'}
];
function find(n){ return ING.filter(function(i){ return i[0] === n; })[0]; }
function isCount(){ return document.getElementById('reason').value === 'count'; }

function render(){
  var html = '';
  rows.forEach(function(r, i){
    var it = find(r.n), v = it ? it[1]*r.q : 0, stock = it ? it[2] : 0;
    var over = it && r.d === 'less' && r.q > stock;
    html += '<div class="line" data-i="'+i+'">'
      + '<div class="pick">'+(i===0 ? '<label>Ingredient</label>' : '')
      +   '<input type="text" class="ing" value="'+r.n+'" placeholder="Type to search" autocomplete="off">'
      +   '<div class="menu"></div></div>'
      + '<div>'+(i===0 ? '<label>'+(isCount()?'Difference':'Quantity')+'</label>' : '')
      +   '<input type="number" class="qty" value="'+r.q+'" min="0" step="1">'
      +   (isCount() ? '<div class="dir"><button type="button" data-d="less" aria-pressed="'+(r.d==='less')+'">Less</button><button type="button" data-d="more" aria-pressed="'+(r.d==='more')+'">More</button></div>' : '')
      + '</div>'
      + '<div>'+(i===0 ? '<label>&nbsp;</label>' : '')+'<button class="del" type="button">&times;</button></div>'
      + '<div class="val'+(over?' warn':'')+'">'
      +   (it ? nm(r.q)+' g &middot; <b>'+naira(v)+'</b> &middot; '+nm(stock)+' g in store'
                + (over ? ' &middot; <b>more than you have</b>' : '') : 'pick an ingredient')
      + '</div></div>';
  });
  document.getElementById('lines').innerHTML = html;

  var total = rows.reduce(function(s, r){
    var it = find(r.n); if (!it) return s;
    return s + it[1]*r.q*(r.d === 'more' ? -1 : 1);
  }, 0);
  document.getElementById('tot').textContent = naira(Math.abs(total));
  document.getElementById('totLbl').textContent = total < 0 ? 'Value coming back in' : 'Value leaving the store';
  document.getElementById('tot').style.color = total < 0 ? 'var(--go)' : 'var(--bad)';
  wire();
}
function wire(){
  document.querySelectorAll('.line').forEach(function(ln){
    var i = +ln.dataset.i, inp = ln.querySelector('.ing'), menu = ln.querySelector('.menu');
    inp.addEventListener('input', function(){
      var q = inp.value.toLowerCase();
      var hits = ING.filter(function(it){ return it[0].toLowerCase().indexOf(q) > -1; }).slice(0,7);
      menu.innerHTML = hits.map(function(it){
        return '<div data-n="'+it[0]+'">'+it[0]+'<span>'+nm(it[2])+' g</span></div>'; }).join('');
      menu.classList.toggle('on', hits.length > 0 && inp.value !== rows[i].n);
    });
    inp.addEventListener('focus', function(){ inp.select(); });
    menu.addEventListener('mousedown', function(e){
      var d = e.target.closest('div[data-n]'); if (!d) return;
      rows[i].n = d.dataset.n; menu.classList.remove('on'); render();
    });
    inp.addEventListener('blur', function(){ setTimeout(function(){ menu.classList.remove('on'); }, 120); });
    ln.querySelector('.qty').addEventListener('input', function(e){
      rows[i].q = parseFloat(e.target.value) || 0; render(); });
    ln.querySelector('.del').addEventListener('click', function(){
      if (rows.length > 1) { rows.splice(i,1); render(); } });
    var dir = ln.querySelector('.dir');
    if (dir) dir.addEventListener('click', function(e){
      var b = e.target.closest('button'); if (!b) return;
      rows[i].d = b.dataset.d; render(); });
  });
}
document.getElementById('add').addEventListener('click', function(){ rows.push({n:'', q:0, d:'less'}); render(); });
document.getElementById('reason').addEventListener('change', function(e){
  document.getElementById('noteWrap').classList.toggle('on', e.target.value === 'other');
  if (e.target.value !== 'count') rows.forEach(function(r){ r.d = 'less'; });
  render();
});
document.getElementById('submit').addEventListener('click', function(){ showTab('m'); });

/* ===== movement report ===== */
var MV = [
  {g:'Ingredients'},
  {i:'Plain flour', u:'g', o:8000, b:25000, s:21000, a:-2000, c:10000, cu:1.14, v:11400,
   det:[['16 Oct','Wrong recipe or failed batch','−2,000 g','−₦2,280']]},
  {i:'Granulated sugar', u:'g', o:5000, b:12000, s:10500, a:1500, c:8000, cu:1.50, v:12000,
   det:[['4 Oct','Counted wrong','+1,500 g','+₦2,250']]},
  {i:'Icing sugar', u:'g', o:4000, b:10000, s:9000, a:0, c:5000, cu:2.40, v:12000},
  {i:'Unsalted butter', u:'g', o:3000, b:8000, s:9800, a:0, c:1200, cu:15.56, v:18672, low:true},
  {i:'Eggs', u:'g', o:2400, b:6000, s:5400, a:0, c:3000, cu:5.83, v:17490},
  {i:'Whole milk', u:'g', o:1500, b:3000, s:2063, a:-437, c:2000, cu:3.70, v:7398,
   det:[['16 Oct','Wrong recipe or failed batch','−37 g','−₦137'],
        ['11 Oct','Spoiled or expired','−400 g','−₦1,480']]},
  {i:'Baking powder', u:'g', o:400, b:500, s:385, a:-15, c:500, cu:3.00, v:1500,
   det:[['16 Oct','Wrong recipe or failed batch','−15 g','−₦45']]},
  {i:'Salt', u:'g', o:800, b:500, s:292, a:-8, c:1000, cu:0.60, v:600,
   det:[['16 Oct','Wrong recipe or failed batch','−8 g','−₦5']]},
  {i:'Powdered whipping cream', u:'g', o:2000, b:3000, s:2350, a:-150, c:2500, cu:13.00, v:32500,
   det:[['11 Oct','Spoiled or expired','−150 g','−₦1,950']]},
  {g:'Boxes and boards'},
  {i:'10" High Box', u:'pcs', o:6, b:14, s:0, a:0, c:20, cu:570, v:11400},
  {i:'10" Low Box', u:'pcs', o:3, b:7, s:1, a:0, c:9, cu:500, v:4500},
  {i:'10" Thin Board', u:'pcs', o:2, b:0, s:1, a:0, c:1, cu:800, v:800, low:true},
  {i:'12" High Box', u:'pcs', o:14, b:6, s:0, a:0, c:20, cu:700, v:14000},
  {i:'12" Low Box', u:'pcs', o:5, b:5, s:1, a:0, c:9, cu:600, v:5400},
  {i:'14" Thick Board', u:'pcs', o:2, b:6, s:2, a:-1, c:5, cu:2529, v:12645,
   det:[['12 Oct','Damaged or spilled','−1 pcs','−₦2,529']]}
];
function drawMV(){
  var html = '';
  MV.forEach(function(r, i){
    if (r.g) { html += '<tr class="grp"><td colspan="9">'+r.g+'</td></tr>'; return; }
    var acls = r.a === 0 ? 'zero' : (r.a < 0 ? 'neg' : 'pos');
    var atxt = r.a === 0 ? '—' : (r.a < 0 ? '−'+nm(Math.abs(r.a)) : '+'+nm(r.a));
    html += '<tr><td>'+r.i+'</td><td>'+r.u+'</td>'
      + '<td>'+nm(r.o)+'</td>'
      + '<td class="bought">+'+nm(r.b)+'</td>'
      + '<td class="used">−'+nm(r.s)+'</td>'
      + '<td><span class="adj '+acls+'" data-i="'+i+'">'+atxt+'</span></td>'
      + '<td class="close'+(r.low?' low':'')+'">'+nm(r.c)+(r.low?' ⚠':'')+'</td>'
      + '<td>'+naira(r.cu)+'</td><td>'+naira(r.v)+'</td></tr>';
    if (r.open && r.det) {
      html += '<tr class="detail"><td colspan="9"><div class="dwrap"><b>'+r.i+' &middot; adjustments in October</b>'
        + r.det.map(function(d){
            return '<div><span>'+d[0]+' &middot; '+d[1]+'</span><span>'+d[2]+' &middot; '+d[3]+'</span></div>'; }).join('')
        + '</div></td></tr>';
    }
  });
  document.getElementById('mvbody').innerHTML = html;
  document.querySelectorAll('.adj').forEach(function(a){
    if (a.classList.contains('zero')) return;
    a.addEventListener('click', function(){
      var r = MV[+a.dataset.i]; r.open = !r.open; drawMV();
    });
  });
}

function showTab(t){
  document.querySelectorAll('.tabs button').forEach(function(x){ x.setAttribute('aria-selected', x.dataset.t === t); });
  document.getElementById('pane-f').classList.toggle('on', t === 'f');
  document.getElementById('pane-m').classList.toggle('on', t === 'm');
  window.scrollTo(0,0);
}
document.querySelectorAll('.tabs button').forEach(function(t){
  t.addEventListener('click', function(){ showTab(t.dataset.t); });
});

render();
drawMV();
