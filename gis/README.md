# Israel Flight Planner — GIS & Georeferencing Assets

This directory contains the spatial reference datasets, World Files (`.wld` / `.jgw`), Ground Control Points (`.points`), and GeoJSON layers used to calibrate and georeference the aeronautical charts in the flight planner.

---

## 1. World Files (`.wld` / `.jgw`)
The raster maps in `images/layers/` are rendered in **EPSG:3857 (WGS 84 / Pseudo-Mercator)** to align pixel-for-pixel with standard Leaflet/OSM/Google Maps web tiles:

| Raster Image | Companion World Files | Coverage (WGS 84) | Resolution |
| :--- | :--- | :--- | :--- |
| `air_nav_combined_aligned.jpg` (4,154 × 10,315 px) | `images/layers/air_nav_combined_aligned.jgw`<br>`images/layers/air_nav_combined_aligned.wld`<br>`gis/air_nav_combined_aligned.wld` | **S**: 29.505837° · **N**: 33.425343°<br>**W**: 34.087530° · **E**: 35.938721° | ~49.61 m/px |
| `air_nav_combined_aligned_AZM.jpg` (4,164 × 10,292 px) | `images/layers/air_nav_combined_aligned_AZM.jgw`<br>`images/layers/air_nav_combined_aligned_AZM.wld`<br>`gis/air_nav_combined_aligned_AZM.wld` | **S**: 29.507471° · **N**: 33.424702°<br>**W**: 34.079555° · **E**: 35.938279° | ~49.69 m/px |

- Complete bounding box and affine parameters are detailed in [gis/georeferencing_metadata.json](file:///home/ubuntu/flight-planner-isr-dev/gis/georeferencing_metadata.json).

---

## 2. Ground Control Points (GCP)
- **[gis/air_nav_calibration_points.points](file:///home/ubuntu/flight-planner-isr-dev/gis/air_nav_calibration_points.points)**: QGIS Georeferencer format file containing the 40 vector grid intersection points used to fit and calibrate the Air Nav Chart raster against AIP B-08 coordinates.
- **[gis/air_nav_calibration_points.json](file:///home/ubuntu/flight-planner-isr-dev/gis/air_nav_calibration_points.json)**: JSON export containing pixel coordinates `{x, y}` mapped to geographic `{lat, lng}`.

---

## 3. Aeronautical GIS Layers
- **[gis/israel_reporting_points.geojson](file:///home/ubuntu/flight-planner-isr-dev/gis/israel_reporting_points.geojson)**: Official Israel VFR/CVFR reporting points formatted as a GeoJSON FeatureCollection with attributes (Hebrew name, English name, type, and coordinates).
- **[gis/israel_reporting_points.json](file:///home/ubuntu/flight-planner-isr-dev/gis/israel_reporting_points.json)**: JSON export of reporting points for direct integration with external flight planning software and GIS databases.

---

## 4. Opening in QGIS
1. Ensure the raster (`.jpg`) and companion `.wld` or `.jgw` file are located in the same folder.
2. In QGIS, navigate to **Layer > Add Layer > Add Raster Layer...** and select `air_nav_combined_aligned.jpg` (or `air_nav_combined_aligned_AZM.jpg`).
3. Set the layer CRS to **EPSG:3857 (WGS 84 / Pseudo-Mercator)**.
4. The map will automatically load in its exact geographic position in Israel without requiring manual alignment.
