/** Data layer management */

const LayerManager = {
  map: null,
  layerGroups: {},      // id -> L.featureGroup
  visibleLayers: new Set(),
  featureCache: new Map(), // stamp -> {layer, feature, layerId}
  importedLayers: [],   // [{id, name, color, count}]
  _importCounter: 0,

  // Static dataset definitions — add new datasets here by adding entries
  datasetDefs: [
    {
      id: 'globalkites',
      name: 'GlobalKites',
      attribution: '<a href="https://doi.org/10.5281/zenodo.14844953" target="_blank" rel="noopener">Barge et al. (2024)</a> · CC BY 4.0 · 6,721+ kites',
      color: null, // per-sublayer
      sublayers: [
        { id: 'kites',     name: 'All Kites (6,721)',    file: 'data/globalkites/kites.geojson',     color: '#e74c3c' },
        { id: 'openkites', name: 'Open Kites (862)',     file: 'data/globalkites/openkites.geojson', color: '#e67e22' },
        { id: 'sample610', name: 'Sample 610 (Detail)', file: 'data/globalkites/sample610.geojson', color: '#f39c12' },
        { id: 'vshaped',   name: 'V-Shaped (64)',        file: 'data/globalkites/vshaped.geojson',   color: '#c0392b' },
        { id: 'crescents', name: 'Crescents (241)',      file: 'data/globalkites/crescents.geojson', color: '#9b59b6' },
        { id: 'rings',     name: 'Rings (62)',            file: 'data/globalkites/rings.geojson',     color: '#8e44ad' }
      ]
    }
    // Add more static datasets here as objects with id, name, sublayers or file
  ],

  init(map) {
    this.map = map;
    // Create contribution group
    this.layerGroups['contributions'] = L.featureGroup().addTo(map);
    // Build the layer tree UI
    this._buildDatasetTree();
  },

  // ─── UI TREE ─────────────────────────────────────────────

  _buildDatasetTree() {
    this.datasetDefs.forEach(ds => {
      if (ds.sublayers) {
        // Create a layer group per sublayer
        ds.sublayers.forEach(sl => {
          this.layerGroups[sl.id] = L.featureGroup();
        });
        // Build sublayer checkboxes
        const container = document.getElementById('globalkites-toggles');
        if (!container) return;
        container.innerHTML = '';
        ds.sublayers.forEach(sl => {
          const lbl = document.createElement('label');
          lbl.className = 'sublayer-option';
          lbl.innerHTML = `
            <input type="checkbox" id="layer-${sl.id}" value="${sl.id}">
            <span class="sublayer-dot" style="background:${sl.color}"></span>
            <span>${sl.name}</span>`;
          container.appendChild(lbl);
          const cb = lbl.querySelector('input');
          cb.addEventListener('change', e => this.toggleLayer(sl.id, e.target.checked, sl.file, sl.color));
        });
      }
    });

    // Dataset group toggle (expand/collapse)
    const hdr = document.getElementById('toggle-globalkites');
    const body = document.getElementById('body-globalkites');
    if (hdr && body) {
      hdr.addEventListener('click', () => {
        const open = body.style.display !== 'none';
        body.style.display = open ? 'none' : '';
        hdr.querySelector('.dataset-arrow').textContent = open ? '▶' : '▼';
        hdr.setAttribute('aria-expanded', String(!open));
      });
    }
  },

  // ─── TOGGLE / LOAD ───────────────────────────────────────

  async toggleLayer(id, visible, fileUrl, color) {
    if (visible) {
      this.visibleLayers.add(id);
      if (!this.layerGroups[id]) this.layerGroups[id] = L.featureGroup();
      if (!this.layerGroups[id]._loaded) {
        try {
          this._showLoading(`Loading ${id}…`);
          const geojson = await this._fetchLocal(fileUrl);
          this._renderGeoJSON(id, geojson, color);
          this.layerGroups[id]._loaded = true;
        } catch (e) {
          console.error('toggleLayer error:', e);
          Utils.showToast(`Failed to load ${id}: ${e.message}`, 'error');
          document.getElementById(`layer-${id}`) && (document.getElementById(`layer-${id}`).checked = false);
          this.visibleLayers.delete(id);
          this._hideLoading();
          return;
        } finally { this._hideLoading(); }
      }
      this.map.addLayer(this.layerGroups[id]);
    } else {
      this.visibleLayers.delete(id);
      if (this.layerGroups[id]) this.map.removeLayer(this.layerGroups[id]);
    }
    this._updateCounts();
    this._updateExportList();
  },

  // ─── IMPORT LAYER (file or URL) ──────────────────────────

  async importGeoJSON(geojson, name, color) {
    const id = `imported_${++this._importCounter}`;
    color = color || '#3498db';

    if (!geojson || !geojson.features || geojson.features.length === 0)
      throw new Error('GeoJSON has no features');

    // Only keep features with geometry
    const valid = geojson.features.filter(f => f && f.geometry);
    if (valid.length === 0) throw new Error('No valid geometries found');

    geojson = { type: 'FeatureCollection', features: valid };

    const lg = L.featureGroup();
    this.layerGroups[id] = lg;
    lg._loaded = true;
    lg._geojson = geojson;

    this._renderGeoJSON(id, geojson, color);
    this.map.addLayer(lg);
    this.visibleLayers.add(id);

    // Zoom to layer
    try {
      const bounds = lg.getBounds();
      if (bounds && bounds.isValid()) MapManager.fitBounds(bounds);
    } catch(e) {}

    const count = valid.length;
    this.importedLayers.push({ id, name, color, count });

    // Inject into the Layers panel dataset tree
    this._addImportedToTree(id, name, color, count);
    this._updateCounts();
    this._updateExportList();

    Utils.showToast(`Loaded "${name}" — ${Utils.formatNumber(count)} features`, 'success');
    return id;
  },

  _addImportedToTree(id, name, color, count) {
    const container = document.getElementById('imported-datasets');
    if (!container) return;

    const group = document.createElement('div');
    group.className = 'dataset-group';
    group.id = `imported-group-${id}`;
    group.innerHTML = `
      <div class="dataset-header imported-header">
        <span class="sublayer-dot" style="background:${color}"></span>
        <label class="sublayer-option" style="flex:1;margin:0;cursor:pointer;">
          <input type="checkbox" id="layer-${id}" checked>
          <span style="font-weight:500;">${name}</span>
          <span class="feature-count" style="margin-left:auto;">${Utils.formatNumber(count)}</span>
        </label>
        <button class="remove-layer-btn" data-id="${id}" title="Remove layer">✕</button>
      </div>`;
    container.appendChild(group);

    // Toggle visibility
    group.querySelector(`#layer-${id}`).addEventListener('change', e => {
      const lg = this.layerGroups[id];
      if (!lg) return;
      if (e.target.checked) { this.map.addLayer(lg); this.visibleLayers.add(id); }
      else { this.map.removeLayer(lg); this.visibleLayers.delete(id); }
      this._updateCounts();
    });

    // Remove layer
    group.querySelector('.remove-layer-btn').addEventListener('click', () => {
      this._removeImportedLayer(id);
    });
  },

  _removeImportedLayer(id) {
    if (this.layerGroups[id]) {
      this.map.removeLayer(this.layerGroups[id]);
      // Clean featureCache
      this.featureCache.forEach((v, k) => { if (v.layerId === id) this.featureCache.delete(k); });
      delete this.layerGroups[id];
    }
    this.visibleLayers.delete(id);
    this.importedLayers = this.importedLayers.filter(l => l.id !== id);
    const el = document.getElementById(`imported-group-${id}`);
    if (el) el.remove();
    this._updateCounts();
    this._updateExportList();
    Utils.showToast('Layer removed', 'info');
  },

  // ─── RENDER GEOJSON ──────────────────────────────────────

  _renderGeoJSON(id, geojson, color) {
    const lg = this.layerGroups[id];
    if (!lg) return;
    color = color || '#3498db';

    L.geoJSON(geojson, {
      pointToLayer: (f, ll) => L.marker(ll, { icon: Utils.makeIcon(color) }),
      style: () => ({ color, weight: 2, opacity: 0.85, fillColor: color, fillOpacity: 0.25 }),
      onEachFeature: (f, layer) => {
        const stamp = L.stamp(layer);
        this.featureCache.set(stamp, { layer, feature: f, layerId: id });
        layer.bindPopup(() => this._popupHTML(f, id), { maxWidth: 320, className: 'custom-popup' });
        layer.on('click', e => {
          e.originalEvent?.stopPropagation();
          window.UIManager?.showFeatureInfo(f, id);
        });
      }
    }).addTo(lg);
  },

  _popupHTML(f, id) {
    const p = f.properties || {};
    const coords = f.geometry?.type === 'Point' ? f.geometry.coordinates : null;
    const name = p.name || p.Name || p.NAME || p.id || p.ID || p.EAMENA_ID || p.site_name || 'Unnamed';
    let h = `<div class="popup-content"><h4>${name}</h4>`;
    const skip = ['_layer','_source_layer','_id','FID','OBJECTID'];
    let shown = 0;
    for (const [k,v] of Object.entries(p)) {
      if (skip.includes(k) || v === null || v === undefined || v === '' || v === 'None') continue;
      if (shown >= 8) { h += `<p style="color:#999;font-size:.7rem">…more fields</p>`; break; }
      const label = k.replace(/_/g,' ').replace(/\b\w/g,x=>x.toUpperCase());
      h += `<p class="popup-meta"><strong>${label}:</strong> ${v}</p>`;
      shown++;
    }
    if (coords) h += `<p class="popup-coords">${Utils.formatCoords(coords[1],coords[0],6)}</p>`;
    h += '</div>';
    return h;
  },

  // ─── CONTRIBUTIONS ───────────────────────────────────────

  addContribution(feature) {
    const lg = this.layerGroups['contributions'];
    const color = '#f39c12';
    L.geoJSON(feature, {
      pointToLayer: (f, ll) => L.marker(ll, { icon: Utils.makeIcon(color, true) }),
      onEachFeature: (f, layer) => {
        const stamp = L.stamp(layer);
        this.featureCache.set(stamp, { layer, feature: f, layerId: 'contributions' });
        layer.bindPopup(() => this._popupHTML(f, 'contributions'), { maxWidth: 320, className: 'custom-popup' });
        layer.on('click', e => { e.originalEvent?.stopPropagation(); window.UIManager?.showFeatureInfo(f, 'contributions'); });
      }
    }).addTo(lg);
    this._updateCounts();
  },

  removeContribution(id) {
    let removed = false;
    this.layerGroups['contributions']?.eachLayer(l => {
      const s = L.stamp(l), c = this.featureCache.get(s);
      if (c && c.feature.properties._id === id) {
        this.layerGroups['contributions'].removeLayer(l);
        this.featureCache.delete(s);
        removed = true;
      }
    });
    if (removed) this._updateCounts();
    return removed;
  },

  clearContributions() {
    this.layerGroups['contributions']?.clearLayers();
    this.featureCache.forEach((v,k) => { if (v.layerId === 'contributions') this.featureCache.delete(k); });
    this._updateCounts();
  },

  getContributionsGeoJSON() {
    const features = [];
    this.layerGroups['contributions']?.eachLayer(l => {
      const c = this.featureCache.get(L.stamp(l));
      if (c?.feature) features.push(c.feature);
    });
    return { type: 'FeatureCollection', features };
  },

  loadContributions(g) {
    this.clearContributions();
    if (g?.features) g.features.forEach(f => this.addContribution(f));
  },

  // ─── EXPORT ──────────────────────────────────────────────

  exportAll(opts = {}) {
    const features = [];
    if (opts.globalkites) {
      this.datasetDefs[0].sublayers.forEach(sl => {
        if (this.visibleLayers.has(sl.id) && this.layerGroups[sl.id]?._loaded) {
          this.layerGroups[sl.id].eachLayer(l => {
            const c = this.featureCache.get(L.stamp(l)); if (c?.feature) features.push(c.feature);
          });
        }
      });
    }
    if (opts.contributions) {
      this.layerGroups['contributions']?.eachLayer(l => {
        const c = this.featureCache.get(L.stamp(l)); if (c?.feature) features.push(c.feature);
      });
    }
    if (opts.imported) {
      this.importedLayers.forEach(il => {
        if (this.layerGroups[il.id]?._loaded) {
          this.layerGroups[il.id].eachLayer(l => {
            const c = this.featureCache.get(L.stamp(l)); if (c?.feature) features.push(c.feature);
          });
        }
      });
    }
    const g = { type: 'FeatureCollection', features };
    Utils.downloadFile(JSON.stringify(g, null, 2), `wom_export_${new Date().toISOString().split('T')[0]}.geojson`);
    Utils.showToast(`Exported ${features.length} features`, 'success');
  },

  exportLayer(id) {
    const features = [];
    this.layerGroups[id]?.eachLayer(l => {
      const c = this.featureCache.get(L.stamp(l)); if (c?.feature) features.push(c.feature);
    });
    Utils.downloadFile(JSON.stringify({ type:'FeatureCollection', features }, null, 2), `wom_${id}_${new Date().toISOString().split('T')[0]}.geojson`);
    Utils.showToast(`Exported ${features.length} features`, 'success');
  },

  // ─── COUNTS & EXPORT LIST ────────────────────────────────

  _updateCounts() {
    // GlobalKites
    let gkCount = 0;
    this.datasetDefs[0].sublayers.forEach(sl => {
      if (this.visibleLayers.has(sl.id) && this.layerGroups[sl.id]?._loaded)
        gkCount += this.layerGroups[sl.id].getLayers().length;
    });
    const gkEl = document.getElementById('count-globalkites');
    if (gkEl) gkEl.textContent = Utils.formatNumber(gkCount);

    // Contributions
    const contribEl = document.getElementById('count-contributions');
    if (contribEl) contribEl.textContent = Utils.formatNumber(this.layerGroups['contributions']?.getLayers().length || 0);

    this._updateExportList();
  },

  _updateExportList() {
    const c = document.getElementById('export-layer-list');
    if (!c) return;
    c.innerHTML = '';

    const addBtn = (name, id) => {
      const n = this.layerGroups[id]?.getLayers().length || 0;
      if (n === 0) return;
      const b = document.createElement('button');
      b.className = 'btn btn-small export-layer-btn';
      b.innerHTML = `<span>${name}</span><span class="feature-count">${Utils.formatNumber(n)}</span>`;
      b.onclick = () => this.exportLayer(id);
      c.appendChild(b);
    };

    this.datasetDefs[0].sublayers.forEach(sl => {
      if (this.layerGroups[sl.id]?._loaded) addBtn(sl.name, sl.id);
    });
    this.importedLayers.forEach(il => addBtn(il.name, il.id));
    addBtn('My Contributions', 'contributions');
  },

  // ─── HELPERS ─────────────────────────────────────────────

  async _fetchLocal(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
    return r.json();
  },

  _showLoading(t = 'Loading…') {
    const o = document.getElementById('loading-overlay'), te = document.getElementById('loading-text');
    if (o && te) { te.textContent = t; o.hidden = false; o.style.cssText = ''; }
  },
  _hideLoading() {
    const o = document.getElementById('loading-overlay');
    if (o) { o.hidden = true; o.style.display = 'none'; }
  }
};

window.LayerManager = LayerManager;
