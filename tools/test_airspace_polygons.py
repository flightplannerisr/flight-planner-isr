#!/usr/bin/env python3
"""
Test script to validate geometry and verify there are NO self-intersecting polygons
or invalid circles in js/data/special-airspace.js.
"""

import json, os, sys

def ccw(A, B, C):
    return (C[1] - A[1]) * (B[0] - A[0]) > (B[1] - A[1]) * (C[0] - A[0])

def intersect(A, B, C, D):
    # If segments share an endpoint, they don't count as an invalid intersection
    if A == C or A == D or B == C or B == D:
        return False
    return ccw(A, C, D) != ccw(B, C, D) and ccw(A, B, C) != ccw(A, B, D)

def is_self_intersecting(pts):
    n = len(pts)
    if n < 4:
        return False, None, None
    # Check every pair of non-adjacent edges
    edges = [(pts[i], pts[(i + 1) % n]) for i in range(n)]
    for i in range(len(edges)):
        for j in range(i + 1, len(edges)):
            if abs(i - j) <= 1 or abs(i - j) == n - 1:
                continue
            if intersect(edges[i][0], edges[i][1], edges[j][0], edges[j][1]):
                return True, edges[i], edges[j]
    return False, None, None

def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    target = os.path.join(root, 'js', 'data', 'special-airspace.js')
    
    with open(target, 'r', encoding='utf-8') as f:
        content = f.read()
    
    prefix = 'var specialAirspaceData = '
    if prefix not in content:
        print('ERROR: Prefix not found')
        sys.exit(1)
        
    raw_json = content.split(prefix)[1].rstrip(';\n ')
    data = json.loads(raw_json)
    
    print(f'Testing {len(data)} airspace zones in special-airspace.js...')
    
    errors = []
    polygons_checked = 0
    circles_checked = 0
    
    for item in data:
        code = item.get('code', 'UNKNOWN')
        name = item.get('name', '')
        geom = item.get('geom', {})
        gtype = geom.get('type')
        
        if gtype == 'Polygon':
            coords = geom.get('coordinates', [])
            polygons_checked += 1
            if len(coords) < 3:
                errors.append(f'{code}: Polygon has fewer than 3 coordinates ({len(coords)})')
                continue
            
            # Check bounds for Israel
            for pt in coords:
                if not (29.0 <= pt[0] <= 34.0 and 33.5 <= pt[1] <= 36.5):
                    errors.append(f'{code}: Coordinate out of expected bounds: {pt}')
                    break
            
            # Check self-intersection
            self_int, e1, e2 = is_self_intersecting(coords)
            if self_int:
                errors.append(f'{code} ({name}): Self-intersecting polygon! Edge {e1} crosses {e2}')
                
        elif gtype == 'Circle':
            circles_checked += 1
            center = geom.get('center', [])
            radius = geom.get('radius', 0)
            if len(center) != 2 or not (29.0 <= center[0] <= 34.0 and 33.5 <= center[1] <= 36.5):
                errors.append(f'{code}: Circle center out of bounds: {center}')
            if radius <= 0:
                errors.append(f'{code}: Invalid circle radius: {radius}')
        else:
            errors.append(f'{code}: Unknown geometry type: {gtype}')
            
    print(f'Validated {polygons_checked} polygons and {circles_checked} circles.')
    
    if errors:
        print(f'\nFAILED with {len(errors)} error(s):')
        for err in errors:
            print('  - ' + err)
        sys.exit(1)
    else:
        print('\nSUCCESS: All airspace polygons are clean, valid, and non-intersecting!')

if __name__ == '__main__':
    main()
