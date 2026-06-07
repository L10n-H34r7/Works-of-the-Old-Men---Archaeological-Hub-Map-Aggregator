# Works of the Old Men - Archaeological Hub & Map Aggregator

https://l10n-h34r7.github.io/Works-of-the-Old-Men---Archaeological-Hub-Map-Aggregator/

A WIP vibecoded, open-source, simply navigated website serving as the central reference hub for "The Works of the Old Men"—the ancient pre-Islamic stone geoglyphs and living structures found across the Arabian Peninsula (from North to South) extending across the Red Sea into East Africa and more archeological discovery.

The information and maps are scattered around the idea is to have them all in one place and foreverybody to get involved.

Ideas : implement a layer of sites that where excavated and documented with links to papers and videos documentaries
Include get involved section.

WIP : 
To add a new dataset in the future: just drop the GeoJSON in data/yourfolder/ and add one entry to datasets.json — it appears automatically on next load. No code changes needed.

Proposition the same culture extend from south africa up to fertile crescent and more. from paleo -> neo -> bronze 
many incredible place are still to be found ! Andthe connections between these places and these people.


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

**GlobalKites** | [Zenodo](https://doi.org/10.5281/zenodo.14844953) | 6,721+ desert kites | CC BY 4.0 |
**EAMENA** | [EAMENA Database](https://zenodo.org/communities/eamena/records?q=&l=list&p=1&s=10&sort=newest) |

### Converting New ESRI JSON Data

```bash
python3 convert_esri_to_geojson.py
```

The script reads ESRI JSON from `data/globalkites/` and outputs GeoJSON.


*Built for the archaeological community. Open source, open data, open science.*
