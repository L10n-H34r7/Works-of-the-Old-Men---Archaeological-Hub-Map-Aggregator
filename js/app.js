/** Main Application */

const App = {
  initialized: false,
  contributionMode: false,

  async init() {
    if (this.initialized) return;
    try {
      this._showLoading('Initializing…');
      await this._waitForLeaflet();

      MapManager.init('map');
      this.map = MapManager.getMap();

      await LayerManager.init(this.map);  // async — loads datasets.json
      UIManager.init();
      ContributionTool.init(this.map);

      this._bindMapEvents();
      this._addSearchControl();
      this._addAppStyles();

      this.initialized = true;
      this._hideLoading();
      setTimeout(() => Utils.showToast('Welcome to Works of the Old Men Hub', 'success'), 400);
    } catch(e) {
      console.error('Init failed:', e);
      this._hideLoading();
      Utils.showToast('Failed to initialize: ' + e.message, 'error');
    }
  },

  _bindMapEvents() {
    this.map.on('click', e => {
      // Hide feature info popup on any map click
      UIManager.hideFeatureInfo();

      if (this.contributionMode) {
        // In contribution mode: place marker, do NOT close panels
        if (!e.originalEvent?.target?.closest('.leaflet-popup')) {
          ContributionTool.onMapClick(e);
        }
      } else {
        // Normal mode: clicking the map closes panels
        UIManager.closeAllPanels();
      }
    });

    // Close feature info button
    document.querySelector('.feature-info-close')
      ?.addEventListener('click', () => UIManager.hideFeatureInfo());
  },

  _waitForLeaflet() {
    return new Promise((resolve, reject) => {
      if (window.L) { resolve(); return; }
      let attempts = 0;
      const check = setInterval(() => {
        if (window.L) { clearInterval(check); resolve(); }
        else if (++attempts > 100) { clearInterval(check); reject(new Error('Leaflet failed to load')); }
      }, 50);
    });
  },

  setContributionMode(en) {
    this.contributionMode = en;
    if (en) ContributionTool.enable();
    else    ContributionTool.disable();
  },

  _addSearchControl() {
    if (!window.L?.Control?.Geocoder) return;

    const geocoder = L.Control.geocoder({
      defaultMarkGeocode: false,
      position: 'topleft',
      placeholder: '🔍 Search place or coordinates…',
      errorMessage: 'Nothing found.',
      geocoder: L.Control.Geocoder.nominatim({
        geocodingQueryParams: { limit: 8 }
      })
    })
    .on('markgeocode', e => {
      const { center, bbox, name } = e.geocode;
      // Zoom to result
      if (bbox) {
        this.map.fitBounds(bbox, { maxZoom: 14, padding: [20, 20] });
      } else {
        this.map.setView(center, 13);
      }
      // Briefly show a marker that fades
      const marker = L.circleMarker(center, {
        radius: 10, color: '#c9a84c', fillColor: '#c9a84c',
        fillOpacity: 0.7, weight: 2
      }).addTo(this.map);
      marker.bindPopup(`<strong>📍 ${name}</strong>`).openPopup();
      setTimeout(() => this.map.removeLayer(marker), 6000);
    })
    .addTo(this.map);
  },

  _addAppStyles() {
    const s = document.createElement('style');
    s.textContent = `
      .custom-popup .leaflet-popup-content-wrapper { border-radius:8px; box-shadow:0 4px 20px rgba(0,0,0,.18); }
      .custom-popup .leaflet-popup-content { margin:12px 14px; max-width:300px; }
      .popup-content h4 { margin:0 0 6px; font-size:.9rem; color:#2c5f4a; }
      .popup-meta { margin:3px 0; font-size:.78rem; }
      .popup-meta strong { color:#333; }
      .popup-coords { margin-top:6px; padding-top:6px; border-top:1px solid #eee; font-size:.68rem; color:#888; font-family:monospace; }
      #map { width:100%; height:100%; display:block; }
      .leaflet-container { background:#1a1a1a; }
    `;
    document.head.appendChild(s);
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

document.addEventListener('DOMContentLoaded', () => App.init());
window.App = App;

// Safety: force-hide loading after 6s
setTimeout(() => {
  const o = document.getElementById('loading-overlay');
  if (o && !o.hidden) { o.hidden = true; o.style.display = 'none'; }
}, 6000);
