#!/usr/bin/env python3
"""
Israel (LLLL) NOTAM Fetcher & Geographic Parser
================================================
Fetches NOTAMs from IAA AeroInfo API (or loads from file), extracts deterministic
geometries (Polygons, Circles, Points) and generates standard GeoJSON for map display.

Usage:
    # 1. Parse sample / local JSON file:
    python3 fetch_and_parse_notams.py --input raw_notams.json

    # 2. Fetch directly from IAA API using browser cookies:
    python3 fetch_and_parse_notams.py --cookie "__uzma=...; uzmx=..." --uzlc "7f90..."

    # 3. Test with built-in real-world NOTAM examples:
    python3 fetch_and_parse_notams.py --test
"""

import os
import sys
import re
import json
import argparse
import urllib.request
import urllib.error
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple

# ---------------------------------------------------------------------------
# Coordinate Conversion & Math
# ---------------------------------------------------------------------------

def dms_to_decimal(deg: float, minutes: float, seconds: float, direction: str) -> float:
    """Convert degrees, minutes, seconds to decimal degrees."""
    dec = deg + (minutes / 60.0) + (seconds / 3600.0)
    if direction.upper() in ('S', 'W'):
        dec = -dec
    return round(dec, 6)

def parse_coordinate_token(lat_str: str, lon_str: str) -> Optional[Tuple[float, float]]:
    """
    Parse latitude and longitude strings in ICAO formats:
    - DDMMSS[N/S] DDDMMSS[E/W]   (e.g., 325643N 0355342E)
    - DDMM.MM[N/S] DDDMM.MM[E/W] (e.g., 3256.4N 03553.7E)
    - DDMM[N/S] DDDMM[E/W]       (e.g., 3301N 03549E)
    Returns: (latitude, longitude) as float tuples
    """
    lat_m = re.match(r'^(\d{2})(\d{2})(?:(\d{2})|(?:\.(\d+)))?([NS])$', lat_str.strip().upper())
    lon_m = re.match(r'^(\d{3})(\d{2})(?:(\d{2})|(?:\.(\d+)))?([EW])$', lon_str.strip().upper())

    if not lat_m or not lon_m:
        return None

    # Latitude
    lat_deg = int(lat_m.group(1))
    lat_min = int(lat_m.group(2))
    if lat_m.group(3):
        lat_sec = float(lat_m.group(3))
    elif lat_m.group(4):
        lat_sec = float('0.' + lat_m.group(4)) * 60.0
    else:
        lat_sec = 0.0
    lat_dec = dms_to_decimal(lat_deg, lat_min, lat_sec, lat_m.group(5))

    # Longitude
    lon_deg = int(lon_m.group(1))
    lon_min = int(lon_m.group(2))
    if lon_m.group(3):
        lon_sec = float(lon_m.group(3))
    elif lon_m.group(4):
        lon_sec = float('0.' + lon_m.group(4)) * 60.0
    else:
        lon_sec = 0.0
    lon_dec = dms_to_decimal(lon_deg, lon_min, lon_sec, lon_m.group(5))

    # Sanity bounding box check (Levant / Eastern Mediterranean / Israel FIR)
    if 25.0 <= lat_dec <= 37.0 and 30.0 <= lon_dec <= 39.0:
        return (lat_dec, lon_dec)
    elif -90 <= lat_dec <= 90 and -180 <= lon_dec <= 180:
        return (lat_dec, lon_dec)

    return None

# ---------------------------------------------------------------------------
# ICAO NOTAM Component Parsers
# ---------------------------------------------------------------------------

def parse_q_line(q_text: str) -> Dict[str, Any]:
    """
    Parse ICAO Q-line (Qualifiers line).
    Format: Q) FIR/QCODE/TRAFFIC/PURPOSE/SCOPE/LOWER/UPPER/COORD_RADIUS
    Example: Q) LLLL/QAELC/IV/NBO/E /000/090/3301N03549E006
    """
    result = {
        'fir': 'LLLL',
        'q_code': None,
        'subject': None,
        'condition': None,
        'traffic': None,
        'purpose': None,
        'scope': None,
        'lower_fl': None,
        'upper_fl': None,
        'center': None,
        'radius_nm': None,
        'radius_m': None
    }
    m = re.search(
        r'Q\)\s*([A-Z]{4})/([A-Z]{5})/([A-Z]+)/([A-Z]+)/([A-Z]+)\s*/(\d{3})/(\d{3})/(\d{4}[NS]\d{5}[EW])(\d{3})',
        q_text
    )
    if m:
        result['fir'] = m.group(1)
        qcode = m.group(2)
        result['q_code'] = qcode
        result['subject'] = qcode[1:3]
        result['condition'] = qcode[3:5]
        result['traffic'] = m.group(3)
        result['purpose'] = m.group(4)
        result['scope'] = m.group(5)
        result['lower_fl'] = int(m.group(6))
        result['upper_fl'] = int(m.group(7))

        coord_str = m.group(8)
        radius_nm = int(m.group(9))
        result['radius_nm'] = radius_nm
        result['radius_m'] = round(radius_nm * 1852.0, 1)

        pt = parse_coordinate_token(coord_str[:5], coord_str[5:])
        if pt:
            result['center'] = {'lat': pt[0], 'lng': pt[1]}

    return result

def extract_item_e_polygons(e_text: str) -> List[List[Tuple[float, float]]]:
    """
    Deterministically extract coordinate sequence polygons from Item E text.
    Detects sequences like:
    325643N0355342E 325613N0354517E 330323N0354356E 330648N0354855E ...
    """
    coord_pattern = re.compile(
        r'(\d{2}\d{2}(?:\d{2}|\.\d+)?[NS])\s*(\d{3}\d{2}(?:\d{2}|\.\d+)?[EW])',
        re.IGNORECASE
    )

    matches = list(coord_pattern.finditer(e_text))
    if not matches:
        return []

    polygons = []
    current_poly = []
    last_end = None

    for m in matches:
        start, end = m.span()
        if last_end is not None:
            sep = e_text[last_end:start].strip()
            # If separator has substantial narrative text, break polygon
            if sep and not re.match(r'^(?:-|–|to|,|\n|\s|and|\.)*$', sep, re.IGNORECASE):
                if len(current_poly) >= 3:
                    polygons.append(current_poly)
                current_poly = []

        pt = parse_coordinate_token(m.group(1), m.group(2))
        if pt:
            current_poly.append(pt)
        last_end = end

    if len(current_poly) >= 3:
        polygons.append(current_poly)

    return polygons

def extract_item_e_circles(e_text: str) -> List[Dict[str, Any]]:
    """
    Extract circles explicitly defined in Item E.
    e.g. "WI A RADIUS OF 2NM CENTRED ON 315320N0344415E"
    """
    circles = []
    # Pattern 1: Radius before coordinates
    p1 = re.compile(
        r'(?:RADIUS\s+OF|RADIUS|WI\s+A\s+RADIUS\s+OF|WITHIN\s+A\s+RADIUS\s+OF)\s*(\d+(?:\.\d+)?)\s*(NM|M|KM|FT)\s*(?:CENTRED|CENTERED|CENTRED\s+ON|AT|AROUND)?\s*(?:PSN\s*)?(\d{2}\d{2}(?:\d{2}|\.\d+)?[NS])\s*(\d{3}\d{2}(?:\d{2}|\.\d+)?[EW])',
        re.IGNORECASE
    )
    for m in p1.finditer(e_text):
        r_val = float(m.group(1))
        unit = m.group(2).upper()
        pt = parse_coordinate_token(m.group(3), m.group(4))
        if pt:
            r_m = r_val * 1852.0 if unit == 'NM' else (r_val * 1000.0 if unit == 'KM' else (r_val * 0.3048 if unit == 'FT' else r_val))
            circles.append({
                'center': {'lat': pt[0], 'lng': pt[1]},
                'radius_meters': round(r_m, 1),
                'radius_nm': round(r_m / 1852.0, 2)
            })

    # Pattern 2: Coordinates before radius
    p2 = re.compile(
        r'(\d{2}\d{2}(?:\d{2}|\.\d+)?[NS])\s*(\d{3}\d{2}(?:\d{2}|\.\d+)?[EW])\s*(?:WITH\s+A\s+RADIUS\s+OF|RADIUS\s+OF|RADIUS)\s*(\d+(?:\.\d+)?)\s*(NM|M|KM|FT)',
        re.IGNORECASE
    )
    for m in p2.finditer(e_text):
        pt = parse_coordinate_token(m.group(1), m.group(2))
        r_val = float(m.group(3))
        unit = m.group(4).upper()
        if pt:
            r_m = r_val * 1852.0 if unit == 'NM' else (r_val * 1000.0 if unit == 'KM' else (r_val * 0.3048 if unit == 'FT' else r_val))
            circles.append({
                'center': {'lat': pt[0], 'lng': pt[1]},
                'radius_meters': round(r_m, 1),
                'radius_nm': round(r_m / 1852.0, 2)
            })

    return circles

def extract_item_e_points(e_text: str) -> List[Dict[str, Any]]:
    """Extract standalone coordinate points from Item E (e.g. cranes, obstacles)."""
    points = []
    p = re.compile(
        r'(\d{2}\d{2}(?:\d{2}|\.\d+)?[NS])\s*(\d{3}\d{2}(?:\d{2}|\.\d+)?[EW])',
        re.IGNORECASE
    )
    for m in p.finditer(e_text):
        pt = parse_coordinate_token(m.group(1), m.group(2))
        if pt:
            points.append({'lat': pt[0], 'lng': pt[1]})
    return points

# ---------------------------------------------------------------------------
# Full NOTAM Text Parsing
# ---------------------------------------------------------------------------

def parse_notam_message(raw_text: str, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Parse a complete ICAO NOTAM text into a structured dictionary with geospatial representations.
    """
    parsed = {
        'id': metadata.get('notamID') if metadata else None,
        'type': metadata.get('messageType') if metadata else None,
        'fir': 'LLLL',
        'q_line': None,
        'validity': {
            'start': None,
            'end': None,
            'schedule': None
        },
        'vertical_limits': {
            'lower': None,
            'upper': None
        },
        'text_e': '',
        'geometries': []
    }

    # Extract ID / Type from header if not provided in metadata
    if not parsed['id']:
        id_m = re.search(r'\(([A-Z]\d{4}/\d{2})\s+(NOTAM[NRC])', raw_text)
        if id_m:
            parsed['id'] = id_m.group(1)
            parsed['type'] = id_m.group(2)

    # Extract Q-line
    q_m = re.search(r'Q\)\s*([^\n\r]+)', raw_text)
    if q_m:
        parsed['q_line'] = parse_q_line('Q) ' + q_m.group(1))

    # Extract B) start time (YYMMDDHHMM)
    b_m = re.search(r'B\)\s*(\d{10})', raw_text)
    if b_m:
        parsed['validity']['start'] = b_m.group(1)

    # Extract C) end time
    c_m = re.search(r'C\)\s*(\d{10}|PERM)', raw_text)
    if c_m:
        parsed['validity']['end'] = c_m.group(1)

    # Extract D) schedule
    d_m = re.search(r'D\)\s*([^\n\r]+)', raw_text)
    if d_m:
        parsed['validity']['schedule'] = d_m.group(1).strip()

    # Extract E) main body text
    e_m = re.search(r'E\)\s*(.*?)(?=\n[F-G]\)|(?:\)\))|$)', raw_text, re.DOTALL)
    if e_m:
        parsed['text_e'] = e_m.group(1).strip()
    else:
        # Fallback if no E) prefix
        parsed['text_e'] = raw_text.strip()

    # Extract F) Lower altitude limit
    f_m = re.search(r'F\)\s*([^G\n\r\)]+?)(?=\s*G\)|$|\n|\r)', raw_text)
    if f_m:
        parsed['vertical_limits']['lower'] = f_m.group(1).strip()
    elif parsed['q_line'] and parsed['q_line']['lower_fl'] is not None:
        lfl = parsed['q_line']['lower_fl']
        parsed['vertical_limits']['lower'] = f"FL{lfl:03d}" if lfl > 0 else 'GND'

    # Extract G) Upper altitude limit
    g_m = re.search(r'G\)\s*([^\n\r\)]+)', raw_text)
    if g_m:
        parsed['vertical_limits']['upper'] = g_m.group(1).strip()
    elif parsed['q_line'] and parsed['q_line']['upper_fl'] is not None:
        ufl = parsed['q_line']['upper_fl']
        parsed['vertical_limits']['upper'] = f"FL{ufl:03d}" if ufl < 999 else 'UNL'

    # --- GEOMETRY EXTRACTION HIERARCHY ---
    # 1. Polygons in Item E
    e_polygons = extract_item_e_polygons(parsed['text_e'])
    if e_polygons:
        for poly in e_polygons:
            coords = [[pt[1], pt[0]] for pt in poly] # [lng, lat]
            if coords[0] != coords[-1]:
                coords.append(coords[0])
            parsed['geometries'].append({
                'type': 'Polygon',
                'source': 'Item E explicit boundary',
                'coordinates': [coords],
                'leaflet_latlngs': [[pt[0], pt[1]] for pt in poly]
            })

    # 2. Explicit Circles in Item E
    e_circles = extract_item_e_circles(parsed['text_e'])
    if e_circles:
        for circle in e_circles:
            parsed['geometries'].append({
                'type': 'Circle',
                'source': 'Item E explicit radius',
                'center': circle['center'],
                'radius_meters': circle['radius_meters'],
                'radius_nm': circle['radius_nm']
            })

    # 3. Fallback to Q-line influence radius (if no polygon/circle in E, and radius is localized < 999 NM)
    if not parsed['geometries'] and parsed['q_line']:
        q = parsed['q_line']
        if q['center'] and q['radius_nm'] and 0 < q['radius_nm'] < 999:
            parsed['geometries'].append({
                'type': 'Circle',
                'source': 'Q-line influence radius',
                'center': q['center'],
                'radius_meters': q['radius_m'],
                'radius_nm': q['radius_nm']
            })

    # 4. Point feature (obstacles, antennas, cranes)
    if not parsed['geometries']:
        pts = extract_item_e_points(parsed['text_e'])
        if len(pts) == 1:
            parsed['geometries'].append({
                'type': 'Point',
                'source': 'Item E point coordinate',
                'coordinates': [pts[0]['lng'], pts[0]['lat']],
                'leaflet_latlng': [pts[0]['lat'], pts[0]['lng']]
            })

    return parsed

# ---------------------------------------------------------------------------
# GeoJSON Converter
# ---------------------------------------------------------------------------

def notams_to_geojson(parsed_notams: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Convert parsed NOTAM records into standard RFC 7946 GeoJSON FeatureCollection."""
    features = []
    for n in parsed_notams:
        for idx, geom in enumerate(n['geometries']):
            feat = {
                'type': 'Feature',
                'properties': {
                    'notam_id': n['id'],
                    'type': n['type'],
                    'q_code': n['q_line']['q_code'] if n['q_line'] else None,
                    'start_time': n['validity']['start'],
                    'end_time': n['validity']['end'],
                    'schedule': n['validity']['schedule'],
                    'lower_limit': n['vertical_limits']['lower'],
                    'upper_limit': n['vertical_limits']['upper'],
                    'text': n['text_e'],
                    'geometry_type': geom['type'],
                    'source': geom['source']
                }
            }
            if geom['type'] == 'Polygon':
                feat['geometry'] = {
                    'type': 'Polygon',
                    'coordinates': geom['coordinates']
                }
            elif geom['type'] == 'Circle':
                feat['geometry'] = {
                    'type': 'Point',
                    'coordinates': [geom['center']['lng'], geom['center']['lat']]
                }
                feat['properties']['radius_meters'] = geom['radius_meters']
                feat['properties']['radius_nm'] = geom['radius_nm']
                feat['properties']['is_circle'] = True
            elif geom['type'] == 'Point':
                feat['geometry'] = {
                    'type': 'Point',
                    'coordinates': geom['coordinates']
                }
            features.append(feat)

    return {
        'type': 'FeatureCollection',
        'features': features
    }

# ---------------------------------------------------------------------------
# API Fetcher
# ---------------------------------------------------------------------------

def fetch_iaa_notams(cookies: str, uzlc_token: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Fetch raw NOTAM JSON from the official IAA AeroInfo API.
    Requires browser session cookies due to Radware Bot Manager.
    """
    url = 'https://aeroinfo.iaa.gov.il/api/api/AeroInfo/GetNotams'
    payload = json.dumps({
        "fromDate": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:00:00.000Z"),
        "hoursAhead": "0",
        "regions": "North,Center,South",
        "locations": "LLLL",
        "series": "3",
        "nonActive": False
    }).encode('utf-8')

    headers = {
        'accept': '*/*',
        'accept-language': 'en-IL,en-GB;q=0.9,en-US;q=0.8,en;q=0.7,he;q=0.6',
        'content-type': 'application/json',
        'origin': 'https://aeroinfo.iaa.gov.il',
        'referer': 'https://aeroinfo.iaa.gov.il/Notams',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36',
        'cookie': cookies
    }
    if uzlc_token:
        headers['uzlc'] = uzlc_token

    req = urllib.request.Request(url, data=payload, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = resp.read()
            return json.loads(data.decode('utf-8'))
    except urllib.error.HTTPError as e:
        print(f"HTTP Error {e.code}: {e.reason}", file=sys.stderr)
        if e.code == 302:
            print("Note: Radware Bot Manager returned 302 Redirect. Updated session cookies/tokens required.", file=sys.stderr)
        raise
    except Exception as e:
        print(f"Fetch failed: {e}", file=sys.stderr)
        raise

# ---------------------------------------------------------------------------
# Main Execution / CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Israel NOTAMs Geographic Parser")
    parser.add_argument('--input', '-i', help="Path to raw NOTAMs JSON file (e.g. from browser export)")
    parser.add_argument('--output', '-o', default="notams.geojson", help="Output GeoJSON path (default: notams.geojson)")
    parser.add_argument('--cookie', help="Browser session cookies string from aeroinfo.iaa.gov.il")
    parser.add_argument('--uzlc', help="Radware uzlc header token")
    parser.add_argument('--test', action='store_true', help="Run demonstration with sample Israeli NOTAMs")

    args = parser.parse_args()

    raw_items = []
    if args.test or (not args.input and not args.cookie):
        print("[*] Running in TEST mode using realistic LLLL (Israel) NOTAM samples...")
        sample_texts = [
            """(C2439/26 NOTAMN
Q) LLLL/QAELC/IV/NBO/E /000/090/3301N03549E006
A) LLLL B) 2611200345 C) 2611201000
D) 0345-0700 0745-1000
E) AN AREA AT KESHET/GOLAN-HEIGHTS BTN FLW PSN CLSD FM GND
   UP TO 9,000FT AMSL, TO ALL FLT INCLUDING AGRICULTURE FLT:
   325643N0355342E 325613N0354517E 330323N0354356E 330648N0354855E
   330602N0355058E 325816N0355235E.
   CTN ADZ.))""",
            """(A0512/26 NOTAMN
Q) LLLL/QWPLW/IV/M/W /000/015/3153N03444E002
A) LLLL B) 2611210600 C) 2611211400
E) UNMANNED ACFT ACT WILL TAKE PLACE WI A RADIUS OF 2NM CENTRED ON
   315320N0344415E (PALMAHIM).
F) GND G) 1500FT AMSL)""",
            """(C1820/26 NOTAMN
Q) LLLL/QOBCE/IV/M/AE /000/003/3204N03447E001
A) LLLL B) 2611150500 C) 2612311600
E) TEMPORARY CRANE ERECTED AT PSN 320432N0344715E (TEL AVIV),
   ELEVATION 280FT AMSL, HGT 120FT AGL. FLG AND LGTD.)""",
            """(A0490/26 NOTAMN
Q) LLLL/QWLLW/IV/M/W /000/050/3146N03513E003
A) LLLL B) 2611221700 C) 2611222100
E) LASER EMISSION WILL TAKE PLACE IN JERUSALEM AREA. CTN ADZ.)"""
        ]
        for t in sample_texts:
            raw_items.append({'messageText': t})
    elif args.input:
        print(f"[*] Loading NOTAMs from file: {args.input}")
        with open(args.input, 'r', encoding='utf-8') as f:
            data = json.load(f)
            raw_items = data if isinstance(data, list) else [data]
    elif args.cookie:
        print("[*] Fetching live NOTAMs from IAA AeroInfo API...")
        raw_items = fetch_iaa_notams(args.cookie, args.uzlc)

    parsed_notams = []
    poly_count = 0
    circle_count = 0
    point_count = 0

    for item in raw_items:
        text = item.get('messageText') or item.get('text') or str(item)
        parsed = parse_notam_message(text, metadata=item if isinstance(item, dict) else None)
        parsed_notams.append(parsed)

        for g in parsed['geometries']:
            if g['type'] == 'Polygon':
                poly_count += 1
            elif g['type'] == 'Circle':
                circle_count += 1
            elif g['type'] == 'Point':
                point_count += 1

    # Convert to GeoJSON
    geojson = notams_to_geojson(parsed_notams)

    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(geojson, f, indent=2)

    print("\n" + "=" * 60)
    print("NOTAM GEOGRAPHIC PARSING SUMMARY")
    print("=" * 60)
    print(f"Total NOTAMs Processed     : {len(parsed_notams)}")
    print(f"Polygons Extracted (Areas) : {poly_count}")
    print(f"Circles Extracted (Radius) : {circle_count}")
    print(f"Points Extracted (Obstacles): {point_count}")
    print(f"Total Visual Map Features  : {len(geojson['features'])}")
    print(f"Output GeoJSON saved to    : {args.output}")
    print("=" * 60)

if __name__ == '__main__':
    main()
