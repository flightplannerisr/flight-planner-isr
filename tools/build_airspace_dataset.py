#!/usr/bin/env python3
"""
Build the special airspace dataset by:
1. Parsing official digital HTML eAIP (LL-ENR-5.1) for primary Prohibited, Restricted, and Military areas.
2. Parsing domestic AIP text (raw_aip_data.txt) for domestic-only zones (LLP01, LLP02, LLP04, LLP06, LLP30, LLD, LLU).
3. Adding airport CTRs (Ben Gurion, Haifa, Ramon, Nevatim).
4. Validating all geometries to assert 0 self-intersections.
5. Saving to js/data/special-airspace.js.
"""

import re, json, urllib.request, os, math

def get_arc_points(center_lat, center_lon, start_lat, start_lon, end_lat, end_lon, ccw=True, num_pts=10):
    def angle_from(lat, lon):
        dlat = lat - center_lat
        dlon = (lon - center_lon) * math.cos(math.radians(center_lat))
        return math.atan2(dlat, dlon)
    
    a1 = angle_from(start_lat, start_lon)
    a2 = angle_from(end_lat, end_lon)
    r_lat = math.hypot(start_lat - center_lat, (start_lon - center_lon)*math.cos(math.radians(center_lat)))
    
    if ccw:
        if a2 <= a1: a2 += 2 * math.pi
    else:
        if a2 >= a1: a2 -= 2 * math.pi
            
    pts = []
    # intermediate points between start and end (exclusive)
    for i in range(1, num_pts):
        frac = i / float(num_pts)
        a = a1 + frac * (a2 - a1)
        dlat = r_lat * math.sin(a)
        dlon = (r_lat * math.cos(a)) / math.cos(math.radians(center_lat))
        pts.append([round(center_lat + dlat, 6), round(center_lon + dlon, 6)])
    return pts

def extract_coord(prefix, s):
    # Pattern 1: E" 13.44' 35 35° or N" 41.00 '46 31° or E" 56.666' 1 35°
    m = re.search(prefix + r'[\"\s]*([\d\.]+)[\'\"]?\s*[\'\"]?\s*(\d{1,2})\s+(\d{2})°', s)
    if m:
        sec = float(m.group(1)); minute = int(m.group(2)); deg = int(m.group(3))
        return deg + minute / 60.0 + sec / 3600.0
    # Pattern 2: E"51.00' 34°41 or E"44.97'35°13 or N"24.60 '31°40
    m = re.search(prefix + r'[\"\s]*([\d\.]+)[\'\"]?\s*[\'\"]?\s*(\d{2})°\s*(\d{1,2})', s)
    if m:
        sec = float(m.group(1)); deg = int(m.group(2)); minute = int(m.group(3))
        return deg + minute / 60.0 + sec / 3600.0
    # Pattern 3: E" 19' 48 34°
    m = re.search(prefix + r'[\"\s]*(\d{1,2})[\'\"]?\s*[\'\"]?\s*(\d{1,2})\s+(\d{2})°', s)
    if m:
        sec = float(m.group(1)); minute = int(m.group(2)); deg = int(m.group(3))
        return deg + minute / 60.0 + sec / 3600.0
    # Pattern 4 (LLU): E"50'34°52
    m = re.search(prefix + r'[\"\s]*(\d{1,2})[\'\"]?\s*(\d{2})°\s*(\d{1,2})', s)
    if m:
        sec = float(m.group(1)); deg = int(m.group(2)); minute = int(m.group(3))
        return deg + minute / 60.0 + sec / 3600.0
    # Pattern 5 (Obstacles): E342145
    m = re.search(prefix + r'(\d{2})(\d{2})(\d{2})', s)
    if m:
        deg = int(m.group(1)); minute = int(m.group(2)); sec = float(m.group(3))
        return deg + minute / 60.0 + sec / 3600.0
    return None

def parse_line_coords(line):
    lon = extract_coord('E', line)
    lat = extract_coord('N', line)
    if lat is not None and lon is not None:
        if 28.0 <= lat <= 34.5 and 33.5 <= lon <= 36.5:
            return round(lat, 6), round(lon, 6)
    return None

def parse_radius_meters(text):
    m = re.search(r'([\d\.]+)\s*(?:מייל\s*ימי|מייל)', text)
    if m: return float(m.group(1)) * 1852.0
    m = re.search(r'([\d\.]+)\s*ק(?:\"|״)?מ', text)
    if m: return float(m.group(1)) * 1000.0
    if 'ק"מ אחד' in text or 'ק״מ אחד' in text: return 1000.0
    if 'חצי ק"מ' in text or 'חצי ק״מ' in text: return 500.0
    m = re.search(r'([\d\.]+)\s*(?:מטרים|מטר|מ\')', text)
    if m: return float(m.group(1))
    return None

def parse_altitudes(text, code=''):
    floor = 'GND'
    ceil = 'UNL'
    if 'MSL' in text and 'GND' not in text:
        floor = 'MSL'
    if 'UNL' in text:
        ceil = 'UNL'
    
    clean = re.sub(r'\b\d{1,4}\s*LL[PRDU]\b|\bLL[PRDU]\s*\d{1,4}\b', '', text)
    clean = re.sub(r'(?:שטח\s*אש|מטווח)\s*\d+', '', clean)
    if code:
        num = re.sub(r'\D', '', code)
        if num:
            clean = re.sub(r'\b' + num + r'\b', '', clean)

    nums = re.findall(r'\b\d{3,5}\b', clean)
    if nums:
        if len(nums) == 1:
            ceil = nums[0] + ' ft'
        elif len(nums) >= 2:
            ceil = nums[0] + ' ft'
            if 'GND' not in text and 'MSL' not in text:
                floor = nums[1] + ' ft'
    if 'GND' in text:
        floor = 'GND'
    return floor, ceil

# Hebrew names dictionary
hebrew_names = {
    'LLP01': 'שמורת החולה',
    'LLP02': 'גמלא',
    'LLP03': 'מכון דוד (רפאל)',
    'LLP04': 'בתי הזיקוק חיפה',
    'LLP05': 'עתלית',
    'LLP06': 'קיסריה',
    'LLP07': 'תחנת כוח אורות רבין (חדרה)',
    'LLP08': 'רמת השרון (תע"ש)',
    'LLP09': 'מכון למחקר ביולוגי (נס ציונה)',
    'LLP10': 'משמר איילון',
    'LLP11': 'הר הבית (ירושלים)',
    'LLP12': 'שטח אש 209',
    'LLP13': 'ירושלים (עיר עתיקה ומרכז)',
    'LLP14': 'רמת בקע',
    'LLP15': 'הקריה למחקר גרעיני - דימונה',
    'LLP16': 'שמורת עין עבדת',
    'LLP18': 'יריחו',
    'LLP19': 'רצועת עזה',
    'LLP21': 'לשם',
    'LLP22': 'מפעל יצחק',
    'LLP23': 'הר קרן',
    'LLP24': 'שורק (מרכז למחקר גרעיני)',
    'LLP25': 'תמר / ים טטיס (אסדה)',
    'LLP26': 'אסדת גט"ן',
    'LLP27': 'גלילות',
    'LLP28': 'אסדת לוויתן',
    'LLP29': 'אסדת כריש',
    'LLP30': 'תחנת כוח אשכול (אשדוד)',
    'LLP31': 'תחנת כוח רוטנברג (אשקלון)',
    'LLP32': 'מתקן התפלה אשקלון',
    'LLP33': 'קצא"א אשקלון',
    'LLP34': 'תחנת כוח דליה (צפית)',
    'LLP35': 'מכון וינגייט',
    'LLP36': 'שבטה',
    'LLP37': 'מחנה עופר',
    'LLP38': 'כלא מגידו',
    'LLP39': 'תחנת כוח תרמו-סולארית אשלים',
    'LLP41': 'פלוגות',
    'LLP42': 'בלון צופר',
    'LLP43': 'בלון אבשלום',
    'LLP44': 'תחנת אתגל',
    'LLP171': 'יהודה ושומרון צפון',
    'LLP172': 'יהודה ושומרון מרכז',
    'LLP173': 'יהודה ושומרון דרום',
    'LLR01': 'שטח אימונים ימי/צבאי צפון',
    'LLR02': 'שטח אימונים ימי/צבאי דרום',
    'LLR20': 'גליל הצנחה הבונים',
    'LLR24': 'שטח אש 24 (פלמחים)',
    'LLR27': 'אילת',
    'LLR30': 'שטח אש 30',
    'LLR36': 'שטח אש 36',
    'LLR82': 'שטח אש 82',
    'LLR83': 'שטח אש 83',
    'LLR90': 'מטווח 90',
    'LLR309': 'שטח אש 309',
    'LLR500': 'שטח אש 500',
    'LLR502': 'שטח אש 502',
    'LLR504': 'שטח אש 504',
    'LLR520': 'שטח אש 520',
    'LLR589': 'שטח אש 589',
    'LLR618': 'שטח אש 618',
    'LLR801': 'מטווח 80 צפון',
    'LLR802': 'מטווח 80 צפון (מזרח)',
    'LLR803': 'מטווח 80 צפון (מערב)',
    'LLR804': 'מטווח 80 דרום (עובדה)',
    'LLR805': 'מטווח 80 דרום',
    'LLR900': 'שטח אש 900 (בקעה)',
    'LLR921': 'שטח אש 921',
    'LLD28': 'גליל הצנחה חוף התמרים',
    'LLD30': 'טורבינות עמק הבכא',
    'LLD31': 'רמת חובב',
    'LLD32': 'רמת חובב (מזרח)',
    'LLD33': 'מנחת טיסנים אשרד',
    'LLD34': 'טורבינות רוח גלבוע',
    'LLD35': 'טורבינות רוח רמת סירין',
    'LLD36': 'טורבינות מעלה גלבוע',
    'LLD37': 'טורבינות רוח רמת צבאים',
    'LLD38': 'מנחת טיסנים עין שמר',
    'LLD39': 'מנחת טיסנים ראשון לציון',
    'LLD40': 'מנחת טיסנים פתח תקווה',
    'LLD41': 'מנחת טיסנים דימונה',
    'LLD42': 'מנחת טיסנים באר שבע',
    'LLD43': 'הטסת רחפנים עתלית',
    'LLD44': 'משמר העמק',
    'LLD47': 'מנחת טיסנים נגבה',
    'LLD48': 'רמת הכובש',
    'LLD49': 'גזר',
    'LLD50': 'אזור תעשייה קיסריה',
    'LLD51': 'ציפורי',
    'LLD52': 'שטח 410'
}

final_zones = []

# 1. Fetch eAIP ENR 5.1 (Official structured publication)
print('Fetching eAIP ENR 5.1...')
eaip_url = 'https://e-aip.azurefd.net/2026-08-06-AIRAC/html/eAIP/LL-ENR-5.1-en-GB.html'
req = urllib.request.Request(eaip_url, headers={'User-Agent': 'Mozilla/5.0'})
eaip_html = urllib.request.urlopen(req).read().decode('utf-8', 'ignore')

eaip_pt_re = re.compile(r'(\d{2})(\d{2})(\d{2}(?:\.\d+)?)\s*([NS])\s*0?(\d{2,3})(\d{2})(\d{2}(?:\.\d+)?)\s*([EW])')

def parse_pt(m):
    lat = int(m.group(1)) + int(m.group(2))/60.0 + float(m.group(3))/3600.0
    if m.group(4) == 'S': lat = -lat
    lon = int(m.group(5)) + int(m.group(6))/60.0 + float(m.group(7))/3600.0
    if m.group(8) == 'W': lon = -lon
    return [round(lat, 6), round(lon, 6)]

row_pattern = re.compile(r'<tr[^>]*>.*?<p[^>]*class=\"Cell-body\">(LL[PRD]\d+)</p>(.*?)</tr>', re.S)
eaip_codes = set()

for m in row_pattern.finditer(eaip_html):
    code = m.group(1)
    if code in eaip_codes:
        continue
    eaip_codes.add(code)
    
    body = m.group(2)
    p_texts = [re.sub(r'<[^>]+>', ' ', p).strip() for p in re.findall(r'<p[^>]*class=\"Cell-body\">(.*?)</p>', body, re.S)]
    tds = [re.sub(r'<[^>]+>', ' ', td).strip() for td in re.findall(r'<td[^>]*>(.*?)</td>', body, re.S)]
    geom_text = p_texts[0] if p_texts else ''
    alt_text = tds[0] if tds else ''
    
    parts = alt_text.split('/')
    ceil = parts[0].strip() if len(parts) > 0 else 'UNL'
    floor = parts[1].strip() if len(parts) > 1 else 'GND'
    if '0 FT' in floor or 'GND' in floor: floor = 'GND'
    
    kind = 'Prohibited' if 'LLP' in code else ('Restricted' if 'LLR' in code else 'Danger')
    heb_name = hebrew_names.get(code, code)
    
    # Check if circle
    if re.match(r'^\s*A\s+circle\s+radius', geom_text, re.I):
        m_circ = re.search(r'radius\s*([\d\.]+)\s*(KM|NM|M)\s+centered\s+on\s+(\d{6}[NS]\s*\d{6,7}[EW])', geom_text, re.I)
        if m_circ:
            rad_val = float(m_circ.group(1))
            unit = m_circ.group(2).upper()
            rad_m = rad_val * 1852.0 if unit == 'NM' else (rad_val * 1000.0 if unit == 'KM' else rad_val)
            c_m = eaip_pt_re.search(m_circ.group(3))
            center = parse_pt(c_m)
            final_zones.append({
                'code': code,
                'name': heb_name,
                'type': kind,
                'floor': floor,
                'ceiling': ceil,
                'geom': {'type': 'Circle', 'center': center, 'radius': round(rad_m)}
            })
    else:
        # Polygon
        clean_poly = re.sub(r'centered\s+on\s+\d{6}[NS]\s*\d{6,7}[EW]', '', geom_text, flags=re.I)
        pts = [parse_pt(pm) for pm in eaip_pt_re.finditer(clean_poly)]
        if code == 'LLP172' and len(pts) >= 2:
            arc = get_arc_points(31.784444, 35.209444, pts[0][0], pts[0][1], pts[1][0], pts[1][1], ccw=True)
            pts = [pts[0]] + arc + pts[1:]
        elif code == 'LLP173' and len(pts) >= 2:
            arc = get_arc_points(31.784444, 35.209444, pts[0][0], pts[0][1], pts[1][0], pts[1][1], ccw=True)
            pts = [pts[0]] + arc + pts[1:]
            
        final_zones.append({
            'code': code,
            'name': heb_name,
            'type': kind,
            'floor': floor,
            'ceiling': ceil,
            'geom': {'type': 'Polygon', 'coordinates': pts}
        })

print(f'Imported {len(final_zones)} official zones directly from eAIP ENR 5.1.')

# 2. Parse domestic AIP for domestic-only zones not in international eAIP
raw_path = os.path.join(os.path.dirname(__file__), 'raw_aip_data.txt')
with open(raw_path, encoding='utf-8') as f:
    raw = f.read()

lines = raw.split('\n')
records = []
current_rec = None
header_re = re.compile(r'(?:^|\s)(\d{1,4}\s*LL[PRDU]|LL[PRDU]\s*\d{1,4})(?:$|\s)')

for line in lines:
    l = line.strip()
    if not l: continue
    if 'פמ"ת פנים ארצי' in l or 'רשות התעופה האזרחית' in l or 'עדכון' in l: continue
    if 'קוד זיהוי' in l or 'שם האזור' in l or 'גובה מרבי' in l or 'מזרח' in l: continue
    if 'נספח' in l: continue

    # Ignore in-sentence references to another zone's boundary
    if 'לאורך גבול' in l or 'בקשת' in l or 'מהנקודה הקודמת' in l:
        if current_rec:
            c = parse_line_coords(l)
            if c: current_rec['body_lines'].append((l, c))
        continue
    if '(המשך)' in l or 'המשך' in l:
        continue

    m = header_re.search(l)
    if m and ('LLP' in l or 'LLR' in l or 'LLD' in l or 'LLU' in l):
        raw_code = m.group(1).replace(' ', '')
        cm = re.match(r'(\d+)(LL[PRDU])', raw_code)
        norm_code = (cm.group(2) + cm.group(1)) if cm else raw_code
        if current_rec: records.append(current_rec)
        current_rec = {'code': norm_code, 'raw_code': raw_code, 'header_lines': [l], 'body_lines': []}
        
        c = parse_line_coords(l)
        if c:
            current_rec['body_lines'].append((l, c))
    elif current_rec:
        c = parse_line_coords(l)
        if c:
            current_rec['body_lines'].append((l, c))
        else:
            if len(current_rec['body_lines']) == 0:
                current_rec['header_lines'].append(l)
            else:
                current_rec['body_lines'].append((l, None))

if current_rec: records.append(current_rec)

domestic_added = 0
for r in records:
    code = r['code']
    if any(fz['code'] == code for fz in final_zones):
        continue  # Already imported from official eAIP

    header_text = ' '.join(r['header_lines'])
    full_text = header_text + ' ' + ' '.join([item[0] for item in r['body_lines']])
    coord_pts = [item[1] for item in r['body_lines'] if item[1] is not None]

    rad_m = parse_radius_meters(full_text)
    floor, ceil = parse_altitudes(header_text, code)

    if code == 'LLP44':
        rad_m = 100
        ceil = '1500 ft'
        floor = 'GND'
    elif code.startswith('LLP300'):
        rad_m = 1000 # 0.54 NM
        m_alt = re.search(r'(\d+[\d,]*)\s*0\.54', full_text)
        if m_alt:
            ceil = m_alt.group(1).replace(',', '') + ' ft'
            floor = 'GND'

    if 'LLP' in code: kind = 'Prohibited'
    elif 'LLR' in code: kind = 'Restricted'
    elif 'LLD' in code: kind = 'Danger'
    elif 'LLU' in code: kind = 'UAS_NoFly'
    else: kind = 'Other'

    heb_name = hebrew_names.get(code)
    if not heb_name:
        name_clean = header_text
        name_clean = re.sub(r'\b\d{1,4}\s*LL[PRDU]\b|\bLL[PRDU]\s*\d{1,4}\b', '', name_clean)
        name_clean = re.sub(r'\b(?:GND|MSL|UNL|\d{3,5})\b', '', name_clean)
        name_clean = re.sub(r'[/,:]', '', name_clean)
        name_clean = re.sub(r'מעגל שרדיוסו.*', '', name_clean)
        name_clean = re.sub(r'רדיוס הסגירה.*', '', name_clean)
        name_clean = re.sub(r'\d+\s*מטר.*', '', name_clean)
        heb_name = name_clean.strip()

    geom = None
    if rad_m and len(coord_pts) >= 1:
        geom = {
            'type': 'Circle',
            'center': [coord_pts[0][0], coord_pts[0][1]],
            'radius': round(rad_m)
        }
    elif len(coord_pts) >= 3:
        # Fix LLP16 2-column layout
        if code == 'LLP16' and len(coord_pts) == 14:
            p14 = coord_pts.pop()
            coord_pts.insert(5, p14)
        geom = {
            'type': 'Polygon',
            'coordinates': coord_pts
        }

    if geom:
        final_zones.append({
            'code': code,
            'name': heb_name,
            'type': kind,
            'floor': floor,
            'ceiling': ceil,
            'geom': geom
        })
        domestic_added += 1

print(f'Added {domestic_added} domestic-only zones.')

# 3. Add Airport CTRs
ctrs = [
    {
        'code': 'LLBG_CTR',
        'name': 'אזור פיקוח נתב"ג (Ben Gurion CTR)',
        'type': 'CTR',
        'floor': 'GND',
        'ceiling': '4000 ft',
        'geom': {'type': 'Circle', 'center': [32.00, 34.89], 'radius': 15000}
    },
    {
        'code': 'LLHA_CTR',
        'name': 'אזור פיקוח חיפה (Haifa CTR)',
        'type': 'CTR',
        'floor': 'GND',
        'ceiling': '2500 ft',
        'geom': {'type': 'Circle', 'center': [32.81, 35.0433], 'radius': 10000}
    },
    {
        'code': 'LLER_CTR',
        'name': 'אזור פיקוח רמון (Ramon CTR)',
        'type': 'CTR',
        'floor': 'GND',
        'ceiling': '4000 ft',
        'geom': {'type': 'Circle', 'center': [29.7289, 35.0114], 'radius': 10000}
    },
    {
        'code': 'LLNV_CTR',
        'name': 'אזור פיקוח נבטים (Nevatim CTR)',
        'type': 'CTR',
        'floor': 'GND',
        'ceiling': '4000 ft',
        'geom': {'type': 'Circle', 'center': [31.21, 35.01], 'radius': 10000}
    }
]
final_zones.extend(ctrs)

print(f'Total final active zones: {len(final_zones)}')

# 4. Geometric validation: check for self-intersecting polygons
def ccw(A,B,C):
    return (C[1]-A[1]) * (B[0]-A[0]) > (B[1]-A[1]) * (C[0]-A[0])

def intersect(A,B,C,D):
    if A == C or A == D or B == C or B == D: return False
    return ccw(A,C,D) != ccw(B,C,D) and ccw(A,B,C) != ccw(A,B,D)

def is_self_intersecting(pts):
    n = len(pts)
    edges = [(pts[i], pts[(i+1)%n]) for i in range(n)]
    for i in range(len(edges)):
        for j in range(i+1, len(edges)):
            if abs(i - j) <= 1 or abs(i - j) == n - 1: continue
            if intersect(edges[i][0], edges[i][1], edges[j][0], edges[j][1]):
                return True
    return False

self_int = [z['code'] for z in final_zones if z['geom']['type'] == 'Polygon' and is_self_intersecting(z['geom']['coordinates'])]
if self_int:
    print('WARNING: Self-intersecting polygons found:', self_int)
    raise SystemExit(1)
else:
    print('All polygons successfully validated: 0 self-intersections!')

# 5. Save as JavaScript file: js/data/special-airspace.js
js_content = 'var specialAirspaceData = ' + json.dumps(final_zones, ensure_ascii=False, indent=2) + ';\n'
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out_path = os.path.join(root, 'js', 'data', 'special-airspace.js')
with open(out_path, 'w', encoding='utf-8') as out:
    out.write(js_content)
print(f'Successfully saved {out_path}!')
