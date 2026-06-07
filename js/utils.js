/** Utility functions */

const Utils = {
  formatCoords(lat, lng, precision = 6) {
    const latDir = lat >= 0 ? 'N' : 'S', lngDir = lng >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(precision)}°${latDir}, ${Math.abs(lng).toFixed(precision)}°${lngDir}`;
  },

  generateId() { return 'wom_' + Date.now() + '_' + Math.random().toString(36).substr(2,9); },

  formatNumber(n) { return (n||0).toLocaleString(); },

  typeLabel(type) {
    const m = { kite:'Desert Kite','open-kite':'Open Kite','v-shaped':'V-Shaped Kite',
      crescent:'Crescent', ring:'Ring', mustatil:'Mustatil / Gate', wheel:'Wheel',
      pendant:'Pendant', cairn:'Cairn / Tomb', wall:'Meandering Wall',
      settlement:'Settlement', 'rock-art':'Rock Art', other:'Other' };
    return m[type] || type || 'Unknown';
  },

  makeIcon(color, isContrib = false) {
    const sz = isContrib ? 28 : 18;
    const svg = isContrib
      ? `<svg width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}" xmlns="http://www.w3.org/2000/svg"><circle cx="${sz/2}" cy="${sz/2}" r="${sz/2-2}" fill="${color}" stroke="white" stroke-width="2.5"/><circle cx="${sz/2}" cy="${sz/2}" r="${sz/4}" fill="white" opacity=".7"/></svg>`
      : `<svg width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}" xmlns="http://www.w3.org/2000/svg"><circle cx="${sz/2}" cy="${sz/2}" r="${sz/2-1}" fill="${color}" stroke="rgba(0,0,0,.25)" stroke-width="1"/></svg>`;
    return L.divIcon({
      className: '',
      html: svg,
      iconSize: [sz,sz],
      iconAnchor: [sz/2,sz/2],
      popupAnchor: [0,-sz/2]
    });
  },

  createFeature(d) {
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [d.lng, d.lat] },
      properties: {
        name: d.name, type: d.type, subtype: d.subtype||'',
        description: d.description||'', source: d.source||'',
        contributor: d.contributor||'Anonymous',
        date_added: new Date().toISOString(),
        _layer: 'contributions', _id: this.generateId()
      }
    };
  },

  showToast(msg, type='info', dur=3200) {
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
      padding:10px 22px;border-radius:8px;z-index:9999;font-size:.85rem;font-weight:500;
      color:#fff;box-shadow:0 4px 16px rgba(0,0,0,.2);pointer-events:none;
      background:${type==='error'?'#c0392b':type==='success'?'#27ae60':'#2c5f4a'};
      animation:fadeUp .25s ease;max-width:90vw;text-align:center;`;
    document.body.appendChild(el);
    setTimeout(()=>el.remove(), dur);
  },

  downloadFile(content, filename) {
    const blob = new Blob([content], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  async parseGeoJSONFile(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = e => {
        try {
          let d = JSON.parse(e.target.result);
          if (d.type === 'Feature') d = { type:'FeatureCollection', features:[d] };
          if (d.type === 'FeatureCollection' && Array.isArray(d.features)) resolve(d);
          else reject(new Error('Not a valid GeoJSON'));
        } catch(err) { reject(err); }
      };
      r.onerror = () => reject(new Error('Failed to read file'));
      r.readAsText(file);
    });
  }
};

// CSS animations
const _style = document.createElement('style');
_style.textContent = `
  @keyframes fadeUp { from{opacity:0;transform:translateX(-50%) translateY(10px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
`;
document.head.appendChild(_style);

window.Utils = Utils;
