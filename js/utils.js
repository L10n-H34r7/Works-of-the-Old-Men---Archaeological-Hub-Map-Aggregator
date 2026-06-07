/** Utility functions for Works of the Old Men application */

const Utils = {
  formatCoords(lat, lng, precision = 6) {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lngDir = lng >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(precision)}°${latDir}, ${Math.abs(lng).toFixed(precision)}°${lngDir}`;
  },

  haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },

  toRad(deg) { return deg * Math.PI / 180; },

  generateId() { return 'wom_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9); },

  debounce(fn, delay) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), delay); }; },

  throttle(fn, limit) {
    let inThrottle;
    return (...a) => { if (!inThrottle) { fn(...a); inThrottle = true; setTimeout(() => inThrottle = false, limit); } };
  },

  deepClone(obj) { return JSON.parse(JSON.stringify(obj)); },

  formatNumber(num) { return (num || 0).toLocaleString(); },

  getTypeDisplayName(type) {
    const names = {
      'kite': 'Desert Kite', 'open-kite': 'Open Kite', 'v-shaped': 'V-Shaped Kite',
      'crescent': 'Crescent', 'ring': 'Ring', 'mustatil': 'Mustatil / Gate',
      'wheel': 'Wheel', 'pendant': 'Pendant', 'cairn': 'Cairn / Tomb',
      'wall': 'Meandering Wall', 'settlement': 'Settlement / Enclosure',
      'rock-art': 'Rock Art / Inscriptions', 'other': 'Other'
    };
    return names[type] || type;
  },

  getTypeColor(type) {
    const colors = {
      'kite': '#e74c3c', 'open-kite': '#e67e22', 'v-shaped': '#f39c12',
      'crescent': '#9b59b6', 'ring': '#8e44ad', 'mustatil': '#27ae60',
      'wheel': '#2980b9', 'pendant': '#16a085', 'cairn': '#7f8c8d',
      'wall': '#95a5a6', 'settlement': '#34495e', 'rock-art': '#c0392b', 'other': '#3498db'
    };
    return colors[type] || '#3498db';
  },

  getMarkerIcon(type, isContribution = false) {
    return this.getMarkerIconColor(this.getTypeColor(type), isContribution);
  },

  getMarkerIconColor(color, isContribution = false) {
    const size = isContribution ? 28 : 20;
    const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      ${isContribution
        ? `<circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="${color}" stroke="white" stroke-width="2.5" opacity="0.95"/><circle cx="${size/2}" cy="${size/2}" r="${size/4}" fill="white" opacity="0.7"/>`
        : `<circle cx="${size/2}" cy="${size/2}" r="${size/2 - 1}" fill="${color}" stroke="rgba(0,0,0,0.3)" stroke-width="1.2" opacity="0.88"/>`
      }
    </svg>`;
    const className = `marker-custom${isContribution ? ' marker-contribution' : ''}`;
    return L.divIcon({
      className,
      html: svg,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2]
    });
  },

  isValidFeature(f) {
    return f && f.type === 'Feature' && f.geometry && f.geometry.type === 'Point' &&
      Array.isArray(f.geometry.coordinates) && f.geometry.coordinates.length >= 2 &&
      typeof f.geometry.coordinates[0] === 'number' && typeof f.geometry.coordinates[1] === 'number';
  },

  createFeatureFromData(data) {
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [data.lng, data.lat] },
      properties: {
        name: data.name, type: data.type, subtype: data.subtype || '',
        description: data.description || '', source: data.source || '',
        contributor: data.contributor || 'Anonymous',
        date_added: new Date().toISOString(),
        _layer: 'contributions', _id: this.generateId()
      }
    };
  },

  showToast(msg, type = 'info', dur = 3500) {
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    t.style.cssText = `position:fixed;bottom:80px;left:50%;transform:translateX(-50%);padding:12px 24px;border-radius:8px;background:${type === 'error' ? '#c0392b' : type === 'success' ? '#27ae60' : '#2c5f4a'};color:#fff;font-size:.875rem;font-weight:500;box-shadow:0 8px 24px rgba(0,0,0,.12);z-index:3000;animation:slideUp .3s ease;max-width:90vw;text-align:center;`;
    document.body.appendChild(t);
    setTimeout(() => { t.style.animation = 'slideUp .3s ease reverse'; setTimeout(() => t.remove(), 300); }, dur);
  },

  downloadFile(content, filename, mime = 'application/json') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  async parseGeoJSONFile(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = e => {
        try {
          const d = JSON.parse(e.target.result);
          if (d.type === 'FeatureCollection' && Array.isArray(d.features)) res(d);
          else if (d.type === 'Feature') res({ type: 'FeatureCollection', features: [d] });
          else rej(new Error('Invalid GeoJSON'));
        } catch (err) { rej(err); }
      };
      r.onerror = () => rej(new Error('Failed to read'));
      r.readAsText(file);
    });
  }
};

const style = document.createElement('style');
style.textContent = `@keyframes slideUp { from { opacity: 0; transform: translateX(-50%) translateY(20px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }`;
document.head.appendChild(style);

window.Utils = Utils;
