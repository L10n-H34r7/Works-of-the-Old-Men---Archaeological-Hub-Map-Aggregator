/** UI Manager - panels, modals, interactions */

const UIManager = { panels:{}, buttons:{}, filterSelects:{}, activePanel:null, featureInfoVisible:false,

  init() { this.cacheElements(); this.bindEvents(); this.setupPanelToggles(); this.setupFilterSelects(); this.setupContributionForm(); this.setupExportButtons(); },

  cacheElements() {
    this.panels={layers:document.getElementById('panel-layers'),about:document.getElementById('panel-about'),contribute:document.getElementById('panel-contribute'),export:document.getElementById('panel-export')};
    this.buttons={layers:document.getElementById('btn-layers'),about:document.getElementById('btn-about'),contribute:document.getElementById('btn-contribute'),export:document.getElementById('btn-export')};
    this.filterSelects={type:document.getElementById('filter-type'),region:document.getElementById('filter-region')};
  },

  bindEvents() {
    Object.entries(this.buttons).forEach(([k,b])=>{ if(b) b.addEventListener('click',()=>this.togglePanel(k)); });
    Object.values(this.panels).forEach(p=>{ if(p){ const c=p.querySelector('.panel-close'); if(c) c.addEventListener('click',()=>this.closePanel(p)); } });
    if(window.MapManager?.map) window.MapManager.map.on('click',()=>this.closeAllPanels());
    document.addEventListener('keydown',e=>{ if(e.key==='Escape') this.closeAllPanels(); if(e.key==='l'&&e.ctrlKey){e.preventDefault();this.togglePanel('layers');} if(e.key==='c'&&e.ctrlKey){e.preventDefault();this.togglePanel('contribute');} if(e.key==='e'&&e.ctrlKey){e.preventDefault();this.togglePanel('export');} });
    window.addEventListener('resize',()=>this.handleResize());
  },

  setupPanelToggles() { if(window.innerWidth>768) this.openPanel('layers'); },

  togglePanel(name) {
    const p=this.panels[name], b=this.buttons[name]; if(!p||!b) return;
    const open=p.getAttribute('aria-expanded')==='true';
    if(open) this.closePanel(p); else this.openPanel(name);
  },

  openPanel(name) {
    const p=this.panels[name], b=this.buttons[name]; if(!p) return;
    if(window.innerWidth<=768) this.closeAllPanels();
    p.hidden=false; p.offsetHeight; p.setAttribute('aria-expanded','true'); if(b) b.setAttribute('aria-expanded','true'); this.activePanel=name;
  },

  closePanel(p) {
    p.setAttribute('aria-expanded','false');
    setTimeout(()=>{ if(p.getAttribute('aria-expanded')==='false') p.hidden=true; },300);
    const n=Object.entries(this.panels).find(([_,v])=>v===p)?.[0]; if(n&&this.buttons[n]) this.buttons[n].setAttribute('aria-expanded','false');
    if(this.activePanel===n) this.activePanel=null;
  },

  closeAllPanels() { Object.values(this.panels).forEach(p=>{ if(p.getAttribute('aria-expanded')==='true') this.closePanel(p); }); },

  handleResize() { if(window.innerWidth>768&&!this.activePanel) this.openPanel('layers'); },

  setupFilterSelects() {
    if(this.filterSelects.type) this.filterSelects.type.addEventListener('change',e=>window.LayerManager?.setFilter('type',e.target.value));
    if(this.filterSelects.region) this.filterSelects.region.addEventListener('change',e=>window.LayerManager?.setFilter('region',e.target.value));
    this.populateRegionFilter();
  },

  populateRegionFilter() {
    const s=this.filterSelects.region; if(!s) return;
    const r=[{v:'all',l:'All Regions'},{v:'jordan',l:'Jordan'},{v:'saudi',l:'Saudi Arabia'},{v:'yemen',l:'Yemen'},{v:'oman',l:'Oman'},{v:'uae',l:'UAE'},{v:'syria',l:'Syria'},{v:'iraq',l:'Iraq'},{v:'djibouti',l:'Djibouti'},{v:'ethiopia',l:'Ethiopia'}];
    s.innerHTML=r.map(x=>`<option value="${x.v}">${x.l}</option>`).join('');
  },

  setupContributionForm() {
    const f=document.getElementById('contribute-form'), s=document.getElementById('contribute-status'), sb=document.getElementById('btn-start-contribute'), cb=document.getElementById('btn-cancel-contribute'), rb=document.getElementById('btn-reset-form');
    if(sb) sb.addEventListener('click',()=>this.startContributionMode());
    if(cb) cb.addEventListener('click',()=>this.cancelContributionMode());
    if(rb) rb.addEventListener('click',()=>this.resetContributionForm());
    if(f) f.addEventListener('submit',e=>this.handleContributionSubmit(e));
  },

  startContributionMode() {
    const s=document.getElementById('contribute-status'), f=document.getElementById('contribute-form'), cb=document.getElementById('btn-cancel-contribute');
    if(s) s.hidden=true; if(f) f.hidden=false; if(cb) cb.hidden=false;
    window.App?.setContributionMode(true); Utils.showToast('Click on the map to place a structure','info');
  },

  cancelContributionMode() {
    const s=document.getElementById('contribute-status'), f=document.getElementById('contribute-form'), cb=document.getElementById('btn-cancel-contribute');
    if(s) s.hidden=false; if(f) f.hidden=true; if(cb) cb.hidden=true;
    window.App?.setContributionMode(false); this.resetContributionForm();
  },

  resetContributionForm() {
    const f=document.getElementById('contribute-form'); if(f) f.reset();
    document.getElementById('contrib-lat').value=''; document.getElementById('contrib-lng').value='';
  },

  handleContributionSubmit(e) {
    e.preventDefault(); const fd=new FormData(e.target);
    const d={name:fd.get('name'),type:fd.get('type'),subtype:fd.get('subtype'),lat:parseFloat(fd.get('lat')),lng:parseFloat(fd.get('lng')),description:fd.get('description'),source:fd.get('source'),contributor:fd.get('contributor')};
    if(!d.name||!d.type||isNaN(d.lat)||isNaN(d.lng)){ Utils.showToast('Fill all required fields','error'); return; }
    const feat=Utils.createFeatureFromData(d); window.LayerManager?.addContribution(feat); this.updateContributionsList(); this.resetContributionForm(); this.cancelContributionMode(); Utils.showToast('Structure added!','success');
  },

  setContributionCoords(lat,lng) { document.getElementById('contrib-lat').value=lat.toFixed(6); document.getElementById('contrib-lng').value=lng.toFixed(6); },

  updateContributionsList() {
    const c=document.getElementById('contrib-items'); if(!c) return;
    const f=[]; window.LayerManager?.layerGroups.contributions.eachLayer(l=>{ const s=L.stamp(l); const ca=window.LayerManager?.featureCache.get(s); if(ca&&ca.feature) f.push(ca.feature); });
    if(f.length===0){ c.innerHTML='<li class="empty-state">No contributions yet</li>'; return; }
    c.innerHTML=f.map(feat=>{ const p=feat.properties, co=feat.geometry.coordinates; return `<li data-id="${p._id}"><div><span class="contrib-item-type">${Utils.getTypeDisplayName(p.type)}</span>${p.name?`<div class="contrib-item-name">${p.name}</div>`:''}</div><div><span class="contrib-item-coords">${Utils.formatCoords(co[1],co[0],4)}</span><button class="btn btn-small" onclick="window.UIManager.removeContribution('${p._id}')" title="Remove">✕</button></div></li>'; }).join('');
  },

  removeContribution(id) { window.LayerManager?.removeContribution(id); this.updateContributionsList(); },

  setupExportButtons() {
    const db=document.getElementById('btn-download-geojson'), sb=document.getElementById('btn-save-contrib'), lb=document.getElementById('btn-load-contrib'), cb=document.getElementById('btn-clear-contrib'), fi=document.getElementById('input-load-contrib');
    if(db) db.addEventListener('click',()=>this.exportAll());
    if(sb) sb.addEventListener('click',()=>this.saveContributions());
    if(lb) lb.addEventListener('click',()=>fi?.click());
    if(fi) fi.addEventListener('change',e=>this.loadContributionsFile(e));
    if(cb) cb.addEventListener('click',()=>this.clearContributions());
  },

  exportAll() {
    const o={globalkites:document.getElementById('export-globalkites')?.checked??true,contributions:document.getElementById('export-contributions')?.checked??true,external:document.getElementById('export-external')?.checked??true};
    window.LayerManager?.exportAll(o);
  },

  saveContributions() {
    const g=window.LayerManager?.getContributionsGeoJSON();
    if(g&&g.features.length>0){ const fn=`wom_contributions_${new Date().toISOString().split('T')[0]}.geojson`; Utils.downloadFile(JSON.stringify(g,null,2),fn); Utils.showToast(`Saved ${g.features.length} contributions`,'success'); }
    else Utils.showToast('No contributions to save','info');
  },

  async loadContributionsFile(e) {
    const f=e.target.files[0]; if(!f) return;
    try{ const g=await Utils.parseGeoJSONFile(f); window.LayerManager?.loadContributions(g); this.updateContributionsList(); Utils.showToast(`Loaded ${g.features.length} contributions`,'success'); }
    catch(err){ console.error(err); Utils.showToast('Failed: '+err.message,'error'); }
    e.target.value='';
  },

  clearContributions() { if(confirm('Clear all contributions?')){ window.LayerManager?.clearContributions(); this.updateContributionsList(); Utils.showToast('Cleared','info'); } },

  showFeatureInfo(f,id) {
    const p=document.getElementById('feature-info'), c=document.querySelector('.feature-info-content'); if(!p||!c) return;
    const pr=f.properties, co=f.geometry.coordinates, lat=co[1], lng=co[0];
    let h=`<h4>${pr.name||pr.ID||pr.id||'Unnamed Structure'}</h4><div class="meta">Layer: ${id} | ${Utils.formatCoords(lat,lng,6)}</div><div class="props">`;
    const skip=['_layer','_source_layer','_id','_osm_id','_osm_type','FID'];
    for(const [k,v] of Object.entries(pr)){ if(skip.includes(k)||v===null||v===undefined||v==='') continue; const l=k.replace(/_/g,' ').replace(/\b\w/g,x=>x.toUpperCase()); h+=`<div><span class="prop-label">${l}:</span><span class="prop-value">${v}</span></div>`; }
    h+='</div>'; c.innerHTML=h; p.hidden=false; this.featureInfoVisible=true;
  },

  hideFeatureInfo() { const p=document.getElementById('feature-info'); if(p){ p.hidden=true; this.featureInfoVisible=false; } },

  updateBasemapUI(b) { document.querySelectorAll('input[name="basemap"]').forEach(i=>i.checked=i.value===b); }
};

window.UIManager = UIManager;
