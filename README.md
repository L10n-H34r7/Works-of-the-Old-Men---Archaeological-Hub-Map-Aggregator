# Works of the Old Men - Archaeological Hub & Map Aggregator

A WIP vibecoded (neat), open-source, simply navigated website serving as the central reference hub for "The Works of the Old Men"—the ancient pre-Islamic stone geoglyphs and living structures found across the Arabian Peninsula (from North to South) extending across the Red Sea into East Africa and more archeological discovery.

The information and maps are scattered around the idea is to have them all in one place and foreverybody to get involved.

## Features

- **Super Map Aggregator**: Aggregates multiple datasets (GlobalKites, EAMENA, Pleiades, OpenStreetMap) onto one unified map
- **High-Resolution Satellite View**: Uses Esri World Imagery for easy visual identification of ruins
- **Layer Toggles**: Easy selection of which datasets to overlay (GlobalKites sublayers, EAMENA, Pleiades, OSM)
- **No External Redirects**: All cartographic exploration happens directly on the map
- **Interactive Research Tool**: Click-to-contribute functionality for researchers to add new structure points
- **Filtering**: Filter by structure type (kites, funerary, monumental) and region
- **Export**: Download visible layers as GeoJSON
- **Responsive Design**: Works on desktop and mobile

## Data Sources

| Dataset | Source | Features | License |
|---------|--------|----------|---------|
| **GlobalKites** | [Zenodo](https://doi.org/10.5281/zenodo.14844953) | 6,721+ desert kites | CC BY 4.0 |
| **EAMENA** | [EAMENA Database](https://database.eamena.org/) | Heritage places across MENA | Open Access | https://zenodo.org/communities/eamena/records?q=&l=list&p=1&s=10&sort=newest
| **Pleiades** | [Pleiades Gazetteer](https://pleiades.stoa.org/) | 31,000+ ancient places | CC BY 3.0 |
| **OpenStreetMap** | Overpass API | Archaeological sites tagged in OSM | ODbL |

## Structure Types (GlobalKites)

- **Desert Kites** - Massive hunting traps with driving walls
- **Open Kites** - V/W/C-shaped open structures
- **V-Shaped** - Simple V-shaped traps
- **Crescents** - Crescent-shaped structures
- **Rings** - Circular/ring structures
- **Sample 610** - Detailed morphological sample

## Quick Start

### Option 1: Python HTTP Server (Recommended)
```bash
cd works-of-old-men
python3 -m http.server 8000
# Open http://localhost:8000
```

### Option 2: Node.js http-server
```bash
cd works-of-old-men
npx http-server -p 8000
```

### Option 3: VS Code Live Server
Right-click `index.html` → "Open with Live Server"

## Project Structure

```
works-of-old-men/
├── index.html              # Main application
├── css/
│   └── style.css           # Styling
├── js/
│   ├── app.js              # Main application logic
│   ├── map.js              # Map initialization & base layers
│   ├── layers.js           # Data layer management
│   ├── ui.js               # UI components & panels
│   ├── contrib.js          # Contribution tool
│   └── utils.js            # Helper functions
├── data/
│   └── globalkites/        # Converted GeoJSON files
│       ├── kites.geojson
│       ├── openkites.geojson
│       ├── sample610.geojson
│       ├── vshaped.geojson
│       ├── crescents.geojson
│       ├── rings.geojson
│       ├── combined.geojson
│       └── metadata.json
├── convert_esri_to_geojson.py  # Data conversion script
└── README.md
```

## Usage

### Map Navigation
- **Pan**: Click and drag
- **Zoom**: Scroll wheel, +/− buttons, or double-click
- **Basemap**: Choose Satellite, OpenStreetMap, or Hybrid from Layers panel

### Layer Controls
1. Open **Layers** panel (top navigation)
2. Toggle GlobalKites sublayers on/off
3. Enable external layers (EAMENA, Pleiades, OSM)
4. Use **Type Filter** and **Region Filter** to narrow results

### Contributing Structures
1. Open **Contribute** panel
2. Click **"Start Adding"**
3. Click on the map where you see a structure
4. Fill in the form (name, type, description, source)
5. Click **"Save Structure"**
6. Your contribution appears on the map and in the list

### Exporting Data
1. Open **Export** panel
2. Choose which layers to include
3. Click **"Download GeoJSON"** for combined export
4. Or click individual layer buttons for single-layer exports

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+L` | Toggle Layers panel |
| `Ctrl+C` | Toggle Contribute panel |
| `Ctrl+E` | Toggle Export panel |
| `Escape` | Close all panels |

## Development

### Adding New Data Sources

1. Add layer definition to `layerDefinitions` in `js/layers.js`
2. Implement loader function (local file, API, Overpass, etc.)
3. Add toggle UI in `index.html` or `js/ui.js`
4. Style markers in `js/utils.js` (`getMarkerIcon`, `getTypeColor`)

### Converting New ESRI JSON Data

```bash
python3 convert_esri_to_geojson.py
```

The script reads ESRI JSON from `data/globalkites/` and outputs GeoJSON.

## License

- **Application Code**: MIT License
- **GlobalKites Data**: CC BY 4.0 (cite Barge et al. 2024)
- **EAMENA Data**: Open Access (cite EAMENA Project)
- **Pleiades Data**: CC BY 3.0 (cite Pleiades Gazetteer)
- **OpenStreetMap Data**: ODbL (cite OpenStreetMap contributors)

## Citation

If you use this hub in research, please cite:

> Works of the Old Men Archaeological Hub. [This application]. Data aggregated from GlobalKites (Barge et al. 2024), EAMENA, Pleiades, and OpenStreetMap.

### GlobalKites Citation
> Barge, O., Régagnon, E., Abu-Azizeh, W., Bouzid, S., Brochier, J., & Crassard, R. (2024). *Desert kites and related constructions*. Zenodo. https://doi.org/10.5281/zenodo.14844953

## Acknowledgments

- **GlobalKites Project** (CNRS, Université Lyon 2, Archéorient) for the comprehensive desert kite dataset
- **EAMENA Project** (Oxford, Leicester, Durham) for endangered archaeology data
- **Pleiades Gazetteer** (NYU/ISAW) for ancient places data
- **OpenStreetMap** contributors for community-mapped features
- **Esri** for World Imagery basemap
- **Leaflet** for the mapping library

## Browser Support

- Chrome/Edge 80+
- Firefox 75+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome for Android)

## Performance Notes

- GlobalKites layers load on-demand when toggled
- Client-side filtering for responsive interaction
- For 6,721+ points, clustering is recommended for production (add Leaflet.markercluster)

---

*Built for the archaeological community. Open source, open data, open science.*
