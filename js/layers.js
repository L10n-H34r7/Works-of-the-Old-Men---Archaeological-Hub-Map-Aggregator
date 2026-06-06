/** Data layer management */

const LayerManager = {
  map: null, layers: {}, layerGroups: {}, visibleLayers: new Set(),
  filters: { type: 'all', region: 'all' }, featureCache: new Map(),
  loadingTimeouts: new Map(),

  layerDefinitions: {
    globalkites: {
      id: 'globalkites', name: 'GlobalKites - All Kites',
      sublayers: [
        { id: 'kites', name: 'All Kites (6,721)', file: 'data/globalkites/kites.geojson', color: '#e74c3c', default: true },
        { id: 'openkites', name: 'Open Kites (862)', file: 'data/globalkites/openkites.geojson', color: '#e67e22', default: true },
        { id: 'sample610', name: 'Sample 610 (Detailed)', file: 'data/globalkites/sample610.geojson', color: '#f39c12', default: false },
        { id: 'vshaped', name: 'V-Shaped (64)', file: 'data/globalkites/vshaped.geojson', color: '#c0392b', default: true },
        { id: 'crescents', name: 'Crescents (241)', file: 'data/globalkites/crescents.geojson', color: '#9b59b6', default: true },
        { id: 'rings', name: 'Rings (62)', file: 'data/globalkites/rings.geojson', color: '#8e44ad', default: true }
      ]
    },
    eamena: { id: 'eamena', name: 'EAMENA Heritage Places', color: '#27ae60', default: false },
    pleiades: { id: 'pleiades', name: 'Pleiades Ancient Places', color: '#2980b9', default: false },
    'osm-arch': { id: 'osm-arch', name: 'OSM Archaeological Sites', color: '#16a085', default: false }
  },

  init(map) {
    this.map = map; this.createLayerGroups(); this.setupLayerToggles(); this.loadInitialLayers();
  },

  createLayerGroups() {
    this.layerDefinitions.globalkites.sublayers.forEach(d => this.layerGroups[d.id] = L.featureGroup());
    this.layerGroups.eamena = L.featureGroup();
    this.layerGroups.pleiades = L.featureGroup();
    this.layerGroups['osm-arch'] = L.featureGroup();
    this.layerGroups.contributions = L.featureGroup();
  },

  setupLayerToggles() {
    const c = document.getElementById('globalkites-toggles');
    if (!c) return;
    this.layerDefinitions.globalkites.sublayers.forEach(d => {
      const l = document.createElement('label'); l.className = 'layer-option';
      l.innerHTML = `<input type="checkbox" id="layer-${d.id}" value="${d.id}" ${d.default?'checked':''}><span class="option-label">${d.name}</span>`;
      c.appendChild(l);
      const input = l.querySelector('input');
      if (input) input.addEventListener('change', e => this.toggleLayer(d.id, e.target.checked));
      if (d.default) this.visibleLayers.add(d.id);
    });
    ['eamena','pleiades','osm-arch'].forEach(id => {
      const i = document.getElementById(`layer-${id}`);
      if (i) i.addEventListener('change', e => this.toggleLayer(id, e.target.checked));
    });
  },

  async loadInitialLayers() {
    for (const d of this.layerDefinitions.globalkites.sublayers) {
      if (d.default) {
        try { await this.loadLayer(d.id); }
        catch (e) { console.warn(`Failed to load initial layer ${d.id}:`, e); }
      }
    }
    this.updateFeatureCounts();
  },

  async toggleLayer(id, vis) {
    const checkbox = document.getElementById(`layer-${id}`);
    if (vis) {
      this.visibleLayers.add(id);
      try { await this.loadLayer(id); this.map.addLayer(this.layerGroups[id]); }
      catch (e) { 
        console.error(`Failed to load layer ${id}:`, e);
        Utils.showToast(`Failed to load ${id}: ${e.message}`, 'error');
        if (checkbox) checkbox.checked = false;
        this.visibleLayers.delete(id);
      }
    } else {
      this.visibleLayers.delete(id);
      this.map.removeLayer(this.layerGroups[id]);
    }
    this.updateFeatureCounts(); this.applyFilters();
  },

  async loadLayer(id) {
    if (this.layerGroups[id]?._loaded) return;
    this.showLoading(`Loading ${id}...`);
    // Auto-hide loading after 15 seconds
    const timeout = setTimeout(() => this.hideLoading(), 15000);
    this.loadingTimeouts.set(id, timeout);
    try {
      let g;
      if (id === 'eamena') g = await this.loadEAMENA();
      else if (id === 'pleiades') g = await this.loadPleiades();
      else if (id === 'osm-arch') g = await this.loadOSMArchaeological();
      else {
        const def = this.layerDefinitions.globalkites.sublayers.find(d => d.id === id);
        if (def) g = await this.loadLocalGeoJSON(def.file);
        else throw new Error(`Unknown layer: ${id}`);
      }
      if (g && g.features) { this.renderGeoJSON(id, g); this.layerGroups[id]._loaded = true; this.layerGroups[id]._geojson = g; }
      else throw new Error('No features in GeoJSON');
    } catch (e) {
      console.error(`Failed to load layer ${id}:`, e);
      Utils.showToast(`Failed to load ${id}: ${e.message}`, 'error');
      throw e;
    } finally { 
      clearTimeout(this.loadingTimeouts.get(id));
      this.loadingTimeouts.delete(id);
      this.hideLoading(); 
    }
  },

  async loadLocalGeoJSON(url) { 
    const r = await fetch(url); 
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`); 
    return r.json(); 
  },

  async loadEAMENA() {
    const b = this.map.getBounds();
    const url = `https://database.eamena.org/api/search/export_results?format=geojson&map-filter={"type":"FeatureCollection","features":[{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[${b.getWest()},${b.getSouth()}],[${b.getEast()},${b.getSouth()}],[${b.getEast()},${b.getNorth()}],[${b.getWest()},${b.getNorth()}],[${b.getWest()},${b.getSouth()}]]]}}]}&resource-type-filter=[{"graphid":"34cfe98e-c2c0-11ea-9026-02e7594ce0a0","name":"Heritage Place","inverted":false}]`;
    const r = await fetch(url); if (!r.ok) throw new Error(`EAMENA ${r.status}`); return r.json();
  },

  async loadPleiades() {
    try { const r = await fetch('data/pleiades-subset.geojson'); if (r.ok) return r.json(); } catch(e) {}
    return { type: 'FeatureCollection', features: [] };
  },

  async loadOSMArchaeological() {
    const b = this.map.getBounds();
    const bbox = `${b.getSouth()},${b.getWest()},${b.getNorth()},${b.getEast()}`;
    const q = `[out:json][timeout:60];(node["historic"="archaeological_site"](${bbox});way["historic"="archaeological_site"](${bbox});relation["historic"="archaeological_site"](${bbox});node["historic"="tomb"](${bbox});way["historic"="tomb"](${bbox});node["historic"="cairn"](${bbox});node["historic"="monument"](${bbox}));out center;`;
    const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: `data=${encodeURIComponent(q)}`, headers: {'Content-Type':'application/x-www-form-urlencoded'} });
    if (!r.ok) throw new Error(`Overpass ${r.status}`);
    return this.overpassToGeoJSON(await r.json());
  },

  overpassToGeoJSON(d) {
    const f = [];
    for (const el of d.elements) {
      let c; if (el.type==='node') c=[el.lon,el.lat]; else if (el.center) c=[el.center.lon,el.center.lat]; else continue;
      f.push({ type:'Feature', geometry:{type:'Point',coordinates:c}, properties:{...el.tags,_osm_id:el.id,_osm_type:el.type} });
    }
    return { type:'FeatureCollection', features:f };
  },

  renderGeoJSON(id, g) {
    const def = this.getLayerDef(id); const color = def?.color || Utils.getTypeColor('other'); const lg = this.layerGroups[id];
    L.geoJSON(g, {
      pointToLayer: (f,ll) => L.marker(ll, { icon: Utils.getMarkerIcon(f.properties.type || f.properties.structure_type || id, id==='contributions') }),
      onEachFeature: (f,layer) => {
        this.featureCache.set(L.stamp(layer), { layer, feature:f, layerId:id });
        layer.bindPopup(this.createPopupContent(f,id), {maxWidth:300,className:'custom-popup'});
        layer.on('click', e => { e.originalEvent?.stopPropagation(); window.UIManager?.showFeatureInfo(f,id); });
      },
      filter: f => this.shouldShowFeature(f,id)
    }).addTo(lg);
    lg.eachLayer(layer => { const s=L.stamp(layer); if(!this.featureCache.has(s)){ const feat=g.features.find(f=>Math.abs(f.geometry.coordinates[1]-layer.getLatLng().lat)<1e-5&&Math.abs(f.geometry.coordinates[0]-layer.getLatLng().lng)<1e-5); if(feat) this.featureCache.set(s,{layer,feature:feat,layerId:id}); } });
  },

  getLayerDef(id) {
    const s = this.layerDefinitions.globalkites.sublayers.find(d=>d.id===id); if(s) return s;
    return this.layerDefinitions[id];
  },

  shouldShowFeature(f,id) {
    const p=f.properties; const t=p.type||p.structure_type||id;
    if(this.filters.type!=='all'){
      if(this.filters.type==='kite'&&!['kite','open-kite','v-shaped'].includes(t)) return false;
      if(this.filters.type==='funerary'&&!['cairn','pendant','wheel','ring','crescent'].includes(t)) return false;
      if(this.filters.type==='monumental'&&!['mustatil','settlement','wall'].includes(t)) return false;
      if(!['kite','funerary','monumental'].includes(this.filters.type)&&t!==this.filters.type) return false;
    }
    if(this.filters.region!=='all'){
      const lat=f.geometry.coordinates[1], lng=f.geometry.coordinates[0];
      if(!this.checkRegion(lat,lng,this.filters.region)) return false;
    }
    return true;
  },

  checkRegion(lat,lng,r) {
    const reg={jordan:{lat:[29,33.5],lng:[34.5,39.5]},saudi:{lat:[15.5,32],lng:[34.5,56]},yemen:{lat:[12,19],lng:[42.5,54.5]},oman:{lat:[16.5,26.5],lng:[51.5,59.5]},uae:{lat:[22.5,26.5],lng:[51.5,56.5]},syria:{lat:[32,37.5],lng:[35.5,42.5]},iraq:{lat:[29,37.5],lng:[38.5,48.5]},djibouti:{lat:[10.5,12.5],lng:[41.5,43.5]},ethiopia:{lat:[3,15],lng:[33,48]}};
    const rr=reg[r]; if(!rr) return true;
    return lat>=rr.lat[0]&&lat<=rr.lat[1]&&lng>=rr.lng[0]&&lng<=rr.lng[1];
  },

  applyFilters() {
    this.featureCache.forEach(({layer,feature,layerId}) => {
      const show=this.shouldShowFeature(feature,layerId);
      if(show&&!this.map.hasLayer(layer)) this.layerGroups[layerId].addLayer(layer);
      else if(!show&&this.map.hasLayer(layer)) this.layerGroups[layerId].removeLayer(layer);
    });
    this.updateFeatureCounts();
  },

  setFilter(n,v){ this.filters[n]=v; this.applyFilters(); },

  updateFeatureCounts() {
    let gk=0; this.layerDefinitions.globalkites.sublayers.forEach(d=>{ if(this.visibleLayers.has(d.id)&&this.layerGroups[d.id]?._loaded) gk+=this.layerGroups[d.id].getLayers().length; });
    const ge=document.getElementById('count-globalkites'); if(ge) ge.textContent=Utils.formatNumber(gk);
    const cc=this.layerGroups.contributions?.getLayers().length || 0; const ce=document.getElementById('count-contributions'); if(ce) ce.textContent=Utils.formatNumber(cc);
    this.updateExportLayerList();
  },

  updateExportLayerList() {
    const c=document.getElementById('export-layer-list'); if(!c) return; c.innerHTML='';
    this.layerDefinitions.globalkites.sublayers.forEach(d=>{ if(this.layerGroups[d.id]?._loaded){ const n=this.layerGroups[d.id].getLayers().length; if(n>0){ const b=document.createElement('button'); b.className='btn btn-small'; b.style.justifyContent='space-between'; b.innerHTML=`<span>${d.name}</span><span>${Utils.formatNumber(n)} features</span>`; b.onclick=()=>this.exportLayer(d.id); c.appendChild(b); } } });
    ['eamena','pleiades','osm-arch'].forEach(id=>{ if(this.layerGroups[id]?._loaded){ const n=this.layerGroups[id].getLayers().length; if(n>0){ const d=this.layerDefinitions[id]; const b=document.createElement('button'); b.className='btn btn-small'; b.style.justifyContent='space-between'; b.innerHTML=`<span>${d.name}</span><span>${Utils.formatNumber(n)} features</span>`; b.onclick=()=>this.exportLayer(id); c.appendChild(b); } } });
    const cn=this.layerGroups.contributions?.getLayers().length || 0; if(cn>0){ const b=document.createElement('button'); b.className='btn btn-small'; b.style.justifyContent='space-between'; b.innerHTML=`<span>My Contributions</span><span>${Utils.formatNumber(cn)} features</span>`; b.onclick=()=>this.exportLayer('contributions'); c.appendChild(b); }
  },

  exportLayer(id) {
    const f=[]; this.layerGroups[id]?.eachLayer(l=>{ const s=L.stamp(l); const c=this.featureCache.get(s); if(c&&c.feature) f.push(c.feature); });
    const g={type:'FeatureCollection',features:f}; const fn=`wom_${id}_${new Date().toISOString().split('T')[0]}.geojson`; Utils.downloadFile(JSON.stringify(g,null,2),fn); Utils.showToast(`Exported ${f.length} features`,'success');
  },

  exportAll(o={}) {
    const f=[];
    if(o.globalkites) this.layerDefinitions.globalkites.sublayers.forEach(d=>{ if(this.visibleLayers.has(d.id)&&this.layerGroups[d.id]?._loaded) this.layerGroups[d.id].eachLayer(l=>{ const s=L.stamp(l); const c=this.featureCache.get(s); if(c&&c.feature) f.push(c.feature); }); });
    if(o.contributions) this.layerGroups.contributions?.eachLayer(l=>{ const s=L.stamp(l); const c=this.featureCache.get(s); if(c&&c.feature) f.push(c.feature); });
    if(o.external) ['eamena','pleiades','osm-arch'].forEach(id=>{ if(this.visibleLayers.has(id)&&this.layerGroups[id]?._loaded) this.layerGroups[id].eachLayer(l=>{ const s=L.stamp(l); const c=this.featureCache.get(s); if(c&&c.feature) f.push(c.feature); }); });
    const g={type:'FeatureCollection',features:f}; const fn=`wom_combined_${new Date().toISOString().split('T')[0]}.geojson`; Utils.downloadFile(JSON.stringify(g,null,2),fn); Utils.showToast(`Exported ${f.length} features`,'success');
  },

  createPopupContent(f,id) {
    const p=f.properties; const c=f.geometry.coordinates; const lat=c[1],lng=c[0];
    let h=`<div class="popup-content"><h4>${p.name||p.ID||p.id||'Unnamed Structure'}</h4><p class="popup-meta"><strong>Type:</strong> ${Utils.getTypeDisplayName(p.type||id)}</p>`;
    if(p.subtype) h+=`<p class="popup-meta"><strong>Subtype:</strong> ${p.subtype}</p>`;
    if(p.Length) h+=`<p class="popup-meta"><strong>Length:</strong> ${p.Length} m</p>`;
    if(p.Orient) h+=`<p class="popup-meta"><strong>Orientation:</strong> ${p.Orient}°</p>`;
    if(p.PitTraps) h+=`<p class="popup-meta"><strong>Pit Traps:</strong> ${p.PitTraps}</p>`;
    if(p.description) h+=`<p class="popup-meta"><strong>Description:</strong> ${p.description}</p>`;
    if(p.source) h+=`<p class="popup-meta"><strong>Source:</strong> ${p.source}</p>`;
    if(p.contributor) h+=`<p class="popup-meta"><strong>Contributor:</strong> ${p.contributor}</p>`;
    if(p.date_added) h+=`<p class="popup-meta"><strong>Added:</strong> ${new Date(p.date_added).toLocaleDateString()}</p>`;
    h+=`<p class="popup-coords">${Utils.formatCoords(lat,lng,6)}</p></div>`;
    return h;
  },

  addContribution(f) {
    const lg=this.layerGroups.contributions;
    L.geoJSON(f,{pointToLayer:(feat,ll)=>L.marker(ll,{icon:Utils.getMarkerIcon(feat.properties.type,true)}),onEachFeature:(feat,layer)=>{ this.featureCache.set(L.stamp(layer),{layer,feature:feat,layerId:'contributions'}); layer.bindPopup(this.createPopupContent(feat,'contributions')); layer.on('click',e=>{e.originalEvent?.stopPropagation();window.UIManager?.showFeatureInfo(feat,'contributions');}); }}).addTo(lg);
    this.updateFeatureCounts();
  },

  removeContribution(id) {
    let rem=false; this.layerGroups.contributions?.eachLayer(l=>{ const s=L.stamp(l); const c=this.featureCache.get(s); if(c&&c.feature.properties._id===id){ this.layerGroups.contributions.removeLayer(l); this.featureCache.delete(s); rem=true; } });
    if(rem) this.updateFeatureCounts(); return rem;
  },

  clearContributions() { this.layerGroups.contributions?.clearLayers(); this.featureCache.forEach((v,k)=>{ if(v.layerId==='contributions') this.featureCache.delete(k); }); this.updateFeatureCounts(); },

  getContributionsGeoJSON() { const f=[]; this.layerGroups.contributions?.eachLayer(l=>{ const s=L.stamp(l); const c=this.featureCache.get(s); if(c&&c.feature) f.push(c.feature); }); return {type:'FeatureCollection',features:f}; },

  loadContributions(g) { this.clearContributions(); if(g&&g.features) g.features.forEach(f=>this.addContribution(f)); },

  showLoading(t='Loading...') { const o=document.getElementById('loading-overlay'), te=document.getElementById('loading-text'); if(o&&te){ te.textContent=t; o.hidden=false; } },
  hideLoading() { const o=document.getElementById('loading-overlay'); if(o) o.hidden=true; }
};

window.LayerManager = LayerManager;
