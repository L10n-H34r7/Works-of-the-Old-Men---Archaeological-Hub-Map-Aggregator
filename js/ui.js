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

    // Default: open layers panel on desktop
    if (window.innerWidth > 768) this.openPanel('layers');
  },

  // ─── PANEL SWITCHING ──────────────────────────────────────

  _bindNavButtons() {
    ['about', 'layers', 'tools'].forEach(name => {
      document.getElementById(`btn-${name}`)
        ?.addEventListener('click', () => this.togglePanel(name));
    });
  },

  _bindPanelClose() {
    document.querySelectorAll('.panel-close').forEach(btn => {
      btn.addEventListener('click', () => this.closeAllPanels());
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') this.closeAllPanels(); });
    // NOTE: map click does NOT close panels — wired in app.js with contribution-mode awareness
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
    ['about', 'layers', 'tools'].forEach(name => {
      const panel = document.getElementById(`panel-${name}`);
      const btn   = document.getElementById(`btn-${name}`);
      if (panel) { panel.hidden = true; panel.setAttribute('aria-expanded', 'false'); }
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

  // ─── IMPORT ───────────────────────────────────────────────

  _bindImport() {
    document.getElementById('btn-imp-file')?.addEventListener('click', async () => {
      const fileEl  = document.getElementById('imp-file');
      const nameEl  = document.getElementById('imp-file-name');
      const colorEl = document.getElementById('imp-file-color');
      const file    = fileEl?.files?.[0];
      if (!file) { Utils.showToast('Select a GeoJSON file first', 'error'); return; }
      const name  = nameEl?.value?.trim() || file.name.replace(/\.(geojson|json)$/i, '');
      const color = colorEl?.value || '#2980b9';
      LayerManager._showLoading(`Loading "${name}"…`);
      try {
        const geojson = await Utils.parseGeoJSONFile(file);
        await window.LayerManager.importGeoJSON(geojson, name, color);
        if (fileEl)  fileEl.value  = '';
        if (nameEl)  nameEl.value  = '';
      } catch(e) {
        Utils.showToast('Error: ' + e.message, 'error');
      } finally {
        LayerManager._hideLoading();
      }
    });
  },

  // ─── CONTRIBUTE ───────────────────────────────────────────

  _bindContribute() {
    document.getElementById('btn-start-contribute')?.addEventListener('click', () => {
      document.getElementById('contrib-status-block').style.display = 'none';
      document.getElementById('contrib-form-block').style.display   = '';
      window.App?.setContributionMode(true);
      Utils.showToast('Click on the map to place a marker', 'info');
    });

    document.getElementById('btn-cancel-contribute')?.addEventListener('click', () => {
      this._cancelContribute();
    });

    document.getElementById('contribute-form')?.addEventListener('submit', e => {
      e.preventDefault();
      const fd  = new FormData(e.target);
      const lat = parseFloat(fd.get('lat')), lng = parseFloat(fd.get('lng'));
      const name = fd.get('name'), type = fd.get('type');
      if (!name || !type || isNaN(lat) || isNaN(lng)) {
        Utils.showToast('Fill all required fields and set position by clicking the map', 'error');
        return;
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
    document.getElementById('contrib-form-block').style.display   = 'none';
    window.App?.setContributionMode(false);
  },

  // Called from ContributionTool / App when user clicks map
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
    if (!features.length) {
      ul.innerHTML = '<li style="color:var(--color-text-muted);font-size:.8rem;padding:6px 0;">No contributions yet</li>';
      return;
    }
    ul.innerHTML = features.map(f => {
      const p = f.properties, co = f.geometry.coordinates;
      return `<li class="contrib-item">
        <div>
          <span class="contrib-type">${Utils.typeLabel(p.type)}</span>
          ${p.name ? `<span class="contrib-name">${p.name}</span>` : ''}
          <code class="contrib-coords">${Utils.formatCoords(co[1], co[0], 4)}</code>
        </div>
        <button class="btn btn-small" style="color:var(--color-error)" onclick="UIManager.removeContrib('${p._id}')">✕</button>
      </li>`;
    }).join('');
  },

  removeContrib(id) {
    window.LayerManager?.removeContribution(id);
    this.updateContribList();
  },

  // ─── CONTRIBUTION LAYER FILE CONTROLS ─────────────────────

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
        Utils.downloadFile(JSON.stringify(g, null, 2), `wom_contributions_${new Date().toISOString().split('T')[0]}.geojson`);
        Utils.showToast(`Saved ${g.features.length} contributions`, 'success');
      } else Utils.showToast('No contributions to save', 'info');
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
      } catch(err) { Utils.showToast('Failed: ' + err.message, 'error'); }
      e.target.value = '';
    });
  },

  // ─── EXPORT ───────────────────────────────────────────────

  _bindExport() {
    document.getElementById('btn-download-geojson')?.addEventListener('click', () => {
      window.LayerManager?.exportAll({
        datasets:      document.getElementById('export-datasets')?.checked ?? true,
        contributions: document.getElementById('export-contributions')?.checked ?? true,
        imported:      document.getElementById('export-imported')?.checked ?? true
      });
    });
  },

  // ─── FEATURE INFO ─────────────────────────────────────────

  showFeatureInfo(f, id) {
    const panel   = document.getElementById('feature-info');
    const content = document.querySelector('.feature-info-content');
    if (!panel || !content) return;
    const p = f.properties || {}, co = f.geometry?.coordinates || [0, 0];
    let h = `<h4>${p.name||p.Name||p.NAME||p.ID||p.id||p.EAMENA_ID||'Unnamed'}</h4>`;
    h += `<p style="font-size:.7rem;color:var(--color-text-muted);margin-bottom:8px;">${id} · ${Utils.formatCoords(co[1],co[0],6)}</p>`;
    h += '<table style="width:100%;font-size:.78rem;border-collapse:collapse;">';
    const skip = ['_layer','_source_layer','_id','FID','OBJECTID'];
    for (const [k, v] of Object.entries(p)) {
      if (skip.includes(k) || v === null || v === undefined || v === '' || v === 'None') continue;
      const label = k.replace(/_/g,' ').replace(/\b\w/g, x => x.toUpperCase());
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
