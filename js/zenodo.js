/** Zenodo Dataset Loader — loads GeoJSON from Zenodo URLs or local files into map layers */

const ZenodoManager = {
  loadedLayers: [], // { id, name, color, featureCount }
  layerCounter: 0,

  init(map) {
    this.map = map;
    this.bindEvents();
    this.bindFeaturedButtons();
  },

  bindEvents() {
    // URL loader
    const btnUrl = document.getElementById('btn-load-zenodo-url');
    if (btnUrl) btnUrl.addEventListener('click', () => this.loadFromURL());

    // File upload loader
    const btnFile = document.getElementById('btn-load-zenodo-file');
    if (btnFile) btnFile.addEventListener('click', () => this.loadFromFile());
  },

  bindFeaturedButtons() {
    document.querySelectorAll('[data-zenodo-url]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const url = btn.dataset.zenodoUrl;
        const name = btn.dataset.layerName || 'Zenodo Layer';
        const color = btn.dataset.layerColor || '#27ae60';
        await this.addLayer({ url, name, color, source: 'featured' });
      });
    });
  },

  async loadFromURL() {
    const urlInput = document.getElementById('zenodo-url-input');
    const nameInput = document.getElementById('zenodo-layer-name-url');
    const colorInput = document.getElementById('zenodo-layer-color-url');

    const url = urlInput?.value?.trim();
    const name = nameInput?.value?.trim() || 'Zenodo Layer';
    const color = colorInput?.value || '#27ae60';

    if (!url) { Utils.showToast('Please enter a GeoJSON URL', 'error'); return; }

    await this.addLayer({ url, name, color, source: 'url' });

    if (urlInput) urlInput.value = '';
    if (nameInput) nameInput.value = '';
  },

  async loadFromFile() {
    const fileInput = document.getElementById('zenodo-file-input');
    const nameInput = document.getElementById('zenodo-layer-name-file');
    const colorInput = document.getElementById('zenodo-layer-color-file');

    const file = fileInput?.files?.[0];
    const name = nameInput?.value?.trim() || (file?.name?.replace(/\.(geojson|json)$/i, '') || 'Uploaded Layer');
    const color = colorInput?.value || '#2980b9';

    if (!file) { Utils.showToast('Please select a GeoJSON file', 'error'); return; }

    try {
      const geojson = await Utils.parseGeoJSONFile(file);
      await this.addLayer({ geojson, name, color, source: 'file' });
      if (fileInput) fileInput.value = '';
      if (nameInput) nameInput.value = '';
    } catch (e) {
      Utils.showToast('Failed to read file: ' + e.message, 'error');
    }
  },

  async addLayer({ url, geojson, name, color, source }) {
    this.showLoading(`Loading "${name}"...`);
    try {
      let g = geojson;

      if (!g && url) {
        // Try direct fetch first
        try {
          const resp = await fetch(url);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
          const contentType = resp.headers.get('content-type') || '';
          const text = await resp.text();
          try {
            g = JSON.parse(text);
          } catch (parseErr) {
            throw new Error('Response is not valid JSON. The URL may require authentication or CORS is blocked.');
          }
        } catch (fetchErr) {
          // Try via a CORS proxy as fallback
          console.warn('Direct fetch failed, trying CORS proxy:', fetchErr.message);
          try {
            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
            const resp2 = await fetch(proxyUrl);
            if (!resp2.ok) throw new Error(`Proxy HTTP ${resp2.status}`);
            g = await resp2.json();
          } catch (proxyErr) {
            throw new Error(`Cannot load URL: ${fetchErr.message}. Try downloading the file and using "Upload Local GeoJSON File" instead.`);
          }
        }
      }

      if (!g) throw new Error('No data to load');

      // Normalise to FeatureCollection
      if (g.type === 'Feature') g = { type: 'FeatureCollection', features: [g] };
      if (!g.type || g.type !== 'FeatureCollection') {
        // Maybe it's an array
        if (Array.isArray(g)) g = { type: 'FeatureCollection', features: g };
        else throw new Error('Not a valid GeoJSON FeatureCollection');
      }
      if (!g.features || g.features.length === 0) throw new Error('GeoJSON has no features');

      // Filter to only Point features (for now) — TODO: support polygons/lines
      const points = g.features.filter(f => f.geometry && f.geometry.type === 'Point');
      const nonPoints = g.features.filter(f => f.geometry && f.geometry.type !== 'Point');

      if (points.length === 0 && nonPoints.length === 0) throw new Error('No valid geometries found');

      const id = `zenodo_${++this.layerCounter}`;
      const layerGroup = L.featureGroup();

      // Render all feature types
      const allFeatures = g.features.filter(f => f.geometry);
      L.geoJSON({ type: 'FeatureCollection', features: allFeatures }, {
        pointToLayer: (f, ll) => L.marker(ll, { icon: Utils.getMarkerIconColor(color, false) }),
        style: () => ({ color, weight: 2, opacity: 0.8, fillColor: color, fillOpacity: 0.3 }),
        onEachFeature: (f, layer) => {
          const popupContent = this.createZenodoPopup(f, name);
          layer.bindPopup(popupContent, { maxWidth: 350, className: 'custom-popup' });
          layer.on('click', e => {
            e.originalEvent?.stopPropagation();
            window.UIManager?.showFeatureInfo(f, id);
          });
          // Store in LayerManager featureCache
          window.LayerManager?.featureCache.set(L.stamp(layer), { layer, feature: f, layerId: id });
        }
      }).addTo(layerGroup);

      const featureCount = allFeatures.length;
      layerGroup._loaded = true;
      layerGroup._geojson = g;

      // Register with LayerManager
      window.LayerManager?.registerExternalLayer(id, layerGroup);
      this.map.addLayer(layerGroup);

      // Fit map to layer bounds
      try {
        const bounds = layerGroup.getBounds();
        if (bounds.isValid()) this.map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
      } catch (e) { /* ignore */ }

      // Store in local registry
      this.loadedLayers.push({ id, name, color, featureCount, url: url || null });

      // Update UI
      this.updateLayersList();
      this.updateLayersPanel(id, name, color, featureCount);
      window.LayerManager?.updateFeatureCounts();
      this.updateZenodoCount();

      Utils.showToast(`Loaded "${name}" — ${featureCount} features`, 'success');

    } catch (e) {
      console.error('ZenodoManager.addLayer error:', e);
      Utils.showToast(`Failed to load "${name}": ${e.message}`, 'error');
    } finally {
      this.hideLoading();
    }
  },

  createZenodoPopup(f, layerName) {
    const p = f.properties || {};
    const coords = f.geometry?.coordinates;
    let lat = '', lng = '';
    if (coords) {
      if (f.geometry.type === 'Point') { lng = coords[0]; lat = coords[1]; }
    }

    // Try common property keys for name
    const name = p.name || p.Name || p.NAME || p.id || p.ID || p.EAMENA_ID ||
                 p.site_name || p.SiteName || p.label || p.Label || 'Unnamed';

    let h = `<div class="popup-content"><h4>${name}</h4>`;
    h += `<p class="popup-meta"><strong>Dataset:</strong> ${layerName}</p>`;

    // Show up to 8 non-null properties
    const skip = ['_layer', '_source_layer', '_id', 'FID', 'OBJECTID'];
    let shown = 0;
    for (const [k, v] of Object.entries(p)) {
      if (skip.includes(k) || v === null || v === undefined || v === '' || v === 'None') continue;
      if (shown >= 8) { h += `<p class="popup-meta" style="color:#999;font-size:.7rem;">…more fields available</p>`; break; }
      const label = k.replace(/_/g, ' ').replace(/\b\w/g, x => x.toUpperCase());
      h += `<p class="popup-meta"><strong>${label}:</strong> ${v}</p>`;
      shown++;
    }

    if (lat !== '' && lng !== '') {
      h += `<p class="popup-coords">${Utils.formatCoords(parseFloat(lat), parseFloat(lng), 6)}</p>`;
    }
    h += '</div>';
    return h;
  },

  updateLayersList() {
    const section = document.getElementById('zenodo-loaded-section');
    const list = document.getElementById('zenodo-loaded-list');
    if (!section || !list) return;

    if (this.loadedLayers.length === 0) {
      section.style.display = 'none';
      return;
    }
    section.style.display = '';
    list.innerHTML = '';

    this.loadedLayers.forEach(layer => {
      const item = document.createElement('div');
      item.className = 'zenodo-loaded-item';
      item.innerHTML = `
        <span class="zenodo-loaded-dot" style="background:${layer.color}"></span>
        <div class="zenodo-loaded-info">
          <span class="zenodo-loaded-name">${layer.name}</span>
          <span class="zenodo-loaded-count">${Utils.formatNumber(layer.featureCount)} features</span>
        </div>
        <button class="btn btn-small" data-remove-id="${layer.id}" title="Remove layer">✕</button>
      `;
      item.querySelector('[data-remove-id]').addEventListener('click', () => {
        this.removeLayer(layer.id);
      });
      list.appendChild(item);
    });
  },

  updateLayersPanel(id, name, color, featureCount) {
    // Show the zenodo layers section in the Layers panel
    const section = document.getElementById('section-zenodo-layers');
    const toggles = document.getElementById('zenodo-layer-toggles');
    if (!section || !toggles) return;

    section.style.display = '';

    const label = document.createElement('label');
    label.className = 'layer-option';
    label.id = `zenodo-toggle-${id}`;
    label.innerHTML = `
      <input type="checkbox" id="layer-${id}" value="${id}" checked>
      <div style="flex:1;">
        <span class="option-label" style="display:flex;align-items:center;gap:6px;">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0;"></span>
          ${name}
        </span>
        <span class="option-desc">${Utils.formatNumber(featureCount)} features · Zenodo</span>
      </div>
      <button class="btn btn-small" style="padding:2px 6px;font-size:.7rem;" data-remove-zenodo="${id}">✕</button>
    `;

    const checkbox = label.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', e => {
      const lg = window.LayerManager?.layerGroups[id];
      if (!lg) return;
      if (e.target.checked) this.map.addLayer(lg);
      else this.map.removeLayer(lg);
      this.updateZenodoCount();
    });

    label.querySelector('[data-remove-zenodo]').addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      this.removeLayer(id);
    });

    toggles.appendChild(label);
    this.updateZenodoCount();
  },

  removeLayer(id) {
    window.LayerManager?.unregisterExternalLayer(id);

    // Remove from local registry
    const idx = this.loadedLayers.findIndex(l => l.id === id);
    if (idx !== -1) this.loadedLayers.splice(idx, 1);

    // Remove toggle from layers panel
    const toggle = document.getElementById(`zenodo-toggle-${id}`);
    if (toggle) toggle.remove();

    // Hide section if empty
    const toggles = document.getElementById('zenodo-layer-toggles');
    const section = document.getElementById('section-zenodo-layers');
    if (toggles && section && toggles.children.length === 0) section.style.display = 'none';

    this.updateLayersList();
    this.updateZenodoCount();
    window.LayerManager?.updateFeatureCounts();
    Utils.showToast('Layer removed', 'info');
  },

  updateZenodoCount() {
    const el = document.getElementById('count-zenodo');
    if (!el) return;
    let total = 0;
    this.loadedLayers.forEach(l => {
      const lg = window.LayerManager?.layerGroups[l.id];
      if (lg && this.map.hasLayer(lg)) total += l.featureCount;
    });
    el.textContent = Utils.formatNumber(total);
  },

  getLoadedLayers() { return this.loadedLayers; },

  showLoading(t = 'Loading...') {
    const o = document.getElementById('loading-overlay'), te = document.getElementById('loading-text');
    if (o && te) { te.textContent = t; o.hidden = false; o.style.display = ''; o.style.visibility = ''; o.style.opacity = ''; o.style.pointerEvents = ''; }
  },
  hideLoading() {
    const o = document.getElementById('loading-overlay');
    if (o) { o.hidden = true; o.style.display = 'none'; }
  }
};

window.ZenodoManager = ZenodoManager;
