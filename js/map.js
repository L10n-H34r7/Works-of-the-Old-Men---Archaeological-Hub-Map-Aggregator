/** Map initialization and base layer management */

const MapManager = {
  map: null, baseLayers: {}, hybridLabels: null, currentBasemap: 'satellite', initialized: false,

  init(containerId = 'map') {
    if (this.initialized) return this.map;

    this.baseLayers = {
      satellite: L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { attribution: 'Tiles &copy; Esri', maxZoom: 19, id: 'satellite' }
      ),
      hybrid: L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { attribution: 'Tiles &copy; Esri', maxZoom: 19, id: 'hybrid' }
      ),
      'google-sat': L.tileLayer(
        'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
        { attribution: '&copy; Google Maps', maxZoom: 20, id: 'google-sat' }
      ),
      'google-hybrid': L.tileLayer(
        'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
        { attribution: '&copy; Google Maps', maxZoom: 20, id: 'google-hybrid' }
      )
    };

    this.hybridLabels = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Labels &copy; Esri', maxZoom: 19, pane: 'overlayPane' }
    );

    this.map = L.map(containerId, {
      center: [23.5, 45.0], zoom: 5,
      layers: [this.baseLayers.satellite],
      zoomControl: true, scrollWheelZoom: true,
      doubleClickZoom: true, boxZoom: true,
      keyboard: true, tap: true, touchZoom: true
    });

    this.initialized = true;
    return this.map;
  },

  setBasemap(b) {
    if (!this.baseLayers[b]) return;
    const ids = Object.keys(this.baseLayers);
    this.map.eachLayer(l => {
      if (l.options && l.options.id && ids.includes(l.options.id)) this.map.removeLayer(l);
    });
    this.map.removeLayer(this.hybridLabels);
    this.map.addLayer(this.baseLayers[b]);
    if (b === 'hybrid') { this.map.addLayer(this.hybridLabels); this.hybridLabels.bringToFront(); }
    this.currentBasemap = b;
    document.querySelectorAll('input[name="basemap"]').forEach(i => i.checked = (i.value === b));
  },

  getMap() { return this.map; },
  fitBounds(b, o = {}) { try { if (b && b.isValid()) this.map.fitBounds(b, { padding: [30, 30], maxZoom: 13, ...o }); } catch(e){} },
  getBounds() { return this.map.getBounds(); },
  addLayer(l) { this.map.addLayer(l); },
  removeLayer(l) { this.map.removeLayer(l); },
  hasLayer(l) { return this.map.hasLayer(l); }
};

window.MapManager = MapManager;
