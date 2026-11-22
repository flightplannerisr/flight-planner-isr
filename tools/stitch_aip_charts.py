#!/usr/bin/env python3
"""
AIP Chart Stitcher: Convert & Join North + South AIP PDF Charts into Unified Georeferenced JPEG
=============================================================================================

This tool automates:
1. Converting official Israel AIP vector/raster PDFs (North Sheet & South Sheet) to high-res rasters.
2. Aligning the longitude meridians across the 31°20'N latitude seam.
3. Stitching North and South sheets vertically into a single seamless chart raster.
4. Generating matching companion World Files (.wld, .jgw) in EPSG:3857 and WGS 84.

Usage:
------
# Direct from PDFs (requires pdftoppm / poppler):
python3 tools/stitch_aip_charts.py \
    --north "images/Navigation-North 2026.pdf" \
    --south "images/Navigation-south 2026.pdf" \
    --output "images/layers/air_nav_combined_aligned.jpg" \
    --dpi 150

# From pre-rasterized images (PNG/TIFF/JPG):
python3 tools/stitch_aip_charts.py \
    --north-img "north_150dpi.png" \
    --south-img "south_150dpi.png" \
    --output "images/layers/air_nav_combined_aligned.jpg"
"""

import os
import sys
import argparse
import subprocess
import math

try:
    from PIL import Image
    # Allow opening very large chart images without DecompressionBombError
    Image.MAX_IMAGE_PIXELS = None
except ImportError:
    Image = None

# Coordinate constants for Israel AIP 1:250,000 / AZM charts at 150 DPI:
# Standard AIP sheet width = 1984.25 pt (700mm) => 4,134 px at 150 DPI
# Standard AIP sheet height = 2834.65 pt (1000mm) => 5,905 px at 150 DPI
SEAM_LAT = "31°20'N"
NORTH_SEAM_Y_PT = 2630.0    # 31°20'N in North sheet (pt from top)
SOUTH_SEAM_Y_PT = 321.18    # 31°20'N in South sheet (pt from top)
SOUTH_SEAM_BOTTOM_Y_PT = 2625.0  # 29°30'N in South sheet (pt from top)
SOUTH_HORIZ_OFFSET_PT = 63.6     # Horizontal meridian offset (pt East)

# Exact EPSG:3857 bounds calibrated for the combined 4154 x 10315 raster
EPSG3857_BOUNDS = {
    'min_x': 3794606.48,
    'max_x': 4000788.75,
    'min_y': 3439977.82,
    'max_y': 3951898.18
}

def latlng_to_3857(lat, lng):
    x = lng * 20037508.34 / 180.0
    y = math.log(math.tan((90.0 + lat) * math.pi / 360.0)) / (math.pi / 180.0)
    y = y * 20037508.34 / 180.0
    return x, y

def rasterize_pdf(pdf_path, output_prefix, dpi=150):
    """Rasterize page 1 of a PDF to TIFF using pdftoppm."""
    cmd = ['pdftoppm', '-tiff', '-r', str(dpi), '-f', '1', '-l', '1', pdf_path, output_prefix]
    print(f"Rasterizing {pdf_path} at {dpi} DPI...")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"pdftoppm failed: {res.stderr}")
    tif_path = f"{output_prefix}-1.tif"
    if not os.path.exists(tif_path):
        raise FileNotFoundError(f"Expected rendered TIFF at {tif_path}")
    return tif_path

def stitch_images(north_img_path, south_img_path, output_jpg_path, dpi=150, quality=85):
    """Crop and stitch North and South charts seamlessly at 31°20'N."""
    if Image is None:
        raise ImportError("Pillow (PIL) is required. Install with: pip install Pillow")
    
    pt_to_px = dpi / 72.0
    
    print(f"Loading North: {north_img_path}")
    im_north = Image.open(north_img_path)
    print(f"Loading South: {south_img_path}")
    im_south = Image.open(south_img_path)
    
    nw, nh = im_north.size
    sw, sh = im_south.size
    
    # Calculate crop coordinates in pixels
    north_crop_h = int(round(NORTH_SEAM_Y_PT * pt_to_px))
    south_seam_top = int(round(SOUTH_SEAM_Y_PT * pt_to_px))
    south_seam_bottom = int(round(SOUTH_SEAM_BOTTOM_Y_PT * pt_to_px))
    south_crop_h = south_seam_bottom - south_seam_top
    horiz_offset = int(round(SOUTH_HORIZ_OFFSET_PT * pt_to_px))
    
    # Target width is North sheet map width
    target_w = nw
    total_h = north_crop_h + south_crop_h
    
    print(f"Stitching dimensions: {target_w} x {total_h} px")
    print(f"  North part: y=0 to {north_crop_h} px")
    print(f"  South part: y={south_seam_top} to {south_seam_bottom} px (height={south_crop_h} px, shift={horiz_offset} px)")
    
    # Crop North
    part_north = im_north.crop((0, 0, target_w, north_crop_h))
    
    # Crop South (shift left by horiz_offset to align meridians)
    part_south = im_south.crop((horiz_offset, south_seam_top, min(sw, horiz_offset + target_w), south_seam_bottom))
    
    # Create combined image with white background
    combined = Image.new('RGB', (target_w, total_h), (255, 255, 255))
    combined.paste(part_north, (0, 0))
    combined.paste(part_south, (0, north_crop_h))
    
    os.makedirs(os.path.dirname(os.path.abspath(output_jpg_path)), exist_ok=True)
    print(f"Saving optimized JPEG ({quality}%): {output_jpg_path}")
    combined.save(output_jpg_path, 'JPEG', quality=quality, optimize=True)
    
    # Generate companion world files
    generate_world_files(output_jpg_path, target_w, total_h)
    print("Done!")

def generate_world_files(jpg_path, width, height):
    """Write companion .wld and .jgw files in EPSG:3857 coordinates."""
    base, _ = os.path.splitext(jpg_path)
    
    dx = (EPSG3857_BOUNDS['max_x'] - EPSG3857_BOUNDS['min_x']) / width
    dy = (EPSG3857_BOUNDS['max_y'] - EPSG3857_BOUNDS['min_y']) / height
    cx = EPSG3857_BOUNDS['min_x'] + dx / 2.0
    cy = EPSG3857_BOUNDS['max_y'] - dy / 2.0
    
    wld_text = f"{dx:.8f}\n0.00000000\n0.00000000\n{-dy:.8f}\n{cx:.8f}\n{cy:.8f}\n"
    
    for ext in ['.wld', '.jgw']:
        out_file = base + ext
        with open(out_file, 'w') as f:
            f.write(wld_text)
        print(f"Generated world file: {out_file}")

def main():
    parser = argparse.ArgumentParser(description="Convert & join North and South Israel AIP PDF charts into unified JPEG")
    parser.add_argument('--north', help="Path to North Sheet PDF")
    parser.add_argument('--south', help="Path to South Sheet PDF")
    parser.add_argument('--north-img', help="Path to pre-rasterized North image (PNG/TIFF)")
    parser.add_argument('--south-img', help="Path to pre-rasterized South image (PNG/TIFF)")
    parser.add_argument('--output', '-o', required=True, help="Path for output JPEG (e.g. images/layers/air_nav_combined_aligned.jpg)")
    parser.add_argument('--dpi', type=int, default=150, help="Rendering DPI (default: 150)")
    parser.add_argument('--quality', type=int, default=85, help="JPEG quality 1-100 (default: 85)")
    args = parser.parse_args()
    
    tmp_north = None
    tmp_south = None
    
    try:
        north_img = args.north_img
        south_img = args.south_img
        
        if not north_img:
            if not args.north:
                parser.error("Either --north (PDF) or --north-img must be specified.")
            tmp_north = rasterize_pdf(args.north, '/tmp/tmp_north', dpi=args.dpi)
            north_img = tmp_north
            
        if not south_img:
            if not args.south:
                parser.error("Either --south (PDF) or --south-img must be specified.")
            tmp_south = rasterize_pdf(args.south, '/tmp/tmp_south', dpi=args.dpi)
            south_img = tmp_south
            
        stitch_images(north_img, south_img, args.output, dpi=args.dpi, quality=args.quality)
        
    finally:
        for tmp in [tmp_north, tmp_south]:
            if tmp and os.path.exists(tmp):
                try: os.remove(tmp)
                except OSError: pass

if __name__ == '__main__':
    main()
