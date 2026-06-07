/** Contribution Tool – click-to-place marker */

const ContributionTool = {
  map: null, enabled: false, tempMarker: null,

  init(map) { this.map = map; },

  enable() {
    if (this.enabled) return;
    this.enabled = true;
    this.map.getContainer().style.cursor = 'crosshair';
  },

  disable() {
    if (!this.enabled) return;
    this.enabled = false;
    this.map.getContainer().style.cursor = '';
    this._removeTempMarker();
  },

  onMapClick(e) {
    const { lat, lng } = e.latlng;
    this._showTempMarker(e.latlng);
    window.UIManager?.setContributionCoords(lat, lng);
    Utils.showToast(`Position: ${Utils.formatCoords(lat, lng, 5)}`, 'info', 1800);
  },

  _showTempMarker(ll) {
    const icon = L.divIcon({
      className: '',
      html: `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="14" fill="#f39c12" stroke="white" stroke-width="3" opacity=".92"/>
        <circle cx="16" cy="16" r="5" fill="white" opacity=".85"/>
      </svg>`,
      iconSize: [32,32], iconAnchor: [16,16]
    });
    if (this.tempMarker) this.tempMarker.setLatLng(ll);
    else this.tempMarker = L.marker(ll, { icon, interactive: false, zIndexOffset: 1000 }).addTo(this.map);
  },

  _removeTempMarker() {
    if (this.tempMarker) { this.map.removeLayer(this.tempMarker); this.tempMarker = null; }
  }
};

window.ContributionTool = ContributionTool;
