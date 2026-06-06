#!/usr/bin/env python3
"""
Convert ESRI JSON format (from GlobalKites Zenodo) to standard GeoJSON.
"""

import json
from pathlib import Path

def esri_to_geojson(esri_data, layer_name="layer"):
    features = []
    for feat in esri_data.get("features", []):
        attrs = feat.get("attributes", {})
        geom = feat.get("geometry", {})
        coords = None
        if "x" in geom and "y" in geom:
            coords = [geom["x"], geom["y"]]
        elif "paths" in geom:
            coords = geom["paths"]
        elif "rings" in geom:
            coords = geom["rings"]
        if coords is None:
            continue
        geom_type = esri_data.get("geometryType", "esriGeometryPoint")
        if geom_type == "esriGeometryPoint":
            geojson_type = "Point"
        elif geom_type == "esriGeometryPolyline":
            geojson_type = "LineString" if isinstance(coords[0], (int, float)) else "MultiLineString"
        elif geom_type == "esriGeometryPolygon":
            geojson_type = "Polygon"
        else:
            geojson_type = "Point"
        props = {k: v for k, v in attrs.items() if k != "FID"}
        props["_layer"] = layer_name
        features.append({
            "type": "Feature",
            "geometry": {"type": geojson_type, "coordinates": coords},
            "properties": props
        })
    return {"type": "FeatureCollection", "name": layer_name, "features": features}

def main():
    data_dir = Path("/home/user/works-of-old-men/data/globalkites")
    files_to_convert = [
        ("Kites.json", "kites.geojson", "GlobalKites - All Kites"),
        ("OpenKites.json", "openkites.geojson", "GlobalKites - Open Kites"),
        ("Sample610.json", "sample610.geojson", "GlobalKites - Sample 610"),
        ("Vshaped.json", "vshaped.geojson", "GlobalKites - V-Shaped"),
        ("Crescents.json", "crescents.geojson", "GlobalKites - Crescents"),
        ("Rings.json", "rings.geojson", "GlobalKites - Rings"),
    ]
    all_features = []
    layer_metadata = []
    for input_file, output_file, layer_name in files_to_convert:
        input_path = data_dir / input_file
        output_path = data_dir / output_file
        if not input_path.exists():
            print(f"Warning: {input_path} not found, skipping")
            continue
        with open(input_path, 'r') as f:
            esri_data = json.load(f)
        geojson = esri_to_geojson(esri_data, layer_name)
        with open(output_path, 'w') as f:
            json.dump(geojson, f, separators=(',', ':'))
        print(f"Converted {input_file} -> {output_file} ({len(geojson['features'])} features)")
        layer_metadata.append({
            "id": output_file.replace(".geojson", ""),
            "name": layer_name,
            "file": output_file,
            "feature_count": len(geojson["features"]),
            "geometry_type": geojson["features"][0]["geometry"]["type"] if geojson["features"] else "Point"
        })
        for feat in geojson["features"]:
            feat["properties"]["_source_layer"] = output_file.replace(".geojson", "")
        all_features.extend(geojson["features"])
    combined = {"type": "FeatureCollection", "name": "GlobalKites - Combined", "features": all_features}
    combined_path = data_dir / "combined.geojson"
    with open(combined_path, 'w') as f:
        json.dump(combined, f, separators=(',', ':'))
    print(f"\nCreated combined dataset: {len(all_features)} total features")
    metadata = {
        "dataset": "GlobalKites",
        "source": "Zenodo: https://doi.org/10.5281/zenodo.14844953",
        "license": "CC BY 4.0",
        "citation": "Barge, O., Régagnon, E., Abu-Azizeh, W., Bouzid, S., Brochier, J., & Crassard, R. (2024). Desert kites and related constructions. Zenodo. https://doi.org/10.5281/zenodo.14844953",
        "layers": layer_metadata,
        "total_features": len(all_features)
    }
    metadata_path = data_dir / "metadata.json"
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    print(f"Created metadata file: {metadata_path}")

if __name__ == "__main__":
    main()
