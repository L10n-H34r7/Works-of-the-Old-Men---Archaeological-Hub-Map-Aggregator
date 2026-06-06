/** Main Application */

const App = { initialized:false, contributionMode:false,

  async init(){
    if(this.initialized) return; console.log('Initializing Works of the Old Men Hub...');
    try{
      this.showLoading('Initializing map...');
      await this.waitForLeaflet();
      
      MapManager.init('map'); this.map = MapManager.getMap();
      LayerManager.init(this.map); UIManager.init(); ContributionTool.init(this.map);
      this.setupGlobalEvents(); this.addCustomStyles();
      this.initialized=true; this.hideLoading(); console.log('Works of the Old Men Hub ready!');
      setTimeout(()=>Utils.showToast('Welcome to Works of the Old Men Hub','success'),500);
    }catch(e){ console.error('Init failed:',e); this.hideLoading(); Utils.showToast('Failed to initialize: ' + e.message,'error'); }
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

  setupGlobalEvents(){
    document.querySelectorAll('input[name="basemap"]').forEach(i=>i.addEventListener('change',e=>MapManager.setBasemap(e.target.value)));
    const cb=document.querySelector('.feature-info-close'); if(cb) cb.addEventListener('click',()=>UIManager.hideFeatureInfo());
    this.map.on('click',()=>UIManager.hideFeatureInfo());
    this.map.on('click',e=>{ if(this.contributionMode&&!e.originalEvent?.target?.closest('.leaflet-popup')) ContributionTool.onMapClick(e); });
  },

  addCustomStyles(){
    const s=document.createElement('style'); s.textContent=`
      .custom-popup .leaflet-popup-content-wrapper{border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,.15);}
      .custom-popup .leaflet-popup-content{margin:12px 16px;max-width:280px;}
      .popup-content h4{margin:0 0 8px;font-size:.95rem;color:#2c5f4a;}
      .popup-meta{margin:4px 0;font-size:.8rem;}.popup-meta strong{color:#333;}
      .popup-coords{margin-top:8px;padding-top:8px;border-top:1px solid #eee;font-size:.7rem;color:#888;font-family:monospace;}
      .marker-temp svg{animation:pulse 2s ease-in-out infinite;}
      @keyframes pulse{0%,100%{transform:scale(1);opacity:1;}50%{transform:scale(1.1);opacity:.7;}}
      .marker-contribution svg{filter:drop-shadow(0 2px 4px rgba(0,0,0,.3));}
      .empty-state{padding:16px;text-align:center;color:#999;font-size:.8rem;}
      #export-layer-list .btn{text-align:left;}
      #map { width: 100%; height: 100%; display: block; visibility: visible; }
      .leaflet-container { background: #f5f2eb; }
    `; document.head.appendChild(s);
  },

  setContributionMode(en){ this.contributionMode=en; if(en) ContributionTool.enable(); else ContributionTool.disable(); },

  showLoading(t='Loading...'){ const o=document.getElementById('loading-overlay'), te=document.getElementById('loading-text'); if(o&&te){ te.textContent=t; o.hidden=false; } },
  hideLoading(){ const o=document.getElementById('loading-overlay'); if(o) o.hidden=true; }
};

document.addEventListener('DOMContentLoaded',()=>App.init()); window.App=App;
