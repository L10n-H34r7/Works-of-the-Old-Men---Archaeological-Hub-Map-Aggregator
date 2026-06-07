/** Data layer management */

const LayerManager = {
  map: null, layers: {}, layerGroups: {}, visibleLayers: new Set(),
  filters: { type: 'all', region: 'all' }, featureCache: new Map(),
  loadingTimeouts: new Map(),

  layerDefinitions: {
    globalkites: {
      id: 'globalkites', name: 'GlobalKites - All Kites',
      sublayers: [
        { id: 'kites',     name: 'All Kites (6,721)',        file: 'data/globalkites/kites.geojson',      color: '#e74c3c', default: false },
        { id: 'openkites', name: 'Open Kites (862)',          file: 'data/globalkites/openkites.geojson',  color: '#e67e22', default: false },
        { id: 'sample610', name: 'Sample 610 (Detailed)',     file: 'data/globalkites/sample610.geojson',  color: '#f39c12', default: false },
        { id: 'vshaped',   name: 'V-Shaped (64)',             file: 'data/globalkites/vshaped.geojson',    color: '#c0392b', default: false },
        { id: 'crescents', name: 'Crescents (241)',           file: 'data/globalkites/crescents.geojson',  color: '#9b59b6', default: false },
        { id: 'rings',     name: 'Rings (62)',                file: 'data/globalkites/rings.geojson',      color: '#8e44ad', default: false }
      ]
    }
    // External sources removed — use zenodo.js for adding datasets
  },

  init(map) {
    this.map = map;
    this.createLayerGroups();
    this.setupLayerToggles();
    // No layers loaded automatically on init — user must check boxes
  },

  createLayerGroups() {
    this.layerDefinitions.globalkites.sublayers.forEach(d => {
      this.layerGroups[d.id] = L.featureGroup();
    });
    this.layerGroups.contributions = L.featureGroup();
  },

  setupLayerToggles() {
    const c = document.getElementById('globalkites-toggles');
    if (!c) return;
    this.layerDefinitions.globalkites.sublayers.forEach(d => {
      const l = document.createElement('label');
      l.className = 'layer-option';
      l.innerHTML = `<input type="checkbox" id="layer-${d.id}" value="${d.id}"><span class="option-label">${d.name}</span>`;
      c.appendChild(l);
      const input = l.querySelector('input');
      if (input) input.addEventListener('change', e => this.toggleLayer(d.id, e.target.checked));
      // All unchecked by default (d.default = false for all)
    });
  },

  async toggleLayer(id, vis) {
    const checkbox = document.getElementById(`layer-${id}`);
    if (vis) {
      this.visibleLayers.add(id);
      try {
        await this.loadLayer(id);
        this.map.addLayer(this.layerGroups[id]);
      } catch (e) {
        console.error(`Failed to load layer ${id}:`, e);
        Utils.showToast(`Failed to load ${id}: ${e.message}`, 'error');
        if (checkbox) checkbox.checked = false;
        this.visibleLayers.delete(id);
      }
    } else {
      this.visibleLayers.delete(id);
      if (this.layerGroups[id]) this.map.removeLayer(this.layerGroups[id]);
    }
    this.updateFeatureCounts();
    this.applyFilters();
  },

  async loadLayer(id) {
    if (this.layerGroups[id]?._loaded) return;
    this.showLoading(`Loading ${id}...`);
    const timeout = setTimeout(() => { this.hideLoading(); console.warn(`Load timeout for ${id}`); }, 20000);
    this.loadingTimeouts.set(id, timeout);
    try {
      let g;
      const def = this.layerDefinitions.globalkites.sublayers.find(d => d.id === id);
      if (def) g = await this.loadLocalGeoJSON(def.file);
      else throw new Error(`Unknown layer: ${id}`);

      if (g && g.features) {
        this.renderGeoJSON(id, g);
        this.layerGroups[id]._loaded = true;
        this.layerGroups[id]._geojson = g;
      } else {
        throw new Error('No features in GeoJSON');
      }
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

  renderGeoJSON(id, g, color) {
    const def = this.getLayerDef(id);
    const layerColor = color || def?.color || Utils.getTypeColor('other');
    const lg = this.layerGroups[id];

    const coordLookup = new Map();
    g.features.forEach(f => {
      if (f.geometry?.coordinates?.length >= 2) {
        const key = `${f.geometry.coordinates[0].toFixed(6)},${f.geometry.coordinates[1].toFixed(6)}`;
        coordLookup.set(key, f);
      }
    });

    L.geoJSON(g, {
      pointToLayer: (f, ll) => L.marker(ll, {
        icon: Utils.getMarkerIconColor(layerColor, id === 'contributions')
      }),
      onEachFeature: (f, layer) => {
        this.featureCache.set(L.stamp(layer), { layer, feature: f, layerId: id });
        layer.bindPopup(this.createPopupContent(f, id), { maxWidth: 300, className: 'custom-popup' });
        layer.on('click', e => { e.originalEvent?.stopPropagation(); window.UIManager?.showFeatureInfo(f, id); });
      },
      filter: f => this.shouldShowFeature(f, id)
    }).addTo(lg);

    lg.eachLayer(layer => {
      const stamp = L.stamp(layer);
      if (!this.featureCache.has(stamp)) {
        let lat, lng;
        if (typeof layer.getLatLng === 'function') {
          const ll = layer.getLatLng(); lat = ll.lat; lng = ll.lng;
        } else if (layer._latlng) {
          lat = layer._latlng.lat; lng = layer._latlng.lng;
        }
        if (lat !== undefined && lng !== undefined) {
          const key = `${lng.toFixed(6)},${lat.toFixed(6)}`;
          const feat = coordLookup.get(key);
          if (feat) this.featureCache.set(stamp, { layer, feature: feat, layerId: id });
        }
      }
    });
  },

  getLayerDef(id) {
    const s = this.layerDefinitions.globalkites.sublayers.find(d => d.id === id);
    if (s) return s;
    return null;
  },

  shouldShowFeature(f, id) {
    const p = f.properties;
    const t = p.type || p.structure_type || id;
    if (this.filters.type !== 'all') {
      if (this.filters.type === 'kite' && !['kite', 'open-kite', 'v-shaped'].includes(t)) return false;
      if (this.filters.type === 'funerary' && !['cairn', 'pendant', 'wheel', 'ring', 'crescent'].includes(t)) return false;
      if (this.filters.type === 'monumental' && !['mustatil', 'settlement', 'wall'].includes(t)) return false;
      if (!['kite', 'funerary', 'monumental'].includes(this.filters.type) && t !== this.filters.type) return false;
    }
    if (this.filters.region !== 'all') {
      const lat = f.geometry.coordinates[1], lng = f.geometry.coordinates[0];
      if (!this.checkRegion(lat, lng, this.filters.region)) return false;
    }
    return true;
  },

  checkRegion(lat, lng, r) {
    const reg = {
      jordan: { lat: [29, 33.5], lng: [34.5, 39.5] },
      saudi: { lat: [15.5, 32], lng: [34.5, 56] },
      yemen: { lat: [12, 19], lng: [42.5, 54.5] },
      oman: { lat: [16.5, 26.5], lng: [51.5, 59.5] },
      uae: { lat: [22.5, 26.5], lng: [51.5, 56.5] },
      syria: { lat: [32, 37.5], lng: [35.5, 42.5] },
      iraq: { lat: [29, 37.5], lng: [38.5, 48.5] },
      djibouti: { lat: [10.5, 12.5], lng: [41.5, 43.5] },
      ethiopia: { lat: [3, 15], lng: [33, 48] }
    };
    const rr = reg[r]; if (!rr) return true;
    return lat >= rr.lat[0] && lat <= rr.lat[1] && lng >= rr.lng[0] && lng <= rr.lng[1];
  },

  applyFilters() {
    this.featureCache.forEach(({ layer, feature, layerId }) => {
      const show = this.shouldShowFeature(feature, layerId);
      if (this.layerGroups[layerId]) {
        if (show && !this.layerGroups[layerId].hasLayer(layer)) this.layerGroups[layerId].addLayer(layer);
        else if (!show && this.layerGroups[layerId].hasLayer(layer)) this.layerGroups[layerId].removeLayer(layer);
      }
    });
    this.updateFeatureCounts();
  },

  setFilter(n, v) { this.filters[n] = v; this.applyFilters(); },

  updateFeatureCounts() {
    let gk = 0;
    this.layerDefinitions.globalkites.sublayers.forEach(d => {
      if (this.visibleLayers.has(d.id) && this.layerGroups[d.id]?._loaded)
        gk += this.layerGroups[d.id].getLayers().length;
    });
    const ge = document.getElementById('count-globalkites');
    if (ge) ge.textContent = Utils.formatNumber(gk);

    const cc = this.layerGroups.contributions?.getLayers().length || 0;
    const ce = document.getElementById('count-contributions');
    if (ce) ce.textContent = Utils.formatNumber(cc);

    this.updateExportLayerList();
  },

  updateExportLayerList() {
    const c = document.getElementById('export-layer-list');
    if (!c) return;
    c.innerHTML = '';
    this.layerDefinitions.globalkites.sublayers.forEach(d => {
      if (this.layerGroups[d.id]?._loaded) {
        const n = this.layerGroups[d.id].getLayers().length;
        if (n > 0) {
          const b = document.createElement('button');
          b.className = 'btn btn-small';
          b.style.justifyContent = 'space-between';
          b.innerHTML = `<span>${d.name}</span><span>${Utils.formatNumber(n)} features</span>`;
          b.onclick = () => this.exportLayer(d.id);
          c.appendChild(b);
        }
      }
    });
    // Zenodo layers
    if (window.ZenodoManager) {
      window.ZenodoManager.getLoadedLayers().forEach(layer => {
        if (this.layerGroups[layer.id]?._loaded) {
          const n = this.layerGroups[layer.id].getLayers().length;
          if (n > 0) {
            const b = document.createElement('button');
            b.className = 'btn btn-small';
            b.style.justifyContent = 'space-between';
            b.innerHTML = `<span>${layer.name}</span><span>${Utils.formatNumber(n)} features</span>`;
            b.onclick = () => this.exportLayer(layer.id);
            c.appendChild(b);
          }
        }
      });
    }
    const cn = this.layerGroups.contributions?.getLayers().length || 0;
    if (cn > 0) {
      const b = document.createElement('button');
      b.className = 'btn btn-small';
      b.style.justifyContent = 'space-between';
      b.innerHTML = `<span>My Contributions</span><span>${Utils.formatNumber(cn)} features</span>`;
      b.onclick = () => this.exportLayer('contributions');
      c.appendChild(b);
    }
  },

  exportLayer(id) {
    const f = [];
    this.layerGroups[id]?.eachLayer(l => {
      const s = L.stamp(l);
      const c = this.featureCache.get(s);
      if (c && c.feature) f.push(c.feature);
    });
    const g = { type: 'FeatureCollection', features: f };
    const fn = `wom_${id}_${new Date().toISOString().split('T')[0]}.geojson`;
    Utils.downloadFile(JSON.stringify(g, null, 2), fn);
    Utils.showToast(`Exported ${f.length} features`, 'success');
  },

  exportAll(o = {}) {
    const f = [];
    if (o.globalkites) {
      this.layerDefinitions.globalkites.sublayers.forEach(d => {
        if (this.visibleLayers.has(d.id) && this.layerGroups[d.id]?._loaded) {
          this.layerGroups[d.id].eachLayer(l => {
            const s = L.stamp(l); const c = this.featureCache.get(s);
            if (c && c.feature) f.push(c.feature);
          });
        }
      });
    }
    if (o.contributions) {
      this.layerGroups.contributions?.eachLayer(l => {
        const s = L.stamp(l); const c = this.featureCache.get(s);
        if (c && c.feature) f.push(c.feature);
      });
    }
    if (o.zenodo && window.ZenodoManager) {
      window.ZenodoManager.getLoadedLayers().forEach(layer => {
        if (this.layerGroups[layer.id]?._loaded) {
          this.layerGroups[layer.id].eachLayer(l => {
            const s = L.stamp(l); const c = this.featureCache.get(s);
            if (c && c.feature) f.push(c.feature);
          });
        }
      });
    }
    const g = { type: 'FeatureCollection', features: f };
    const fn = `wom_combined_${new Date().toISOString().split('T')[0]}.geojson`;
    Utils.downloadFile(JSON.stringify(g, null, 2), fn);
    Utils.showToast(`Exported ${f.length} features`, 'success');
  },

  createPopupContent(f, id) {
    const p = f.properties;
    const c = f.geometry?.coordinates || [0, 0];
    const lat = c[1], lng = c[0];
    let h = `<div class="popup-content"><h4>${p.name || p.ID || p.id || p.EAMENA_ID || 'Unnamed Structure'}</h4>`;
    h += `<p class="popup-meta"><strong>Type:</strong> ${Utils.getTypeDisplayName(p.type || id)}</p>`;
    if (p.subtype) h += `<p class="popup-meta"><strong>Subtype:</strong> ${p.subtype}</p>`;
    if (p.Length) h += `<p class="popup-meta"><strong>Length:</strong> ${p.Length} m</p>`;
    if (p.Orient) h += `<p class="popup-meta"><strong>Orientation:</strong> ${p.Orient}°</p>`;
    if (p.PitTraps) h += `<p class="popup-meta"><strong>Pit Traps:</strong> ${p.PitTraps}</p>`;
    if (p.description) h += `<p class="popup-meta"><strong>Description:</strong> ${p.description}</p>`;
    if (p.source) h += `<p class="popup-meta"><strong>Source:</strong> ${p.source}</p>`;
    if (p.contributor) h += `<p class="popup-meta"><strong>Contributor:</strong> ${p.contributor}</p>`;
    if (p.date_added) h += `<p class="popup-meta"><strong>Added:</strong> ${new Date(p.date_added).toLocaleDateString()}</p>`;
    h += `<p class="popup-coords">${Utils.formatCoords(lat, lng, 6)}</p></div>`;
    return h;
  },

  addContribution(f) {
    const lg = this.layerGroups.contributions;
    L.geoJSON(f, {
      pointToLayer: (feat, ll) => L.marker(ll, { icon: Utils.getMarkerIconColor('#f39c12', true) }),
      onEachFeature: (feat, layer) => {
        this.featureCache.set(L.stamp(layer), { layer, feature: feat, layerId: 'contributions' });
        layer.bindPopup(this.createPopupContent(feat, 'contributions'));
        layer.on('click', e => { e.originalEvent?.stopPropagation(); window.UIManager?.showFeatureInfo(feat, 'contributions'); });
      }
    }).addTo(lg);
    this.updateFeatureCounts();
  },

  removeContribution(id) {
    let rem = false;
    this.layerGroups.contributions?.eachLayer(l => {
      const s = L.stamp(l); const c = this.featureCache.get(s);
      if (c && c.feature.properties._id === id) {
        this.layerGroups.contributions.removeLayer(l);
        this.featureCache.delete(s);
        rem = true;
      }
    });
    if (rem) this.updateFeatureCounts();
    return rem;
  },

  clearContributions() {
    this.layerGroups.contributions?.clearLayers();
    this.featureCache.forEach((v, k) => { if (v.layerId === 'contributions') this.featureCache.delete(k); });
    this.updateFeatureCounts();
  },

  getContributionsGeoJSON() {
    const f = [];
    this.layerGroups.contributions?.eachLayer(l => {
      const s = L.stamp(l); const c = this.featureCache.get(s);
      if (c && c.feature) f.push(c.feature);
    });
    return { type: 'FeatureCollection', features: f };
  },

  loadContributions(g) {
    this.clearContributions();
    if (g && g.features) g.features.forEach(f => this.addContribution(f));
  },

  // Register an external layer group (from zenodo.js)
  registerExternalLayer(id, layerGroup) {
    this.layerGroups[id] = layerGroup;
    this.visibleLayers.add(id);
  },

  unregisterExternalLayer(id) {
    if (this.layerGroups[id]) {
      this.map.removeLayer(this.layerGroups[id]);
      // Remove from featureCache
      this.featureCache.forEach((v, k) => { if (v.layerId === id) this.featureCache.delete(k); });
      delete this.layerGroups[id];
    }
    this.visibleLayers.delete(id);
    this.updateFeatureCounts();
  },

  showLoading(t = 'Loading...') {
    const o = document.getElementById('loading-overlay'), te = document.getElementById('loading-text');
    if (o && te) { te.textContent = t; o.hidden = false; }
  },
  hideLoading() {
    const o = document.getElementById('loading-overlay');
    if (o) { o.hidden = true; o.style.display = 'none'; }
  }
};

window.LayerManager = LayerManager;
