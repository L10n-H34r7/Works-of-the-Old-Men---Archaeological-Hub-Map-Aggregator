/**
 * LayerManager
 * Reads data/datasets.json on startup and builds the collapsible dataset tree.
 * To add a new dataset: add a subfolder under data/ and add an entry to datasets.json.
 */

const LayerManager = {
  map: null,
  layerGroups: {},       // layerId -> L.featureGroup
  visibleLayers: new Set(),
  featureCache: new Map(), // L.stamp -> { layer, feature, layerId }
  datasets: [],          // loaded from datasets.json
  importedLayers: [],    // runtime-imported: { id, name, color, count }
  _importCounter: 0,

  // ─── INIT ─────────────────────────────────────────────────

  async init(map) {
    this.map = map;
    this.layerGroups['contributions'] = L.featureGroup().addTo(map);

    try {
      const resp = await fetch('data/datasets.json');
      if (!resp.ok) throw new Error('datasets.json not found');
      this.datasets = await resp.json();
    } catch(e) {
      console.warn('Could not load datasets.json, using empty dataset list:', e.message);
      this.datasets = [];
    }

    this._buildDatasetTree();
  },

  // ─── BUILD LAYERS PANEL TREE ──────────────────────────────

  _buildDatasetTree() {
    const container = document.getElementById('dataset-tree');
    if (!container) return;
    container.innerHTML = '';

    this.datasets.forEach(ds => {
      // Pre-create featureGroups for all sublayers
      if (ds.sublayers) {
        ds.sublayers.forEach(sl => {
          if (!this.layerGroups[sl.id]) this.layerGroups[sl.id] = L.featureGroup();
        });
      }

      const group = this._makeDatasetGroup(ds);
      container.appendChild(group);
    });
  },

  _makeDatasetGroup(ds) {
    const wrap = document.createElement('div');
    wrap.className = 'dataset-group';
    wrap.id = `ds-group-${ds.id}`;

    // Header button
    const hdr = document.createElement('button');
    hdr.className = 'dataset-header';
    hdr.setAttribute('aria-expanded', 'false');
    hdr.innerHTML = `
      <span class="dataset-arrow">▶</span>
      <span class="dataset-name">${ds.name}</span>
      <span class="feature-count" id="count-${ds.id}">0</span>`;
    wrap.appendChild(hdr);

    // Body (sublayers)
    const body = document.createElement('div');
    body.className = 'dataset-body';
    body.style.display = 'none';

    if (ds.attribution) {
      const attr = document.createElement('p');
      attr.className = 'layer-attribution';
      attr.innerHTML = ds.attribution;
      body.appendChild(attr);
    }

    const list = document.createElement('div');
    list.className = 'sublayer-list';

    if (ds.sublayers) {
      ds.sublayers.forEach(sl => {
        const lbl = this._makeSublayerLabel(sl, ds.id);
        list.appendChild(lbl);
      });
    }
    body.appendChild(list);
    wrap.appendChild(body);

    // Toggle expand/collapse
    hdr.addEventListener('click', () => {
      const open = body.style.display !== 'none';
      body.style.display = open ? 'none' : '';
      hdr.setAttribute('aria-expanded', String(!open));
      hdr.querySelector('.dataset-arrow').textContent = open ? '▶' : '▼';
    });

    return wrap;
  },

  _makeSublayerLabel(sl, dsId) {
    const lbl = document.createElement('label');
    lbl.className = 'sublayer-option';
    lbl.innerHTML = `
      <input type="checkbox" id="layer-${sl.id}">
      <span class="sublayer-dot" style="background:${sl.color}"></span>
      <span class="sublayer-name">${sl.name}</span>`;

    const cb = lbl.querySelector('input');
    cb.addEventListener('change', e => {
      this.toggleLayer(sl.id, e.target.checked, sl.file, sl.color, dsId);
    });
    return lbl;
  },

  // ─── TOGGLE / LOAD ────────────────────────────────────────

  async toggleLayer(id, visible, fileUrl, color, dsId) {
    if (visible) {
      this.visibleLayers.add(id);
      if (!this.layerGroups[id]) this.layerGroups[id] = L.featureGroup();

      if (!this.layerGroups[id]._loaded) {
        this._showLoading(`Loading ${id}…`);
        try {
          const geojson = await this._fetchLocal(fileUrl);
          this._renderGeoJSON(id, geojson, color);
          this.layerGroups[id]._loaded = true;
        } catch(e) {
          console.error('toggleLayer error:', e);
          Utils.showToast(`Failed to load: ${e.message}`, 'error');
          const cb = document.getElementById(`layer-${id}`);
          if (cb) cb.checked = false;
          this.visibleLayers.delete(id);
          this._hideLoading();
          return;
        } finally {
          this._hideLoading();
        }
      }
      this.map.addLayer(this.layerGroups[id]);
    } else {
      this.visibleLayers.delete(id);
      if (this.layerGroups[id]) this.map.removeLayer(this.layerGroups[id]);
    }

    this._updateDatasetCount(dsId);
    this._updateExportList();
  },

  // ─── IMPORT (file upload) ─────────────────────────────────

  async importGeoJSON(geojson, name, color) {
    color = color || '#3498db';

    const valid = (geojson.features || []).filter(f => f && f.geometry);
    if (!valid.length) throw new Error('No valid geometries found');
    geojson = { type: 'FeatureCollection', features: valid };

    const id = `imported_${++this._importCounter}`;
    const lg = L.featureGroup();
    this.layerGroups[id] = lg;
    lg._loaded = true;
    lg._geojson = geojson;

    this._renderGeoJSON(id, geojson, color);
    this.map.addLayer(lg);
    this.visibleLayers.add(id);

    // Zoom to layer
    try { const b = lg.getBounds(); if (b?.isValid()) MapManager.fitBounds(b); } catch(e) {}

    const count = valid.length;
    this.importedLayers.push({ id, name, color, count });

    this._addImportedToTree(id, name, color, count);
    this._updateExportList();
    Utils.showToast(`Loaded "${name}" — ${Utils.formatNumber(count)} features`, 'success');
    return id;
  },

  _addImportedToTree(id, name, color, count) {
    const container = document.getElementById('imported-datasets');
    if (!container) return;

    const wrap = document.createElement('div');
    wrap.className = 'dataset-group imported-dataset-group';
    wrap.id = `ds-group-${id}`;
    wrap.innerHTML = `
      <div class="dataset-header imported-header" style="cursor:default;">
        <span class="sublayer-dot" style="background:${color};width:10px;height:10px;flex-shrink:0;border-radius:50%;border:1px solid rgba(0,0,0,.15);"></span>
        <label class="sublayer-option" style="flex:1;border:none;padding:0;margin:0;cursor:pointer;background:transparent;">
          <input type="checkbox" id="layer-${id}" checked style="margin:0;">
          <span class="sublayer-name" style="font-weight:600;">${name}</span>
        </label>
        <span class="feature-count">${Utils.formatNumber(count)}</span>
        <button class="remove-layer-btn" data-remove="${id}" title="Remove layer">✕</button>
      </div>`;

    container.appendChild(wrap);

    wrap.querySelector(`#layer-${id}`).addEventListener('change', e => {
      const lg = this.layerGroups[id];
      if (!lg) return;
      if (e.target.checked) { this.map.addLayer(lg); this.visibleLayers.add(id); }
      else { this.map.removeLayer(lg); this.visibleLayers.delete(id); }
    });

    wrap.querySelector('[data-remove]').addEventListener('click', () => this._removeImported(id));
  },

  _removeImported(id) {
    if (this.layerGroups[id]) {
      this.map.removeLayer(this.layerGroups[id]);
      this.featureCache.forEach((v, k) => { if (v.layerId === id) this.featureCache.delete(k); });
      delete this.layerGroups[id];
    }
    this.visibleLayers.delete(id);
    this.importedLayers = this.importedLayers.filter(l => l.id !== id);
    document.getElementById(`ds-group-${id}`)?.remove();
    this._updateExportList();
    Utils.showToast('Layer removed', 'info');
  },

  // ─── RENDER ───────────────────────────────────────────────

  _renderGeoJSON(id, geojson, color) {
    const lg = this.layerGroups[id];
    if (!lg) return;
    color = color || '#3498db';

    L.geoJSON(geojson, {
      pointToLayer: (f, ll) => L.marker(ll, { icon: Utils.makeIcon(color) }),
      style: () => ({ color, weight: 2, opacity: .85, fillColor: color, fillOpacity: .25 }),
      onEachFeature: (f, layer) => {
        this.featureCache.set(L.stamp(layer), { layer, feature: f, layerId: id });
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
    for (const [k, v] of Object.entries(p)) {
      if (skip.includes(k) || v === null || v === undefined || v === '' || v === 'None') continue;
      if (shown >= 8) { h += `<p style="color:#999;font-size:.7rem">…more fields</p>`; break; }
      h += `<p class="popup-meta"><strong>${k.replace(/_/g,' ').replace(/\b\w/g,x=>x.toUpperCase())}:</strong> ${v}</p>`;
      shown++;
    }
    if (coords) h += `<p class="popup-coords">${Utils.formatCoords(coords[1], coords[0], 6)}</p>`;
    h += '</div>';
    return h;
  },

  // ─── CONTRIBUTIONS ────────────────────────────────────────

  addContribution(feature) {
    L.geoJSON(feature, {
      pointToLayer: (f, ll) => L.marker(ll, { icon: Utils.makeIcon('#f39c12', true) }),
      onEachFeature: (f, layer) => {
        this.featureCache.set(L.stamp(layer), { layer, feature: f, layerId: 'contributions' });
        layer.bindPopup(() => this._popupHTML(f, 'contributions'), { maxWidth: 320, className: 'custom-popup' });
        layer.on('click', e => { e.originalEvent?.stopPropagation(); window.UIManager?.showFeatureInfo(f, 'contributions'); });
      }
    }).addTo(this.layerGroups['contributions']);
    this._updateContribCount();
  },

  removeContribution(cid) {
    let removed = false;
    this.layerGroups['contributions']?.eachLayer(l => {
      const c = this.featureCache.get(L.stamp(l));
      if (c?.feature.properties._id === cid) {
        this.layerGroups['contributions'].removeLayer(l);
        this.featureCache.delete(L.stamp(l));
        removed = true;
      }
    });
    if (removed) this._updateContribCount();
    return removed;
  },

  clearContributions() {
    this.layerGroups['contributions']?.clearLayers();
    this.featureCache.forEach((v, k) => { if (v.layerId === 'contributions') this.featureCache.delete(k); });
    this._updateContribCount();
  },

  getContributionsGeoJSON() {
    const features = [];
    this.layerGroups['contributions']?.eachLayer(l => {
      const c = this.featureCache.get(L.stamp(l)); if (c?.feature) features.push(c.feature);
    });
    return { type: 'FeatureCollection', features };
  },

  loadContributions(g) {
    this.clearContributions();
    if (g?.features) g.features.forEach(f => this.addContribution(f));
  },

  // ─── EXPORT ───────────────────────────────────────────────

  exportAll(opts = {}) {
    const features = [];

    if (opts.datasets) {
      this.datasets.forEach(ds => {
        if (ds.sublayers) {
          ds.sublayers.forEach(sl => {
            if (this.visibleLayers.has(sl.id) && this.layerGroups[sl.id]?._loaded) {
              this.layerGroups[sl.id].eachLayer(l => {
                const c = this.featureCache.get(L.stamp(l)); if (c?.feature) features.push(c.feature);
              });
            }
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

    Utils.downloadFile(
      JSON.stringify({ type: 'FeatureCollection', features }, null, 2),
      `wom_export_${new Date().toISOString().split('T')[0]}.geojson`
    );
    Utils.showToast(`Exported ${features.length} features`, 'success');
  },

  exportLayer(id) {
    const features = [];
    this.layerGroups[id]?.eachLayer(l => {
      const c = this.featureCache.get(L.stamp(l)); if (c?.feature) features.push(c.feature);
    });
    Utils.downloadFile(
      JSON.stringify({ type: 'FeatureCollection', features }, null, 2),
      `wom_${id}_${new Date().toISOString().split('T')[0]}.geojson`
    );
    Utils.showToast(`Exported ${features.length} features`, 'success');
  },

  // ─── COUNTS ───────────────────────────────────────────────

  _updateDatasetCount(dsId) {
    const ds = this.datasets.find(d => d.id === dsId);
    if (!ds) return;
    let total = 0;
    if (ds.sublayers) {
      ds.sublayers.forEach(sl => {
        if (this.visibleLayers.has(sl.id) && this.layerGroups[sl.id]?._loaded)
          total += this.layerGroups[sl.id].getLayers().length;
      });
    }
    const el = document.getElementById(`count-${dsId}`);
    if (el) el.textContent = Utils.formatNumber(total);
  },

  _updateContribCount() {
    const el = document.getElementById('count-contributions');
    if (el) el.textContent = Utils.formatNumber(this.layerGroups['contributions']?.getLayers().length || 0);
    this._updateExportList();
  },

  _updateExportList() {
    const c = document.getElementById('export-layer-list');
    if (!c) return;
    c.innerHTML = '';

    const addBtn = (name, id) => {
      const n = this.layerGroups[id]?.getLayers().length || 0;
      if (!n) return;
      const b = document.createElement('button');
      b.className = 'btn btn-small export-layer-btn';
      b.innerHTML = `<span>${name}</span><span class="feature-count">${Utils.formatNumber(n)}</span>`;
      b.onclick = () => this.exportLayer(id);
      c.appendChild(b);
    };

    this.datasets.forEach(ds => {
      if (ds.sublayers) ds.sublayers.forEach(sl => { if (this.layerGroups[sl.id]?._loaded) addBtn(sl.name, sl.id); });
    });
    this.importedLayers.forEach(il => addBtn(il.name, il.id));
    addBtn('My Contributions', 'contributions');
  },

  // ─── HELPERS ──────────────────────────────────────────────

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
