        function exportGPX() {
            if (appState.waypoints.length === 0) {
                alert('No waypoints to export!');
                return;
            }
            
            var gpx = '<?xml version="1.0" encoding="UTF-8"?>\n';
            gpx += '<gpx version="1.1" creator="Israel Flight Planner"\n';
            gpx += '  xmlns="http://www.topografix.com/GPX/1/1"\n';
            gpx += '  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n';
            gpx += '  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">\n';
            gpx += '  <metadata>\n';
            gpx += '    <name>Flight Plan</name>\n';
            gpx += '    <time>' + new Date().toISOString() + '</time>\n';
            gpx += '  </metadata>\n';
            gpx += '  <trk>\n';
            gpx += '    <name>Flight Route</name>\n';
            gpx += '    <trkseg>\n';
            
            appState.waypoints.forEach(function(wp, idx) {
                var legIdx = idx < appState.waypoints.length - 1 ? idx : idx - 1;
                var eleMeters = Math.round(getLegAltitude(legIdx) * 0.3048);
                gpx += '      <trkpt lat="' + wp.lat.toFixed(6) + '" lon="' + wp.lng.toFixed(6) + '">\n';
                gpx += '        <ele>' + eleMeters + '</ele>\n';
                gpx += '        <name>WP' + wp.num + '</name>\n';
                gpx += '      </trkpt>\n';
            });
            
            gpx += '    </trkseg>\n';
            gpx += '  </trk>\n';
            gpx += '</gpx>';
            
            var blob = new Blob([gpx], { type: 'application/gpx+xml' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'flight-plan-' + new Date().toISOString().split('T')[0] + '.gpx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
        

        // Custom map capture: draws tiles + overlays directly onto canvas
        // Works around CORS by using already-loaded tile images from the DOM
        function saveMapScreenshot() {
                        if (appState.waypoints.length === 0) {
                alert('Add some waypoints first!');
                return;
            }
            
            // Hide sidebar before showing screenshot dialog
            var sidebar = document.querySelector('.sidebar');
            if (sidebar && sidebar.style.display !== 'none') {
                window.sidebarWasVisible = true;
                sidebar.style.display = 'none';
                
                // Show the "Show Menu" button
                var showBtn = document.getElementById('showSidebarBtn');
                if (!showBtn) {
                    showBtn = document.createElement('button');
                    showBtn.id = 'showSidebarBtn';
                    showBtn.textContent = 'Show Menu (M)';
                    showBtn.onclick = toggleSidebar;
                    showBtn.style.cssText = 'position: fixed; top: 10px; left: 10px; z-index: 1000; padding: 10px 15px; background: #0066cc; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; box-shadow: 0 2px 8px rgba(0,0,0,0.3);';
                    document.body.appendChild(showBtn);
                } else {
                    showBtn.style.display = 'block';
                }
            } else {
                window.sidebarWasVisible = false;
            }
            
            // Set default zoom to 11.25 when entering print mode
            if (appState.map.getZoom() !== 11.25) {
                appState.map.setZoom(11.25, { animate: false });
            }

            // Create modal for screenshot options
            var modal = document.createElement('div');
            modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 10000; display: flex; align-items: center; justify-content: center;';
            
            var dialog = document.createElement('div');
            dialog.style.cssText = 'background: white; padding: 30px; border-radius: 12px; max-width: 500px; width: 90%;';
            
            dialog.innerHTML = '<h2 style="margin: 0 0 20px 0;">Save Map Image</h2>' +
                '<p style="font-size: 14px; color: #666; margin-bottom: 15px;">Choose a capture method.</p>' +
                
                '<div style="display: flex; flex-direction: column; gap: 10px;">' +
                '<button onclick="captureManualSelection()" style="padding: 12px; background: #0066cc; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">Select Area Manually</button>' +
                '<button onclick="captureA4Area()" style="padding: 12px; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">🖨️ Print / Save A4</button>' +
                '<button onclick="captureA3Area()" style="padding: 12px; background: #17a2b8; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">🖨️ Print / Save A3</button>' +
                '<button onclick="captureA5Area()" style="padding: 12px; background: #6f42c1; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">🖨️ Print / Save A5 (Kneeboard)</button>' +
                '<button onclick="closeScreenshotModal()" style="padding: 12px; background: #dc3545; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">Cancel</button>' +
                '</div>';
            
            modal.appendChild(dialog);
            document.body.appendChild(modal);
            window.screenshotModal = modal;
            window.captureOrientation = 'portrait'; // Default to portrait
        }
        
        window.setOrientation = function(orientation) {
            window.captureOrientation = orientation;
            var landscapeBtn = document.getElementById('orientLandscape');
            var portraitBtn = document.getElementById('orientPortrait');
            
            if (orientation === 'landscape') {
                landscapeBtn.style.background = '#0066cc';
                landscapeBtn.style.color = 'white';
                portraitBtn.style.background = 'white';
                portraitBtn.style.color = '#0066cc';
            } else {
                portraitBtn.style.background = '#0066cc';
                portraitBtn.style.color = 'white';
                landscapeBtn.style.background = 'white';
                landscapeBtn.style.color = '#0066cc';
            }
        };
        
        window.closeScreenshotModal = function(skipSidebarRestore) {
            if (window.screenshotModal) {
                document.body.removeChild(window.screenshotModal);
                delete window.screenshotModal;
            }
            
            // Restore sidebar if it was visible before (unless told to skip)
            if (window.sidebarWasVisible && !skipSidebarRestore) {
                var sidebar = document.querySelector('.sidebar');
                if (sidebar) {
                    sidebar.style.display = 'flex';
                }
                
                // Hide the "Show Menu" button
                var showBtn = document.getElementById('showSidebarBtn');
                if (showBtn) {
                    showBtn.style.display = 'none';
                }
                
                delete window.sidebarWasVisible;
            }
        };
        
        window.captureCurrentView = function() {
            closeScreenshotModal(true); // Skip sidebar restore
            performCaptureSimple();
        };
        
        window.captureRoute = function() {
            closeScreenshotModal(true); // Skip sidebar restore
            
            // Calculate bounds including waypoints and text boxes
            var boundsPoints = appState.waypoints.map(function(wp) {
                return [wp.lat, wp.lng];
            });
            
            // Add text box positions to bounds
            appState.textBoxes.forEach(function(marker) {
                var latlng = marker.getLatLng();
                boundsPoints.push([latlng.lat, latlng.lng]);
            });
            
            if (boundsPoints.length === 0) {
                alert('No waypoints or text boxes to capture');
                return;
            }
            
            var bounds = L.latLngBounds(boundsPoints);
            
            // Get the center of the route bounds
            var routeCenter = bounds.getCenter();
            
            // Use large padding for proper margins (200px = ~1-2cm)
            appState.map.fitBounds(bounds, {padding: [200, 200], animate: false});
            
            // Wait for fitBounds to complete
            setTimeout(function() {
                // The sidebar is 320px wide, when it's hidden the map expands left
                // Pan the map slightly left to compensate and center the route
                var currentZoom = appState.map.getZoom();
                var mapContainer = appState.map.getContainer();
                var sidebarWidth = 320;
                
                // Calculate offset to center (sidebar is visible now but will be hidden during capture)
                var offsetPixels = sidebarWidth / 4;
                
                // Pan by converting pixels to map coordinates
                var currentCenter = appState.map.getCenter();
                var pointC = appState.map.project(currentCenter, currentZoom);
                pointC.x -= offsetPixels; // Pan left
                var newCenter = appState.map.unproject(pointC, currentZoom);
                
                appState.map.setView(newCenter, currentZoom, {animate: false});
                
                setTimeout(function() {
                    performCaptureSimple();
                }, 500);
            }, 500);
        };
        
        // Helper to compute Leaflet zoom level for a given real-world map scale (e.g. 250000) at latitude
        function computeScaleZoom(scaleNum, lat) {
            // Standard CSS print resolution is 96 DPI: 1 inch = 25.4mm = 96px => 1px = 0.0254 / 96 meters
            var metersPerPx = (0.0254 / 96.0) * scaleNum;
            var latRad = (lat || 31.5) * Math.PI / 180.0;
            var cosLat = Math.cos(latRad);
            // Leaflet Web Mercator: world circumference = 40075016.686m = 256 * 2^zoom * metersPerPx / cos(lat)
            return Math.log2((40075016.686 * cosLat) / (256.0 * metersPerPx));
        }

        // Paper dimensions in millimeters & 96 DPI CSS print pixels: [shortSideMm, longSideMm]
        var PAPER_SPECS = {
            'A3': { shortMm: 297, longMm: 420, portW: 1123, portH: 1587, landW: 1587, landH: 1123, cssSizePort: '297mm 420mm', cssSizeLand: '420mm 297mm' },
            'A4': { shortMm: 210, longMm: 297, portW: 794,  portH: 1123, landW: 1123, landH: 794,  cssSizePort: '210mm 297mm', cssSizeLand: '297mm 210mm' },
            'A5': { shortMm: 148, longMm: 210, portW: 559,  portH: 794,  landW: 794,  landH: 559,  cssSizePort: '148mm 210mm', cssSizeLand: '210mm 148mm' }
        };

        window.captureA3Area = function() { window.captureA4Area('A3'); };
        window.captureA5Area = function() { window.captureA4Area('A5'); };

        window.captureA4Area = function(paperSize) {
            paperSize = paperSize || 'A4';
            var paperSpec = PAPER_SPECS[paperSize] || PAPER_SPECS['A4'];
            var isLandscape = (window.captureOrientation === 'landscape');
            var selectedScale = '250000'; // Default scale: 1:250,000

            // Close screenshot modal but keep sidebar hidden
            closeScreenshotModal(true);

            var mapContainer = document.getElementById('map');
            var mapW = mapContainer.offsetWidth;
            var mapH = mapContainer.offsetHeight;

            // Geographic center of primary rect — source of truth
            var rectGeoCenter = appState.map.getCenter();

            function calculateRectDimensions(land, scaleVal, centerLat) {
                var widthMm = land ? paperSpec.longMm : paperSpec.shortMm;
                var heightMm = land ? paperSpec.shortMm : paperSpec.longMm;

                if (scaleVal === 'auto') {
                    var r = widthMm / heightMm;
                    var rw, rh;
                    if (land) {
                        rh = Math.round(Math.min(mapH, mapW / r) * 0.80);
                        rw = Math.round(rh * r);
                    } else {
                        rw = Math.round(Math.min(mapW, mapH / r) * 0.80);
                        rh = Math.round(rw * r);
                    }
                    return { w: rw, h: rh };
                }

                var scaleNum = parseInt(scaleVal, 10);
                var groundWidthM = (widthMm / 1000.0) * scaleNum;
                var groundHeightM = (heightMm / 1000.0) * scaleNum;

                var zoom = appState.map.getZoom();
                var latRad = (centerLat || (rectGeoCenter ? rectGeoCenter.lat : 31.5)) * Math.PI / 180.0;
                var metersPerPx = (40075016.686 * Math.cos(latRad)) / (256.0 * Math.pow(2, zoom));

                var rw = Math.round(groundWidthM / metersPerPx);
                var rh = Math.round(groundHeightM / metersPerPx);
                return { w: rw, h: rh };
            }

            var initDims = calculateRectDimensions(isLandscape, selectedScale, rectGeoCenter.lat);
            // If initial rect exceeds visible map container, adjust map zoom so user sees whole frame
            if (selectedScale !== 'auto') {
                var initialZoom = appState.map.getZoom();
                var maxDimRatio = Math.max(initDims.w / (mapW * 0.85), initDims.h / (mapH * 0.85));
                if (maxDimRatio > 1) {
                    var zoomReduction = Math.ceil(Math.log2(maxDimRatio));
                    var adjustedZoom = Math.max(appState.map.getMinZoom() || 6, initialZoom - zoomReduction);
                    appState.map.setView(rectGeoCenter, adjustedZoom, { animate: false });
                    initDims = calculateRectDimensions(isLandscape, selectedScale, rectGeoCenter.lat);
                }
            }

            var rectW = initDims.w;
            var rectH = initDims.h;

            var centerPt = appState.map.latLngToContainerPoint(rectGeoCenter);
            var startX = Math.round(centerPt.x - rectW / 2);
            var startY = Math.round(centerPt.y - rectH / 2);

            // ── Overlay dimming layer ──────────────────────────────────────
            var overlay = document.createElement('div');
            overlay.id = 'a4Overlay';
            overlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:2000;pointer-events:none;';
            var origMapPosition = mapContainer.style.position;
            mapContainer.style.position = 'relative';
            mapContainer.appendChild(overlay);

            // Four dimming panels around the rect
            var panels = {};
            ['top','bottom','left','right'].forEach(function(side) {
                var p = document.createElement('div');
                p.style.cssText = 'position:absolute;background:rgba(0,0,0,0.45);pointer-events:none;';
                overlay.appendChild(p);
                panels[side] = p;
            });

            // ── Print rectangle ───────────────────────────────────────────────
            var rect = document.createElement('div');
            rect.id = 'a4Rect';
            rect.style.cssText = [
                'position:absolute',
                'border:2px dashed #fff',
                'box-shadow:0 0 0 1px #0066cc, inset 0 0 0 1px #0066cc',
                'cursor:move',
                'z-index:2001',
                'box-sizing:border-box'
            ].join(';');
            mapContainer.appendChild(rect);

            // Corner label
            var label = document.createElement('div');
            label.style.cssText = 'position:absolute;top:4px;left:4px;background:rgba(0,102,204,0.85);color:#fff;font-size:11px;font-weight:700;padding:2px 7px;border-radius:3px;pointer-events:none;white-space:nowrap;';
            rect.appendChild(label);

            function updateLabel() {
                var sizeText = paperSize + (isLandscape ? ' Landscape' : ' Portrait');
                if (selectedScale === 'auto') {
                    label.textContent = sizeText + ' · Auto Scale';
                } else {
                    var scaleNum = parseInt(selectedScale, 10);
                    var scaleText = '1:' + (scaleNum >= 1000 ? (scaleNum / 1000) + 'k' : scaleNum);
                    var widthMm = isLandscape ? paperSpec.longMm : paperSpec.shortMm;
                    var heightMm = isLandscape ? paperSpec.shortMm : paperSpec.longMm;
                    var kmW = (widthMm * scaleNum / 1000000).toFixed(1);
                    var kmH = (heightMm * scaleNum / 1000000).toFixed(1);
                    var nmW = (kmW * 0.539957).toFixed(1);
                    var nmH = (kmH * 0.539957).toFixed(1);
                    var cmText = (scaleNum / 100000) + ' km';
                    label.textContent = sizeText + ' · ' + scaleText + ' (1cm = ' + cmText + ') · ' + kmW + '×' + kmH + ' km (' + nmW + '×' + nmH + ' NM)';
                }
            }
            updateLabel();

            // Declared early so positionRect can call updateExtraRects safely
            var extraRects = [];

            function positionRect(x, y) {
                var minX = Math.min(0, mapW - rectW);
                var maxX = Math.max(0, mapW - rectW);
                var minY = Math.min(0, mapH - rectH);
                var maxY = Math.max(0, mapH - rectH);
                x = Math.max(minX, Math.min(maxX, x));
                y = Math.max(minY, Math.min(maxY, y));
                rect.style.left   = x + 'px';
                rect.style.top    = y + 'px';
                rect.style.width  = rectW + 'px';
                rect.style.height = rectH + 'px';
                updatePanels(x, y, rectW, rectH);
                window._a4Pos = { x: x, y: y, w: rectW, h: rectH };
                // Save geographic center
                rectGeoCenter = appState.map.containerPointToLatLng(
                    L.point(x + rectW / 2, y + rectH / 2)
                );
                if (typeof updateExtraRects === 'function') updateExtraRects();
            }

            function updatePanels(x, y, w, h) {
                var topH = Math.max(0, y);
                var botY = Math.max(0, y + h);
                var botH = Math.max(0, mapH - botY);
                var leftW = Math.max(0, x);
                var rightX = Math.max(0, x + w);
                var rightW = Math.max(0, mapW - rightX);

                panels.top.style.cssText    = 'position:absolute;background:rgba(0,0,0,0.45);pointer-events:none;left:0;top:0;width:100%;height:' + topH + 'px;';
                panels.bottom.style.cssText = 'position:absolute;background:rgba(0,0,0,0.45);pointer-events:none;left:0;top:' + botY + 'px;width:100%;height:' + botH + 'px;';
                panels.left.style.cssText   = 'position:absolute;background:rgba(0,0,0,0.45);pointer-events:none;left:0;top:' + topH + 'px;width:' + leftW + 'px;height:' + Math.min(mapH - topH, Math.max(0, h)) + 'px;';
                panels.right.style.cssText  = 'position:absolute;background:rgba(0,0,0,0.45);pointer-events:none;left:' + rightX + 'px;top:' + topH + 'px;width:' + rightW + 'px;height:' + Math.min(mapH - topH, Math.max(0, h)) + 'px;';
            }

            // Re-anchor rects to geo position when map moves/zooms
            function refreshRectPositions() {
                if (!rectGeoCenter) return;
                if (selectedScale !== 'auto') {
                    var dims = calculateRectDimensions(isLandscape, selectedScale, rectGeoCenter.lat);
                    rectW = dims.w;
                    rectH = dims.h;
                }
                var center = appState.map.latLngToContainerPoint(rectGeoCenter);
                var x = Math.round(center.x - rectW / 2);
                var y = Math.round(center.y - rectH / 2);
                rect.style.left   = x + 'px';
                rect.style.top    = y + 'px';
                rect.style.width  = rectW + 'px';
                rect.style.height = rectH + 'px';
                updatePanels(x, y, rectW, rectH);
                window._a4Pos = { x: x, y: y, w: rectW, h: rectH };
                // Reposition extra rects from their geo centers
                extraRects.forEach(function(er, idx) {
                    var p = idx + 1;
                    var gc = extraGeocenters[p];
                    if (!gc) return;
                    var pageLandscape = pageOrientations[p] !== undefined ? pageOrientations[p] : isLandscape;
                    var pageDims = calculateRectDimensions(pageLandscape, selectedScale, gc.lat);
                    var pw = pageDims.w;
                    var ph = pageDims.h;
                    var ep = appState.map.latLngToContainerPoint(gc);
                    er.style.left   = Math.round(ep.x - pw/2) + 'px';
                    er.style.top    = Math.round(ep.y - ph/2) + 'px';
                    er.style.width  = pw + 'px';
                    er.style.height = ph + 'px';
                });
            }
            appState.map.on('move zoom', refreshRectPositions);

            // ── Drag logic ─────────────────────────────────────────────────
            var dragging = false, dragOffX, dragOffY;
            rect.addEventListener('mousedown', function(e) {
                dragging = true;
                var r = rect.getBoundingClientRect();
                var m = mapContainer.getBoundingClientRect();
                dragOffX = e.clientX - (r.left - m.left);
                dragOffY = e.clientY - (r.top  - m.top);
                e.preventDefault();
                appState.map.dragging.disable();
            });
            document.addEventListener('mousemove', function(e) {
                if (!dragging) return;
                var m = mapContainer.getBoundingClientRect();
                positionRect(e.clientX - m.left - dragOffX, e.clientY - m.top - dragOffY);
            });
            document.addEventListener('mouseup', function() {
                if (dragging) { dragging = false; appState.map.dragging.enable(); }
            });

            // ── Toolbar ────────────────────────────────────────────────────
            var toolbar = document.createElement('div');
            toolbar.id = 'a4Toolbar';
            toolbar.style.cssText = [
                'position:fixed;bottom:20px;left:50%;transform:translateX(-50%)',
                'background:rgba(0,0,0,0.85);color:#fff;border-radius:10px',
                'padding:8px 14px;display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:8px',
                'z-index:3000;box-shadow:0 4px 16px rgba(0,0,0,0.4);font-size:13px;font-weight:600;max-width:95vw'
            ].join(';');
            toolbar.innerHTML =
                '<span style="opacity:.7;font-size:12px;">Drag rect · scroll to zoom</span>' +
                '<button id="a4Portrait"  style="padding:5px 10px;background:#0066cc;color:#fff;border:2px solid #fff;border-radius:5px;cursor:pointer;font-size:12px;">📱 Port</button>' +
                '<button id="a4Landscape" style="padding:5px 10px;background:transparent;color:#fff;border:2px solid rgba(255,255,255,0.3);border-radius:5px;cursor:pointer;font-size:12px;">📐 Land</button>' +
                '<span style="opacity:.7;font-size:12px;margin-left:4px;">Scale:</span>' +
                '<select id="a4ScaleRatio" style="padding:5px 8px;border-radius:5px;border:none;font-size:12px;font-weight:600;background:#fff;color:#333;cursor:pointer;">' +
                    '<option value="250000" selected>1:250,000 (Chart)</option>' +
                    '<option value="150000">1:150,000</option>' +
                    '<option value="125000">1:125,000</option>' +
                    '<option value="100000">1:100,000 (Detailed)</option>' +
                    '<option value="500000">1:500,000 (Regional)</option>' +
                    '<option value="auto">Fit View (Auto)</option>' +
                '</select>' +
                '<button id="a4ZoomToScale" style="padding:5px 10px;background:#17a2b8;color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:12px;" title="Set screen zoom to match print scale exactly (1cm on screen = 1cm on chart)">🔍 1:1 View</button>' +
                '<button id="a4ZoomIn"   style="padding:5px 10px;background:#0066cc;color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:14px;">+</button>' +
                '<button id="a4ZoomOut"  style="padding:5px 10px;background:#0066cc;color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:14px;">−</button>' +
                '<span style="opacity:.7;font-size:12px;margin-left:4px;">Pages:</span>' +
                '<select id="a4PageCount" style="padding:5px 8px;border-radius:5px;border:none;font-size:12px;font-weight:600;background:#fff;color:#333;cursor:pointer;"><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option></select>' +
                '<button id="a4LayoutStacked"  style="padding:5px 8px;background:#0066cc;color:#fff;border:2px solid #fff;border-radius:5px;cursor:pointer;font-size:12px;" title="Pages stacked vertically">⬇ Stack</button>' +
                '<button id="a4LayoutSideBySide" style="padding:5px 8px;background:transparent;color:#fff;border:2px solid rgba(255,255,255,0.3);border-radius:5px;cursor:pointer;font-size:12px;" title="Pages side by side">➡ Side</button>' +
                '<span style="opacity:.7;font-size:12px;">Overlap: <span id="a4OverlapLabel">0</span>%</span>' +
                '<input id="a4Overlap" type="range" min="0" max="50" value="0" step="5" style="width:70px;cursor:pointer;accent-color:#0066cc;">' +
                '<button id="a4Print"    style="padding:6px 14px;background:#28a745;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:700;">🖨️ Print / Save</button>' +
                '<button id="a4Cancel"   style="padding:6px 10px;background:#dc3545;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:700;">✕ Cancel</button>';
            document.body.appendChild(toolbar);
            positionRect(startX, startY); // Safe — toolbar is now in DOM

            // Page layout direction: portrait defaults to side-by-side, landscape to stacked
            var pagesHorizontal = !isLandscape;

            function setPagesLayout(horizontal) {
                pagesHorizontal = horizontal;
                document.getElementById('a4LayoutStacked').style.background     = horizontal ? 'transparent' : '#0066cc';
                document.getElementById('a4LayoutStacked').style.borderColor    = horizontal ? 'rgba(255,255,255,0.3)' : '#fff';
                document.getElementById('a4LayoutSideBySide').style.background  = horizontal ? '#0066cc' : 'transparent';
                document.getElementById('a4LayoutSideBySide').style.borderColor = horizontal ? '#fff' : 'rgba(255,255,255,0.3)';
                updateExtraRects();
            }

            document.getElementById('a4LayoutStacked').onclick    = function() { setPagesLayout(false); };
            document.getElementById('a4LayoutSideBySide').onclick = function() { setPagesLayout(true);  };

            // Sync button styles to match initial default
            setPagesLayout(pagesHorizontal);

            document.getElementById('a4Overlap').addEventListener('input', function() {
                document.getElementById('a4OverlapLabel').textContent = this.value;
                updateExtraRects();
            });

            function getOverlapFraction() {
                return parseInt(document.getElementById('a4Overlap').value) / 100;
            }

            // Per-page orientation: track whether each extra page is landscape
            var pageOrientations = {}; // p index (1-based) -> true=landscape
            var extraGeocenters = {}; // p index -> LatLng center

            function updateExtraRects() {
                extraRects.forEach(function(r) { if (r.parentNode) r.parentNode.removeChild(r); });
                extraRects = [];
                var pageCount = parseInt(document.getElementById('a4PageCount').value) || 1;
                var pos = window._a4Pos;
                if (!pos || pageCount <= 1) return;
                var overlap = getOverlapFraction();
                var stepW = pagesHorizontal ? pos.w * (1 - overlap) : 0;
                var stepH = pagesHorizontal ? 0 : pos.h * (1 - overlap);
                for (var p = 1; p < pageCount; p++) {
                    var pageLandscape = pageOrientations[p] !== undefined ? pageOrientations[p] : isLandscape;
                    var pDims = calculateRectDimensions(pageLandscape, selectedScale, rectGeoCenter.lat);
                    var pw = pDims.w;
                    var ph = pDims.h;
                    var er = document.createElement('div');
                    er.style.cssText = 'position:absolute;border:2px dashed rgba(255,255,255,0.5);box-shadow:0 0 0 1px rgba(0,102,204,0.5);z-index:2001;box-sizing:border-box;';
                    var ex, ey;
                    if (extraGeocenters[p]) {
                        var pt = appState.map.latLngToContainerPoint(extraGeocenters[p]);
                        ex = Math.round(pt.x - pw / 2);
                        ey = Math.round(pt.y - ph / 2);
                    } else {
                        ex = Math.round(pos.x + p * stepW);
                        ey = Math.round(pos.y + p * stepH);
                        extraGeocenters[p] = appState.map.containerPointToLatLng(L.point(ex + pw / 2, ey + ph / 2));
                    }
                    er.style.left = ex + 'px';
                    er.style.top  = ey + 'px';
                    er.style.width = pw + 'px'; er.style.height = ph + 'px';
                    // Label + orientation toggle button
                    var pl = document.createElement('div');
                    pl.style.cssText = 'position:absolute;top:4px;left:4px;display:flex;align-items:center;gap:4px;';
                    var lbl = document.createElement('span');
                    lbl.style.cssText = 'background:rgba(0,102,204,0.7);color:#fff;font-size:11px;font-weight:700;padding:2px 7px;border-radius:3px;';
                    lbl.textContent = 'Page ' + (p + 1);
                    var rotBtn = document.createElement('button');
                    rotBtn.style.cssText = 'background:rgba(255,255,255,0.2);color:#fff;border:1px solid rgba(255,255,255,0.5);border-radius:3px;font-size:10px;padding:2px 5px;cursor:pointer;';
                    rotBtn.textContent = pageLandscape ? '⬛ Land' : '📱 Port';
                    rotBtn.title = 'Toggle orientation for this page';
                    (function(idx, btn) {
                        btn.addEventListener('click', function(e) {
                            e.stopPropagation();
                            pageOrientations[idx] = !(pageOrientations[idx] !== undefined ? pageOrientations[idx] : isLandscape);
                            updateExtraRects();
                        });
                    })(p, rotBtn);
                    pl.appendChild(lbl);
                    pl.appendChild(rotBtn);
                    er.appendChild(pl);
                    mapContainer.appendChild(er);
                    extraRects.push(er);

                    // Make extra rect draggable
                    (function(erEl, pageIdx) {
                        var erDragging = false, erOffX, erOffY;
                        erEl.style.cursor = 'move';
                        erEl.addEventListener('mousedown', function(e) {
                            if (e.target.tagName === 'BUTTON') return;
                            erDragging = true;
                            var r = erEl.getBoundingClientRect();
                            var m = mapContainer.getBoundingClientRect();
                            erOffX = e.clientX - (r.left - m.left);
                            erOffY = e.clientY - (r.top  - m.top);
                            e.preventDefault();
                            appState.map.dragging.disable();
                        });
                        document.addEventListener('mousemove', function(e) {
                            if (!erDragging) return;
                            var m = mapContainer.getBoundingClientRect();
                            var nx = e.clientX - m.left - erOffX;
                            var ny = e.clientY - m.top  - erOffY;
                            erEl.style.left = nx + 'px';
                            erEl.style.top  = ny + 'px';
                            var pw = parseInt(erEl.style.width);
                            var ph = parseInt(erEl.style.height);
                            extraGeocenters[pageIdx] = appState.map.containerPointToLatLng(
                                L.point(nx + pw/2, ny + ph/2)
                            );
                        });
                        document.addEventListener('mouseup', function() {
                            if (erDragging) { erDragging = false; appState.map.dragging.enable(); }
                        });
                    })(er, p);
                }
            }

            document.getElementById('a4PageCount').addEventListener('change', updateExtraRects);

            document.getElementById('a4ZoomIn').onclick  = function() { appState.map.zoomIn();  };
            document.getElementById('a4ZoomOut').onclick = function() { appState.map.zoomOut(); };

            document.getElementById('a4ScaleRatio').addEventListener('change', function() {
                selectedScale = this.value;
                var dims = calculateRectDimensions(isLandscape, selectedScale, rectGeoCenter.lat);
                rectW = dims.w;
                rectH = dims.h;
                var center = appState.map.latLngToContainerPoint(rectGeoCenter);
                positionRect(Math.round(center.x - rectW / 2), Math.round(center.y - rectH / 2));
                updateLabel();
                var zoomBtn = document.getElementById('a4ZoomToScale');
                if (zoomBtn) {
                    zoomBtn.style.display = (selectedScale === 'auto') ? 'none' : 'inline-block';
                }
            });

            document.getElementById('a4ZoomToScale').onclick = function() {
                if (selectedScale === 'auto') return;
                var scaleNum = parseInt(selectedScale, 10);
                var targetZoom = computeScaleZoom(scaleNum, rectGeoCenter.lat);
                appState.map.setView(rectGeoCenter, targetZoom, { animate: true });
            };

            function setA4Orientation(landscape) {
                isLandscape = landscape;
                window.captureOrientation = landscape ? 'landscape' : 'portrait';
                // Update button styles
                document.getElementById('a4Portrait').style.background  = landscape ? 'transparent' : '#0066cc';
                document.getElementById('a4Portrait').style.borderColor  = landscape ? 'rgba(255,255,255,0.3)' : '#fff';
                document.getElementById('a4Landscape').style.background = landscape ? '#0066cc' : 'transparent';
                document.getElementById('a4Landscape').style.borderColor = landscape ? '#fff' : 'rgba(255,255,255,0.3)';
                // Rebuild rect dimensions
                var dims = calculateRectDimensions(landscape, selectedScale, rectGeoCenter.lat);
                rectW = dims.w;
                rectH = dims.h;

                var curCenter = rectGeoCenter || appState.map.getCenter();
                var pt = appState.map.latLngToContainerPoint(curCenter);
                positionRect(Math.round(pt.x - rectW / 2), Math.round(pt.y - rectH / 2));
                updateLabel();
                setPagesLayout(!landscape);
            }

            document.getElementById('a4Portrait').onclick  = function() { setA4Orientation(false); };
            document.getElementById('a4Landscape').onclick = function() { setA4Orientation(true);  };

            document.getElementById('a4Cancel').onclick = function() {
                cleanupA4();
                // Restore sidebar
                if (window.sidebarWasVisible) {
                    var sb = document.querySelector('.sidebar');
                    if (sb) sb.style.display = 'flex';
                    var showBtn = document.getElementById('showSidebarBtn');
                    if (showBtn) showBtn.style.display = 'none';
                }
            };

            document.getElementById('a4Print').onclick = function() {
                var pos = window._a4Pos;
                var mapRect = mapContainer.getBoundingClientRect();

                // Convert rect corners to geographic bounds using container-relative coords
                var nw = appState.map.containerPointToLatLng(L.point(pos.x,         pos.y));
                var se = appState.map.containerPointToLatLng(L.point(pos.x + pos.w, pos.y + pos.h));
                var primaryCenter = rectGeoCenter || appState.map.containerPointToLatLng(
                    L.point(pos.x + pos.w / 2, pos.y + pos.h / 2)
                );

                // Print dimensions in CSS pixels (96 DPI)
                var printW = isLandscape ? paperSpec.landW : paperSpec.portW;
                var printH = isLandscape ? paperSpec.landH : paperSpec.portH;
                var singleCssPageSize = isLandscape ? paperSpec.cssSizeLand : paperSpec.cssSizePort;

                // Compute zoom for printing
                var printZoom;
                if (selectedScale !== 'auto') {
                    var scaleNum = parseInt(selectedScale, 10);
                    printZoom = computeScaleZoom(scaleNum, primaryCenter.lat);
                } else {
                    var lngSpan  = Math.abs(se.lng - nw.lng);
                    var zoomByW  = Math.log2(printW * 360 / (256 * lngSpan));
                    function mercY(lat) { var r = lat * Math.PI / 180; return Math.log(Math.tan(Math.PI/4 + r/2)); }
                    var mercSpan = Math.abs(mercY(nw.lat) - mercY(se.lat));
                    var zoomByH  = Math.log2(printH * 2 * Math.PI / (256 * mercSpan));
                    printZoom = Math.min(zoomByW, zoomByH);
                }

                // Compute center points for each page from geo centers
                var pageCountForPrint = parseInt(document.getElementById('a4PageCount') ? document.getElementById('a4PageCount').value : '1') || 1;
                var pageCenters = [];
                // Page 0: primary rect geo center
                pageCenters.push(primaryCenter);
                // Pages 1+: extra rect geo centers
                for (var pp = 1; pp < pageCountForPrint; pp++) {
                    pageCenters.push(extraGeocenters[pp] || pageCenters[0]);
                }
                cleanupA4();

                // Save original map state
                var origCenter   = appState.map.getCenter();
                var origZoom     = appState.map.getZoom();
                var origZoomSnap = appState.map.options.zoomSnap;
                var mapDiv       = document.getElementById('map');
                var origW        = mapDiv.style.width;
                var origH        = mapDiv.style.height;
                var origFlex     = mapDiv.style.flex;
                var sidebar      = document.querySelector('.sidebar');
                var zoomInd      = document.querySelector('.zoom-indicator');

                // Allow exact floating-point zoom without snapping during print
                appState.map.options.zoomSnap = 0;

                // Resize map to exactly paper dimensions
                mapDiv.style.flex   = 'none';
                mapDiv.style.width  = printW + 'px';
                mapDiv.style.height = printH + 'px';
                if (sidebar) sidebar.style.display = 'none';
                if (zoomInd) zoomInd.style.display = 'none';

                appState.map.invalidateSize({ animate: false });
                appState.map.setView(pageCenters[0], printZoom, { animate: false });

                // Wait for tiles to load then print automatically
                setTimeout(function() {

                    // Watermark — placed in the corner with least route content
                    var watermark = document.createElement('div');
                    watermark.id = 'a4Watermark';
                    watermark.innerHTML =
                        '<span style="font-size:10px;">🛩️</span>' +
                        '<span style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;' +
                        'font-size:8px;font-weight:600;color:#0066cc;letter-spacing:0.2px;opacity:0.8;">' +
                        'ISR Flight Planner - by Yossi Hadad</span>';
                    document.body.appendChild(watermark);

                    // Find corner with fewest overlapping drawn elements
                    (function positionWatermark() {
                        var mr = document.getElementById('map').getBoundingClientRect();
                        var ww = 160, wh = 28, margin = 8;

                        var corners = [
                            { label: 'BL', style: 'bottom:'+margin+'px;left:'+margin+'px;' },
                            { label: 'BR', style: 'bottom:'+margin+'px;right:'+margin+'px;' },
                            { label: 'TL', style: 'top:'+margin+'px;left:'+margin+'px;' },
                            { label: 'TR', style: 'top:'+margin+'px;right:'+margin+'px;' }
                        ];

                        // Compute screen rect for each corner
                        function cornerRect(c) {
                            var x = (c.label[1]==='L') ? mr.left+margin : mr.right-margin-ww;
                            var y = (c.label[0]==='T') ? mr.top+margin : mr.bottom-margin-wh;
                            return { left:x, top:y, right:x+ww, bottom:y+wh };
                        }

                        function overlaps(a, b) {
                            return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
                        }

                        // Collect rects of all visible drawn elements inside the map
                        var drawn = [];
                        var selectors = [
                            '.leg-info-label', '.time-label', '.leaflet-marker-icon',
                            '.wl-div', '.tb-div', '.al-div'
                        ];
                        selectors.forEach(function(sel) {
                            document.querySelectorAll(sel).forEach(function(el) {
                                var r = el.getBoundingClientRect();
                                if (r.width > 0 && r.height > 0 &&
                                    r.left < mr.right && r.right > mr.left &&
                                    r.top < mr.bottom && r.bottom > mr.top) {
                                    drawn.push(r);
                                }
                            });
                        });

                        // Pick corner with zero or fewest overlapping elements
                        var best = corners[0], bestScore = Infinity;
                        corners.forEach(function(c) {
                            var cr = cornerRect(c);
                            var score = 0;
                            drawn.forEach(function(r) { if (overlaps(cr, r)) score++; });
                            if (score < bestScore) { bestScore = score; best = c; }
                        });

                        watermark.style.cssText =
                            'position:fixed;z-index:99999;display:flex;align-items:center;gap:4px;' +
                            'background:rgba(255,255,255,0.75);border:1px solid rgba(0,102,204,0.4);' +
                            'border-radius:3px;padding:2px 6px;pointer-events:none;' + best.style;
                    })();

                    var printStyle = document.createElement('style');
                    printStyle.id = 'a4PrintStyle';
                    printStyle.textContent =
                        '@media print {' +
                        '  #showSidebarBtn { display:none !important; }' +
                        '  .sidebar, .zoom-indicator { display:none !important; }' +
                        '  .leaflet-control-zoom, .leaflet-control-layers, .leaflet-control-attribution { display:none !important; }' +
                        '  * { -webkit-print-color-adjust:exact; print-color-adjust:exact; }' +
                        '  html, body { margin:0 !important; padding:0 !important;' +
                        '    width:' + printW + 'px !important; height:' + printH + 'px !important;' +
                        '    overflow:hidden !important; }' +
                        '  .container { display:block !important; margin:0 !important; padding:0 !important; }' +
                        '  #map { position:fixed !important; top:0 !important; left:0 !important;' +
                        '    width:' + printW + 'px !important; height:' + printH + 'px !important;' +
                        '    margin:0 !important; padding:0 !important; }' +
                        '  #a4Watermark { display:flex !important; }' +
                        '  @page { size:' + singleCssPageSize + '; margin:0; }' +
                        '}';
                    document.head.appendChild(printStyle);

                    function restore() {
                        ['a4PrintStyle', 'a4Watermark'].forEach(function(id) {
                            var el = document.getElementById(id);
                            if (el) el.parentNode.removeChild(el);
                        });
                        mapDiv.style.flex   = origFlex;
                        mapDiv.style.width  = origW;
                        mapDiv.style.height = origH;
                        if (sidebar) sidebar.style.display = '';
                        if (zoomInd) zoomInd.style.display = '';
                        appState.map.options.zoomSnap = origZoomSnap;
                        appState.map.invalidateSize({ animate: false });
                        appState.map.setView(origCenter, origZoom, { animate: false });
                        if (window.sidebarWasVisible) {
                            if (sidebar) sidebar.style.display = 'flex';
                            var showBtn = document.getElementById('showSidebarBtn');
                            if (showBtn) showBtn.style.display = 'none';
                        }
                    }

                    var pageCount = pageCountForPrint;

                    if (pageCount === 1) {
                        window.print();
                        setTimeout(restore, 1500);
                    } else {
                        // Print each page one at a time; onafterprint triggers the next
                        var currentPage = 0;
                        function printNextPage() {
                            if (currentPage >= pageCount) {
                                restore();
                                return;
                            }
                            var pageLand = currentPage === 0 ? isLandscape :
                                (pageOrientations[currentPage] !== undefined ? pageOrientations[currentPage] : isLandscape);
                            var pgW = pageLand ? paperSpec.landW : paperSpec.portW;
                            var pgH = pageLand ? paperSpec.landH : paperSpec.portH;
                            var pgCssSize = pageLand ? paperSpec.cssSizeLand : paperSpec.cssSizePort;
                            var pageZoom = (selectedScale !== 'auto') ?
                                computeScaleZoom(parseInt(selectedScale, 10), pageCenters[currentPage].lat) :
                                printZoom;

                            mapDiv.style.width  = pgW + 'px';
                            mapDiv.style.height = pgH + 'px';
                            // Recreate print style with correct dimensions for this page
                            var oldPs = document.getElementById('a4PrintStyle');
                            if (oldPs) oldPs.parentNode.removeChild(oldPs);
                            var ps = document.createElement('style');
                            ps.id = 'a4PrintStyle';
                            ps.textContent =
                                '@media print {' +
                                '  #showSidebarBtn { display:none !important; }' +
                                '  .sidebar, .zoom-indicator { display:none !important; }' +
                                '  .leaflet-control-zoom, .leaflet-control-layers, .leaflet-control-attribution { display:none !important; }' +
                                '  * { -webkit-print-color-adjust:exact; print-color-adjust:exact; }' +
                                '  html, body { margin:0 !important; padding:0 !important;' +
                                '    width:' + pgW + 'px !important; height:' + pgH + 'px !important;' +
                                '    overflow:hidden !important; }' +
                                '  .container { display:block !important; margin:0 !important; padding:0 !important; }' +
                                '  #map { position:fixed !important; top:0 !important; left:0 !important;' +
                                '    width:' + pgW + 'px !important; height:' + pgH + 'px !important;' +
                                '    margin:0 !important; padding:0 !important; }' +
                                '  #a4Watermark { display:flex !important; }' +
                                '  @page { size:' + pgCssSize + '; margin:0; }' +
                                '}';
                            document.head.appendChild(ps);
                            appState.map.invalidateSize({ animate: false });
                            appState.map.setView(pageCenters[currentPage], pageZoom, { animate: false });
                            setTimeout(function() {
                                window.onafterprint = function() {
                                    window.onafterprint = null;
                                    currentPage++;
                                    setTimeout(printNextPage, 300);
                                };
                                window.print();
                            }, 1000);
                        }
                        printNextPage();
                    }

                }, 1500);
            };

            function cleanupA4() {
                appState.map.off('move zoom', refreshRectPositions);
                if (overlay.parentNode)  overlay.parentNode.removeChild(overlay);
                if (rect.parentNode)     rect.parentNode.removeChild(rect);
                if (toolbar.parentNode)  toolbar.parentNode.removeChild(toolbar);
                extraRects.forEach(function(r) { if (r.parentNode) r.parentNode.removeChild(r); });
                extraRects = [];
                mapContainer.style.position = origMapPosition;
                appState.map.dragging.enable();
                delete window._a4Pos;
            }
        };


                function captureWithMapBackground(mapDiv, options, callback) {
            domtoimage.toBlob(mapDiv, {
                width: mapDiv.offsetWidth,
                height: mapDiv.offsetHeight,
                style: { overflow: 'hidden' }
            }).then(function(blob) {
                callback(blob);
            }).catch(function(err) {
                console.error('Capture failed:', err);
                callback(null);
            });
        }

        function hideMapControls() {
            var controls = document.querySelectorAll('.leaflet-control-zoom, .leaflet-control-layers, .leaflet-control-attribution');
            controls.forEach(function(el) { el.dataset.preCapture = el.style.display; el.style.display = 'none'; });
            var pi = document.getElementById('print-info');
            if (pi) { pi.dataset.preCapture = pi.style.display; pi.style.display = 'none'; }
        }

        function restoreMapControls() {
            var controls = document.querySelectorAll('.leaflet-control-zoom, .leaflet-control-layers, .leaflet-control-attribution');
            controls.forEach(function(el) { el.style.display = el.dataset.preCapture || ''; delete el.dataset.preCapture; });
            var pi = document.getElementById('print-info');
            if (pi) { pi.style.display = pi.dataset.preCapture || ''; delete pi.dataset.preCapture; }
        }

        function performCaptureWithCrop() {
            var loading = document.createElement('div');
            document.body.appendChild(loading);

            var mapDiv = document.getElementById('map');
            var sidebar = document.querySelector('.sidebar');
            var zoom = document.querySelector('.zoom-indicator');

            var sidebarDisplay = sidebar ? sidebar.style.display : '';
            var zoomDisplay    = zoom ? zoom.style.display : '';

            if (sidebar) sidebar.style.display = 'none';
            if (zoom)    zoom.style.display    = 'none';
            hideMapControls();

            setTimeout(function() {
                var hasLocal = Array.from(mapDiv.querySelectorAll('img')).some(function(img) {
                    return img.src && img.src.startsWith('file://');
                });

                function doCapture(blobPromise) {
                    blobPromise.then(function(blob) {
                        if (sidebar) sidebar.style.display = sidebarDisplay;
                        if (zoom)    zoom.style.display    = zoomDisplay;
                        restoreMapControls();

                        var url = URL.createObjectURL(blob);
                        var a = document.createElement('a');
                        a.href = url;
                        a.download = 'flight-plan-selection-' + new Date().toISOString().slice(0,19).replace(/:/g,'-') + '.png';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        if (document.body.contains(loading)) document.body.removeChild(loading);
                        appState.map.setView(window._captureOrigCenter, window._captureOrigZoom, {animate: false});
                        delete window.selectedBounds;
                        delete window._captureOrigCenter;
                        delete window._captureOrigZoom;
                        delete window.selectedPixelW;
                        delete window.selectedPixelH;
                        restoreSidebarAfterCapture();
                    }).catch(function(err) {
                        if (sidebar) sidebar.style.display = sidebarDisplay;
                        if (zoom)    zoom.style.display    = zoomDisplay;
                        restoreMapControls();
                        if (document.body.contains(loading)) document.body.removeChild(loading);
                        alert('Capture failed: ' + (err && err.message ? err.message : err));
                        restoreSidebarAfterCapture();
                    });
                }

                // Unified approach: resize map to selection ratio, fitBounds, print dialog
                // Works for both AirNav (file://) and OSM (https://)
                var selRatio = (window.selectedPixelW || 1) / (window.selectedPixelH || 1);
                var origMapWS = mapDiv.style.width, origMapHS = mapDiv.style.height, origMapFlexS = mapDiv.style.flex;
                var viewH = mapDiv.offsetHeight;
                var viewW = Math.round(viewH * selRatio);
                mapDiv.style.flex = 'none';
                mapDiv.style.width = viewW + 'px';
                mapDiv.style.height = viewH + 'px';
                appState.map.invalidateSize({animate: false});
                appState.map.fitBounds(window.selectedBounds, {padding: [0, 0], animate: false});

                var printStyle = document.createElement('style');
                printStyle.id = '_selPrintStyle';
                printStyle.textContent =
                    '@media print {' +
                    '  #showSidebarBtn, .sidebar, .zoom-indicator,' +
                    '  .leaflet-control-zoom, .leaflet-control-layers, .leaflet-control-attribution { display:none !important; }' +
                    '  * { -webkit-print-color-adjust:exact; print-color-adjust:exact; }' +
                    '  @page { margin:0; size:' + viewW + 'px ' + viewH + 'px; }' +
                    '  html, body { margin:0!important;padding:0!important;' +
                    '    width:' + viewW + 'px!important;height:' + viewH + 'px!important;overflow:hidden!important; }' +
                    '  .container { display:block!important;margin:0!important;padding:0!important; }' +
                    '  #map { position:fixed!important;top:0!important;left:0!important;' +
                    '    width:' + viewW + 'px!important;height:' + viewH + 'px!important;' +
                    '    margin:0!important;padding:0!important; }' +
                    '}';
                document.head.appendChild(printStyle);
                if (document.body.contains(loading)) document.body.removeChild(loading);

                function restoreAfterPrint() {
                    var s = document.getElementById('_selPrintStyle');
                    if (s) s.parentNode.removeChild(s);
                    mapDiv.style.flex = origMapFlexS;
                    mapDiv.style.width = origMapWS;
                    mapDiv.style.height = origMapHS;
                    appState.map.invalidateSize({animate: false});
                    if (sidebar) sidebar.style.display = sidebarDisplay;
                    if (zoom)    zoom.style.display    = zoomDisplay;
                    restoreMapControls();
                    appState.map.setView(window._captureOrigCenter, window._captureOrigZoom, {animate: false});
                    delete window.selectedBounds;
                    delete window._captureOrigCenter;
                    delete window._captureOrigZoom;
                    delete window.selectedPixelW;
                    delete window.selectedPixelH;
                    restoreSidebarAfterCapture();
                }

                // Wait for tiles then print
                setTimeout(function() {
                    window.print();
                    setTimeout(restoreAfterPrint, 1500);
                }, 1500);
            }, 500);
        }
        
        function restoreSidebarAfterCapture() {
            if (window.sidebarWasVisible) {
                var sidebar = document.querySelector('.sidebar');
                if (sidebar) {
                    sidebar.style.display = 'flex';
                }
                
                // Hide the "Show Menu" button
                var showBtn = document.getElementById('showSidebarBtn');
                if (showBtn) {
                    showBtn.style.display = 'none';
                }
                
                delete window.sidebarWasVisible;
            }
        }
        
        function performCaptureSimple() {
            var loading = document.createElement('div');
            loading.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,102,204,0.95); color: white; padding: 30px 50px; border-radius: 12px; z-index: 10001; font-size: 18px; font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.3);';
            loading.textContent = 'Capturing map screenshot...';
            document.body.appendChild(loading);
            
            var mapDiv = document.getElementById('map');
            var sidebar = document.querySelector('.sidebar');
            var zoom = document.querySelector('.zoom-indicator');
            
            // Save original state
            var originalCenter = appState.map.getCenter();
            var originalZoom = appState.map.getZoom();
            
            // Round zoom to nearest whole number for cleaner capture
            var roundedZoom = Math.round(originalZoom);
            appState.map.setZoom(roundedZoom, {animate: false});
            
            // Save state
            var sidebarDisplay = sidebar.style.display;
            var zoomDisplay = zoom.style.display;
            
            // Hide UI
            sidebar.style.display = 'none';
            zoom.style.display = 'none';
            hideMapControls();
            
            setTimeout(function() {
                domtoimage.toBlob(mapDiv).then(function(blob) {
                    // Restore UI
                    sidebar.style.display = sidebarDisplay;
                    zoom.style.display = zoomDisplay;
                    restoreMapControls();
                    
                    // Restore original zoom
                    appState.map.setView(originalCenter, originalZoom, {animate: false});
                    
                    // Create image from blob to crop if needed
                    var img = new Image();
                    var blobUrl = URL.createObjectURL(blob);
                    
                    img.onload = function() {
                        var canvas = document.createElement('canvas');
                        var ctx = canvas.getContext('2d');
                        
                        // dom-to-image captures at physical pixels (devicePixelRatio)
                        // mapDiv.offsetWidth/Height are CSS pixels
                        // Clamp to map area in physical pixels
                        var dpr = window.devicePixelRatio || 1;
                        var maxW = mapDiv.offsetWidth  * dpr;
                        var maxH = mapDiv.offsetHeight * dpr;
                        var sourceWidth  = Math.min(img.width,  maxW);
                        var sourceHeight = Math.min(img.height, maxH);
                        
                        if (window.captureOrientation === 'portrait') {
                            // Portrait: 9:16 ratio (phone-like) - crop from center for focused view
                            var targetRatio = 9/16;
                            var sourceRatio = sourceWidth / sourceHeight;
                            
                            if (sourceRatio > targetRatio) {
                                // Source is wider, crop width significantly for narrow portrait
                                canvas.height = sourceHeight;
                                canvas.width = sourceHeight * targetRatio;
                                var cropX = (sourceWidth - canvas.width) / 2;
                                ctx.drawImage(img, cropX, 0, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
                            } else {
                                // Source is taller, crop height
                                canvas.width = sourceWidth;
                                canvas.height = sourceWidth / targetRatio;
                                var cropY = (sourceHeight - canvas.height) / 2;
                                ctx.drawImage(img, 0, cropY, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
                            }
                        } else {
                            // Landscape: use full image
                            canvas.width = sourceWidth;
                            canvas.height = sourceHeight;
                            ctx.drawImage(img, 0, 0);
                        }
                        
                        canvas.toBlob(function(finalBlob) {
                            document.body.removeChild(loading);
                            URL.revokeObjectURL(blobUrl);
                            
                            var url = URL.createObjectURL(finalBlob);
                            var a = document.createElement('a');
                            a.href = url;
                            var timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
                            a.download = 'flight-plan-map-' + timestamp + '.png';
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                            
                            // Restore sidebar after capture completes
                            restoreSidebarAfterCapture();
                        });
                    };
                    
                    img.src = blobUrl;
                }).catch(function(error) {
                    sidebar.style.display = sidebarDisplay;
                    zoom.style.display = zoomDisplay;
                    restoreMapControls();
                    appState.map.setView(originalCenter, originalZoom, {animate: false});
                    document.body.removeChild(loading);
                    restoreSidebarAfterCapture();
                    alert('Screenshot failed: ' + error.message);
                    console.error('Screenshot error:', error);
                });
            }, 500);
        }
        
        function applyOrientationAndCapture() {
            var mapDiv = document.getElementById('map');
            var container = document.querySelector('.container');
            var sidebar = document.querySelector('.sidebar');
            var header = document.querySelector('.header');
            
            // Save original state AND current view
            var originalMapHeight = mapDiv.style.height;
            var originalMapWidth = mapDiv.style.width;
            var originalContainerMargin = container.style.marginLeft;
            var sidebarDisplay = sidebar.style.display;
            var headerDisplay = header.style.display;
            var originalCenter = appState.map.getCenter();
            var originalZoom = appState.map.getZoom();
            
            // Hide UI elements
            sidebar.style.display = 'none';
            header.style.display = 'none';
            container.style.marginLeft = '0';
            
            // Calculate target dimensions based on orientation
            var targetWidth, targetHeight;
            
            if (window.captureOrientation === 'portrait') {
                // Portrait: Use taller format but ensure adequate width
                // Use 3:4 ratio instead of 9:16 for better map coverage
                targetWidth = Math.min(window.innerWidth, 1080);
                targetHeight = Math.floor(targetWidth * (4/3));
            } else {
                // Landscape: 16:9 ratio (e.g., 1920x1080)
                targetWidth = Math.min(window.innerWidth, 1920);
                targetHeight = Math.floor(targetWidth * (9/16));
            }
            
            // Apply new dimensions
            mapDiv.style.width = targetWidth + 'px';
            mapDiv.style.height = targetHeight + 'px';
            container.style.width = targetWidth + 'px';
            
            // Force map to recalculate with new dimensions
            appState.map.invalidateSize();
            
            // For portrait mode, we need to adjust the view slightly
            // because the aspect ratio change affects how the map fits
            if (window.captureOrientation === 'portrait') {
                // Get the current bounds
                var currentBounds = appState.map.getBounds();
                
                // Fit to those same bounds with the new container size
                appState.map.fitBounds(currentBounds, {
                    padding: [0, 0],
                    animate: false
                });
            } else {
                // For landscape, just restore center and zoom
                appState.map.setView(originalCenter, originalZoom, {animate: false});
            }
            
            // Wait for map to resize and tiles to load
            setTimeout(function() {
                performCapture();
                
                // Restore original state after a delay
                setTimeout(function() {
                    sidebar.style.display = sidebarDisplay;
                    header.style.display = headerDisplay;
                    mapDiv.style.height = originalMapHeight;
                    mapDiv.style.width = originalMapWidth;
                    container.style.marginLeft = originalContainerMargin;
                    container.style.width = '';
                    appState.map.invalidateSize();
                    // Restore view again after returning to original size
                    appState.map.setView(originalCenter, originalZoom, {animate: false});
                }, 1500);
            }, 1000);
        }
        
        window.captureManualSelection = function() {
            closeScreenshotModal(true);

            var mapContainer = document.getElementById('map');
            var mapW = mapContainer.offsetWidth;
            var mapH = mapContainer.offsetHeight;

            var rW = Math.round(mapW * 0.6);
            var rH = Math.round(mapH * 0.6);
            var rX = Math.round((mapW - rW) / 2);
            var rY = Math.round((mapH - rH) / 2);

            // Dimming overlay
            var overlay = document.createElement('div');
            overlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:2000;pointer-events:none;';
            var origPos = mapContainer.style.position;
            mapContainer.style.position = 'relative';
            mapContainer.appendChild(overlay);

            var panels = {};
            ['top','bottom','left','right'].forEach(function(s) {
                var p = document.createElement('div');
                p.style.cssText = 'position:absolute;background:rgba(0,0,0,0.45);pointer-events:none;';
                overlay.appendChild(p);
                panels[s] = p;
            });

            // Selection rect
            var selRect = document.createElement('div');
            selRect.style.cssText = 'position:absolute;border:2px dashed #fff;box-sizing:border-box;cursor:move;z-index:2001;';
            mapContainer.appendChild(selRect);

            // Resize handles
            var handleDirs = ['nw','n','ne','e','se','s','sw','w'];
            var handles = {};
            handleDirs.forEach(function(d) {
                var h = document.createElement('div');
                h.style.cssText = 'position:absolute;width:10px;height:10px;background:white;border:1px solid #0066cc;box-sizing:border-box;z-index:2002;';
                h.dataset.dir = d;
                selRect.appendChild(h);
                handles[d] = h;
            });

            function positionHandles() {
                var pos = {
                    nw:{left:-5,top:-5}, n:{left:'50%',marginLeft:-5,top:-5}, ne:{right:-5,top:-5},
                    e:{right:-5,top:'50%',marginTop:-5}, se:{right:-5,bottom:-5},
                    s:{left:'50%',marginLeft:-5,bottom:-5}, sw:{left:-5,bottom:-5}, w:{left:-5,top:'50%',marginTop:-5}
                };
                var cursors = {nw:'nwse-resize',n:'ns-resize',ne:'nesw-resize',e:'ew-resize',se:'nwse-resize',s:'ns-resize',sw:'nesw-resize',w:'ew-resize'};
                handleDirs.forEach(function(d) {
                    var h = handles[d], p = pos[d];
                    h.style.left=''; h.style.right=''; h.style.top=''; h.style.bottom=''; h.style.marginLeft=''; h.style.marginTop='';
                    Object.keys(p).forEach(function(k){ h.style[k] = typeof p[k]==='number' ? p[k]+'px' : p[k]; });
                    h.style.cursor = cursors[d];
                });
            }

            function updateOverlay() {
                selRect.style.left=rX+'px'; selRect.style.top=rY+'px';
                selRect.style.width=rW+'px'; selRect.style.height=rH+'px';
                panels.top.style.cssText    = 'position:absolute;background:rgba(0,0,0,0.45);pointer-events:none;left:0;top:0;width:100%;height:'+rY+'px;';
                panels.bottom.style.cssText = 'position:absolute;background:rgba(0,0,0,0.45);pointer-events:none;left:0;top:'+(rY+rH)+'px;width:100%;bottom:0;';
                panels.left.style.cssText   = 'position:absolute;background:rgba(0,0,0,0.45);pointer-events:none;left:0;top:'+rY+'px;width:'+rX+'px;height:'+rH+'px;';
                panels.right.style.cssText  = 'position:absolute;background:rgba(0,0,0,0.45);pointer-events:none;left:'+(rX+rW)+'px;top:'+rY+'px;right:0;height:'+rH+'px;';
                positionHandles();
            }
            updateOverlay();

            // Drag to move rect
            selRect.addEventListener('mousedown', function(e) {
                if (e.target !== selRect) return;
                e.preventDefault(); e.stopPropagation();
                appState.map.dragging.disable();
                var sx=e.clientX, sy=e.clientY, ox=rX, oy=rY;
                function onMove(me) {
                    rX = Math.max(0, Math.min(mapW-rW, ox+me.clientX-sx));
                    rY = Math.max(0, Math.min(mapH-rH, oy+me.clientY-sy));
                    updateOverlay();
                }
                function onUp() { document.removeEventListener('mousemove',onMove); document.removeEventListener('mouseup',onUp); appState.map.dragging.enable(); }
                document.addEventListener('mousemove',onMove); document.addEventListener('mouseup',onUp);
            });

            // Resize via handles
            handleDirs.forEach(function(d) {
                handles[d].addEventListener('mousedown', function(e) {
                    e.preventDefault(); e.stopPropagation();
                    appState.map.dragging.disable();
                    var sx=e.clientX, sy=e.clientY, ox=rX, oy=rY, ow=rW, oh=rH, minS=40;
                    function onMove(me) {
                        var dx=me.clientX-sx, dy=me.clientY-sy;
                        var nx=ox, ny=oy, nw=ow, nh=oh;
                        if(d.indexOf('e')>=0) nw=Math.max(minS,ow+dx);
                        if(d.indexOf('s')>=0) nh=Math.max(minS,oh+dy);
                        if(d.indexOf('w')>=0){nw=Math.max(minS,ow-dx); nx=ox+ow-nw;}
                        if(d.indexOf('n')>=0){nh=Math.max(minS,oh-dy); ny=oy+oh-nh;}
                        nx=Math.max(0,nx); ny=Math.max(0,ny);
                        nw=Math.min(nw,mapW-nx); nh=Math.min(nh,mapH-ny);
                        rX=nx; rY=ny; rW=nw; rH=nh;
                        updateOverlay();
                    }
                    function onUp() { document.removeEventListener('mousemove',onMove); document.removeEventListener('mouseup',onUp); appState.map.dragging.enable(); }
                    document.addEventListener('mousemove',onMove); document.addEventListener('mouseup',onUp);
                });
            });

            // Toolbar
            var toolbar = document.createElement('div');
            toolbar.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.82);color:#fff;border-radius:10px;padding:10px 18px;display:flex;align-items:center;gap:12px;z-index:3000;box-shadow:0 4px 16px rgba(0,0,0,0.4);font-size:13px;font-weight:600;';
            toolbar.innerHTML =
                '<span style="opacity:.7;">Drag to move &middot; handles to resize</span>' +
                '<button id="selCapture" style="padding:7px 18px;background:#28a745;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:700;">Save Area</button>' +
                '<button id="selCancel"  style="padding:7px 14px;background:#dc3545;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:700;">Cancel</button>';
            document.body.appendChild(toolbar);

            function cleanup() {
                if (selRect.parentNode)  selRect.parentNode.removeChild(selRect);
                if (overlay.parentNode)  overlay.parentNode.removeChild(overlay);
                if (toolbar.parentNode)  toolbar.parentNode.removeChild(toolbar);
                mapContainer.style.position = origPos;
            }

            document.getElementById('selCapture').onclick = function() {
                // Convert pixel rect to lat/lng bounds
                var nw = appState.map.containerPointToLatLng(L.point(rX, rY));
                var se = appState.map.containerPointToLatLng(L.point(rX + rW, rY + rH));
                window.selectedBounds = L.latLngBounds(nw, se);
                window.selectedPixelW = rW;
                window.selectedPixelH = rH;

                // Save current view so we can restore after capture
                window._captureOrigCenter = appState.map.getCenter();
                window._captureOrigZoom   = appState.map.getZoom();

                cleanup();

                // performCaptureWithCrop will resize map to selection ratio, fitBounds, then print
                setTimeout(function() {
                    performCaptureWithCrop();
                }, 300);
            };

            document.getElementById('selCancel').onclick = function() {
                cleanup();
                restoreSidebarAfterCapture();
            };
        };
        
        
        function performCapture() {
            var loading = document.createElement('div');
            loading.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,102,204,0.95); color: white; padding: 30px 50px; border-radius: 12px; z-index: 10001; font-size: 18px; font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.3);';
            loading.textContent = 'Capturing map screenshot...';
            document.body.appendChild(loading);
            
            var mapDiv = document.getElementById('map');
            
            setTimeout(function() {
                hideMapControls();
                domtoimage.toBlob(mapDiv).then(function(blob) {
                    restoreMapControls();
                    document.body.removeChild(loading);
                    
                    var url = URL.createObjectURL(blob);
                    var a = document.createElement('a');
                    a.href = url;
                    var timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
                    a.download = 'flight-plan-map-' + timestamp + '.png';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }).catch(function(error) {
                    restoreMapControls();
                    document.body.removeChild(loading);
                    alert('Screenshot failed: ' + error.message);
                    console.error('Screenshot error:', error);
                });
            }, 500);
        }
        
        function printRouteDetails() {
            if (appState.waypoints.length === 0) {
                alert('No waypoints to print!');
                return;
            }
            
            // Create printable content
            var printWindow = window.open('', '', 'width=800,height=600');
            var html = '<html><head><title>Flight Plan</title>';
            html += '<style>';
            html += 'body { font-family: Arial, sans-serif; margin: 20px; }';
            html += 'h1 { color: #0066cc; border-bottom: 3px solid #0066cc; padding-bottom: 10px; }';
            html += 'h2 { color: #333; margin-top: 30px; border-bottom: 2px solid #ddd; padding-bottom: 5px; }';
            html += 'table { width: 100%; border-collapse: collapse; margin: 20px 0; }';
            html += 'th { background: #0066cc; color: white; padding: 10px; text-align: left; }';
            html += 'td { padding: 8px; border-bottom: 1px solid #ddd; }';
            html += 'tr:hover { background: #f5f5f5; }';
            html += '.summary { background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0; }';
            html += '.summary-item { margin: 10px 0; font-size: 16px; }';
            html += '.summary-label { font-weight: bold; color: #0066cc; }';
            html += '@media print { button { display: none; } }';
            html += '</style></head><body>';
            
            html += '<h1>✈️ Flight Plan</h1>';
            html += '<p><strong>Date:</strong> ' + new Date().toLocaleString() + '</p>';
            html += '<p><strong>Cruise Speed:</strong> ' + appState.cruiseSpeed + ' knots | ';
            html += '<strong>Fuel Flow:</strong> ' + appState.fuelFlow + ' L/hr</p>';
            
            // Legs table FIRST
            html += '<h2>Flight Legs</h2>';
            html += '<table><thead><tr>';
            html += '<th>Leg</th><th>From WP</th><th>To WP</th><th>Heading</th><th>Distance</th><th>Time</th><th>Fuel</th>';
            html += '</tr></thead><tbody>';
            
            var totalDistance = 0;
            var totalTime = 0;
            var totalFuel = 0;
            var usedTextBoxes = []; // Track which text boxes we've already printed
            
            for (var i = 0; i < appState.waypoints.length - 1; i++) {
                var wp1 = appState.waypoints[i];
                var wp2 = appState.waypoints[i + 1];
                
                var distance = calculateDistance(wp1.lat, wp1.lng, wp2.lat, wp2.lng);
                var heading = calculateBearing(wp1.lat, wp1.lng, wp2.lat, wp2.lng);
                var timeHours = distance / appState.cruiseSpeed;
                var fuel = timeHours * appState.fuelFlow;
                
                totalDistance += distance;
                totalTime += timeHours;
                totalFuel += fuel;
                
                var hours = Math.floor(timeHours);
                var remainingSecs = Math.round((timeHours - hours) * 3600);
                var minutes = Math.floor(remainingSecs / 60);
                var seconds = remainingSecs % 60;
                var timeStr = (hours < 10 ? '0' : '') + hours + ':' +
                              (minutes < 10 ? '0' : '') + minutes + ':' +
                              (seconds < 10 ? '0' : '') + seconds;
                
                html += '<tr>';
                html += '<td><strong>' + (i + 1) + '</strong></td>';
                html += '<td>' + wp1.name + '</td>';
                html += '<td>' + wp2.name + '</td>';
                html += '<td>' + getMagHeading(heading) + '°</td>';
                html += '<td>' + distance.toFixed(1) + ' nm</td>';
                html += '<td>' + timeStr + '</td>';
                html += '<td>' + fuel.toFixed(1) + ' L</td>';
                html += '</tr>';
                
                // Find text boxes closest to THIS specific leg
                var legTextBoxes = [];
                var totalMinutes = Math.ceil(timeHours * 60);
                
                appState.textBoxes.forEach(function(textMarker, tbIndex) {
                    // Skip if already used
                    if (usedTextBoxes.indexOf(tbIndex) !== -1) return;
                    
                    var textLatlng = textMarker.getLatLng();
                    
                    // Calculate distance to this leg by finding closest point on leg
                    var closestPoint = getClosestPointOnLine(
                        textLatlng.lat, textLatlng.lng,
                        wp1.lat, wp1.lng, wp2.lat, wp2.lng
                    );
                    var distToLeg = calculateDistance(
                        textLatlng.lat, textLatlng.lng,
                        closestPoint.lat, closestPoint.lng
                    );
                    
                    // If within 5 nm of this leg
                    if (distToLeg < 5) {
                        // Find which leg this text box is CLOSEST to overall
                        var closestLegIndex = i;
                        var minDistToAnyLeg = distToLeg;
                        
                        for (var j = 0; j < appState.waypoints.length - 1; j++) {
                            if (j === i) continue;
                            var wpA = appState.waypoints[j];
                            var wpB = appState.waypoints[j + 1];
                            var pt = getClosestPointOnLine(
                                textLatlng.lat, textLatlng.lng,
                                wpA.lat, wpA.lng, wpB.lat, wpB.lng
                            );
                            var d = calculateDistance(textLatlng.lat, textLatlng.lng, pt.lat, pt.lng);
                            if (d < minDistToAnyLeg) {
                                minDistToAnyLeg = d;
                                closestLegIndex = j;
                            }
                        }
                        
                        // Only add if THIS leg is the closest
                        if (closestLegIndex === i) {
                            // Find nearest minute marker along this leg
                            var minDistToMarker = Infinity;
                            var nearestMinute = 0;
                            
                            for (var min = 0; min <= totalMinutes; min++) {
                                var fraction = totalMinutes > 0 ? (min / totalMinutes) : 0;
                                var markerLat = wp1.lat + (wp2.lat - wp1.lat) * fraction;
                                var markerLng = wp1.lng + (wp2.lng - wp1.lng) * fraction;
                                var distToMarker = Math.sqrt(
                                    Math.pow(textLatlng.lat - markerLat, 2) + 
                                    Math.pow(textLatlng.lng - markerLng, 2)
                                );
                                
                                if (distToMarker < minDistToMarker) {
                                    minDistToMarker = distToMarker;
                                    nearestMinute = min;
                                }
                            }
                            
                            legTextBoxes.push({
                                text: textMarker.textBoxData.text,
                                minute: nearestMinute
                            });
                            usedTextBoxes.push(tbIndex); // Mark as used
                        }
                    }
                });
                
                // Sort text boxes by minute position
                legTextBoxes.sort(function(a, b) { return a.minute - b.minute; });
                
                // Add text boxes row if any exist for this leg
                if (legTextBoxes.length > 0) {
                    html += '<tr style="background: #fff9e6;">';
                    html += '<td colspan="7" style="padding-left: 30px; color: #666;">';
                    html += '<strong style="color: #0066cc;">📝 Notes:</strong><br>';
                    legTextBoxes.forEach(function(tb, idx) {
                        html += '<div style="margin-left: 20px; margin-top: 4px;">';
                        html += '<span style="color: #0066cc; font-weight: bold;">[' + tb.minute + ' min]</span> ';
                        html += '<span style="font-style: italic;">' + tb.text + '</span>';
                        html += '</div>';
                    });
                    html += '</td>';
                    html += '</tr>';
                }
            }
            html += '</tbody></table>';
            
            // Waypoints table SECOND
            html += '<h2>Waypoints</h2>';
            html += '<table><thead><tr>';
            html += '<th>WP</th><th>Name</th><th>Latitude</th><th>Longitude</th>';
            html += '</tr></thead><tbody>';
            
            appState.waypoints.forEach(function(wp) {
                html += '<tr>';
                html += '<td><strong>' + wp.num + '</strong></td>';
                html += '<td>' + wp.name + '</td>';
                html += '<td>' + wp.lat.toFixed(4) + '°N</td>';
                html += '<td>' + wp.lng.toFixed(4) + '°E</td>';
                html += '</tr>';
            });
            html += '</tbody></table>';
            
            // Summary
            html += '<h2>Flight Summary</h2>';
            html += '<div class="summary">';
            
            var summaryHours = Math.floor(totalTime);
            var summaryMinutes = Math.round((totalTime - summaryHours) * 60);
            
            html += '<div class="summary-item"><span class="summary-label">Total Distance:</span> ' + totalDistance.toFixed(1) + ' nm</div>';
            html += '<div class="summary-item"><span class="summary-label">Total Flight Time:</span> ' + summaryHours + 'h ' + summaryMinutes + 'm</div>';
            html += '<div class="summary-item"><span class="summary-label">Total Fuel Required:</span> ' + totalFuel.toFixed(1) + ' liters</div>';
            
            var reserveFuel = (30 / 60) * appState.fuelFlow; // 30 minutes reserve
            var recommendedFuel = totalFuel + reserveFuel;
            
            html += '<div class="summary-item"><span class="summary-label">Recommended Fuel (+ 30 min reserve):</span> ' + recommendedFuel.toFixed(1) + ' liters</div>';
            html += '<div class="summary-item"><span class="summary-label">Number of Waypoints:</span> ' + appState.waypoints.length + '</div>';
            html += '<div class="summary-item"><span class="summary-label">Number of Legs:</span> ' + (appState.waypoints.length - 1) + '</div>';
            
            html += '</div>';
            
            html += '<br><button onclick="window.print()" style="padding: 10px 20px; background: #0066cc; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">🖨️ Print</button>';
            html += '</body></html>';
            
            printWindow.document.write(html);
            printWindow.document.close();
        }
        
        function printPlan() {
            if (appState.waypoints.length === 0) {
                alert('No waypoints to print!');
                return;
            }
            
            // Create modal for print options
            var modal = document.createElement('div');
            modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 10000; display: flex; align-items: center; justify-content: center;';
            
            var dialog = document.createElement('div');
            dialog.style.cssText = 'background: white; padding: 30px; border-radius: 12px; max-width: 500px; width: 90%;';
            
            dialog.innerHTML = '<h2 style="margin: 0 0 20px 0;">Print Flight Plan</h2>' +
                '<div style="margin-bottom: 20px;">' +
                '<label style="display: block; margin-bottom: 10px; font-weight: bold;">Select Print Area:</label>' +
                '<div style="display: flex; gap: 10px; margin-bottom: 10px;">' +
                '<button onclick="setPrintArea(\'current\')" style="flex: 1; padding: 10px; border: 2px solid #0066cc; background: white; border-radius: 6px; cursor: pointer;">Current View</button>' +
                '<button onclick="setPrintArea(\'route\')" style="flex: 1; padding: 10px; border: 2px solid #0066cc; background: white; border-radius: 6px; cursor: pointer;">Fit Route</button>' +
                '</div>' +
                '<button onclick="setPrintArea(\'manual\')" style="width: 100%; padding: 10px; border: 2px solid #0066cc; background: white; border-radius: 6px; cursor: pointer; margin-bottom: 20px;">Manual Selection (draw on map)</button>' +
                '</div>' +
                '<div style="margin-bottom: 20px;">' +
                '<label style="display: block; margin-bottom: 10px; font-weight: bold;">Zoom Level: <span id="printZoomValue">13</span></label>' +
                '<input type="range" id="printZoom" min="10" max="15" value="13" style="width: 100%;" oninput="document.getElementById(\'printZoomValue\').textContent = this.value">' +
                '<div style="display: flex; justify-content: space-between; font-size: 12px; color: #666; margin-top: 5px;">' +
                '<span>10 (overview)</span><span>13 (detailed)</span><span>15 (close-up)</span>' +
                '</div>' +
                '</div>' +
                '<div style="display: flex; gap: 10px;">' +
                '<button onclick="executePrint()" style="flex: 1; padding: 12px; background: #0066cc; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">Print</button>' +
                '<button onclick="cancelPrint()" style="flex: 1; padding: 12px; background: #dc3545; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">Cancel</button>' +
                '</div>';
            
            modal.appendChild(dialog);
            document.body.appendChild(modal);
            
            window.printModal = modal;
            window.printArea = 'current';
            window.manualBounds = null;
            window.selectionRectangle = null;
            
            window.setPrintArea = function(type) {
                window.printArea = type;
                if (type === 'manual') {
                    document.body.removeChild(window.printModal);
                    
                    // Show instruction overlay
                    var instruction = document.createElement('div');
                    instruction.style.cssText = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: rgba(0,102,204,0.95); color: white; padding: 15px 30px; border-radius: 8px; z-index: 10000; font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.3);';
                    instruction.textContent = 'Click two points on the map to define print area (top-left, then bottom-right)';
                    document.body.appendChild(instruction);
                    
                    var clickCount = 0;
                    var firstPoint = null;
                    
                    var clickHandler = function(e) {
                        clickCount++;
                        
                        if (clickCount === 1) {
                            firstPoint = e.latlng;
                            instruction.textContent = 'Now click bottom-right corner';
                            
                            // Show temporary marker
                            var marker = L.marker([firstPoint.lat, firstPoint.lng], {
                                icon: L.divIcon({
                                    className: 'selection-marker',
                                    html: '<div style="background: red; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white;"></div>',
                                    iconSize: [20, 20],
                                    iconAnchor: [10, 10]
                                })
                            }).addTo(appState.map);
                            window.selectionMarkers = [marker];
                        } else if (clickCount === 2) {
                            var secondPoint = e.latlng;
                            
                            // Show second marker
                            var marker2 = L.marker([secondPoint.lat, secondPoint.lng], {
                                icon: L.divIcon({
                                    className: 'selection-marker',
                                    html: '<div style="background: red; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white;"></div>',
                                    iconSize: [20, 20],
                                    iconAnchor: [10, 10]
                                })
                            }).addTo(appState.map);
                            window.selectionMarkers.push(marker2);
                            
                            // Create bounds
                            window.manualBounds = L.latLngBounds(firstPoint, secondPoint);
                            
                            // Show selection rectangle
                            window.selectionRectangle = L.rectangle(window.manualBounds, {
                                color: '#0066cc',
                                weight: 3,
                                fillOpacity: 0.1
                            }).addTo(appState.map);
                            
                            // Remove instruction and handler
                            document.body.removeChild(instruction);
                            appState.map.off('click', clickHandler);
                            
                            // Re-show print dialog
                            document.body.appendChild(window.printModal);
                        }
                    };
                    
                    appState.map.on('click', clickHandler);
                    
                    // Add cancel button to instruction
                    var cancelBtn = document.createElement('button');
                    cancelBtn.textContent = 'Cancel';
                    cancelBtn.style.cssText = 'margin-left: 15px; padding: 5px 15px; background: white; color: #0066cc; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;';
                    cancelBtn.onclick = function() {
                        document.body.removeChild(instruction);
                        appState.map.off('click', clickHandler);
                        if (window.selectionMarkers) {
                            window.selectionMarkers.forEach(function(m) { appState.map.removeLayer(m); });
                            delete window.selectionMarkers;
                        }
                        if (window.selectionRectangle) {
                            appState.map.removeLayer(window.selectionRectangle);
                            delete window.selectionRectangle;
                        }
                        document.body.appendChild(window.printModal);
                    };
                    instruction.appendChild(cancelBtn);
                }
            };
            
            window.executePrint = function() {
                var zoom = parseInt(document.getElementById('printZoom').value);
                document.body.removeChild(window.printModal);
                delete window.printModal;
                
                // Clean up selection markers and rectangle
                if (window.selectionMarkers) {
                    window.selectionMarkers.forEach(function(m) { appState.map.removeLayer(m); });
                    delete window.selectionMarkers;
                }
                if (window.selectionRectangle) {
                    appState.map.removeLayer(window.selectionRectangle);
                    delete window.selectionRectangle;
                }
                
                // Show "Preparing print..." message
                var preparing = document.createElement('div');
                preparing.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.9); color: white; padding: 30px 50px; border-radius: 12px; z-index: 10001; font-size: 18px; font-weight: bold;';
                preparing.textContent = 'Preparing print view...';
                document.body.appendChild(preparing);
                
                // Set zoom and bounds based on selection - use setTimeout to let map render
                setTimeout(function() {
                    if (window.printArea === 'manual' && window.manualBounds) {
                        appState.map.fitBounds(window.manualBounds, {padding: [20, 20]});
                        setTimeout(function() {
                            appState.map.setZoom(zoom);
                            finalizePrint(preparing);
                        }, 300);
                    } else if (window.printArea === 'route' && appState.waypoints.length > 0) {
                        var bounds = L.latLngBounds(appState.waypoints.map(function(wp) {
                            return [wp.lat, wp.lng];
                        }));
                        appState.map.fitBounds(bounds, {padding: [50, 50]});
                        setTimeout(function() {
                            appState.map.setZoom(zoom);
                            finalizePrint(preparing);
                        }, 300);
                    } else if (window.printArea === 'current') {
                        // Keep current center, just set zoom
                        var currentCenter = appState.map.getCenter();
                        appState.map.setView(currentCenter, zoom);
                        finalizePrint(preparing);
                    }
                }, 100);
            };
            
            function finalizePrint(preparing) {
                // Wait for tiles to load
                setTimeout(function() {
                    document.body.removeChild(preparing);
                    
                    // Generate print content
                    var printWP = '';
                    appState.waypoints.forEach(function(wp, idx) {
                    printWP += '<div style="margin-bottom: 20px; padding: 10px; border: 1px solid #ddd;">';
                    printWP += '<h3>Waypoint ' + wp.num + ' — ' + wp.name + '</h3>';
                    printWP += '<p><strong>Coordinates:</strong> ' + wp.lat.toFixed(4) + '°N, ' + wp.lng.toFixed(4) + '°E</p>';
                    
                    if (idx < appState.waypoints.length - 1) {
                        printWP += '<p><strong>Leg Altitude:</strong> ' + getLegAltitude(idx) + ' ft</p>';
                        var wp2 = appState.waypoints[idx + 1];
                        var distance = calculateDistance(wp.lat, wp.lng, wp2.lat, wp2.lng);
                        var heading = calculateBearing(wp.lat, wp.lng, wp2.lat, wp2.lng);
                        var timeHours = distance / appState.cruiseSpeed;
                        var hours = Math.floor(timeHours);
                        var minutes = Math.round((timeHours - hours) * 60);
                        
                        printWP += '<p><strong>To WP' + (idx + 2) + ':</strong> ' + getMagHeading(heading) + '° for ' + distance.toFixed(1) + ' nm (' + hours + 'h ' + minutes + 'm)</p>';
                    }
                    printWP += '</div>';
                });
                
                document.getElementById('print-waypoints').innerHTML = printWP;
                
                var totalDistance = 0;
                for (var i = 0; i < appState.waypoints.length - 1; i++) {
                    var wp1 = appState.waypoints[i];
                    var wp2 = appState.waypoints[i + 1];
                    totalDistance += calculateDistance(wp1.lat, wp1.lng, wp2.lat, wp2.lng);
                }
                var totalTimeHours = totalDistance / appState.cruiseSpeed;
                var hours = Math.floor(totalTimeHours);
                var minutes = Math.round((totalTimeHours - hours) * 60);
                var fuelRequired = totalTimeHours * appState.fuelFlow;
                
                var printStats = '<h2>Summary</h2>';
                printStats += '<p><strong>Total Distance:</strong> ' + totalDistance.toFixed(1) + ' nm</p>';
                printStats += '<p><strong>Total Time:</strong> ' + hours + 'h ' + minutes + 'm</p>';
                printStats += '<p><strong>Fuel Required:</strong> ' + fuelRequired.toFixed(1) + ' liters</p>';
                printStats += '<p><strong>Cruise Speed:</strong> ' + appState.cruiseSpeed + ' knots</p>';
                printStats += '<p><strong>Fuel Flow:</strong> ' + appState.fuelFlow + ' L/hr</p>';
                
                document.getElementById('print-stats').innerHTML = printStats;
                
                setTimeout(function() {
                    window.print();
                }, 500);
                }, 800); // Wait for tiles to load
            }
            
            window.cancelPrint = function() {
                document.body.removeChild(window.printModal);
                delete window.printModal;
                
                // Clean up selection markers and rectangle
                if (window.selectionMarkers) {
                    window.selectionMarkers.forEach(function(m) { appState.map.removeLayer(m); });
                    delete window.selectionMarkers;
                }
                if (window.selectionRectangle) {
                    appState.map.removeLayer(window.selectionRectangle);
                    delete window.selectionRectangle;
                }
                if (window.manualBounds) {
                    delete window.manualBounds;
                }
            };
        }
        
        // ── Folder-based flight plan storage ────────────────────────────────
