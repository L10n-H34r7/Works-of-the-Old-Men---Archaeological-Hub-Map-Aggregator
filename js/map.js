/** Map initialization and base layer management */

const MapManager = {
  map: null, baseLayers: {}, hybridLabels: null, currentBasemap: 'satellite', initialized: false,

  init(containerId = 'map') {
    if (this.initialized) return this.map;

    // Bing Aerial using the public tile endpoint that works without quadkeys
    // (Virtualearth tiles via a compatible XYZ wrapper)
    const bingAttrib = 'Imagery &copy; Microsoft Bing Maps';

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
      ),
      // Bing Aerial via OpenAerialMap-compatible WMTS endpoint
      bing: this._createBingLayer()
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

  // Bing uses quadkey tile naming. We use a TileLayer with a custom getTileUrl override.
  _createBingLayer() {
    const BingLayer = L.TileLayer.extend({
      getTileUrl(coords) {
        const z = coords.z;
        let x = coords.x, y = coords.y;
        let quad = '';
        for (let i = z; i > 0; i--) {
          let digit = 0;
          const mask = 1 << (i - 1);
          if ((x & mask) !== 0) digit += 1;
          if ((y & mask) !== 0) digit += 2;
          quad += digit;
        }
        // Use subdomain cycling t0–t3
        const sub = ['t0','t1','t2','t3'][Math.abs(coords.x + coords.y) % 4];
        return `https://${sub}.ssl.ak.tiles.virtualearth.net/tiles/a${quad}.jpeg?g=1`;
      }
    });
    return new BingLayer('', {
      attribution: 'Imagery &copy; Microsoft Bing Maps',
      maxZoom: 19, id: 'bing'
    });
  },

  setBasemap(b) {
    if (!this.baseLayers[b]) return;
    const ids = Object.keys(this.baseLayers);
    this.map.eachLayer(l => {
      if (l.options?.id && ids.includes(l.options.id)) this.map.removeLayer(l);
    });
    this.map.removeLayer(this.hybridLabels);
    this.map.addLayer(this.baseLayers[b]);
    if (b === 'hybrid') { this.map.addLayer(this.hybridLabels); this.hybridLabels.bringToFront(); }
    this.currentBasemap = b;
    document.querySelectorAll('input[name="basemap"]').forEach(i => i.checked = (i.value === b));
  },

  getMap() { return this.map; },
  fitBounds(b, o = {}) { try { if (b?.isValid()) this.map.fitBounds(b, { padding:[30,30], maxZoom:13, ...o }); } catch(e){} },
  getBounds() { return this.map.getBounds(); },
  addLayer(l) { this.map.addLayer(l); },
  removeLayer(l) { this.map.removeLayer(l); },
  hasLayer(l) { return this.map.hasLayer(l); }
};

window.MapManager = MapManager;
