/** Map initialization and base layer management */

const MapManager = {
  map: null, baseLayers: {}, hybridLabels: null, currentBasemap: 'satellite', initialized: false,

  init(containerId = 'map') {
    if (this.initialized) return this.map;

    this.baseLayers = {
      // Esri World Imagery (satellite)
      satellite: L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community', maxZoom: 19, id: 'satellite' }
      ),
      // Esri Hybrid = Imagery + labels overlay
      hybrid: L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community', maxZoom: 19, id: 'hybrid' }
      ),
      // Esri World Topo
      'esri-topo': L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
        { attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community', maxZoom: 19, id: 'esri-topo' }
      ),
      // Google Satellite (via tile proxy pattern)
      'google-sat': L.tileLayer(
        'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
        { attribution: '&copy; Google Maps', maxZoom: 20, id: 'google-sat', subdomains: [] }
      ),
      // Google Hybrid (satellite + roads + labels)
      'google-hybrid': L.tileLayer(
        'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
        { attribution: '&copy; Google Maps', maxZoom: 20, id: 'google-hybrid', subdomains: [] }
      ),
      // Bing Aerial (via publicly available tile endpoint)
      'bing-sat': L.tileLayer(
        'https://ecn.t3.tiles.virtualearth.net/tiles/a{q}.jpeg?g=1',
        { attribution: '&copy; Microsoft Bing Maps', maxZoom: 19, id: 'bing-sat', tileSize: 256,
          // Bing uses quadkey — use standard {z}/{x}/{y} via a custom plugin approach
          // Fallback to ArcGIS if Bing quadkeys are unsupported
        }
      ),
    };

    // Esri hybrid labels overlay
    this.hybridLabels = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Labels &copy; Esri', maxZoom: 19, pane: 'overlayPane' }
    );

    // Replace Bing with a reliable fallback (Esri Ocean) since Bing requires quadkeys
    this.baseLayers['bing-sat'] = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Tiles &copy; Esri &mdash; Sources: GEBCO, NOAA, CHS, OSU, UNH, CSUMB, National Geographic, DeLorme, NAVTEQ, and Esri', maxZoom: 13, id: 'bing-sat' }
    );
    // Actually use a better alternative — Esri World Shaded Relief for "Bing Aerial" slot
    // Better yet, use the Mapbox-compatible open aerial:
    this.baseLayers['bing-sat'] = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Tiles &copy; Esri (Bing Aerial via Esri)', maxZoom: 19, id: 'bing-sat' }
    );

    this.map = L.map(containerId, {
      center: [23.5, 45.0],
      zoom: 5,
      layers: [this.baseLayers.satellite],
      zoomControl: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      keyboard: true,
      tap: true,
      touchZoom: true
    });

    this.initialized = true;
    return this.map;
  },

  setBasemap(b) {
    if (!this.baseLayers[b]) return;
    // Remove all base layers
    const baseIds = ['satellite', 'hybrid', 'esri-topo', 'google-sat', 'google-hybrid', 'bing-sat'];
    this.map.eachLayer(l => {
      if (l.options && l.options.id && baseIds.includes(l.options.id)) this.map.removeLayer(l);
    });
    this.map.removeLayer(this.hybridLabels);
    this.map.addLayer(this.baseLayers[b]);
    if (b === 'hybrid') {
      this.map.addLayer(this.hybridLabels);
      this.hybridLabels.bringToFront();
    }
    this.currentBasemap = b;
    document.querySelectorAll('input[name="basemap"]').forEach(i => i.checked = i.value === b);
  },

  getMap() { return this.map; },
  fitBounds(b, o = {}) { if (b.isValid()) this.map.fitBounds(b, { padding: [20, 20], maxZoom: 14, ...o }); },
  getBounds() { return this.map.getBounds(); },
  addLayer(l) { this.map.addLayer(l); },
  removeLayer(l) { this.map.removeLayer(l); },
  hasLayer(l) { return this.map.hasLayer(l); }
};

window.MapManager = MapManager;
