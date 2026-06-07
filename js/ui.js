/** UI Manager - panels, modals, interactions */

const UIManager = {
  panels: {}, buttons: {}, filterSelects: {}, activePanel: null, featureInfoVisible: false,

  init() {
    this.cacheElements();
    this.bindEvents();
    this.setupPanelToggles();
    this.setupFilterSelects();
    this.setupContributionForm();
    this.setupExportButtons();
  },

  cacheElements() {
    this.panels = {
      layers: document.getElementById('panel-layers'),
      about: document.getElementById('panel-about'),
      zenodo: document.getElementById('panel-zenodo'),
      contribute: document.getElementById('panel-contribute'),
      export: document.getElementById('panel-export')
    };
    this.buttons = {
      layers: document.getElementById('btn-layers'),
      about: document.getElementById('btn-about'),
      zenodo: document.getElementById('btn-zenodo'),
      contribute: document.getElementById('btn-contribute'),
      export: document.getElementById('btn-export')
    };
    this.filterSelects = {
      type: document.getElementById('filter-type'),
      region: document.getElementById('filter-region')
    };
  },

  bindEvents() {
    Object.entries(this.buttons).forEach(([k, b]) => {
      if (b) b.addEventListener('click', () => this.togglePanel(k));
    });
    Object.values(this.panels).forEach(p => {
      if (p) {
        const c = p.querySelector('.panel-close');
        if (c) c.addEventListener('click', () => this.closePanel(p));
      }
    });
    if (window.MapManager?.map) window.MapManager.map.on('click', () => this.closeAllPanels());
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') this.closeAllPanels();
      if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); this.togglePanel('layers'); }
      if (e.key === 'c' && e.ctrlKey) { e.preventDefault(); this.togglePanel('contribute'); }
      if (e.key === 'e' && e.ctrlKey) { e.preventDefault(); this.togglePanel('export'); }
    });
    window.addEventListener('resize', () => this.handleResize());
  },

  setupPanelToggles() {
    if (window.innerWidth > 768) this.openPanel('layers');
  },

  togglePanel(name) {
    const p = this.panels[name], b = this.buttons[name];
    if (!p || !b) return;
    const open = p.getAttribute('aria-expanded') === 'true';
    if (open) this.closePanel(p);
    else this.openPanel(name);
  },

  openPanel(name) {
    const p = this.panels[name], b = this.buttons[name];
    if (!p) return;
    if (window.innerWidth <= 768) this.closeAllPanels();
    p.hidden = false;
    p.offsetHeight; // force reflow for animation
    p.setAttribute('aria-expanded', 'true');
    if (b) b.setAttribute('aria-expanded', 'true');
    this.activePanel = name;
  },

  closePanel(p) {
    p.setAttribute('aria-expanded', 'false');
    setTimeout(() => { if (p.getAttribute('aria-expanded') === 'false') p.hidden = true; }, 300);
    const n = Object.entries(this.panels).find(([_, v]) => v === p)?.[0];
    if (n && this.buttons[n]) this.buttons[n].setAttribute('aria-expanded', 'false');
    if (this.activePanel === n) this.activePanel = null;
  },

  closeAllPanels() {
    Object.values(this.panels).forEach(p => {
      if (p && p.getAttribute('aria-expanded') === 'true') this.closePanel(p);
    });
  },

  handleResize() {
    if (window.innerWidth > 768 && !this.activePanel) this.openPanel('layers');
  },

  setupFilterSelects() {
    if (this.filterSelects.type) this.filterSelects.type.addEventListener('change', e => window.LayerManager?.setFilter('type', e.target.value));
    if (this.filterSelects.region) this.filterSelects.region.addEventListener('change', e => window.LayerManager?.setFilter('region', e.target.value));
    this.populateRegionFilter();
  },

  populateRegionFilter() {
    const s = this.filterSelects.region;
    if (!s) return;
    const r = [
      { v: 'all', l: 'All Regions' }, { v: 'jordan', l: 'Jordan' },
      { v: 'saudi', l: 'Saudi Arabia' }, { v: 'yemen', l: 'Yemen' },
      { v: 'oman', l: 'Oman' }, { v: 'uae', l: 'UAE' },
      { v: 'syria', l: 'Syria' }, { v: 'iraq', l: 'Iraq' },
      { v: 'djibouti', l: 'Djibouti' }, { v: 'ethiopia', l: 'Ethiopia' }
    ];
    s.innerHTML = r.map(x => `<option value="${x.v}">${x.l}</option>`).join('');
  },

  setupContributionForm() {
    const sb = document.getElementById('btn-start-contribute');
    const cb = document.getElementById('btn-cancel-contribute');
    const rb = document.getElementById('btn-reset-form');
    const f = document.getElementById('contribute-form');
    if (sb) sb.addEventListener('click', () => this.startContributionMode());
    if (cb) cb.addEventListener('click', () => this.cancelContributionMode());
    if (rb) rb.addEventListener('click', () => this.resetContributionForm());
    if (f) f.addEventListener('submit', e => this.handleContributionSubmit(e));
  },

  startContributionMode() {
    const s = document.getElementById('contribute-status');
    const f = document.getElementById('contribute-form');
    const cb = document.getElementById('btn-cancel-contribute');
    if (s) s.hidden = true;
    if (f) f.hidden = false;
    if (cb) cb.hidden = false;
    window.App?.setContributionMode(true);
    Utils.showToast('Click on the map to place a structure', 'info');
  },

  cancelContributionMode() {
    const s = document.getElementById('contribute-status');
    const f = document.getElementById('contribute-form');
    const cb = document.getElementById('btn-cancel-contribute');
    if (s) s.hidden = false;
    if (f) f.hidden = true;
    if (cb) cb.hidden = true;
    window.App?.setContributionMode(false);
    this.resetContributionForm();
  },

  resetContributionForm() {
    const f = document.getElementById('contribute-form');
    if (f) f.reset();
    const la = document.getElementById('contrib-lat');
    const lo = document.getElementById('contrib-lng');
    if (la) la.value = '';
    if (lo) lo.value = '';
  },

  handleContributionSubmit(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const d = {
      name: fd.get('name'), type: fd.get('type'), subtype: fd.get('subtype'),
      lat: parseFloat(fd.get('lat')), lng: parseFloat(fd.get('lng')),
      description: fd.get('description'), source: fd.get('source'), contributor: fd.get('contributor')
    };
    if (!d.name || !d.type || isNaN(d.lat) || isNaN(d.lng)) {
      Utils.showToast('Fill all required fields', 'error'); return;
    }
    const feat = Utils.createFeatureFromData(d);
    window.LayerManager?.addContribution(feat);
    this.updateContributionsList();
    this.resetContributionForm();
    this.cancelContributionMode();
    Utils.showToast('Structure added!', 'success');
  },

  setContributionCoords(lat, lng) {
    const la = document.getElementById('contrib-lat');
    const lo = document.getElementById('contrib-lng');
    if (la) la.value = lat.toFixed(6);
    if (lo) lo.value = lng.toFixed(6);
  },

  updateContributionsList() {
    const c = document.getElementById('contrib-items');
    if (!c) return;
    const f = [];
    window.LayerManager?.layerGroups.contributions?.eachLayer(l => {
      const s = L.stamp(l);
      const ca = window.LayerManager?.featureCache.get(s);
      if (ca && ca.feature) f.push(ca.feature);
    });
    if (f.length === 0) { c.innerHTML = '<li style="color:#999;font-size:.8rem;padding:8px 0;">No contributions yet</li>'; return; }
    c.innerHTML = f.map(feat => {
      const p = feat.properties, co = feat.geometry.coordinates;
      return `<li style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--color-border);font-size:.8rem;">
        <div>
          <span style="color:var(--color-text-muted)">${Utils.getTypeDisplayName(p.type)}</span>
          ${p.name ? `<br><strong>${p.name}</strong>` : ''}
          <br><code style="font-size:.65rem;color:#999">${Utils.formatCoords(co[1], co[0], 4)}</code>
        </div>
        <button class="btn btn-small" onclick="UIManager.removeContribution('${p._id}')" style="color:var(--color-error);border-color:var(--color-error)">✕</button>
      </li>`;
    }).join('');
  },

  removeContribution(id) {
    window.LayerManager?.removeContribution(id);
    this.updateContributionsList();
  },

  setupExportButtons() {
    const db = document.getElementById('btn-download-geojson');
    const sb = document.getElementById('btn-save-contrib');
    const lb = document.getElementById('btn-load-contrib');
    const cb = document.getElementById('btn-clear-contrib');
    const fi = document.getElementById('input-load-contrib');
    if (db) db.addEventListener('click', () => this.exportAll());
    if (sb) sb.addEventListener('click', () => this.saveContributions());
    if (lb) lb.addEventListener('click', () => fi?.click());
    if (fi) fi.addEventListener('change', e => this.loadContributionsFile(e));
    if (cb) cb.addEventListener('click', () => this.clearContributions());
  },

  exportAll() {
    const o = {
      globalkites: document.getElementById('export-globalkites')?.checked ?? true,
      contributions: document.getElementById('export-contributions')?.checked ?? true,
      zenodo: document.getElementById('export-zenodo')?.checked ?? true
    };
    window.LayerManager?.exportAll(o);
  },

  saveContributions() {
    const g = window.LayerManager?.getContributionsGeoJSON();
    if (g && g.features.length > 0) {
      const date = new Date().toISOString().split('T')[0];
      Utils.downloadFile(JSON.stringify(g, null, 2), `wom_contributions_${date}.geojson`);
      Utils.showToast(`Saved ${g.features.length} contributions`, 'success');
    } else {
      Utils.showToast('No contributions to save', 'info');
    }
  },

  async loadContributionsFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const g = await Utils.parseGeoJSONFile(f);
      window.LayerManager?.loadContributions(g);
      this.updateContributionsList();
      Utils.showToast(`Loaded ${g.features.length} contributions`, 'success');
    } catch (err) {
      console.error(err);
      Utils.showToast('Failed: ' + err.message, 'error');
    }
    e.target.value = '';
  },

  clearContributions() {
    if (confirm('Clear all contributions?')) {
      window.LayerManager?.clearContributions();
      this.updateContributionsList();
      Utils.showToast('Cleared', 'info');
    }
  },

  showFeatureInfo(f, id) {
    const p = document.getElementById('feature-info');
    const c = document.querySelector('.feature-info-content');
    if (!p || !c) return;
    const pr = f.properties, co = f.geometry.coordinates, lat = co[1], lng = co[0];
    let h = `<h4>${pr.name || pr.ID || pr.id || pr.EAMENA_ID || 'Unnamed Structure'}</h4>`;
    h += `<p style="font-size:.75rem;color:var(--color-text-muted);margin-bottom:8px;">Layer: ${id} | ${Utils.formatCoords(lat, lng, 6)}</p>`;
    h += '<table style="width:100%;font-size:.78rem;border-collapse:collapse;">';
    const skip = ['_layer', '_source_layer', '_id', '_osm_id', '_osm_type', 'FID', 'OBJECTID'];
    for (const [k, v] of Object.entries(pr)) {
      if (skip.includes(k) || v === null || v === undefined || v === '' || v === 'None') continue;
      const label = k.replace(/_/g, ' ').replace(/\b\w/g, x => x.toUpperCase());
      h += `<tr><td style="padding:3px 6px 3px 0;color:var(--color-text-muted);vertical-align:top;white-space:nowrap;">${label}</td><td style="padding:3px 0;word-break:break-word;">${v}</td></tr>`;
    }
    h += '</table>';
    c.innerHTML = h;
    p.hidden = false;
    this.featureInfoVisible = true;
  },

  hideFeatureInfo() {
    const p = document.getElementById('feature-info');
    if (p) { p.hidden = true; this.featureInfoVisible = false; }
  },

  updateBasemapUI(b) {
    document.querySelectorAll('input[name="basemap"]').forEach(i => i.checked = i.value === b);
  }
};

window.UIManager = UIManager;
