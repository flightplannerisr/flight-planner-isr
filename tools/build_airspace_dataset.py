import re, json, urllib.request, os

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

def parse_altitudes(text):
    floor = 'GND'
    ceil = 'UNL'
    if 'MSL' in text and 'GND' not in text:
        floor = 'MSL'
    if 'UNL' in text:
        ceil = 'UNL'
    
    nums = re.findall(r'-?\d{3,5}', text)
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

# 1. Fetch eAIP ENR 5.1
print('Fetching eAIP ENR 5.1...')
eaip_url = 'https://e-aip.azurefd.net/2026-08-06-AIRAC/html/eAIP/LL-ENR-5.1-en-GB.html'
req = urllib.request.Request(eaip_url, headers={'User-Agent': 'Mozilla/5.0'})
eaip_html = urllib.request.urlopen(req).read().decode('utf-8', 'ignore')

eaip_pt_re = re.compile(r'(\d{2})(\d{2})(\d{2}(?:\.\d+)?)\s*([NS])\s*0?(\d{2,3})(\d{2})(\d{2}(?:\.\d+)?)\s*([EW])')
def parse_eaip_coords(s):
    pts = []
    for m in eaip_pt_re.finditer(s):
        lat = int(m.group(1)) + int(m.group(2))/60.0 + float(m.group(3))/3600.0
        if m.group(4) == 'S': lat = -lat
        lon = int(m.group(5)) + int(m.group(6))/60.0 + float(m.group(7))/3600.0
        if m.group(8) == 'W': lon = -lon
        pts.append([round(lat, 6), round(lon, 6)])
    return pts

pattern = re.compile(r'<p[^>]*class=\"Cell-body\">(LL[PRD]\d+)</p><p[^>]*class=\"Cell-body\">([^<]+)</p>.*?<td[^>]*>(.*?)</td>', re.S)
eaip_zones = {}
for m in pattern.finditer(eaip_html):
    code = m.group(1)
    coord_text = m.group(2).strip()
    coord_text_filtered = re.sub(r'centered\s+on\s+\d{6}[NS]\s*\d{6,7}[EW]', '', coord_text, flags=re.I)
    alt_text = re.sub(r'<[^>]+>', ' ', m.group(3)).strip()
    pts = parse_eaip_coords(coord_text_filtered)
    
    # Check if circle
    rad_m = None
    circ_m = re.search(r'radius\s*([\d\.]+)\s*(KM|NM|M)', coord_text, re.I)
    if circ_m:
        val = float(circ_m.group(1))
        unit = circ_m.group(2).upper()
        rad_m = val * 1852.0 if unit == 'NM' else (val * 1000.0 if unit == 'KM' else val)
        
    eaip_zones[code] = {
        'code': code,
        'points': pts,
        'radius_m': rad_m,
        'alt_raw': alt_text
    }
print(f'Parsed {len(eaip_zones)} zones from eAIP.')

# 2. Parse domestic AIP text
raw_path = os.path.join(os.path.dirname(__file__), 'raw_aip_data.txt')
if not os.path.exists(raw_path):
    raw_path = '/home/ubuntu/flight-planner-isr/tools/raw_aip_data.txt'
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

    m = header_re.search(l)
    if m and ('LLP' in l or 'LLR' in l or 'LLD' in l or 'LLU' in l):
        raw_code = m.group(1).replace(' ', '')
        cm = re.match(r'(\d+)(LL[PRDU])', raw_code)
        norm_code = (cm.group(2) + cm.group(1)) if cm else raw_code
        if current_rec: records.append(current_rec)
        current_rec = {'code': norm_code, 'raw_code': raw_code, 'header_lines': [l], 'body_lines': []}
        
        # Check if line itself contains coords (e.g. LLU or obstacles)
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

print(f'Parsed {len(records)} records from domestic AIP.')

final_zones = []

# Known names in English and Hebrew
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
    'LLP11': 'הר הבית',
    'LLP12': 'שטח אש 209',
    'LLP13': 'ירושלים',
    'LLP14': 'רמת בקע',
    'LLP15': 'דימונה (קמ"ג)',
    'LLP16': 'עין עבדת',
    'LLP18': 'יריחו',
    'LLP19': 'רצועת עזה',
    'LLR20': 'גליל הצנחה הבונים',
    'LLP21': 'לשם',
    'LLP22': 'מפעל יצחק',
    'LLP23': 'הר קרן',
    'LLP24': 'שורק (מרכז מחקר גרעיני)',
    'LLP25': 'אסדת תמר / ים טטיס',
    'LLP26': 'אסדת גט"ן (חדרה)',
    'LLP27': 'גלילות',
    'LLR27': 'אילת',
    'LLP28': 'אסדת לוויתן',
    'LLD28': 'גליל הצנחה חוף התמרים (עכו)',
    'LLD29': 'גליל הצנחה באר שבע (שדה תימן)',
    'LLP30': 'תחנת כוח אשכול (אשדוד)',
    'LLD30': 'טורבינות עמק הבכא',
    'LLD31': 'רמת חובב',
    'LLD34': 'מנחת טיסנים אלישמע',
    'LLD35': 'אירובוטיקס קרית גת',
    'LLD36': 'מחצבת חתרורים',
    'LLD37': 'גליל הצנחה מחניים מערב',
    'LLD38': 'גליל הצנחה מחניים מזרח',
    'LLD39': 'הטסת רחפנים גלילות',
    'LLD40': 'הטסת רחפנים גלילות דרום',
    'LLD41': 'דליה',
    'LLD42': 'הטסת רחפנים ים המלח',
    'LLD43': 'הטסת רחפנים עתלית',
    'LLD44': 'משמר העמק',
    'LLD47': 'מנחת טיסנים נגבה',
    'LLD48': 'רמת הכובש',
    'LLD49': 'גזר',
    'LLD50': 'אזור תעשייה קיסריה',
    'LLD51': 'ציפורי',
    'LLD52': 'שטח 410',
    'LLP39': 'אשלים',
    'LLP41': 'פלוגות',
    'LLP42': 'בלון צופר',
    'LLP43': 'בלון אבשלום',
    'LLP44': 'תחנת אתגל',
    'LLP171': 'יהודה ושומרון צפון',
    'LLP172': 'יהודה ושומרון מרכז',
    'LLP173': 'יהודה ושומרון דרום',
    'LLR24': 'שטח אש 24 (פלמחים)',
    'LLR30': 'שטח אש 30',
    'LLR36': 'שטח אש 36',
    'LLR82': 'שטח אש 82',
    'LLR83': 'שטח אש 83',
    'LLR90': 'מטווח 90',
    'LLR100': 'שטח אש 100',
    'LLR309': 'שטח אש 309',
    'LLR500': 'שטח אש 500',
    'LLR502': 'שטח אש 502',
    'LLR504': 'שטח אש 504',
    'LLR520': 'שטח אש 520',
    'LLR589': 'שטח אש 589',
    'LLR618': 'שטח אש 618',
    'LLR801': 'מטווח 80 צפון',
    'LLR802': 'מטווח 80 צפון',
    'LLR803': 'מטווח 80 צפון',
    'LLR804': 'מטווח 80 דרום',
    'LLR805': 'מטווח 80 דרום',
    'LLR900': 'שטח אש 900 (בקעה)',
    'LLR921': 'שטח אש 921'
}

for r in records:
    code = r['code']
    header_text = ' '.join(r['header_lines'])
    full_text = header_text + ' ' + ' '.join([item[0] for item in r['body_lines']])
    coord_pts = [item[1] for item in r['body_lines'] if item[1] is not None]
    
    # Prefer official eAIP polygon coordinates if available
    if code in eaip_zones and len(eaip_zones[code]['points']) >= 3:
        coord_pts = eaip_zones[code]['points']
        
    # Fix LLP16 multi-column PDF extraction artifact where point 14 belongs between point 5 and 6
    if code == 'LLP16' and len(coord_pts) == 14:
        p14 = coord_pts.pop()
        coord_pts.insert(5, p14)
        
    rad_m = parse_radius_meters(full_text)
    if code == 'LLP44':
        rad_m = 100
        ceil = '1500 ft'
        floor = 'GND'
    elif code == 'LLP12':
        floor = 'GND'
        ceil = '3000 ft'
    elif code.startswith('LLP300'):
        rad_m = 1000 # 0.54 NM
        # extract altitude e.g. 2,800 -> 2800 ft
        m_alt = re.search(r'(\d+[\d,]*)\s*0\.54', full_text)
        if m_alt:
            ceil = m_alt.group(1).replace(',', '') + ' ft'
            floor = 'GND'

    if not rad_m and code in eaip_zones and eaip_zones[code]['radius_m']:
        rad_m = eaip_zones[code]['radius_m']
        if len(coord_pts) == 0 and len(eaip_zones[code]['points']) > 0:
            coord_pts = [eaip_zones[code]['points'][0]]

    # Determine kind
    if 'LLP' in code: kind = 'Prohibited'
    elif 'LLR' in code: kind = 'Restricted'
    elif 'LLD' in code: kind = 'Danger'
    elif 'LLU' in code: kind = 'UAS_NoFly'
    else: kind = 'Other'

    # Name
    heb_name = hebrew_names.get(code)
    if not heb_name:
        # Extract from text
        name_clean = header_text
        name_clean = re.sub(r'\b\d{1,4}\s*LL[PRDU]\b|\bLL[PRDU]\s*\d{1,4}\b', '', name_clean)
        name_clean = re.sub(r'\b(?:GND|MSL|UNL|\d{3,5})\b', '', name_clean)
        name_clean = re.sub(r'[/,:]', '', name_clean)
        name_clean = re.sub(r'מעגל שרדיוסו.*', '', name_clean)
        name_clean = re.sub(r'רדיוס הסגירה.*', '', name_clean)
        name_clean = re.sub(r'\d+\s*מטר.*', '', name_clean)
        heb_name = name_clean.strip()

    floor, ceil = parse_altitudes(header_text)
    if ceil == 'UNL' and code in eaip_zones:
        # eAIP might have flight level
        alt_e = eaip_zones[code]['alt_raw']
        if 'FL' in alt_e or 'FT' in alt_e:
            parts = alt_e.split('/')
            if len(parts) >= 2:
                ceil = parts[0].strip()
                floor = parts[1].strip()

    geom = None
    if rad_m and len(coord_pts) >= 1:
        geom = {
            'type': 'Circle',
            'center': [coord_pts[0][0], coord_pts[0][1]],
            'radius': round(rad_m)
        }
    elif len(coord_pts) >= 3:
        geom = {
            'type': 'Polygon',
            'coordinates': coord_pts
        }
    elif len(coord_pts) == 1 and not rad_m:
        geom = {
            'type': 'Point',
            'center': [coord_pts[0][0], coord_pts[0][1]]
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

# Also add any eAIP zones not in domestic list (e.g. LLR01, LLR02 offshore restricted)
for code, z in eaip_zones.items():
    if not any(fz['code'] == code for fz in final_zones):
        if len(z['points']) >= 3:
            final_zones.append({
                'code': code,
                'name': code + ' שטח אימונים ימי/צבאי',
                'type': 'Restricted' if 'LLR' in code else ('Prohibited' if 'LLP' in code else 'Danger'),
                'floor': 'GND',
                'ceiling': z['alt_raw'].split('/')[0].strip() if '/' in z['alt_raw'] else z['alt_raw'],
                'geom': {
                    'type': 'Polygon',
                    'coordinates': z['points']
                }
            })

# Also add CTRs (Ben Gurion, Haifa, Ramon, Nevatim)
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

print(f'Total final active zones with geometry: {len(final_zones)}')
kind_counts = {}
for z in final_zones:
    kind_counts[z['type']] = kind_counts.get(z['type'], 0) + 1
print('Breakdown:', kind_counts)

# Geometric validation: check for self-intersecting polygons
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

self_intersecting = []
for z in final_zones:
    if z['geom']['type'] == 'Polygon':
        if is_self_intersecting(z['geom']['coordinates']):
            self_intersecting.append(z['code'])

if self_intersecting:
    print('WARNING: Self-intersecting polygons found:', self_intersecting)
else:
    print('All polygons successfully validated: 0 self-intersections!')

# Save as JavaScript file: js/data/special-airspace.js
js_content = 'var specialAirspaceData = ' + json.dumps(final_zones, ensure_ascii=False, indent=2) + ';\n'
with open('/home/ubuntu/flight-planner-isr/js/data/special-airspace.js', 'w', encoding='utf-8') as out:
    out.write(js_content)
print('Successfully saved js/data/special-airspace.js!')
