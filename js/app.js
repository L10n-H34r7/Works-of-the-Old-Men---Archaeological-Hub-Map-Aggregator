/** Main Application */

const App = {
  initialized: false,
  contributionMode: false,

  async init() {
    if (this.initialized) return;
    console.log('Initializing Works of the Old Men Hub...');
    try {
      this.showLoading('Initializing map...');
      await this.waitForLeaflet();

      MapManager.init('map');
      this.map = MapManager.getMap();

      LayerManager.init(this.map);
      UIManager.init();
      ZenodoManager.init(this.map);
      ContributionTool.init(this.map);

      this.setupGlobalEvents();
      this.addCustomStyles();

      this.initialized = true;
      this.hideLoading();
      console.log('Works of the Old Men Hub ready!');
      setTimeout(() => Utils.showToast('Welcome to Works of the Old Men Hub', 'success'), 500);
    } catch (e) {
      console.error('Init failed:', e);
      this.hideLoading();
      Utils.showToast('Failed to initialize: ' + e.message, 'error');
    }
  },

  waitForLeaflet() {
    return new Promise((resolve, reject) => {
      if (window.L) { resolve(); return; }
      let attempts = 0;
      const check = setInterval(() => {
        attempts++;
        if (window.L) { clearInterval(check); resolve(); }
        else if (attempts > 100) { clearInterval(check); reject(new Error('Leaflet failed to load')); }
      }, 50);
    });
  },

  setupGlobalEvents() {
    document.querySelectorAll('input[name="basemap"]').forEach(i =>
      i.addEventListener('change', e => MapManager.setBasemap(e.target.value))
    );
    const cb = document.querySelector('.feature-info-close');
    if (cb) cb.addEventListener('click', () => UIManager.hideFeatureInfo());
    this.map.on('click', () => UIManager.hideFeatureInfo());
    this.map.on('click', e => {
      if (this.contributionMode && !e.originalEvent?.target?.closest('.leaflet-popup')) {
        ContributionTool.onMapClick(e);
      }
    });
  },

  addCustomStyles() {
    const s = document.createElement('style');
    s.textContent = `
      .custom-popup .leaflet-popup-content-wrapper { border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,.15); }
      .custom-popup .leaflet-popup-content { margin: 12px 16px; max-width: 300px; }
      .popup-content h4 { margin: 0 0 8px; font-size: .95rem; color: #2c5f4a; }
      .popup-meta { margin: 4px 0; font-size: .8rem; }
      .popup-meta strong { color: #333; }
      .popup-coords { margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee; font-size: .7rem; color: #888; font-family: monospace; }
      .marker-temp svg { animation: pulse 2s ease-in-out infinite; }
      @keyframes pulse { 0%,100%{transform:scale(1);opacity:1;}50%{transform:scale(1.1);opacity:.7;} }
      .marker-contribution svg { filter: drop-shadow(0 2px 4px rgba(0,0,0,.3)); }
      .empty-state { padding: 16px; text-align: center; color: #999; font-size: .8rem; }
      #export-layer-list .btn { text-align: left; width: 100%; margin-bottom: 4px; }
      #map { width: 100%; height: 100%; display: block; visibility: visible; }
      .leaflet-container { background: #1a1a1a; }

      /* Zenodo panel styles */
      .zenodo-intro { background: var(--color-bg); border-radius: var(--radius-md); padding: 12px; margin-bottom: 16px; font-size: .8rem; line-height: 1.5; }
      .zenodo-intro a { color: var(--color-primary); }
      .zenodo-card { border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 14px; margin-bottom: 12px; }
      .zenodo-card-title { font-weight: 600; font-size: .9rem; color: var(--color-primary); margin-bottom: 6px; }
      .zenodo-card-desc { font-size: .75rem; color: var(--color-text-muted); margin-bottom: 10px; line-height: 1.4; }
      .zenodo-card-actions { display: flex; flex-wrap: wrap; gap: 6px; }
      .zenodo-note { font-size: .72rem; color: var(--color-text-muted); background: #fff8e1; border-left: 3px solid #f39c12; padding: 6px 10px; border-radius: 0 4px 4px 0; width: 100%; line-height: 1.4; }
      .zenodo-url-form { display: flex; flex-direction: column; gap: 10px; }
      .form-input { width: 100%; padding: 8px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-bg-panel); color: var(--color-text); font-size: .875rem; font-family: inherit; }
      .form-input:focus { outline: none; border-color: var(--color-border-focus); }
      .form-group { display: flex; flex-direction: column; gap: 4px; }
      .form-group label { font-size: .75rem; font-weight: 500; color: var(--color-text-muted); }
      .zenodo-loaded-item { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--color-border); }
      .zenodo-loaded-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
      .zenodo-loaded-info { flex: 1; min-width: 0; }
      .zenodo-loaded-name { display: block; font-size: .85rem; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .zenodo-loaded-count { display: block; font-size: .7rem; color: var(--color-text-muted); }
    `;
    document.head.appendChild(s);
  },

  setContributionMode(en) {
    this.contributionMode = en;
    if (en) ContributionTool.enable();
    else ContributionTool.disable();
  },

  showLoading(t = 'Loading...') {
    const o = document.getElementById('loading-overlay'), te = document.getElementById('loading-text');
    if (o && te) {
      te.textContent = t;
      o.hidden = false;
      o.style.display = '';
      o.style.visibility = '';
      o.style.opacity = '';
      o.style.pointerEvents = '';
    }
  },

  hideLoading() {
    const o = document.getElementById('loading-overlay');
    if (o) {
      o.hidden = true;
      o.style.display = 'none';
      o.style.visibility = 'hidden';
      o.style.opacity = '0';
      o.style.pointerEvents = 'none';
    }
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
window.App = App;

// Safety net: force-hide loading overlay after 4s
setTimeout(() => {
  const o = document.getElementById('loading-overlay');
  if (o && !o.hidden) {
    o.hidden = true;
    o.style.display = 'none';
    o.style.visibility = 'hidden';
    o.style.opacity = '0';
    o.style.pointerEvents = 'none';
    console.log('Force-hid loading overlay');
  }
}, 4000);
