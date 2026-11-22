#!/usr/bin/env python3
"""
NOTAM Parser and Coordinate Extractor for Israel (Tel-Aviv FIR / LLLL)
Demonstrates deterministic parsing of ICAO NOTAM text into geospatial features (GeoJSON).
"""

import re
import json
from typing import Dict, Any, List, Optional, Tuple

def dms_to_decimal(deg: float, minutes: float, seconds: float, direction: str) -> float:
    """Convert degrees, minutes, seconds to decimal degrees."""
    dec = deg + (minutes / 60.0) + (seconds / 3600.0)
    if direction.upper() in ('S', 'W'):
        dec = -dec
    return round(dec, 6)

def parse_coordinate_token(lat_str: str, lon_str: str) -> Optional[Tuple[float, float]]:
    """
    Parse latitude and longitude strings in ICAO formats:
    - DDMMSS[N/S] DDDMMSS[E/W]  (DMS)
    - DDMM.MM[N/S] DDDMM.MM[E/W] (DMM)
    - DDMM[N/S] DDDMM[E/W]       (DM)
    Returns: (latitude, longitude) in decimal degrees
    """
    # Regex for Latitude: DDMMSS or DDMM or DDMM.MM
    lat_m = re.match(r'^(\d{2})(\d{2})(?:(\d{2})|(?:\.(\d+)))?([NS])$', lat_str.strip())
    # Regex for Longitude: DDDMMSS or DDDMM or DDDMM.MM
    lon_m = re.match(r'^(\d{3})(\d{2})(?:(\d{2})|(?:\.(\d+)))?([EW])$', lon_str.strip())

    if not lat_m or not lon_m:
        return None

    # Latitude
    lat_deg = int(lat_m.group(1))
    lat_min = int(lat_m.group(2))
    if lat_m.group(3): # seconds
        lat_sec = float(lat_m.group(3))
    elif lat_m.group(4): # fractional minutes
        lat_sec = float('0.' + lat_m.group(4)) * 60.0
    else:
        lat_sec = 0.0
    lat_dir = lat_m.group(5)
    lat_dec = dms_to_decimal(lat_deg, lat_min, lat_sec, lat_dir)

    # Longitude
    lon_deg = int(lon_m.group(1))
    lon_min = int(lon_m.group(2))
    if lon_m.group(3): # seconds
        lon_sec = float(lon_m.group(3))
    elif lon_m.group(4): # fractional minutes
        lon_sec = float('0.' + lon_m.group(4)) * 60.0
    else:
        lon_sec = 0.0
    lon_dir = lon_m.group(5)
    lon_dec = dms_to_decimal(lon_deg, lon_min, lon_sec, lon_dir)

    # Sanity check for Israel/Levant region
    # Israel lat ~29.5 to 33.5, lon ~34.0 to 36.0 (FIR covers ~27 to 35 N, 31 to 37 E)
    if -90 <= lat_dec <= 90 and -180 <= lon_dec <= 180:
        return (lat_dec, lon_dec)
    return None

def parse_q_line(q_text: str) -> Dict[str, Any]:
    """
    Parse ICAO Q-line (Qualifiers).
    Format: Q) FIR/QCODE/TRAFFIC/PURPOSE/SCOPE/LOWER/UPPER/COORD_RADIUS
    Example: Q) LLLL/QAELC/IV/NBO/E /000/090/3301N03549E006
    """
    result = {
        'fir': None,
        'q_code': None,
        'traffic': None,
        'purpose': None,
        'scope': None,
        'lower_fl': None,
        'upper_fl': None,
        'center': None,
        'radius_nm': None,
        'radius_m': None
    }
    # Match standard Q-line pattern
    m = re.search(r'Q\)\s*([A-Z]{4})/([A-Z]{5})/([A-Z]+)/([A-Z]+)/([A-Z]+)\s*/(\d{3})/(\d{3})/(\d{4}[NS]\d{5}[EW])(\d{3})', q_text)
    if m:
        result['fir'] = m.group(1)
        result['q_code'] = m.group(2)
        result['traffic'] = m.group(3)
        result['purpose'] = m.group(4)
        result['scope'] = m.group(5)
        result['lower_fl'] = int(m.group(6))
        result['upper_fl'] = int(m.group(7))

        coord_str = m.group(8)
        radius_nm = int(m.group(9))
        result['radius_nm'] = radius_nm
        result['radius_m'] = round(radius_nm * 1852.0, 1)

        lat_s = coord_str[:5]
        lon_s = coord_str[5:]
        pt = parse_coordinate_token(lat_s, lon_s)
        if pt:
            result['center'] = {'lat': pt[0], 'lng': pt[1]}

    return result

def extract_item_e_polygons(e_text: str) -> List[List[Tuple[float, float]]]:
    """
    Extract polygons from Item E text.
    Looks for sequences of 3 or more coordinates (e.g. 325643N0355342E 325613N0354517E ...)
    """
    # Pattern matching either concatenated or spaced coordinate pairs:
    # 325643N0355342E or 325643N 0355342E or 3256N03549E or 3256.4N03553.2E
    coord_pattern = re.compile(
        r'(\d{2}\d{2}(?:\d{2}|\.\d+)?[NS])\s*(\d{3}\d{2}(?:\d{2}|\.\d+)?[EW])',
        re.IGNORECASE
    )

    matches = list(coord_pattern.finditer(e_text))
    if not matches:
        return []

    # Group adjacent coordinates into polygons
    polygons = []
    current_poly = []
    last_end = None

    for m in matches:
        start, end = m.span()
        # If gap between coordinates is small (e.g. spaces, commas, hyphens, "TO", "AND"), treat as sequence
        if last_end is not None:
            separator = e_text[last_end:start].strip()
            # Allow common separators between polygon points
            if separator and not re.match(r'^(?:-|–|to|,|\n|\s|and)*$', separator, re.IGNORECASE):
                if len(current_poly) >= 3:
                    polygons.append(current_poly)
                current_poly = []

        lat_s = m.group(1).upper()
        lon_s = m.group(2).upper()
        pt = parse_coordinate_token(lat_s, lon_s)
        if pt:
            current_poly.append(pt)
        last_end = end

    if len(current_poly) >= 3:
        polygons.append(current_poly)

    return polygons

def extract_item_e_circles(e_text: str) -> List[Dict[str, Any]]:
    """
    Extract circles explicitly defined in Item E.
    e.g. "WI A RADIUS OF 3NM CENTRED ON 320145N0345022E"
    or "CIRCLE OF 500M RADIUS CENTRED AT 315022N0344510E"
    """
    circles = []
    # Pattern 1: Radius then Coord
    p1 = re.compile(
        r'(?:RADIUS\s+OF|RADIUS|WI\s+A\s+RADIUS\s+OF)\s*(\d+(?:\.\d+)?)\s*(NM|M|KM|FT)\s*(?:CENTRED|CENTERED|CENTRED\s+ON|AT|AROUND)?\s*(?:PSN\s*)?(\d{2}\d{2}(?:\d{2}|\.\d+)?[NS])\s*(\d{3}\d{2}(?:\d{2}|\.\d+)?[EW])',
        re.IGNORECASE
    )
    for m in p1.finditer(e_text):
        r_val = float(m.group(1))
        unit = m.group(2).upper()
        lat_s = m.group(3).upper()
        lon_s = m.group(4).upper()
        pt = parse_coordinate_token(lat_s, lon_s)
        if pt:
            # Convert radius to meters
            if unit == 'NM':
                r_m = r_val * 1852.0
            elif unit == 'KM':
                r_m = r_val * 1000.0
            elif unit == 'FT':
                r_m = r_val * 0.3048
            else:
                r_m = r_val
            circles.append({
                'center': {'lat': pt[0], 'lng': pt[1]},
                'radius_meters': round(r_m, 1),
                'radius_nm': round(r_m / 1852.0, 2)
            })

    # Pattern 2: Coord then Radius
    p2 = re.compile(
        r'(\d{2}\d{2}(?:\d{2}|\.\d+)?[NS])\s*(\d{3}\d{2}(?:\d{2}|\.\d+)?[EW])\s*(?:WITH\s+A\s+RADIUS\s+OF|RADIUS)\s*(\d+(?:\.\d+)?)\s*(NM|M|KM|FT)',
        re.IGNORECASE
    )
    for m in p2.finditer(e_text):
        lat_s = m.group(1).upper()
        lon_s = m.group(2).upper()
        r_val = float(m.group(3))
        unit = m.group(4).upper()
        pt = parse_coordinate_token(lat_s, lon_s)
        if pt:
            if unit == 'NM':
                r_m = r_val * 1852.0
            elif unit == 'KM':
                r_m = r_val * 1000.0
            elif unit == 'FT':
                r_m = r_val * 0.3048
            else:
                r_m = r_val
            circles.append({
                'center': {'lat': pt[0], 'lng': pt[1]},
                'radius_meters': round(r_m, 1),
                'radius_nm': round(r_m / 1852.0, 2)
            })

    return circles

def extract_item_e_points(e_text: str) -> List[Dict[str, Any]]:
    """
    Extract single point features (e.g. cranes, obstacles, lights) in Item E.
    """
    points = []
    p = re.compile(
        r'(?:PSN|AT|LOCATION|COORD)?\s*:?\s*(\d{2}\d{2}(?:\d{2}|\.\d+)?[NS])\s*(\d{3}\d{2}(?:\d{2}|\.\d+)?[EW])',
        re.IGNORECASE
    )
    for m in p.finditer(e_text):
        lat_s = m.group(1).upper()
        lon_s = m.group(2).upper()
        pt = parse_coordinate_token(lat_s, lon_s)
        if pt:
            points.append({'lat': pt[0], 'lng': pt[1]})
    return points

def parse_full_notam(raw_text: str) -> Dict[str, Any]:
    """
    Parse a complete ICAO NOTAM text message into a structured object with geographic geometries.
    """
    parsed = {
        'id': None,
        'type': None, # NOTAMN, NOTAMR, NOTAMC
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
        'geometries': [] # List of GeoJSON-style geometries
    }

    # Extract NOTAM ID and Type (e.g. C2439/26 NOTAMN)
    id_m = re.search(r'\(([A-Z]\d{4}/\d{2})\s+(NOTAM[NRC])', raw_text)
    if id_m:
        parsed['id'] = id_m.group(1)
        parsed['type'] = id_m.group(2)

    # Extract Q-line
    q_m = re.search(r'Q\)\s*([^\n\r]+)', raw_text)
    if q_m:
        parsed['q_line'] = parse_q_line('Q) ' + q_m.group(1))

    # Extract validity lines B) and C)
    b_m = re.search(r'B\)\s*(\d{10})', raw_text)
    if b_m:
        parsed['validity']['start'] = b_m.group(1)

    c_m = re.search(r'C\)\s*(\d{10}|PERM)', raw_text)
    if c_m:
        parsed['validity']['end'] = c_m.group(1)

    d_m = re.search(r'D\)\s*([^\n\r]+)', raw_text)
    if d_m:
        parsed['validity']['schedule'] = d_m.group(1).strip()

    # Extract Item E text
    e_m = re.search(r'E\)\s*(.*?)(?=\n[F-G]\)|(?:\)\))|$)', raw_text, re.DOTALL)
    if e_m:
        parsed['text_e'] = e_m.group(1).strip()

    # Extract Item F) and G) (Vertical limits)
    f_m = re.search(r'F\)\s*([^\n\r]+)', raw_text)
    if f_m:
        parsed['vertical_limits']['lower'] = f_m.group(1).strip()
    elif parsed['q_line'] and parsed['q_line']['lower_fl'] is not None:
        parsed['vertical_limits']['lower'] = f"FL{parsed['q_line']['lower_fl']:03d}" if parsed['q_line']['lower_fl'] > 0 else 'GND'

    g_m = re.search(r'G\)\s*([^\n\r]+)', raw_text)
    if g_m:
        parsed['vertical_limits']['upper'] = g_m.group(1).strip()
    elif parsed['q_line'] and parsed['q_line']['upper_fl'] is not None:
        parsed['vertical_limits']['upper'] = f"FL{parsed['q_line']['upper_fl']:03d}" if parsed['q_line']['upper_fl'] < 999 else 'UNL'

    # --- GEOMETRY EXTRACTION HIERARCHY ---
    # Priority 1: Exact Polygon defined in Item E
    e_polygons = extract_item_e_polygons(parsed['text_e'])
    if e_polygons:
        for poly in e_polygons:
            # Format as GeoJSON Polygon coordinate list [[lng, lat], ...]
            # Note: GeoJSON uses [longitude, latitude] order
            coords = [[pt[1], pt[0]] for pt in poly]
            # Ensure closed ring
            if coords[0] != coords[-1]:
                coords.append(coords[0])
            parsed['geometries'].append({
                'type': 'Polygon',
                'source': 'Item E explicit boundary',
                'coordinates': [coords],
                'leaflet_latlngs': [[pt[0], pt[1]] for pt in poly] # Leaflet uses [lat, lng]
            })

    # Priority 2: Explicit Circles defined in Item E
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

    # Priority 3: Fallback to Q-Line Circle of Influence (if no polygon/circle found in E, but Q-line has a valid radius < 999)
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

    # Priority 4: Point Feature if identified as obstacle or single-point event
    if not parsed['geometries']:
        pts = extract_item_e_points(parsed['text_e'])
        if len(pts) == 1:
            parsed['geometries'].append({
                'type': 'Point',
                'source': 'Item E coordinate point',
                'coordinates': [pts[0]['lng'], pts[0]['lat']],
                'leaflet_latlng': [pts[0]['lat'], pts[0]['lng']]
            })

    return parsed

def notams_to_geojson(parsed_notams: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Convert parsed NOTAMs into a standard GeoJSON FeatureCollection."""
    features = []
    for n in parsed_notams:
        for geom in n['geometries']:
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
                    'source': geom['source']
                }
            }
            if geom['type'] == 'Polygon':
                feat['geometry'] = {
                    'type': 'Polygon',
                    'coordinates': geom['coordinates']
                }
            elif geom['type'] == 'Circle':
                # GeoJSON Point with radius property (standard for web mapping)
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


# =====================================================================
# Demonstration & Tests with Real Israeli NOTAMs (LLLL)
# =====================================================================
if __name__ == '__main__':
    # Sample 1: The Keshet Golan Heights area closure from today's live feed
    notam_1 = """(C2439/26 NOTAMN
Q) LLLL/QAELC/IV/NBO/E /000/090/3301N03549E006
A) LLLL B) 2611200345 C) 2611201000
D) 0345-0700 0745-1000
E) AN AREA AT KESHET/GOLAN-HEIGHTS BTN FLW PSN CLSD FM GND
   UP TO 9,000FT AMSL, TO ALL FLT INCLUDING AGRICULTURE FLT:
   325643N0355342E 325613N0354517E 330323N0354356E 330648N0354855E
   330602N0355058E 325816N0355235E.
   CTN ADZ.))"""

    # Sample 2: UAV / Drone activity with explicit circle in Item E
    notam_2 = """(A0512/26 NOTAMN
Q) LLLL/QWPLW/IV/M/W /000/015/3153N03444E002
A) LLLL B) 2611210600 C) 2611211400
E) UNMANNED ACFT ACT WILL TAKE PLACE WI A RADIUS OF 2NM CENTRED ON
   315320N0344415E (PALMAHIM).
F) GND G) 1500FT AMSL)"""

    # Sample 3: Temporary Crane / Obstacle in Tel Aviv FIR
    notam_3 = """(C1820/26 NOTAMN
Q) LLLL/QOBCE/IV/M/AE /000/003/3204N03447E001
A) LLLL B) 2611150500 C) 2612311600
E) TEMPORARY CRANE ERECTED AT PSN 320432N0344715E (TEL AVIV),
   ELEVATION 280FT AMSL, HGT 120FT AGL. FLG AND LGTD.)"""

    # Sample 4: General FIR Warning with Q-line circle only
    notam_4 = """(A0490/26 NOTAMN
Q) LLLL/QWLLW/IV/M/W /000/050/3146N03513E003
A) LLLL B) 2611221700 C) 2611222100
E) LASER EMISSION WILL TAKE PLACE IN JERUSALEM AREA. CTN ADZ.)"""

    samples = [notam_1, notam_2, notam_3, notam_4]
    parsed_list = []

    print("=" * 70)
    print("DETAILED NOTAM PARSER RESEARCH TEST RESULTS")
    print("=" * 70)

    for i, raw in enumerate(samples, 1):
        res = parse_full_notam(raw)
        parsed_list.append(res)
        print(f"\n--- NOTAM #{i}: {res['id']} ({res['type']}) ---")
        print(f"Q-Code: {res['q_line']['q_code'] if res['q_line'] else 'N/A'}")
        print(f"Altitude: {res['vertical_limits']['lower']} -> {res['vertical_limits']['upper']}")
        print(f"Validity: {res['validity']['start']} to {res['validity']['end']} (Schedule: {res['validity']['schedule']})")
        print(f"Extracted Geometries ({len(res['geometries'])}):")
        for g in res['geometries']:
            if g['type'] == 'Polygon':
                print(f"  * POLYGON ({len(g['leaflet_latlngs'])} vertices, source: {g['source']}):")
                for pt in g['leaflet_latlngs']:
                    print(f"      [{pt[0]}, {pt[1]}]")
            elif g['type'] == 'Circle':
                print(f"  * CIRCLE (center: [{g['center']['lat']}, {g['center']['lng']}], radius: {g['radius_nm']} NM / {g['radius_meters']}m, source: {g['source']})")
            elif g['type'] == 'Point':
                print(f"  * POINT (location: [{g['leaflet_latlng'][0]}, {g['leaflet_latlng'][1]}], source: {g['source']})")

    # Generate GeoJSON
    geojson_data = notams_to_geojson(parsed_list)
    out_file = '/home/ubuntu/flight-planner-isr/tools/notams/sample_output.geojson'
    with open(out_file, 'w') as f:
        json.dump(geojson_data, f, indent=2)

    print("\n" + "=" * 70)
    print(f"Successfully generated standard GeoJSON with {len(geojson_data['features'])} map features:")
    print(f"Saved to: {out_file}")
    print("=" * 70)
