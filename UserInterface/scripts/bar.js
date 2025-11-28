function _htmlDefaults(){
  var el = document.getElementById('chart-shell');
  var d = el ? el.dataset : {};
  return {
    metric: d.metric || null,
    sortBy: d.sortBy || null,
    sortAsc: typeof d.sortAsc === 'string' ? (d.sortAsc === 'true') : null
  };
}

function cssVar(n,f){const v=getComputedStyle(document.documentElement).getPropertyValue(n).trim();return v||f||null;}
function palette(i){const arr=[cssVar('--cat2-base','#5ac8fa'),cssVar('--cat3-base','#af52de'),cssVar('--cat4-base','#ffcc00'),cssVar('--cat5-base','#34c759'),cssVar('--cat6-base','#ff9500')];return arr[i%arr.length];}


function ensureUnifiedLegendHost(){
  if (document.getElementById('unified-legend-row')) return;
  const host = document.getElementById('chart-shell') || document.body;
  const row = document.createElement('div');
  row.id = 'unified-legend-row';
  const box = document.createElement('div');
  box.id = 'unified-legend';
  const secTable = document.createElement('div');
  secTable.id = 'legend-sec-table';
  secTable.className = 'legend-section';
  const sep = document.createElement('div');
  sep.className = 'legend-sep';
  const secBar = document.createElement('div');
  secBar.id = 'legend-sec-bar';
  secBar.className = 'legend-section';
  box.appendChild(secTable);
  box.appendChild(sep);
  box.appendChild(secBar);
  row.appendChild(box);
  host.appendChild(row);
}

window.updateBarLegendVisibility = function(){
  ensureUnifiedLegendHost();
  const row = document.getElementById('unified-legend-row');
  if (row) row.style.display = 'block';
};

window.fillTableLegend = function(groups){
  ensureUnifiedLegendHost();
  const sec = document.getElementById('legend-sec-table');
  if (!sec) return;
  sec.innerHTML = '';
  groups.forEach(g=>{
    const item = document.createElement('div');
    item.className = 'legend-item';
    const sw = document.createElement('span');
    sw.className = 'legend-box legend-box--v ' + (g.cls || '');
    const t = document.createElement('span');
    t.textContent = g.label;
    item.appendChild(sw);
    item.appendChild(t);
    sec.appendChild(item);
  });
};

window.updateBarLegend = function(){
  ensureUnifiedLegendHost();
  const sec = document.getElementById('legend-sec-bar');
  if (!sec) return;
  sec.innerHTML = '';
  const col = window.CHART_STATE?.axisBy?.column || null;
  const cats = window.CHART_STATE?.axisBy?.categories || [];
  if (!col || col === 'P#'){
    const item = document.createElement('div');
    item.className = 'legend-item';
    const sw = document.createElement('span');
    sw.className = 'legend-box legend-box--h';
    const c = getComputedStyle(document.documentElement).getPropertyValue('--cat1-base').trim() || '#B7D0FF';
    sw.style.backgroundColor = c;
    sw.style.borderColor = c;
    const t = document.createElement('span');
    t.textContent = 'Participant';
    item.appendChild(sw);
    item.appendChild(t);
    sec.appendChild(item);
  } else {
    cats.forEach((c,i)=>{
      const item = document.createElement('div');
      item.className = 'legend-item';
      const sw = document.createElement('span');
      sw.className = 'legend-box legend-box--h';
      const colr = (function(i){
        const css = getComputedStyle(document.documentElement);
        const arr = [
          css.getPropertyValue('--cat2-base').trim() || '#5ac8fa',
          css.getPropertyValue('--cat3-base').trim() || '#af52de',
          css.getPropertyValue('--cat4-base').trim() || '#ffcc00',
          css.getPropertyValue('--cat5-base').trim() || '#34c759',
          css.getPropertyValue('--cat6-base').trim() || '#ff9500'
        ];
        return arr[i % arr.length];
      })(i);
      sw.style.backgroundColor = colr;
      sw.style.borderColor = colr;
      const t = document.createElement('span');
      t.textContent = c;
      item.appendChild(sw);
      item.appendChild(t);
      sec.appendChild(item);
    });
  }
  window.updateBarLegendVisibility();
};

window.updateBarLegendVisibility=function(){ensureUnifiedLegendHost();const row=document.getElementById('unified-legend-row');if(row)row.style.display='block';};
window.fillTableLegend=function(groups){ensureUnifiedLegendHost();const sec=document.getElementById('legend-sec-table');if(!sec)return;sec.innerHTML='';groups.forEach(g=>{const item=document.createElement('div');item.className='legend-item';const sw=document.createElement('span');sw.className='legend-box legend-box--v '+g.cls;const t=document.createElement('span');t.textContent=g.label;item.appendChild(sw);item.appendChild(t);sec.appendChild(item);});};
window.updateBarLegend=function(){ensureUnifiedLegendHost();const sec=document.getElementById('legend-sec-bar');if(!sec)return;sec.innerHTML='';const col=window.CHART_STATE?.axisBy?.column||null;const cats=window.CHART_STATE?.axisBy?.categories||[];if(!col||col==='P#'){const item=document.createElement('div');item.className='legend-item';const sw=document.createElement('span');sw.className='legend-box legend-box--h';sw.style.backgroundColor=cssVar('--cat1-base','#B7D0FF');sw.style.borderColor=sw.style.backgroundColor;const t=document.createElement('span');t.textContent='Participant';item.appendChild(sw);item.appendChild(t);sec.appendChild(item);}else{cats.forEach((c,i)=>{const item=document.createElement('div');item.className='legend-item';const sw=document.createElement('span');sw.className='legend-box legend-box--h';const colr=palette(i);sw.style.backgroundColor=colr;sw.style.borderColor=colr;const t=document.createElement('span');t.textContent=c;item.appendChild(sw);item.appendChild(t);sec.appendChild(item);});}window.updateBarLegendVisibility();};

function setDefaultMetric(dataset){
  if(!window.CHART_STATE) window.CHART_STATE = {};
  var htmld = _htmlDefaults();
  var headers = (window.radqyInferNumericColumns ? window.radqyInferNumericColumns(dataset) : []);
  var rngOk = headers.includes('RNG');

  if (!window.CHART_STATE.currentMetric) {
    window.CHART_STATE.currentMetric = htmld.metric && headers.includes(htmld.metric)
      ? htmld.metric
      : (rngOk ? 'RNG' : (headers[0] || null));
  }

  if (!window.CHART_STATE.sortBy) {
    window.CHART_STATE.sortBy = htmld.sortBy && (headers.includes(htmld.sortBy) || htmld.sortBy === 'P#')
      ? htmld.sortBy
      : (rngOk ? 'RNG' : 'P#');
  }

  if (typeof window.CHART_STATE.sortAsc !== 'boolean') {
    window.CHART_STATE.sortAsc = (htmld.sortAsc === null) ? false : htmld.sortAsc;
  }
}

window.updateBarSortVisibility=function(){const el=document.getElementById('bar-sort-wrap');if(!el)return;el.style.display=(window.CHART_STATE?.visType==='bar_chart')?'':'none';};

window.refreshBarSortOptions=function(){const btn=document.getElementById('bar-sort-select');const menu=btn?btn.nextElementSibling:null;const dirBtn=document.getElementById('bar-sort-order');if(!btn||!menu||!dirBtn)return;const ds=(window.radqyMergedDataset?window.radqyMergedDataset():[]);setDefaultMetric(ds);const numericCols=(window.radqyInferNumericColumns?window.radqyInferNumericColumns(ds):[]);const catItems=(window.getCategoricalHeaders?window.getCategoricalHeaders():[]).map(o=>o.header);const items=[];items.push({label:'P#',value:'P#',cls:'radqy-opt--part'});numericCols.forEach(c=>{let cls='radqy-opt--num';if(window.DATA?.TAGS?.headers?.includes(c))cls='radqy-opt--tag';else if(window.DATA?.IQMS?.headers?.includes(c))cls='radqy-opt--iqms';else if(window.DATA?.EXTS?.headers?.includes(c))cls='radqy-opt--ext';else if(window.DATA?.AUXS?.headers?.includes(c))cls='radqy-opt--aux';items.push({label:c,value:c,cls});});catItems.forEach(c=>{let cls='radqy-opt--cat';if(window.DATA?.TAGS?.headers?.includes(c))cls='radqy-opt--tag';else if(window.DATA?.IQMS?.headers?.includes(c))cls='radqy-opt--iqms';else if(window.DATA?.EXTS?.headers?.includes(c))cls='radqy-opt--ext';else if(window.DATA?.AUXS?.headers?.includes(c))cls='radqy-opt--aux';items.push({label:c,value:c,cls});});const current=window.CHART_STATE.sortBy||'P#';btn.textContent=current;menu.innerHTML='';items.forEach(it=>{const opt=document.createElement('div');opt.className=`radqy-select__opt ${it.cls}`;opt.setAttribute('data-value',it.value);opt.textContent=it.label;if(it.value===current)opt.setAttribute('aria-selected','true');opt.addEventListener('click',()=>{window.CHART_STATE.sortBy=it.value;btn.textContent=it.label;menu.parentElement.classList.remove('is-open');if(typeof window.renderChartsView==='function')window.renderChartsView();});menu.appendChild(opt);});if(typeof window.CHART_STATE.sortAsc!=='boolean')window.CHART_STATE.sortAsc=false;renderSortIcon(dirBtn,window.CHART_STATE.sortAsc);btn.onclick=function(){btn.parentElement.classList.toggle('is-open');};document.addEventListener('click',function(e){if(!btn.parentNode.contains(e.target))btn.parentElement.classList.remove('is-open');},{capture:true});dirBtn.onclick=function(){window.CHART_STATE.sortAsc=!window.CHART_STATE.sortAsc;renderSortIcon(dirBtn,window.CHART_STATE.sortAsc);if(typeof window.renderChartsView==='function')window.renderChartsView();};};

function renderSortIcon(el,asc){el.innerHTML=asc?'<span class="sort-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg></span>':'<span class="sort-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg></span>';}

function ensureBarControlsOrder(){var dock=document.getElementById('bar-controls-dock');if(!dock)return;var metric=document.getElementById('bar-metric-wrap');var sortWrap=document.getElementById('bar-sort-wrap');if(metric&&metric.parentNode!==dock)dock.appendChild(metric);if(sortWrap&&sortWrap.parentNode!==dock)dock.appendChild(sortWrap);}

function currentSortAccessor(dataset){var by=(window.CHART_STATE&&window.CHART_STATE.sortBy)||'P#';return function(row,idx){if(by==='P#')return{n:idx,s:null};var v=row[by];var num=(typeof v==='number')?v:parseFloat(v);if(Number.isFinite(num))return{n:num,s:null};return{n:null,s:(v==null?'':String(v))};};}

function fillBarMetricOptions(dataset){setDefaultMetric(dataset);var btn=document.getElementById('bar-metric-select');var menu=btn?btn.nextElementSibling:null;if(!btn||!menu)return;var numeric=(window.radqyInferNumericColumns?window.radqyInferNumericColumns(dataset):[]);var cur=window.CHART_STATE.currentMetric;if(!cur||!numeric.includes(cur))cur=(numeric.includes('RNG')?'RNG':(numeric[0]||null));window.CHART_STATE.currentMetric=cur;btn.textContent=cur||'—';menu.innerHTML='';var TAGS=window.DATA?.TAGS?.headers||[];var IQMS=window.DATA?.IQMS?.headers||[];var EXTS=window.DATA?.EXTS?.headers||[];var AUXS=window.DATA?.AUXS?.headers||[];numeric.forEach(function(m){var cls='radqy-opt--other';if(TAGS.includes(m))cls='radqy-opt--tag';else if(IQMS.includes(m))cls='radqy-opt--iqms';else if(EXTS.includes(m))cls='radqy-opt--ext';else if(AUXS.includes(m))cls='radqy-opt--aux';var opt=document.createElement('div');opt.className='radqy-select__opt '+cls;opt.setAttribute('role','option');opt.setAttribute('data-value',m);opt.textContent=m;if(m===cur)opt.setAttribute('aria-selected','true');opt.addEventListener('click',function(){window.CHART_STATE.currentMetric=m;btn.textContent=m;window.CHART_STATE.sortBy=this.getAttribute('data-value');if(typeof window.refreshBarSortOptions==='function')window.refreshBarSortOptions();btn.parentElement.classList.remove('is-open');if(typeof window.renderChartsView==='function')window.renderChartsView();});menu.appendChild(opt);});btn.onclick=function(){btn.parentElement.classList.toggle('is-open');};document.addEventListener('click',function(e){if(!btn.parentElement.contains(e.target))btn.parentElement.classList.remove('is-open');},{capture:true});}

(function(global){
var Bar={};global.RadqyBarChart=Bar;
const _state={currentMetric:null,selectedCase:null,axisBy:{kind:'participant',column:'P#',categories:[]},last:{svgG:null,data:[],useCategory:false,chartH:0}};
function prettyNumber(v){if(v==null||isNaN(v))return'';return(Math.round(v*100)/100).toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:2});}
function pLabelForIndex(idx){return'P'+(idx+1);}
function getMergedDataset(){const MAIN=global.DATA?.MAIN||{rows:[]};const TAGS=global.DATA?.TAGS||{rows:[]};const IQMS=global.DATA?.IQMS||{rows:[]};const EXTS=global.DATA?.EXTS||{rows:[]};const AUXS=global.DATA?.AUXS||{rows:[]};const n=Math.max(MAIN.rows.length,TAGS.rows.length,IQMS.rows.length,EXTS.rows.length,AUXS.rows.length);const out=[];for(let i=0;i<n;i++){out.push(Object.assign({},MAIN.rows[i]||{},TAGS.rows[i]||{},IQMS.rows[i]||{},EXTS.rows[i]||{},AUXS.rows[i]||{}));}return out;}
function inferNumericHeaders(dataset){if(!dataset.length)return[];const allowed=new Set();(window.DATA?.TAGS?.headers||[]).forEach(h=>allowed.add(h));(window.DATA?.IQMS?.headers||[]).forEach(h=>allowed.add(h));(window.DATA?.EXTS?.headers||[]).forEach(h=>allowed.add(h));(window.DATA?.AUXS?.headers||[]).forEach(h=>allowed.add(h));const headers=Object.keys(dataset[0]||{});const hidden=window.VIEW_STATE?.hiddenHeaders||new Set();const out=[];for(const h of headers){if(!h||!allowed.has(h))continue;if(/^Participant\b/i.test(h))continue;if(h.trim()==='P#')continue;if(hidden.has&&hidden.has(h))continue;let saw=false,allNum=true;for(let r=0;r<dataset.length;r++){const raw=dataset[r][h];if(raw===''||raw==null)continue;const num=(typeof raw==='number')?raw:parseFloat(raw);if(!Number.isFinite(num)){allNum=false;break;}saw=true;}if(saw&&allNum)out.push(h);}return out;}
function inferCategoricalHeaders(dataset){if(!dataset.length)return[];const allowed=new Set();(window.DATA?.TAGS?.headers||[]).forEach(h=>allowed.add(h));(window.DATA?.IQMS?.headers||[]).forEach(h=>allowed.add(h));(window.DATA?.EXTS?.headers||[]).forEach(h=>allowed.add(h));(window.DATA?.AUXS?.headers||[]).forEach(h=>allowed.add(h));const headers=Object.keys(dataset[0]||{});const hidden=window.VIEW_STATE?.hiddenHeaders||new Set();const out=[];for(const h of headers){if(!h||!allowed.has(h))continue;if(/^Participant\b/i.test(h))continue;if(h.trim()==='P#')continue;if(hidden.has&&hidden.has(h))continue;let saw=false,anyNonNum=false;for(let r=0;r<dataset.length;r++){const raw=dataset[r][h];if(raw===''||raw==null)continue;const num=(typeof raw==='number')?raw:parseFloat(raw);if(!Number.isFinite(num)){anyNonNum=true;break;}saw=true;}if(saw&&anyNonNum)out.push(h);}return out;}
function catIdxForValue(v,domain){const i=domain.indexOf(v);return Math.max(0,i);}
Bar._inferNumeric=inferNumericHeaders;Bar._inferCategorical=inferCategoricalHeaders;

Bar.render=function(svgG,width,height,margin,externalDataset,metric,chartState,getPLabel,onSelect){
const ds=externalDataset&&externalDataset.length?externalDataset:getMergedDataset();
setDefaultMetric(ds);
refreshBarSortOptions();
ensureBarControlsOrder();
updateBarLegend();if(window.updateBarLegendVisibility)window.updateBarLegendVisibility();if(window.updateBarSortVisibility)window.updateBarSortVisibility();if(window.updateBarMetricVisibility)window.updateBarMetricVisibility();
fillBarMetricOptions(ds);
const cs=chartState||global.CHART_STATE||{};if(cs.axisBy)_state.axisBy=cs.axisBy;if(metric)_state.currentMetric=metric;if(!_state.currentMetric&&cs.currentMetric)_state.currentMetric=cs.currentMetric;
const dataset=ds;if(!dataset.length||!svgG)return;
const numericHeaders=inferNumericHeaders(dataset);
if(!_state.currentMetric||!numericHeaders.includes(_state.currentMetric))_state.currentMetric=(numericHeaders.includes('RNG')?'RNG':(numericHeaders[0]||null));
if(!_state.currentMetric){svgG.selectAll('*').remove();return;}
const base=dataset.map(function(row,idx){return{p_label:getPLabel?getPLabel(row,idx):pLabelForIndex(idx),case_name:(function(){for(const k in row)if(/^Participant\b/i.test(k))return String(row[k]??idx);return String(idx);})(),value:Number(row[_state.currentMetric]),_row:row,_idx:idx};}).filter(d=>Number.isFinite(d.value));
const AX=_state.axisBy||{kind:'participant',column:'P#',categories:[]};const useCategory=AX.kind==='category';const domainCats=useCategory?(AX.categories||[]):[];
if(useCategory){const col=AX.column;base.forEach(function(d){const v=dataset[d._idx]?dataset[d._idx][col]:null;const t=(v==null||String(v).trim()===''||String(v).toUpperCase()==='NA')?'NA':String(v).trim();d._cat=t;d._catIdx=catIdxForValue(t,domainCats);});}
var sortAcc=currentSortAccessor(dataset);var asc=!!(window.CHART_STATE&&window.CHART_STATE.sortAsc);
const data=base.slice().sort(function(a,b){var av=sortAcc(a._row,a._idx),bv=sortAcc(b._row,b._idx);if(av.n!=null&&bv.n!=null)return asc?(av.n-bv.n):(bv.n-av.n);var as=av.s==null?'':av.s,bs=bv.s==null?'':bv.s;return asc?as.localeCompare(bs):bs.localeCompare(as);});
const chartW=Math.max(120,width-margin.left-margin.right);const chartH=Math.max(120,height-margin.top-margin.bottom);
const x=d3.scale.ordinal().domain(data.map(d=>d.p_label)).rangeRoundBands([0,chartW],0.1);
const maxY=d3.max(data,d=>d.value)||0;const y=d3.scale.linear().domain([0,maxY]).range([chartH,0]);
const xAxis=d3.svg.axis().scale(x).orient('bottom');const yAxis=d3.svg.axis().scale(y).ticks(4).orient('right').innerTickSize(-chartW).outerTickSize(0).tickPadding(10);
svgG.selectAll('*').remove();d3.selectAll('.d3-tip').style('display','none');
if(!document.getElementById('bar-legend')){const leg=document.createElement('div');leg.id='bar-legend';leg.style.position='absolute';leg.style.top='-20px';leg.style.left='70%';leg.style.transform='translateX(-50%)';leg.style.zIndex='10';document.getElementById('chart-shell').appendChild(leg);}
const gx=svgG.append('g').attr('class','x axis').attr('transform','translate(0,'+chartH+')').call(xAxis);
(function(){const n=data.length;const stripP=(n>100);const step=(n>240)?3:(n>160)?2:1;const rotate=(n>80)?65:(n>50)?45:0;const fontPx=(n<=50)?12:(n<=80)?11:(n<=120)?10:9;gx.selectAll('text').text(function(d,i){const lab=stripP?String(d).replace(/^P/i,''):String(d);return(i%step===0)?lab:'';}).style('font-size',fontPx+'px').style('text-anchor',rotate?'start':'middle').attr('dx',rotate?'0.5em':'0').attr('dy',rotate?'0.25em':'.71em').attr('transform',rotate?'rotate('+rotate+')':null);})();
svgG.append('g').attr('class','y axis').attr('transform','translate('+chartW+',0)').call(yAxis);
var metricLabel=(_state.currentMetric||(window.CHART_STATE&&window.CHART_STATE.currentMetric)||'value');
var tip=d3.tip().attr('class','d3-tip').offset([-10,0]).html(function(d){return"<span class='tip-name'>"+d.p_label+"</span><br/>"+"<span class='tip-val'>"+metricLabel+"="+prettyNumber(d.value)+"</span>";});
d3.select('body').call(tip);d3.select(svgG.node().ownerSVGElement).call(tip);d3.select(svgG.node().ownerSVGElement).on('mouseleave.bar-tip-hide',function(){tip.hide();});
const bars=svgG.selectAll('rect.bar').data(data,d=>d.case_name);
const enter=bars.enter().append('rect').attr('class',function(d){let c='bar';if(useCategory)c+=' cat-'+(d._catIdx||0);else{c+=' cat-0';d._catIdx=0;}return c;}).attr('x',d=>x(d.p_label)).attr('width',Math.max(x.rangeBand()-1,1)).attr('y',d=>y(d.value)).attr('height',d=>Math.abs(chartH-y(d.value)));
enter.each(function(d){if(!useCategory)d3.select(this).style('fill',cssVar('--cat1-base','#B7D0FF'));if(_state.selectedCase===d.case_name)d3.select(this).classed('selected-bar',true);});
enter.on('mouseover',function(d){tip.show(d,this);if(_state.selectedCase!==d.case_name)d3.select(this).classed('bar-hover-target',true);if(typeof global.hoverTableRow==='function')global.hoverTableRow(d.case_name,true);}).on('mouseout',function(d){tip.hide();d3.select(this).classed('bar-hover-target',false);if(typeof global.hoverTableRow==='function')global.hoverTableRow(d.case_name,false);}).on('click',function(d){try{tip.hide();}catch(e){}d3.selectAll('.d3-tip').style('display','none');if(d3.event&&typeof d3.event.stopPropagation==='function')d3.event.stopPropagation();if(typeof window.selectCaseAndRefresh==='function'){window.selectCaseAndRefresh(d.case_name);}else{_state.selectedCase=d.case_name;if(typeof window.selectRowInTable==='function')window.selectRowInTable(d.case_name);}});
bars.exit().each(function(){tip.hide();d3.select(this).remove();});
d3.select(svgG.node().ownerSVGElement).on('click.bar-clear',function(){const t=d3.event&&d3.event.target&&d3.event.target.tagName;if(t==='rect')return;if(typeof global.selectCaseAndRefresh==='function')global.selectCaseAndRefresh(null);else{_state.selectedCase=null;svgG.selectAll('rect.bar').classed('selected-bar',false).classed('bar-hover-target',false).each(function(d){if(!useCategory)d3.select(this).style('fill',cssVar('--cat1-base','#B7D0FF'));});if(typeof global.selectRowInTable==='function')global.selectRowInTable(null);}});
(function(){const dom=useCategory?(AX.categories||[]):['P#'];const catMap={};svgG.selectAll('rect.bar').each(function(d){catMap[String(d.case_name)]=d._catIdx||0;});if(global.setRowCategoryClasses)global.setRowCategoryClasses(catMap,dom);})();
_state.last.svgG=svgG;_state.last.data=data;_state.last.useCategory=useCategory;_state.last.chartH=chartH;
};

Bar.clear=function(svgContainerSel){if(svgContainerSel)d3.select(svgContainerSel).selectAll('*').remove();};
function _findBar(caseName){if(!_state.last.svgG)return null;let sel=null;_state.last.svgG.selectAll('rect.bar').each(function(d){if(d&&d.case_name===caseName)sel=d3.select(this);});return sel;}
Bar.hoverFromTable=function(caseName,on){const barSel=_findBar(caseName);if(!barSel)return;if(_state.selectedCase===caseName)return;barSel.classed('bar-hover-target',!!on);if(!_state.last.useCategory){const fill=on?cssVar('--cat1-hover','#006fce'):cssVar('--cat1-base','#B7D0FF');barSel.style('fill',fill);}};
Bar.selectFromTable=function(caseName,on){if(!_state.last.svgG)return;_state.selectedCase=on?caseName:null;_state.last.svgG.selectAll('rect.bar').classed('selected-bar',function(d){return!!on&&d&&d.case_name===caseName;}).classed('bar-hover-target',false).each(function(d){if(!_state.last.useCategory){const fill=(!!on&&d&&d.case_name===caseName)?cssVar('--cat1-selected','#002f6c'):cssVar('--cat1-base','#B7D0FF');d3.select(this).style('fill',fill);}});};
})(window);
