/** Contribution Tool - click-to-add on map */

const ContributionTool = {
  map: null, enabled: false, tempMarker: null, clickHandler: null,

  init(map) { this.map = map; },

  enable() {
    if (this.enabled) return;
    this.enabled = true;
    this.map.getContainer().style.cursor = 'crosshair';
    this.clickHandler = e => this.onMapClick(e);
    this.map.on('click', this.clickHandler);
    this.showTempMarker(this.map.getCenter());
  },

  disable() {
    if (!this.enabled) return;
    this.enabled = false;
    this.map.getContainer().style.cursor = '';
    this.map.off('click', this.clickHandler);
    this.clickHandler = null;
    this.removeTempMarker();
  },

  onMapClick(e) {
    const lat = e.latlng.lat, lng = e.latlng.lng;
    this.showTempMarker(e.latlng);
    window.UIManager?.setContributionCoords(lat, lng);
    Utils.showToast(`Position set: ${Utils.formatCoords(lat, lng, 6)}`, 'info', 2000);
  },

  showTempMarker(ll) {
    const icon = L.divIcon({
      className: 'marker-temp',
      html: `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="14" fill="#f39c12" stroke="white" stroke-width="3" opacity="0.9"/><circle cx="16" cy="16" r="6" fill="white" opacity="0.8"/></svg>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
    if (this.tempMarker) this.tempMarker.setLatLng(ll);
    else this.tempMarker = L.marker(ll, { icon, interactive: false, zIndexOffset: 1000 }).addTo(this.map);
  },

  removeTempMarker() {
    if (this.tempMarker) { this.map.removeLayer(this.tempMarker); this.tempMarker = null; }
  },

  isEnabled() { return this.enabled; }
};

window.ContributionTool = ContributionTool;
