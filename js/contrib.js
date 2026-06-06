/** Contribution Tool - click-to-add on map */

const ContributionTool = { map:null, enabled:false, tempMarker:null, clickHandler:null,

  init(map){ this.map=map; },

  enable(){ if(this.enabled) return; this.enabled=true; this.map.getContainer().style.cursor='crosshair'; this.clickHandler=e=>this.onMapClick(e); this.map.on('click',this.clickHandler); this.showTempMarker(this.map.getCenter()); },

  disable(){ if(!this.enabled) return; this.enabled=false; this.map.getContainer().style.cursor=''; this.map.off('click',this.clickHandler); this.clickHandler=null; this.removeTempMarker(); },

  onMapClick(e){ const lat=e.latlng.lat, lng=e.latlng.lng; this.showTempMarker(e.latlng); window.UIManager?.setContributionCoords(lat,lng); Utils.showToast(`Position set: ${Utils.formatCoords(lat,lng,6)}`,'info',2000); },

  showTempMarker(ll){ if(this.tempMarker) this.tempMarker.setLatLng(ll); else this.tempMarker=L.marker(ll,{icon:L.divIcon({className:'marker-temp',html:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32"><circle cx="12" cy="12" r="10" fill="none" stroke="#2c5f4a" stroke-width="3" stroke-dasharray="8,4"/><circle cx="12" cy="12" r="5" fill="#2c5f4a"/></svg>`,iconSize:[32,32],iconAnchor:[16,16]}),interactive:false,zIndexOffset:1000}).addTo(this.map); },

  removeTempMarker(){ if(this.tempMarker){ this.map.removeLayer(this.tempMarker); this.tempMarker=null; } },

  isEnabled(){ return this.enabled; }
};

window.ContributionTool = ContributionTool;
