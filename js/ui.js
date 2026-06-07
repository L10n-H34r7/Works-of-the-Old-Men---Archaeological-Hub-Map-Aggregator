/** UI Manager */

const UIManager = {
  activePanel: null,

  init() {
    this._bindNavButtons();
    this._bindPanelClose();
    this._bindCollapsibles();
    this._bindBasemaps();
    this._bindToolTabs();
    this._bindImport();
    this._bindContribute();
    this._bindExport();
    this._bindContribControls();

    // Open layers panel by default on desktop
    if (window.innerWidth > 768) this.openPanel('layers');
  },

  // ─── PANEL SWITCHING (one at a time) ─────────────────────

  _bindNavButtons() {
    ['about','layers','tools'].forEach(name => {
      const btn = document.getElementById(`btn-${name}`);
      if (btn) btn.addEventListener('click', () => this.togglePanel(name));
    });
  },

  _bindPanelClose() {
    document.querySelectorAll('.panel-close').forEach(btn => {
      btn.addEventListener('click', () => this.closeAllPanels());
    });
    // clicking map closes panels
    if (window.MapManager?.map) {
      window.MapManager.map.on('click', () => this.closeAllPanels());
    }
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') this.closeAllPanels();
    });
  },

  togglePanel(name) {
    if (this.activePanel === name) { this.closeAllPanels(); return; }
    this.closeAllPanels();
    this.openPanel(name);
  },

  openPanel(name) {
    const panel = document.getElementById(`panel-${name}`);
    const btn   = document.getElementById(`btn-${name}`);
    if (!panel) return;
    panel.hidden = false;
    panel.setAttribute('aria-expanded', 'true');
    if (btn) btn.classList.add('active');
    this.activePanel = name;
  },

  closeAllPanels() {
    ['about','layers','tools'].forEach(name => {
      const panel = document.getElementById(`panel-${name}`);
      const btn   = document.getElementById(`btn-${name}`);
      if (panel) { panel.hidden = true; panel.setAttribute('aria-expanded','false'); }
      if (btn)   btn.classList.remove('active');
    });
    this.activePanel = null;
  },

  // ─── COLLAPSIBLE BASE MAPS ────────────────────────────────

  _bindCollapsibles() {
    const btn  = document.getElementById('toggle-basemaps');
    const body = document.getElementById('body-basemaps');
    if (!btn || !body) return;
    btn.addEventListener('click', () => {
      const open = body.style.display !== 'none';
      body.style.display = open ? 'none' : '';
      btn.setAttribute('aria-expanded', String(!open));
      btn.querySelector('.collapse-arrow').textContent = open ? '▶' : '▼';
    });
  },

  // ─── BASEMAPS ─────────────────────────────────────────────

  _bindBasemaps() {
    document.querySelectorAll('input[name="basemap"]').forEach(i =>
      i.addEventListener('change', e => window.MapManager?.setBasemap(e.target.value))
    );
  },

  // ─── TOOL TABS ────────────────────────────────────────────

  _bindToolTabs() {
    document.querySelectorAll('.tool-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tool-tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tool-tab-body').forEach(b => b.style.display = 'none');
        btn.classList.add('active');
        const target = document.getElementById(btn.dataset.tab);
        if (target) target.style.display = '';
      });
    });
  },

  // ─── IMPORT DATA ──────────────────────────────────────────

  _bindImport() {
    // Featured quick-load buttons
    document.querySelectorAll('[data-load-url]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const url   = btn.dataset.loadUrl;
        const name  = btn.dataset.loadName  || 'Zenodo Layer';
        const color = btn.dataset.loadColor || '#27ae60';
        btn.disabled = true;
        btn.textContent = 'Loading…';
        try {
          await this._doLoadURL(url, name, color);
        } finally {
          btn.disabled = false;
          btn.textContent = btn.dataset.loadName ? `Load ${btn.dataset.loadName.split(' ')[0]}` : 'Load';
        }
      });
    });

    // File upload
    document.getElementById('btn-imp-file')?.addEventListener('click', async () => {
      const fileEl  = document.getElementById('imp-file');
      const nameEl  = document.getElementById('imp-file-name');
      const colorEl = document.getElementById('imp-file-color');
      const file    = fileEl?.files?.[0];
      if (!file) { Utils.showToast('Select a GeoJSON file first', 'error'); return; }
      const name  = nameEl?.value?.trim() || file.name.replace(/\.(geojson|json)$/i,'');
      const color = colorEl?.value || '#2980b9';
      try {
        const geojson = await Utils.parseGeoJSONFile(file);
        await window.LayerManager.importGeoJSON(geojson, name, color);
        if (fileEl) fileEl.value = '';
        if (nameEl) nameEl.value = '';
      } catch(e) { Utils.showToast('Error: ' + e.message, 'error'); }
    });

    // URL load
    document.getElementById('btn-imp-url')?.addEventListener('click', async () => {
      const urlEl   = document.getElementById('imp-url');
      const nameEl  = document.getElementById('imp-url-name');
      const colorEl = document.getElementById('imp-url-color');
      const url   = urlEl?.value?.trim();
      const name  = nameEl?.value?.trim() || 'Imported Layer';
      const color = colorEl?.value || '#27ae60';
      if (!url) { Utils.showToast('Enter a URL first', 'error'); return; }
      await this._doLoadURL(url, name, color);
      if (urlEl)  urlEl.value  = '';
      if (nameEl) nameEl.value = '';
    });
  },

  async _doLoadURL(url, name, color) {
    LayerManager._showLoading(`Loading "${name}"…`);
    try {
      let geojson;
      // Try direct fetch
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        geojson = await r.json();
      } catch(e1) {
        // CORS proxy fallback
        try {
          const r2 = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`);
          if (!r2.ok) throw new Error(`Proxy HTTP ${r2.status}`);
          geojson = await r2.json();
        } catch(e2) {
          throw new Error(`Cannot fetch URL. Download the file and use "Upload GeoJSON File" instead.`);
        }
      }
      // Normalise
      if (geojson.type === 'Feature') geojson = { type:'FeatureCollection', features:[geojson] };
      if (!geojson.type || geojson.type !== 'FeatureCollection') throw new Error('Not a valid GeoJSON FeatureCollection');
      await window.LayerManager.importGeoJSON(geojson, name, color);
    } catch(e) {
      Utils.showToast('Failed: ' + e.message, 'error');
    } finally {
      LayerManager._hideLoading();
    }
  },

  // ─── CONTRIBUTE ───────────────────────────────────────────

  _bindContribute() {
    document.getElementById('btn-start-contribute')?.addEventListener('click', () => {
      document.getElementById('contrib-status-block').style.display = 'none';
      document.getElementById('contrib-form-block').style.display  = '';
      window.App?.setContributionMode(true);
      Utils.showToast('Click on the map to place a marker', 'info');
    });

    document.getElementById('btn-cancel-contribute')?.addEventListener('click', () => {
      this._cancelContribute();
    });

    document.getElementById('contribute-form')?.addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const lat = parseFloat(fd.get('lat')), lng = parseFloat(fd.get('lng'));
      const name = fd.get('name'), type = fd.get('type');
      if (!name || !type || isNaN(lat) || isNaN(lng)) {
        Utils.showToast('Fill all required fields and set position by clicking the map', 'error'); return;
      }
      const feat = Utils.createFeature({ name, type, subtype: fd.get('subtype'), lat, lng, description: fd.get('description'), source: fd.get('source'), contributor: fd.get('contributor') });
      window.LayerManager?.addContribution(feat);
      this.updateContribList();
      e.target.reset();
      this._cancelContribute();
      Utils.showToast('Structure saved!', 'success');
    });
  },

  _cancelContribute() {
    document.getElementById('contrib-status-block').style.display = '';
    document.getElementById('contrib-form-block').style.display  = 'none';
    window.App?.setContributionMode(false);
  },

  setContributionCoords(lat, lng) {
    const la = document.getElementById('contrib-lat');
    const lo = document.getElementById('contrib-lng');
    if (la) la.value = lat.toFixed(6);
    if (lo) lo.value = lng.toFixed(6);
  },

  updateContribList() {
    const ul = document.getElementById('contrib-items');
    if (!ul) return;
    const features = [];
    window.LayerManager?.layerGroups['contributions']?.eachLayer(l => {
      const c = window.LayerManager.featureCache.get(L.stamp(l));
      if (c?.feature) features.push(c.feature);
    });
    if (!features.length) { ul.innerHTML = '<li style="color:#999;font-size:.8rem;padding:6px 0;">No contributions yet</li>'; return; }
    ul.innerHTML = features.map(f => {
      const p = f.properties, co = f.geometry.coordinates;
      return `<li class="contrib-item">
        <div>
          <span class="contrib-type">${Utils.typeLabel(p.type)}</span>
          ${p.name ? `<span class="contrib-name">${p.name}</span>` : ''}
          <code class="contrib-coords">${Utils.formatCoords(co[1],co[0],4)}</code>
        </div>
        <button class="btn btn-small" style="color:var(--color-error)" onclick="UIManager.removeContrib('${p._id}')">✕</button>
      </li>`;
    }).join('');
  },

  removeContrib(id) {
    window.LayerManager?.removeContribution(id);
    this.updateContribList();
  },

  // ─── CONTRIBUTION LAYER CONTROLS ──────────────────────────

  _bindContribControls() {
    document.getElementById('btn-clear-contrib')?.addEventListener('click', () => {
      if (confirm('Clear all contributions?')) {
        window.LayerManager?.clearContributions();
        this.updateContribList();
        Utils.showToast('Cleared', 'info');
      }
    });
    document.getElementById('btn-save-contrib')?.addEventListener('click', () => {
      const g = window.LayerManager?.getContributionsGeoJSON();
      if (g?.features.length > 0) {
        Utils.downloadFile(JSON.stringify(g,null,2), `wom_contributions_${new Date().toISOString().split('T')[0]}.geojson`);
        Utils.showToast(`Saved ${g.features.length} contributions`, 'success');
      } else Utils.showToast('No contributions to save','info');
    });
    document.getElementById('btn-load-contrib')?.addEventListener('click', () => {
      document.getElementById('input-load-contrib')?.click();
    });
    document.getElementById('input-load-contrib')?.addEventListener('change', async e => {
      const file = e.target.files[0]; if (!file) return;
      try {
        const g = await Utils.parseGeoJSONFile(file);
        window.LayerManager?.loadContributions(g);
        this.updateContribList();
        Utils.showToast(`Loaded ${g.features.length} contributions`, 'success');
      } catch(err) { Utils.showToast('Failed: '+err.message,'error'); }
      e.target.value = '';
    });
  },

  // ─── EXPORT ───────────────────────────────────────────────

  _bindExport() {
    document.getElementById('btn-download-geojson')?.addEventListener('click', () => {
      window.LayerManager?.exportAll({
        globalkites:   document.getElementById('export-globalkites')?.checked ?? true,
        contributions: document.getElementById('export-contributions')?.checked ?? true,
        imported:      document.getElementById('export-imported')?.checked ?? true
      });
    });
  },

  // ─── FEATURE INFO POPUP ───────────────────────────────────

  showFeatureInfo(f, id) {
    const panel = document.getElementById('feature-info');
    const content = document.querySelector('.feature-info-content');
    if (!panel || !content) return;
    const p = f.properties || {}, co = f.geometry?.coordinates || [0,0];
    const lat = co[1], lng = co[0];
    let h = `<h4>${p.name||p.Name||p.NAME||p.ID||p.id||p.EAMENA_ID||'Unnamed Structure'}</h4>`;
    h += `<p style="font-size:.72rem;color:var(--color-text-muted);margin-bottom:8px;">${id} · ${Utils.formatCoords(lat,lng,6)}</p>`;
    h += '<table style="width:100%;font-size:.78rem;border-collapse:collapse;">';
    const skip = ['_layer','_source_layer','_id','FID','OBJECTID'];
    for (const [k,v] of Object.entries(p)) {
      if (skip.includes(k) || v===null || v===undefined || v==='' || v==='None') continue;
      const label = k.replace(/_/g,' ').replace(/\b\w/g,x=>x.toUpperCase());
      h += `<tr><td style="padding:3px 8px 3px 0;color:var(--color-text-muted);vertical-align:top;white-space:nowrap;">${label}</td><td style="padding:3px 0;word-break:break-word;">${v}</td></tr>`;
    }
    h += '</table>';
    content.innerHTML = h;
    panel.hidden = false;
  },

  hideFeatureInfo() {
    const p = document.getElementById('feature-info');
    if (p) p.hidden = true;
  }
};

window.UIManager = UIManager;
