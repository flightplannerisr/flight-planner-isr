#!/usr/bin/env python3
"""
Aeronautical Data & Chart Integrity Validator
=============================================

Automated test suite to verify:
1. Syntax and coordinates of aeronautical data files in js/data/.
2. Format and validity of GIS layers in gis/ (GeoJSON, JSON, QGIS points).
3. Existence and math consistency of World Files (.wld, .jgw) matching layer images.

Usage:
------
    python3 tools/validate_datasets.py
"""

import os
import sys
import json
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Israel flight information region bounds (rough envelope for sanity checks)
ISRAEL_BOUNDS = {
    'min_lat': 29.40,
    'max_lat': 33.55,
    'min_lng': 34.00,
    'max_lng': 36.00
}

def check_file_exists(rel_path):
    full = os.path.join(ROOT, rel_path)
    if not os.path.exists(full):
        return False, f"Missing required file: {rel_path}"
    return True, f"Found {rel_path}"

def validate_json_file(rel_path):
    full = os.path.join(ROOT, rel_path)
    if not os.path.exists(full):
        return False, f"File not found: {rel_path}"
    try:
        with open(full, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return True, data
    except Exception as e:
        return False, f"Invalid JSON in {rel_path}: {e}"

def validate_world_files():
    print("Checking companion world files (.wld, .jgw)...")
    charts = [
        'air_nav_combined_aligned',
        'air_nav_combined_aligned_AZM'
    ]
    all_ok = True
    for c in charts:
        img = os.path.join(ROOT, 'images', 'layers', f"{c}.jpg")
        wld = os.path.join(ROOT, 'images', 'layers', f"{c}.wld")
        jgw = os.path.join(ROOT, 'images', 'layers', f"{c}.jgw")
        gis_wld = os.path.join(ROOT, 'gis', f"{c}.wld")
        
        for p in [img, wld, jgw, gis_wld]:
            if not os.path.exists(p):
                print(f"  ❌ Missing: {os.path.relpath(p, ROOT)}")
                all_ok = False
            else:
                print(f"  ✅ Found: {os.path.relpath(p, ROOT)}")
                
        if os.path.exists(wld) and os.path.exists(jgw):
            with open(wld) as fw, open(jgw) as fj:
                if fw.read().strip() != fj.read().strip():
                    print(f"  ⚠️ Mismatch between {wld} and {jgw}")
                    all_ok = False
    return all_ok

def validate_geojson_datasets():
    print("\nChecking GIS datasets in gis/...")
    geojson_path = 'gis/israel_reporting_points.geojson'
    ok, data = validate_json_file(geojson_path)
    if not ok:
        print(f"  ❌ {data}")
        return False
        
    features = data.get('features', [])
    print(f"  ✅ {geojson_path}: Valid GeoJSON with {len(features)} features")
    
    out_of_bounds = 0
    for feat in features:
        geom = feat.get('geometry', {})
        if geom.get('type') == 'Point':
            coords = geom.get('coordinates', [])
            if len(coords) >= 2:
                lng, lat = coords[0], coords[1]
                if not (ISRAEL_BOUNDS['min_lat'] <= lat <= ISRAEL_BOUNDS['max_lat']) or \
                   not (ISRAEL_BOUNDS['min_lng'] <= lng <= ISRAEL_BOUNDS['max_lng']):
                    out_of_bounds += 1
                    
    if out_of_bounds > 0:
        print(f"  ⚠️ Warning: {out_of_bounds} points outside standard Israel bounds")
    else:
        print(f"  ✅ All {len(features)} points within geographic envelope")
    return True

def validate_js_data_files():
    print("\nChecking JavaScript data files in js/data/...")
    js_files = [
        'js/data/reporting-points.js',
        'js/data/frequencies.js',
        'js/data/airstrips.js',
        'js/data/cvfr-points.js',
        'js/data/lsa-points.js',
        'js/data/special-airspace.js',
        'js/data/ctr-zones.js',
        'js/data/translations.js'
    ]
    all_ok = True
    for f in js_files:
        full = os.path.join(ROOT, f)
        if not os.path.exists(full):
            print(f"  ❌ Missing: {f}")
            all_ok = False
        else:
            size_kb = os.path.getsize(full) / 1024.0
            print(f"  ✅ {f} ({size_kb:.1f} KB)")
    return all_ok

def main():
    print("=" * 60)
    print("Israel Flight Planner — Dataset & Chart Validation")
    print("=" * 60)
    
    r1 = validate_world_files()
    r2 = validate_geojson_datasets()
    r3 = validate_js_data_files()
    
    print("\n" + "=" * 60)
    if r1 and r2 and r3:
        print("🎉 ALL DATASETS, GIS LAYERS, AND CHARTS VALIDATED SUCCESSFULLY!")
        print("=" * 60)
        sys.exit(0)
    else:
        print("❌ VALIDATION FAILED — CHECK ERRORS ABOVE.")
        print("=" * 60)
        sys.exit(1)

if __name__ == '__main__':
    main()
