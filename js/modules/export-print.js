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

        // Helper to construct a graphic scale bar for printed maps
        function buildScaleBarHtml(scaleNum, lat, rotDeg) {
            // Standard CSS print resolution is 96 DPI: 1 inch = 25.4mm = 96px => 1px = 0.0254 / 96 meters
            var pxPerM = 96.0 / (0.0254 * scaleNum);
            var candidates = [0.5, 1, 2, 3, 4, 5, 10, 20, 50];
            var bestNm = candidates[0];
            var minDiff = Infinity;
            for (var i = 0; i < candidates.length; i++) {
                var w = candidates[i] * 1852 * pxPerM;
                var diff = Math.abs(w - 130);
                if (diff < minDiff) {
                    minDiff = diff;
                    bestNm = candidates[i];
                }
            }
            var barW = Math.round(bestNm * 1852 * pxPerM);
            var km = +(bestNm * 1.852).toFixed(1);
            var scaleStr = '1:' + scaleNum.toLocaleString();
            var cmKm = +(scaleNum / 100000.0).toFixed(2);
            var halfNm = (bestNm % 2 === 0) ? (bestNm / 2) : +(bestNm / 2).toFixed(1);
            var halfKm = +(km / 2.0).toFixed(1);
            var arrowRot = (rotDeg !== undefined) ? Math.round(-rotDeg) : 0;

            return '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;font-size:8.5px;line-height:1.2;color:#111;text-align:center;">' +
                '<div style="display:flex;align-items:center;justify-content:center;gap:5px;margin-bottom:2px;">' +
                '<svg width="15" height="15" viewBox="0 0 24 24" style="transform:rotate(' + arrowRot + 'deg);transform-origin:center center;display:inline-block;vertical-align:middle;filter:drop-shadow(0 1px 1px rgba(0,0,0,0.3));">' +
                '<polygon points="12,2 16,11 12,9 8,11" fill="#c0392b" />' +
                '<polygon points="12,22 16,13 12,15 8,13" fill="#555" />' +
                '<circle cx="12" cy="12" r="1.5" fill="#222" />' +
                '<text x="12" y="1" font-size="6" font-weight="900" fill="#c0392b" text-anchor="middle" dominant-baseline="bottom">N</text>' +
                '</svg>' +
                '<span style="font-weight:700;letter-spacing:0.4px;font-size:9.5px;">SCALE ' + scaleStr + '</span>' +
                '</div>' +
                '<div style="font-size:7.5px;color:#333;margin-bottom:2px;">1 cm = ' + cmKm + ' km</div>' +
                '<div style="display:flex;justify-content:space-between;width:' + barW + 'px;font-size:7.5px;font-weight:600;margin:0 auto 1px;padding:0 1px;box-sizing:border-box;">' +
                '<span>0</span><span>' + halfNm + '</span><span>' + bestNm + ' NM</span>' +
                '</div>' +
                '<div style="width:' + barW + 'px;height:5px;border:1px solid #111;display:flex;margin:0 auto;box-sizing:border-box;background:#fff;">' +
                '<div style="flex:1;background:#111;border-right:1px solid #111;"></div>' +
                '<div style="flex:1;background:#fff;"></div>' +
                '</div>' +
                '<div style="display:flex;justify-content:space-between;width:' + barW + 'px;font-size:7px;color:#444;margin:1px auto 0;padding:0 1px;box-sizing:border-box;">' +
                '<span>0</span><span>' + halfKm + '</span><span>' + km + ' km</span>' +
                '</div>' +
                '</div>';
        }

        window.captureA4Area = function(paperSize) {
            paperSize = paperSize || 'A4';
            var paperSpec = PAPER_SPECS[paperSize] || PAPER_SPECS['A4'];
            var isLandscape = (window.captureOrientation === 'landscape');
            var selectedScale = '250000'; // Default scale: 1:250,000
            var selectedScaleSide = 'right'; // Scale bar position: 'right', 'left', 'center', 'none'
            var selectedScaleBarSize = 1.0; // Scale bar size multiplier: 0.5 to 2.0
            var printRotation = 0; // Rotation angle in degrees (0 - 359)

            // Close screenshot modal but keep sidebar hidden
            closeScreenshotModal(true);

            var mapContainer = document.getElementById('map');
            var mapW = mapContainer.offsetWidth;
            var mapH = mapContainer.offsetHeight;

            // Geographic center of primary rect — source of truth
            var rectGeoCenter = appState.map.getCenter();

            function calcBearing(lat1, lng1, lat2, lng2) {
                var dLng = (lng2 - lng1) * Math.PI / 180;
                var lat1Rad = lat1 * Math.PI / 180;
                var lat2Rad = lat2 * Math.PI / 180;
                var y = Math.sin(dLng) * Math.cos(lat2Rad);
                var x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
                        Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
                var b = Math.atan2(y, x) * 180 / Math.PI;
                return Math.round((b + 360) % 360);
            }

            function getRouteTrackHeading() {
                if (!appState.waypoints || appState.waypoints.length < 2) return 0;
                var centerLat = rectGeoCenter ? rectGeoCenter.lat : appState.map.getCenter().lat;
                var centerLng = rectGeoCenter ? rectGeoCenter.lng : appState.map.getCenter().lng;
                var bestDist = Infinity;
                var bestHeading = 0;
                for (var i = 0; i < appState.waypoints.length - 1; i++) {
                    var wp1 = appState.waypoints[i];
                    var wp2 = appState.waypoints[i + 1];
                    var midLat = (wp1.lat + wp2.lat) / 2;
                    var midLng = (wp1.lng + wp2.lng) / 2;
                    var dLat = centerLat - midLat;
                    var dLng = (centerLng - midLng) * Math.cos(midLat * Math.PI / 180);
                    var distSq = dLat * dLat + dLng * dLng;
                    if (distSq < bestDist) {
                        bestDist = distSq;
                        bestHeading = calcBearing(wp1.lat, wp1.lng, wp2.lat, wp2.lng);
                    }
                }
                return bestHeading;
            }

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

            // ── Overlay dimming layer (SVG cutout for arbitrary rotation) ────
            var svgOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svgOverlay.id = 'a4OverlaySvg';
            svgOverlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:2000;pointer-events:none;';
            var overlayPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            overlayPath.setAttribute('fill', 'rgba(0,0,0,0.45)');
            overlayPath.setAttribute('fill-rule', 'evenodd');
            svgOverlay.appendChild(overlayPath);
            var origMapPosition = mapContainer.style.position;
            mapContainer.style.position = 'relative';
            mapContainer.appendChild(svgOverlay);

            // ── Print rectangle ───────────────────────────────────────────────
            var rect = document.createElement('div');
            rect.id = 'a4Rect';
            rect.style.cssText = [
                'position:absolute',
                'border:2px dashed #fff',
                'box-shadow:0 0 0 1px #0066cc, inset 0 0 0 1px #0066cc',
                'cursor:move',
                'z-index:2001',
                'box-sizing:border-box',
                'transform-origin:center center'
            ].join(';');
            mapContainer.appendChild(rect);

            // Corner label
            var label = document.createElement('div');
            label.style.cssText = 'position:absolute;top:4px;left:4px;background:rgba(0,102,204,0.85);color:#fff;font-size:11px;font-weight:700;padding:2px 7px;border-radius:3px;pointer-events:none;white-space:nowrap;';
            rect.appendChild(label);

            // Top indicator
            var topIndicator = document.createElement('div');
            topIndicator.id = 'a4TopIndicator';
            topIndicator.style.cssText = 'position:absolute;top:4px;left:50%;transform:translateX(-50%);background:rgba(0,102,204,0.9);color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:3px;pointer-events:none;white-space:nowrap;letter-spacing:0.5px;box-shadow:0 1px 3px rgba(0,0,0,0.3);';
            topIndicator.innerHTML = '⬆ TOP · <span id="a4TopAngle">000° (N)</span>';
            rect.appendChild(topIndicator);

            // Interactive rotation handle at top of rect
            var rotStem = document.createElement('div');
            rotStem.style.cssText = 'position:absolute;top:-16px;left:50%;transform:translateX(-50%);width:2px;height:16px;background:#0066cc;pointer-events:none;';
            rect.appendChild(rotStem);

            var rotHandle = document.createElement('div');
            rotHandle.id = 'a4RotHandle';
            rotHandle.style.cssText = 'position:absolute;top:-34px;left:50%;transform:translateX(-50%);width:22px;height:22px;background:#0066cc;border:2px solid #fff;border-radius:50%;cursor:grab;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:2005;user-select:none;';
            rotHandle.title = 'Drag to rotate print orientation (Hold Shift for smooth angle)';
            rotHandle.innerHTML = '<span style="font-size:12px;color:#fff;line-height:1;pointer-events:none;user-select:none;">⟳</span>';
            rect.appendChild(rotHandle);

            // Preview scale bar at bottom-right of primary rect
            var previewScaleBar = document.createElement('div');
            previewScaleBar.id = 'a4PreviewScaleBar';
            previewScaleBar.style.cssText =
                'position:absolute;bottom:6px;right:6px;pointer-events:none;' +
                'background:rgba(255,255,255,0.88);border:1px solid rgba(0,0,0,0.45);' +
                'border-radius:4px;padding:3px 8px 4px 8px;box-shadow:0 1px 4px rgba(0,0,0,0.18);z-index:2002;';
            rect.appendChild(previewScaleBar);

            function updatePreviewScaleBar(targetEl, scaleVal, centerLat, boxW, boxH, land) {
                if (!targetEl) return;
                if (selectedScaleSide === 'none') {
                    targetEl.style.display = 'none';
                    return;
                }

                var effectiveScale;
                if (scaleVal !== 'auto') {
                    effectiveScale = parseInt(scaleVal, 10);
                } else {
                    var latRad = (centerLat || (rectGeoCenter ? rectGeoCenter.lat : 31.5)) * Math.PI / 180.0;
                    var zoom = appState.map.getZoom();
                    var metersPerPx = (40075016.686 * Math.cos(latRad)) / (256.0 * Math.pow(2, zoom));
                    var widthMm = land ? paperSpec.longMm : paperSpec.shortMm;
                    var groundWidthM = boxW * metersPerPx;
                    effectiveScale = Math.round(groundWidthM / (widthMm / 1000.0));
                }

                targetEl.innerHTML = buildScaleBarHtml(effectiveScale, centerLat, printRotation);

                if (boxW < 120 || boxH < 80) {
                    targetEl.style.display = 'none';
                    return;
                }
                targetEl.style.display = 'block';

                // Auto-scale preview bar if box is small so it fits cleanly inside
                var maxW = boxW - 16;
                var maxH = boxH - 36;
                var barBoxW = 155;
                var barBoxH = 46;
                var fitRatio = Math.min(1.0, Math.min(maxW / (barBoxW * selectedScaleBarSize), maxH / (barBoxH * selectedScaleBarSize))) * selectedScaleBarSize;

                var transform = '';
                if (selectedScaleSide === 'left') {
                    targetEl.style.bottom = '6px';
                    targetEl.style.left = '6px';
                    targetEl.style.right = 'auto';
                    if (Math.abs(fitRatio - 1.0) > 0.01) {
                        transform = 'scale(' + fitRatio.toFixed(2) + ')';
                    }
                    targetEl.style.transformOrigin = 'bottom left';
                } else if (selectedScaleSide === 'center') {
                    targetEl.style.bottom = '6px';
                    targetEl.style.left = '50%';
                    targetEl.style.right = 'auto';
                    transform = 'translateX(-50%)';
                    if (Math.abs(fitRatio - 1.0) > 0.01) {
                        transform += ' scale(' + fitRatio.toFixed(2) + ')';
                    }
                    targetEl.style.transformOrigin = 'bottom center';
                } else { // 'right'
                    targetEl.style.bottom = '6px';
                    targetEl.style.right = '6px';
                    targetEl.style.left = 'auto';
                    if (Math.abs(fitRatio - 1.0) > 0.01) {
                        transform = 'scale(' + fitRatio.toFixed(2) + ')';
                    }
                    targetEl.style.transformOrigin = 'bottom right';
                }
                targetEl.style.transform = transform || 'none';
            }

            function updateLabel() {
                var sizeText = paperSize + (isLandscape ? ' Landscape' : ' Portrait');
                var rotText = (printRotation !== 0) ? ' · Rot: ' + (printRotation < 10 ? '00' : (printRotation < 100 ? '0' : '')) + printRotation + '°' : '';
                var widthMm = isLandscape ? paperSpec.longMm : paperSpec.shortMm;
                var heightMm = isLandscape ? paperSpec.shortMm : paperSpec.longMm;
                if (selectedScale === 'auto') {
                    var latRad = (rectGeoCenter ? rectGeoCenter.lat : 31.5) * Math.PI / 180.0;
                    var zoom = appState.map.getZoom();
                    var metersPerPx = (40075016.686 * Math.cos(latRad)) / (256.0 * Math.pow(2, zoom));
                    var groundWidthM = rectW * metersPerPx;
                    var effectiveScale = Math.round(groundWidthM / (widthMm / 1000.0));
                    var scaleText = '1:' + (effectiveScale >= 1000 ? Math.round(effectiveScale / 1000) + 'k' : effectiveScale);
                    var kmW = (groundWidthM / 1000).toFixed(1);
                    var kmH = ((rectH * metersPerPx) / 1000).toFixed(1);
                    var nmW = (kmW * 0.539957).toFixed(1);
                    var nmH = (kmH * 0.539957).toFixed(1);
                    var cmText = (effectiveScale / 100000).toFixed(2) + ' km';
                    label.textContent = sizeText + rotText + ' · ' + scaleText + ' (Auto: 1cm = ' + cmText + ') · ' + kmW + '×' + kmH + ' km (' + nmW + '×' + nmH + ' NM)';
                } else {
                    var scaleNum = parseInt(selectedScale, 10);
                    var scaleText = '1:' + (scaleNum >= 1000 ? (scaleNum / 1000) + 'k' : scaleNum);
                    var kmW = (widthMm * scaleNum / 1000000).toFixed(1);
                    var kmH = (heightMm * scaleNum / 1000000).toFixed(1);
                    var nmW = (kmW * 0.539957).toFixed(1);
                    var nmH = (kmH * 0.539957).toFixed(1);
                    var cmText = (scaleNum / 100000) + ' km';
                    label.textContent = sizeText + rotText + ' · ' + scaleText + ' (1cm = ' + cmText + ') · ' + kmW + '×' + kmH + ' km (' + nmW + '×' + nmH + ' NM)';
                }
                updatePreviewScaleBar(previewScaleBar, selectedScale, rectGeoCenter ? rectGeoCenter.lat : 31.5, rectW, rectH, isLandscape);
            }
            updateLabel();

            // Declared early so positionRect can call updateExtraRects safely
            var extraRects = [];

            function updateOverlay() {
                var curMapW = mapContainer.offsetWidth;
                var curMapH = mapContainer.offsetHeight;
                svgOverlay.setAttribute('width', curMapW);
                svgOverlay.setAttribute('height', curMapH);
                var pathStr = 'M 0 0 L ' + curMapW + ' 0 L ' + curMapW + ' ' + curMapH + ' L 0 ' + curMapH + ' Z ';

                function getBoxCorners(cx, cy, w, h, angleDeg) {
                    var rad = angleDeg * Math.PI / 180;
                    var cos = Math.cos(rad);
                    var sin = Math.sin(rad);
                    var hw = w / 2;
                    var hh = h / 2;
                    return [
                        { x: Math.round(cx - hw * cos + hh * sin), y: Math.round(cy - hw * sin - hh * cos) },
                        { x: Math.round(cx + hw * cos + hh * sin), y: Math.round(cy + hw * sin - hh * cos) },
                        { x: Math.round(cx + hw * cos - hh * sin), y: Math.round(cy + hw * sin + hh * cos) },
                        { x: Math.round(cx - hw * cos - hh * sin), y: Math.round(cy - hw * sin + hh * cos) }
                    ];
                }

                if (window._a4Pos && rectGeoCenter) {
                    var pc = appState.map.latLngToContainerPoint(rectGeoCenter);
                    var c1 = getBoxCorners(pc.x, pc.y, rectW, rectH, printRotation);
                    pathStr += 'M ' + c1[0].x + ' ' + c1[0].y +
                               ' L ' + c1[1].x + ' ' + c1[1].y +
                               ' L ' + c1[2].x + ' ' + c1[2].y +
                               ' L ' + c1[3].x + ' ' + c1[3].y + ' Z ';
                }

                extraRects.forEach(function(er, idx) {
                    var p = idx + 1;
                    var gc = extraGeocenters[p];
                    if (!gc) return;
                    var ep = appState.map.latLngToContainerPoint(gc);
                    var ew = parseInt(er.style.width) || rectW;
                    var eh = parseInt(er.style.height) || rectH;
                    var c = getBoxCorners(ep.x, ep.y, ew, eh, printRotation);
                    pathStr += 'M ' + c[0].x + ' ' + c[0].y +
                               ' L ' + c[1].x + ' ' + c[1].y +
                               ' L ' + c[2].x + ' ' + c[2].y +
                               ' L ' + c[3].x + ' ' + c[3].y + ' Z ';
                });

                overlayPath.setAttribute('d', pathStr);
            }

            function positionRect(x, y) {
                rect.style.left   = x + 'px';
                rect.style.top    = y + 'px';
                rect.style.width  = rectW + 'px';
                rect.style.height = rectH + 'px';
                rect.style.transform = 'rotate(' + printRotation + 'deg)';
                window._a4Pos = { x: x, y: y, w: rectW, h: rectH };
                // Save geographic center
                rectGeoCenter = appState.map.containerPointToLatLng(
                    L.point(x + rectW / 2, y + rectH / 2)
                );
                updateOverlay();
                if (typeof updateExtraRects === 'function') updateExtraRects();
            }

            function setPrintRotation(deg, source) {
                printRotation = ((Math.round(deg) % 360) + 360) % 360;
                rect.style.transform = 'rotate(' + printRotation + 'deg)';

                var topAngleEl = document.getElementById('a4TopAngle');
                if (topAngleEl) {
                    var card = '';
                    if (printRotation === 0) card = ' (N)';
                    else if (printRotation === 90) card = ' (E)';
                    else if (printRotation === 180) card = ' (S)';
                    else if (printRotation === 270) card = ' (W)';
                    topAngleEl.textContent = (printRotation < 10 ? '00' : (printRotation < 100 ? '0' : '')) + printRotation + '°' + card;
                }

                var rotSelect = document.getElementById('a4Rotation');
                if (rotSelect && source !== 'select') {
                    if ([0, 90, 180, 270].indexOf(printRotation) !== -1) {
                        rotSelect.value = String(printRotation);
                    } else {
                        rotSelect.value = 'custom';
                    }
                }
                var rotSlider = document.getElementById('a4RotSlider');
                if (rotSlider && source !== 'slider') {
                    rotSlider.value = printRotation;
                }
                var rotValEl = document.getElementById('a4RotVal');
                if (rotValEl) {
                    rotValEl.textContent = (printRotation < 10 ? '00' : (printRotation < 100 ? '0' : '')) + printRotation + '°';
                }

                extraRects.forEach(function(er) {
                    er.style.transform = 'rotate(' + printRotation + 'deg)';
                });

                updateOverlay();
                updateLabel();
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
                rect.style.transform = 'rotate(' + printRotation + 'deg)';
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
                    er.style.transform = 'rotate(' + printRotation + 'deg)';
                    var exSb = er.querySelector('.a4-extra-preview-scalebar');
                    if (exSb) {
                        updatePreviewScaleBar(exSb, selectedScale, gc.lat, pw, ph, pageLandscape);
                    }
                });
                updateOverlay();
                updateLabel();
            }
            appState.map.on('move zoom', refreshRectPositions);

            // ── Drag & Rotate logic ──────────────────────────────────────────
            var dragging = false, rotDragging = false;
            var dragStartX = 0, dragStartY = 0, initialPosX = 0, initialPosY = 0;

            rotHandle.addEventListener('mousedown', function(e) {
                rotDragging = true;
                rotHandle.style.cursor = 'grabbing';
                e.preventDefault();
                e.stopPropagation();
                appState.map.dragging.disable();
            });

            rect.addEventListener('mousedown', function(e) {
                if (e.target === rotHandle || e.target.closest('#a4RotHandle') || e.target.tagName === 'BUTTON') return;
                dragging = true;
                dragStartX = e.clientX;
                dragStartY = e.clientY;
                initialPosX = window._a4Pos ? window._a4Pos.x : (parseInt(rect.style.left) || 0);
                initialPosY = window._a4Pos ? window._a4Pos.y : (parseInt(rect.style.top) || 0);
                e.preventDefault();
                appState.map.dragging.disable();
            });

            document.addEventListener('mousemove', function(e) {
                if (rotDragging) {
                    var center = appState.map.latLngToContainerPoint(rectGeoCenter);
                    var mapR = mapContainer.getBoundingClientRect();
                    var cx = mapR.left + center.x;
                    var cy = mapR.top + center.y;
                    var angleRad = Math.atan2(e.clientY - cy, e.clientX - cx);
                    var angleDeg = Math.round(angleRad * 180 / Math.PI) + 90;
                    var normalized = ((angleDeg % 360) + 360) % 360;
                    var finalAngle = e.shiftKey ? normalized : Math.round(normalized / 5) * 5 % 360;
                    setPrintRotation(finalAngle, 'handle');
                    return;
                }
                if (dragging) {
                    var nx = initialPosX + (e.clientX - dragStartX);
                    var ny = initialPosY + (e.clientY - dragStartY);
                    positionRect(nx, ny);
                }
            });

            document.addEventListener('mouseup', function() {
                if (dragging) {
                    dragging = false;
                    appState.map.dragging.enable();
                }
                if (rotDragging) {
                    rotDragging = false;
                    rotHandle.style.cursor = 'grab';
                    appState.map.dragging.enable();
                }
            });

            // ── Toolbar ────────────────────────────────────────────────────
            var toolbar = document.createElement('div');
            toolbar.id = 'a4Toolbar';
            toolbar.style.cssText = [
                'position:fixed;bottom:20px;left:50%;transform:translateX(-50%)',
                'background:rgba(0,0,0,0.85);color:#fff;border-radius:10px',
                'padding:8px 14px;display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:8px',
                'z-index:3000;box-shadow:0 4px 16px rgba(0,0,0,0.4);font-size:13px;font-weight:600;max-width:96vw'
            ].join(';');
            toolbar.innerHTML =
                '<span style="opacity:.7;font-size:12px;">Drag rect · scroll zoom</span>' +
                '<button id="a4Portrait"  style="padding:5px 10px;background:#0066cc;color:#fff;border:2px solid #fff;border-radius:5px;cursor:pointer;font-size:12px;">📱 Port</button>' +
                '<button id="a4Landscape" style="padding:5px 10px;background:transparent;color:#fff;border:2px solid rgba(255,255,255,0.3);border-radius:5px;cursor:pointer;font-size:12px;">📐 Land</button>' +
                '<span style="opacity:.7;font-size:12px;margin-left:4px;">Rot:</span>' +
                '<select id="a4Rotation" style="padding:5px 8px;border-radius:5px;border:none;font-size:12px;font-weight:600;background:#fff;color:#333;cursor:pointer;" title="Print rotation orientation">' +
                    '<option value="0" selected>⬆ 0° (North)</option>' +
                    '<option value="90">➡ 90° (East)</option>' +
                    '<option value="180">⬇ 180° (South)</option>' +
                    '<option value="270">⬅ 270° (West)</option>' +
                    '<option value="route">✈️ Route Track</option>' +
                    '<option value="custom">⚙️ Custom...</option>' +
                '</select>' +
                '<button id="a4RotCCW" title="Rotate counter-clockwise 15°" style="padding:5px 8px;background:#333;color:#fff;border:1px solid rgba(255,255,255,0.3);border-radius:5px;cursor:pointer;font-size:12px;font-weight:700;">⟲ -15°</button>' +
                '<span id="a4RotVal" style="font-size:12px;min-width:34px;text-align:center;font-weight:700;color:#5bc0de;">000°</span>' +
                '<button id="a4RotCW" title="Rotate clockwise 15°" style="padding:5px 8px;background:#333;color:#fff;border:1px solid rgba(255,255,255,0.3);border-radius:5px;cursor:pointer;font-size:12px;font-weight:700;">⟳ +15°</button>' +
                '<input id="a4RotSlider" type="range" min="0" max="355" value="0" step="5" style="width:65px;cursor:pointer;accent-color:#0066cc;" title="Rotation angle">' +
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
                '<span style="opacity:.7;font-size:12px;margin-left:4px;">Side:</span>' +
                '<select id="a4ScaleSide" style="padding:5px 8px;border-radius:5px;border:none;font-size:12px;font-weight:600;background:#fff;color:#333;cursor:pointer;">' +
                    '<option value="right" selected>Right ↘</option>' +
                    '<option value="left">Left ↙</option>' +
                    '<option value="center">Center ⬇</option>' +
                    '<option value="none">Off ✕</option>' +
                '</select>' +
                '<span style="opacity:.7;font-size:12px;margin-left:4px;">Size:</span>' +
                '<select id="a4ScaleBarSize" style="padding:5px 8px;border-radius:5px;border:none;font-size:12px;font-weight:600;background:#fff;color:#333;cursor:pointer;">' +
                    '<option value="0.5">50% (Tiny)</option>' +
                    '<option value="0.75">75% (Small)</option>' +
                    '<option value="1" selected>100% (Normal)</option>' +
                    '<option value="1.25">125% (Large)</option>' +
                    '<option value="1.5">150% (XL)</option>' +
                    '<option value="2">200% (2x)</option>' +
                '</select>' +
                '<span style="opacity:.7;font-size:12px;margin-left:4px;">Pages:</span>' +
                '<select id="a4PageCount" style="padding:5px 8px;border-radius:5px;border:none;font-size:12px;font-weight:600;background:#fff;color:#333;cursor:pointer;"><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option></select>' +
                '<button id="a4LayoutStacked"  style="padding:5px 8px;background:#0066cc;color:#fff;border:2px solid #fff;border-radius:5px;cursor:pointer;font-size:12px;" title="Pages stacked vertically">⬇ Stack</button>' +
                '<button id="a4LayoutSideBySide" style="padding:5px 8px;background:transparent;color:#fff;border:2px solid rgba(255,255,255,0.3);border-radius:5px;cursor:pointer;font-size:12px;" title="Pages side by side">➡ Side</button>' +
                '<span style="opacity:.7;font-size:12px;">Overlap: <span id="a4OverlapLabel">0</span>%</span>' +
                '<input id="a4Overlap" type="range" min="0" max="50" value="0" step="5" style="width:70px;cursor:pointer;accent-color:#0066cc;">' +
                '<label id="a4CombineLabel" style="display:none;align-items:center;gap:4px;font-size:12px;cursor:pointer;background:rgba(255,255,255,0.15);padding:4px 8px;border-radius:4px;border:1px solid rgba(255,255,255,0.3);margin-left:2px;" title="Combine all pages into one single PDF print document">' +
                    '<input type="checkbox" id="a4CombinePdf" checked style="cursor:pointer;accent-color:#28a745;width:14px;height:14px;">' +
                    '<span>📄 1 PDF</span>' +
                '</label>' +
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
                if (!pos || pageCount <= 1) {
                    updateOverlay();
                    return;
                }
                var overlap = getOverlapFraction();
                var stepW = pagesHorizontal ? pos.w * (1 - overlap) : 0;
                var stepH = pagesHorizontal ? 0 : pos.h * (1 - overlap);
                for (var p = 1; p < pageCount; p++) {
                    var pageLandscape = pageOrientations[p] !== undefined ? pageOrientations[p] : isLandscape;
                    var pDims = calculateRectDimensions(pageLandscape, selectedScale, rectGeoCenter.lat);
                    var pw = pDims.w;
                    var ph = pDims.h;
                    var er = document.createElement('div');
                    er.style.cssText = 'position:absolute;border:2px dashed rgba(255,255,255,0.5);box-shadow:0 0 0 1px rgba(0,102,204,0.5);z-index:2001;box-sizing:border-box;transform-origin:center center;';
                    er.style.transform = 'rotate(' + printRotation + 'deg)';
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

                    var extraSb = document.createElement('div');
                    extraSb.className = 'a4-extra-preview-scalebar';
                    extraSb.style.cssText =
                        'position:absolute;bottom:6px;right:6px;pointer-events:none;' +
                        'background:rgba(255,255,255,0.88);border:1px solid rgba(0,0,0,0.45);' +
                        'border-radius:4px;padding:3px 8px 4px 8px;box-shadow:0 1px 4px rgba(0,0,0,0.18);z-index:2002;';
                    er.appendChild(extraSb);
                    var extraLat = extraGeocenters[p] ? extraGeocenters[p].lat : (rectGeoCenter ? rectGeoCenter.lat : 31.5);
                    updatePreviewScaleBar(extraSb, selectedScale, extraLat, pw, ph, pageLandscape);

                    mapContainer.appendChild(er);
                    extraRects.push(er);

                    // Make extra rect draggable
                    (function(erEl, pageIdx) {
                        var erDragging = false, startMx = 0, startMy = 0, startEx = 0, startEy = 0;
                        erEl.style.cursor = 'move';
                        erEl.addEventListener('mousedown', function(e) {
                            if (e.target.tagName === 'BUTTON') return;
                            erDragging = true;
                            startMx = e.clientX;
                            startMy = e.clientY;
                            startEx = parseInt(erEl.style.left) || 0;
                            startEy = parseInt(erEl.style.top) || 0;
                            e.preventDefault();
                            appState.map.dragging.disable();
                        });
                        document.addEventListener('mousemove', function(e) {
                            if (!erDragging) return;
                            var nx = startEx + (e.clientX - startMx);
                            var ny = startEy + (e.clientY - startMy);
                            erEl.style.left = nx + 'px';
                            erEl.style.top  = ny + 'px';
                            var pw = parseInt(erEl.style.width);
                            var ph = parseInt(erEl.style.height);
                            extraGeocenters[pageIdx] = appState.map.containerPointToLatLng(
                                L.point(nx + pw/2, ny + ph/2)
                            );
                            updateOverlay();
                        });
                        document.addEventListener('mouseup', function() {
                            if (erDragging) { erDragging = false; appState.map.dragging.enable(); }
                        });
                    })(er, p);
                }
                updateOverlay();
            }

            // Page count change and combine PDF checkbox listeners
            function updatePrintButtonState() {
                var pCount = parseInt(document.getElementById('a4PageCount').value) || 1;
                var combineLabel = document.getElementById('a4CombineLabel');
                var combineCheck = document.getElementById('a4CombinePdf');
                var printBtn = document.getElementById('a4Print');
                if (pCount > 1) {
                    if (combineLabel) combineLabel.style.display = 'inline-flex';
                    if (combineCheck && combineCheck.checked) {
                        printBtn.innerHTML = '📄 Save ' + pCount + ' Pages (1 PDF)';
                        printBtn.title = 'Render and combine all ' + pCount + ' pages into one single PDF document';
                    } else {
                        printBtn.innerHTML = '🖨️ Print ' + pCount + ' Pages (1 by 1)';
                        printBtn.title = 'Print each page sequentially one by one';
                    }
                } else {
                    if (combineLabel) combineLabel.style.display = 'none';
                    printBtn.innerHTML = '🖨️ Print / Save';
                    printBtn.title = 'Print or save current page as PDF';
                }
            }

            document.getElementById('a4PageCount').addEventListener('change', function() {
                updateExtraRects();
                updatePrintButtonState();
            });

            var combinePdfEl = document.getElementById('a4CombinePdf');
            if (combinePdfEl) {
                combinePdfEl.addEventListener('change', updatePrintButtonState);
            }
            updatePrintButtonState();

            document.getElementById('a4ZoomIn').onclick  = function() { appState.map.zoomIn();  };
            document.getElementById('a4ZoomOut').onclick = function() { appState.map.zoomOut(); };

            document.getElementById('a4Rotation').addEventListener('change', function() {
                if (this.value === 'route') {
                    var track = getRouteTrackHeading();
                    setPrintRotation(track, 'select');
                } else if (this.value !== 'custom') {
                    setPrintRotation(parseInt(this.value, 10), 'select');
                }
            });

            document.getElementById('a4RotCCW').onclick = function() {
                setPrintRotation(printRotation - 15, 'button');
            };

            document.getElementById('a4RotCW').onclick = function() {
                setPrintRotation(printRotation + 15, 'button');
            };

            document.getElementById('a4RotSlider').addEventListener('input', function() {
                setPrintRotation(parseInt(this.value, 10), 'slider');
            });

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

            document.getElementById('a4ScaleSide').addEventListener('change', function() {
                selectedScaleSide = this.value;
                var sizeSelect = document.getElementById('a4ScaleBarSize');
                if (sizeSelect) {
                    sizeSelect.disabled = (selectedScaleSide === 'none');
                    sizeSelect.style.opacity = (selectedScaleSide === 'none') ? '0.4' : '1.0';
                }
                updateLabel();
                if (typeof updateExtraRects === 'function') updateExtraRects();
            });

            document.getElementById('a4ScaleBarSize').addEventListener('change', function() {
                selectedScaleBarSize = parseFloat(this.value) || 1.0;
                updateLabel();
                if (typeof updateExtraRects === 'function') updateExtraRects();
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

            // Deep clone DOM element including canvas bitmap data
            function deepCloneWithCanvas(node) {
                var clone = node.cloneNode(true);
                var origCanvases = node.querySelectorAll ? node.querySelectorAll('canvas') : [];
                var cloneCanvases = clone.querySelectorAll ? clone.querySelectorAll('canvas') : [];
                for (var i = 0; i < origCanvases.length; i++) {
                    try {
                        var targetCanvas = cloneCanvases[i];
                        if (targetCanvas) {
                            targetCanvas.width = origCanvases[i].width;
                            targetCanvas.height = origCanvases[i].height;
                            var ctx = targetCanvas.getContext('2d');
                            if (ctx) ctx.drawImage(origCanvases[i], 0, 0);
                        }
                    } catch (e) {
                        console.warn('Canvas clone warning:', e);
                    }
                }
                return clone;
            }

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
                var primaryCenter = rectGeoCenter || appState.map.containerPointToLatLng(
                    L.point(pos.x + pos.w / 2, pos.y + pos.h / 2)
                );

                // Print dimensions in CSS pixels (96 DPI)
                var printW = isLandscape ? paperSpec.landW : paperSpec.portW;
                var printH = isLandscape ? paperSpec.landH : paperSpec.portH;
                var singleCssPageSize = isLandscape ? paperSpec.cssSizeLand : paperSpec.cssSizePort;

                // Rotated map bounding box to cover the printed sheet completely
                var savedPrintRotation = printRotation;
                var rad = Math.abs(savedPrintRotation) * Math.PI / 180;
                var W_cover = (savedPrintRotation === 0) ? printW : (Math.ceil(printW * Math.abs(Math.cos(rad)) + printH * Math.abs(Math.sin(rad))) + 8);
                var H_cover = (savedPrintRotation === 0) ? printH : (Math.ceil(printW * Math.abs(Math.sin(rad)) + printH * Math.abs(Math.cos(rad))) + 8);

                // Compute zoom for printing
                var printZoom;
                if (selectedScale !== 'auto') {
                    var scaleNum = parseInt(selectedScale, 10);
                    printZoom = computeScaleZoom(scaleNum, primaryCenter.lat);
                } else {
                    printZoom = appState.map.getZoom();
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
                var origPos      = mapDiv.style.position;
                var origLeft     = mapDiv.style.left;
                var origTop      = mapDiv.style.top;
                var origTf       = mapDiv.style.transform;
                var origTfOrig   = mapDiv.style.transformOrigin;
                var containerDiv = document.querySelector('.container');
                var origContW    = containerDiv ? containerDiv.style.width : '';
                var origContH    = containerDiv ? containerDiv.style.height : '';
                var origContPos  = containerDiv ? containerDiv.style.position : '';
                var origContOf   = containerDiv ? containerDiv.style.overflow : '';
                var sidebar      = document.querySelector('.sidebar');
                var zoomInd      = document.querySelector('.zoom-indicator');

                // Allow exact floating-point zoom without snapping during print
                appState.map.options.zoomSnap = 0;

                if (containerDiv) {
                    containerDiv.style.position = 'relative';
                    containerDiv.style.width    = printW + 'px';
                    containerDiv.style.height   = printH + 'px';
                    containerDiv.style.overflow = 'hidden';
                }

                // Resize map to cover dimensions and center with rotation
                mapDiv.style.flex   = 'none';
                mapDiv.style.width  = W_cover + 'px';
                mapDiv.style.height = H_cover + 'px';
                mapDiv.style.position = 'absolute';
                mapDiv.style.left   = '50%';
                mapDiv.style.top    = '50%';
                mapDiv.style.transformOrigin = 'center center';
                mapDiv.style.transform = 'translate(-50%, -50%) rotate(' + (-savedPrintRotation) + 'deg)';
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

                    // Scale Bar — placed at selected side with True North indicator needle
                    var scaleBar = null;
                    if (selectedScaleSide !== 'none') {
                        scaleBar = document.createElement('div');
                        scaleBar.id = 'a4ScaleBar';
                        var effectiveScale = (selectedScale !== 'auto') ? parseInt(selectedScale, 10) :
                            Math.round(((40075016.686 * Math.cos((primaryCenter.lat || 31.5) * Math.PI / 180.0)) / (256.0 * Math.pow(2, printZoom))) / (0.0254 / 96.0));
                        scaleBar.innerHTML = buildScaleBarHtml(effectiveScale, primaryCenter.lat, savedPrintRotation);
                        var posStyle = 'bottom:8px;right:8px;transform-origin:bottom right;';
                        var tf = '';
                        if (selectedScaleSide === 'left') {
                            posStyle = 'bottom:8px;left:8px;transform-origin:bottom left;';
                        } else if (selectedScaleSide === 'center') {
                            posStyle = 'bottom:8px;left:50%;transform-origin:bottom center;';
                            tf = 'translateX(-50%)';
                        }
                        if (Math.abs(selectedScaleBarSize - 1.0) > 0.01) {
                            tf = (tf ? tf + ' ' : '') + 'scale(' + selectedScaleBarSize + ')';
                        }
                        if (tf) {
                            posStyle += 'transform:' + tf + ';';
                        }
                        scaleBar.style.cssText =
                            'position:fixed;z-index:99999;' + posStyle +
                            'background:rgba(255,255,255,0.85);border:1px solid rgba(0,0,0,0.5);' +
                            'border-radius:4px;padding:3px 10px 4px 10px;pointer-events:none;' +
                            'box-shadow:0 1px 4px rgba(0,0,0,0.15);';
                        document.body.appendChild(scaleBar);
                    }

                    // Watermark position
                    (function positionWatermark() {
                        var margin = 8;
                        var corners = [
                            { label: 'BL', style: 'bottom:'+margin+'px;left:'+margin+'px;' },
                            { label: 'BR', style: 'bottom:'+margin+'px;right:'+margin+'px;' },
                            { label: 'TL', style: 'top:'+margin+'px;left:'+margin+'px;' },
                            { label: 'TR', style: 'top:'+margin+'px;right:'+margin+'px;' }
                        ];
                        var best = (selectedScaleSide === 'right') ? corners[0] : corners[1];
                        watermark.style.cssText =
                            'position:fixed;z-index:99999;display:flex;align-items:center;gap:4px;' +
                            'background:rgba(255,255,255,0.75);border:1px solid rgba(0,102,204,0.4);' +
                            'border-radius:3px;padding:2px 6px;pointer-events:none;' + best.style;
                    })();

                    var singleTopOffset = Math.round((printH - H_cover) / 2);
                    var singleLeftOffset = Math.round((printW - W_cover) / 2);
                    var singleTransform = (savedPrintRotation === 0) ? 'none' : ('rotate(' + (-savedPrintRotation) + 'deg)');

                    var printStyle = document.createElement('style');
                    printStyle.id = 'a4PrintStyle';
                    printStyle.textContent =
                        '@media print {' +
                        '  #topNavbar, .top-navbar, #mapHudToolbar, .map-hud-toolbar, #mapLayersPopover, .map-layers-popover { display:none !important; }' +
                        '  #showSidebarBtn { display:none !important; }' +
                        '  .sidebar, .zoom-indicator, #azmWarning, #projectionWarning, #noFolderWarning, #mapWatermark { display:none !important; }' +
                        '  .leaflet-control-zoom, .leaflet-control-layers, .leaflet-control-attribution { display:none !important; }' +
                        '  * { -webkit-print-color-adjust:exact; print-color-adjust:exact; }' +
                        '  html, body { margin:0 !important; padding:0 !important;' +
                        '    width:' + printW + 'px !important; height:' + printH + 'px !important;' +
                        '    overflow:hidden !important; display:block !important; background:transparent !important; }' +
                        '  .container { display:block !important; margin:0 !important; padding:0 !important;' +
                        '    position:relative !important; width:' + printW + 'px !important; height:' + printH + 'px !important;' +
                        '    overflow:hidden !important; }' +
                        '  #map { position:absolute !important; top:' + singleTopOffset + 'px !important; left:' + singleLeftOffset + 'px !important;' +
                        '    width:' + W_cover + 'px !important; height:' + H_cover + 'px !important;' +
                        '    transform: ' + singleTransform + ' !important;' +
                        '    transform-origin: center center !important;' +
                        '    margin:0 !important; padding:0 !important; }' +
                        '  #a4Watermark { display:flex !important; }' +
                        '  #a4ScaleBar { display:block !important; }' +
                        '  @page { size:' + singleCssPageSize + '; margin:0; }' +
                        '}';
                    document.head.appendChild(printStyle);

                    function restore() {
                        ['a4PrintStyle', 'a4Watermark', 'a4ScaleBar'].forEach(function(id) {
                            var el = document.getElementById(id);
                            if (el) el.parentNode.removeChild(el);
                        });
                        if (containerDiv) {
                            containerDiv.style.position = origContPos;
                            containerDiv.style.width    = origContW;
                            containerDiv.style.height   = origContH;
                            containerDiv.style.overflow = origContOf;
                        }
                        mapDiv.style.flex            = origFlex;
                        mapDiv.style.width           = origW;
                        mapDiv.style.height          = origH;
                        mapDiv.style.position        = origPos;
                        mapDiv.style.left            = origLeft;
                        mapDiv.style.top             = origTop;
                        mapDiv.style.transform       = origTf;
                        mapDiv.style.transformOrigin = origTfOrig;
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
                    var isCombinedPdf = pageCount > 1 && (function() {
                        var cb = document.getElementById('a4CombinePdf');
                        return cb ? cb.checked : true;
                    })();

                    if (pageCount === 1) {
                        window.print();
                        setTimeout(restore, 1500);
                    } else if (isCombinedPdf) {
                        // Multi-page COMBINED single PDF document export
                        // 1. Show progress modal
                        var progressOverlay = document.createElement('div');
                        progressOverlay.id = 'a4PdfProgressOverlay';
                        progressOverlay.style.cssText = [
                            'position:fixed;top:0;left:0;right:0;bottom:0',
                            'background:rgba(0,0,0,0.75);z-index:999999',
                            'display:flex;flex-direction:column;justify-content:center;align-items:center',
                            'color:#fff;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif'
                        ].join(';');
                        progressOverlay.innerHTML =
                            '<div style="background:#222;padding:24px 32px;border-radius:10px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.5);min-width:280px;border:1px solid #444;">' +
                                '<div style="font-size:28px;margin-bottom:12px;">📄</div>' +
                                '<div id="a4PdfProgressText" style="font-size:15px;font-weight:600;margin-bottom:8px;">Preparing 1 Combined PDF...</div>' +
                                '<div id="a4PdfProgressSub" style="font-size:12px;opacity:0.75;margin-bottom:12px;">Rendering Page 1 of ' + pageCount + '</div>' +
                                '<div style="width:100%;background:#444;height:6px;border-radius:3px;overflow:hidden;">' +
                                    '<div id="a4PdfProgressBar" style="width:0%;height:100%;background:#28a745;transition:width 0.3s ease;"></div>' +
                                '</div>' +
                            '</div>';
                        document.body.appendChild(progressOverlay);

                        // 2. Multi-page container holding each rendered sheet
                        var printContainer = document.createElement('div');
                        printContainer.id = 'printPagesContainer';
                        printContainer.style.cssText = 'display:none;';
                        document.body.appendChild(printContainer);

                        // Extend restore to clean up multi-page container & progress overlay
                        var origRestore = restore;
                        restore = function() {
                            var pCont = document.getElementById('printPagesContainer');
                            if (pCont && pCont.parentNode) pCont.parentNode.removeChild(pCont);
                            var pOvr = document.getElementById('a4PdfProgressOverlay');
                            if (pOvr && pOvr.parentNode) pOvr.parentNode.removeChild(pOvr);
                            origRestore();
                        };

                        var renderPageIndex = 0;
                        function renderNextPageForPdf() {
                            if (renderPageIndex >= pageCount) {
                                // All pages rendered and captured!
                                var pOvr = document.getElementById('a4PdfProgressOverlay');
                                if (pOvr && pOvr.parentNode) pOvr.parentNode.removeChild(pOvr);

                                // Replace single-page printStyle with multi-page print stylesheet
                                var oldPs = document.getElementById('a4PrintStyle');
                                if (oldPs && oldPs.parentNode) oldPs.parentNode.removeChild(oldPs);

                                var multiPrintStyle = document.createElement('style');
                                multiPrintStyle.id = 'a4PrintStyle';
                                multiPrintStyle.textContent =
                                    '@media print {' +
                                    '  body > *:not(#printPagesContainer) { display:none !important; }' +
                                    '  #topNavbar, .top-navbar, #mapHudToolbar, .map-hud-toolbar, #mapLayersPopover, .map-layers-popover { display:none !important; }' +
                                    '  #showSidebarBtn, .sidebar, .zoom-indicator, #azmWarning, #projectionWarning, #noFolderWarning, #mapWatermark, #a4Watermark, #a4ScaleBar { display:none !important; }' +
                                    '  .container { display:none !important; }' +
                                    '  #printPagesContainer { display:block !important; width:100% !important; margin:0 !important; padding:0 !important; }' +
                                    '  .print-page-sheet { display:block !important; position:relative !important; overflow:hidden !important;' +
                                    '    page-break-after:always !important; break-after:page !important;' +
                                    '    margin:0 !important; padding:0 !important; }' +
                                    '  .print-page-sheet:last-child { page-break-after:auto !important; break-after:auto !important; }' +
                                    '  * { -webkit-print-color-adjust:exact; print-color-adjust:exact; }' +
                                    '  html, body { margin:0 !important; padding:0 !important; overflow:visible !important; height:auto !important; display:block !important; background:transparent !important; }' +
                                    '  @page { size:' + singleCssPageSize + '; margin:0; }' +
                                    '}';
                                document.head.appendChild(multiPrintStyle);

                                setTimeout(function() {
                                    window.onafterprint = function() {
                                        window.onafterprint = null;
                                        restore();
                                    };
                                    window.print();
                                    // Fallback restore in case onafterprint doesn't fire
                                    setTimeout(function() {
                                        if (document.getElementById('printPagesContainer')) {
                                            restore();
                                        }
                                    }, 4000);
                                }, 600);
                                return;
                            }

                            // Update progress indicator
                            var pNum = renderPageIndex + 1;
                            var pct = Math.round((renderPageIndex / pageCount) * 100);
                            var pSub = document.getElementById('a4PdfProgressSub');
                            if (pSub) pSub.textContent = 'Rendering Page ' + pNum + ' of ' + pageCount + '...';
                            var pBar = document.getElementById('a4PdfProgressBar');
                            if (pBar) pBar.style.width = pct + '%';

                            var pgLand = renderPageIndex === 0 ? isLandscape :
                                (pageOrientations[renderPageIndex] !== undefined ? pageOrientations[renderPageIndex] : isLandscape);
                            var pgW = pgLand ? paperSpec.landW : paperSpec.portW;
                            var pgH = pgLand ? paperSpec.landH : paperSpec.portH;
                            var pgW_cover = (savedPrintRotation === 0) ? pgW : (Math.ceil(pgW * Math.abs(Math.cos(rad)) + pgH * Math.abs(Math.sin(rad))) + 8);
                            var pgH_cover = (savedPrintRotation === 0) ? pgH : (Math.ceil(pgW * Math.abs(Math.sin(rad)) + pgH * Math.abs(Math.cos(rad))) + 8);
                            var pageZoom = (selectedScale !== 'auto') ?
                                computeScaleZoom(parseInt(selectedScale, 10), pageCenters[renderPageIndex].lat) :
                                printZoom;

                            if (containerDiv) {
                                containerDiv.style.width  = pgW + 'px';
                                containerDiv.style.height = pgH + 'px';
                            }
                            mapDiv.style.width  = pgW_cover + 'px';
                            mapDiv.style.height = pgH_cover + 'px';
                            mapDiv.style.transform = 'translate(-50%, -50%) rotate(' + (-savedPrintRotation) + 'deg)';

                            appState.map.invalidateSize({ animate: false });
                            appState.map.setView(pageCenters[renderPageIndex], pageZoom, { animate: false });

                            // Wait for Leaflet tiles to load at this center/zoom
                            setTimeout(function() {
                                // Create page sheet wrapper
                                var sheet = document.createElement('div');
                                sheet.className = 'print-page-sheet';
                                sheet.style.cssText =
                                    'position:relative;width:' + pgW + 'px;height:' + pgH + 'px;' +
                                    'overflow:hidden;page-break-after:always;break-after:page;';

                                // Clone rendered map element
                                var clonedMap = deepCloneWithCanvas(mapDiv);
                                clonedMap.id = 'map_page_' + renderPageIndex;
                                var topOffset = Math.round((pgH - pgH_cover) / 2);
                                var leftOffset = Math.round((pgW - pgW_cover) / 2);
                                clonedMap.style.position = 'absolute';
                                clonedMap.style.top = topOffset + 'px';
                                clonedMap.style.left = leftOffset + 'px';
                                clonedMap.style.width = pgW_cover + 'px';
                                clonedMap.style.height = pgH_cover + 'px';
                                if (savedPrintRotation === 0) {
                                    clonedMap.style.transform = 'none';
                                } else {
                                    clonedMap.style.transform = 'rotate(' + (-savedPrintRotation) + 'deg)';
                                    clonedMap.style.transformOrigin = 'center center';
                                }
                                clonedMap.style.margin = '0';
                                clonedMap.style.padding = '0';

                                // Remove interactive leaflet control container in cloned sheet
                                var controls = clonedMap.querySelectorAll('.leaflet-control-container');
                                for (var ci = 0; ci < controls.length; ci++) {
                                    controls[ci].parentNode.removeChild(controls[ci]);
                                }
                                sheet.appendChild(clonedMap);

                                // Add Watermark with page number indicator
                                var wmClone = document.createElement('div');
                                var bestCornerStyle = (selectedScaleSide === 'right') ? 'bottom:8px;left:8px;' : 'bottom:8px;right:8px;';
                                wmClone.style.cssText =
                                    'position:absolute;z-index:99999;display:flex;align-items:center;gap:4px;' +
                                    'background:rgba(255,255,255,0.75);border:1px solid rgba(0,102,204,0.4);' +
                                    'border-radius:3px;padding:2px 6px;pointer-events:none;' + bestCornerStyle;
                                wmClone.innerHTML =
                                    '<span style="font-size:10px;">🛩️</span>' +
                                    '<span style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;' +
                                    'font-size:8px;font-weight:600;color:#0066cc;letter-spacing:0.2px;opacity:0.8;">' +
                                    'ISR Flight Planner · Page ' + pNum + ' of ' + pageCount + '</span>';
                                sheet.appendChild(wmClone);

                                // Add Scale Bar for this specific page
                                if (selectedScaleSide !== 'none') {
                                    var pgScaleBar = document.createElement('div');
                                    var pgEffectiveScale = (selectedScale !== 'auto') ? parseInt(selectedScale, 10) :
                                        Math.round(((40075016.686 * Math.cos((pageCenters[renderPageIndex].lat || 31.5) * Math.PI / 180.0)) / (256.0 * Math.pow(2, pageZoom))) / (0.0254 / 96.0));
                                    pgScaleBar.innerHTML = buildScaleBarHtml(pgEffectiveScale, pageCenters[renderPageIndex].lat, savedPrintRotation);
                                    var posStyle = 'bottom:8px;right:8px;transform-origin:bottom right;';
                                    var tf = '';
                                    if (selectedScaleSide === 'left') {
                                        posStyle = 'bottom:8px;left:8px;transform-origin:bottom left;';
                                    } else if (selectedScaleSide === 'center') {
                                        posStyle = 'bottom:8px;left:50%;transform-origin:bottom center;';
                                        tf = 'translateX(-50%)';
                                    }
                                    if (Math.abs(selectedScaleBarSize - 1.0) > 0.01) {
                                        tf = (tf ? tf + ' ' : '') + 'scale(' + selectedScaleBarSize + ')';
                                    }
                                    if (tf) {
                                        posStyle += 'transform:' + tf + ';';
                                    }
                                    pgScaleBar.style.cssText =
                                        'position:absolute;z-index:99999;' + posStyle +
                                        'background:rgba(255,255,255,0.85);border:1px solid rgba(0,0,0,0.5);' +
                                        'border-radius:4px;padding:3px 10px 4px 10px;pointer-events:none;' +
                                        'box-shadow:0 1px 4px rgba(0,0,0,0.15);';
                                    sheet.appendChild(pgScaleBar);
                                }

                                printContainer.appendChild(sheet);
                                renderPageIndex++;
                                renderNextPageForPdf();
                            }, 1100);
                        }

                        renderNextPageForPdf();
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
                            var pgW_cover = (savedPrintRotation === 0) ? pgW : (Math.ceil(pgW * Math.abs(Math.cos(rad)) + pgH * Math.abs(Math.sin(rad))) + 8);
                            var pgH_cover = (savedPrintRotation === 0) ? pgH : (Math.ceil(pgW * Math.abs(Math.sin(rad)) + pgH * Math.abs(Math.cos(rad))) + 8);
                            var pageZoom = (selectedScale !== 'auto') ?
                                computeScaleZoom(parseInt(selectedScale, 10), pageCenters[currentPage].lat) :
                                printZoom;

                            if (containerDiv) {
                                containerDiv.style.width  = pgW + 'px';
                                containerDiv.style.height = pgH + 'px';
                            }
                            mapDiv.style.width  = pgW_cover + 'px';
                            mapDiv.style.height = pgH_cover + 'px';
                            mapDiv.style.transform = 'translate(-50%, -50%) rotate(' + (-savedPrintRotation) + 'deg)';

                            // Recreate print style with correct dimensions for this page
                            var oldPs = document.getElementById('a4PrintStyle');
                            if (oldPs) oldPs.parentNode.removeChild(oldPs);
                            var pageTopOffset = Math.round((pgH - pgH_cover) / 2);
                            var pageLeftOffset = Math.round((pgW - pgW_cover) / 2);
                            var pageTransform = (savedPrintRotation === 0) ? 'none' : ('rotate(' + (-savedPrintRotation) + 'deg)');

                            var ps = document.createElement('style');
                            ps.id = 'a4PrintStyle';
                            ps.textContent =
                                '@media print {' +
                                '  #topNavbar, .top-navbar, #mapHudToolbar, .map-hud-toolbar, #mapLayersPopover, .map-layers-popover { display:none !important; }' +
                                '  #showSidebarBtn { display:none !important; }' +
                                '  .sidebar, .zoom-indicator, #azmWarning, #projectionWarning, #noFolderWarning, #mapWatermark { display:none !important; }' +
                                '  .leaflet-control-zoom, .leaflet-control-layers, .leaflet-control-attribution { display:none !important; }' +
                                '  * { -webkit-print-color-adjust:exact; print-color-adjust:exact; }' +
                                '  html, body { margin:0 !important; padding:0 !important;' +
                                '    width:' + pgW + 'px !important; height:' + pgH + 'px !important;' +
                                '    overflow:hidden !important; display:block !important; background:transparent !important; }' +
                                '  .container { display:block !important; margin:0 !important; padding:0 !important;' +
                                '    position:relative !important; width:' + pgW + 'px !important; height:' + pgH + 'px !important;' +
                                '    overflow:hidden !important; }' +
                                '  #map { position:absolute !important; top:' + pageTopOffset + 'px !important; left:' + pageLeftOffset + 'px !important;' +
                                '    width:' + pgW_cover + 'px !important; height:' + pgH_cover + 'px !important;' +
                                '    transform: ' + pageTransform + ' !important;' +
                                '    transform-origin: center center !important;' +
                                '    margin:0 !important; padding:0 !important; }' +
                                '  #a4Watermark { display:flex !important; }' +
                                '  #a4ScaleBar { display:block !important; }' +
                                '  @page { size:' + pgCssSize + '; margin:0; }' +
                                '}';
                            document.head.appendChild(ps);

                            var oldSb = document.getElementById('a4ScaleBar');
                            if (oldSb && selectedScaleSide !== 'none') {
                                var pgEffectiveScale = (selectedScale !== 'auto') ? parseInt(selectedScale, 10) :
                                    Math.round(((40075016.686 * Math.cos((pageCenters[currentPage].lat || 31.5) * Math.PI / 180.0)) / (256.0 * Math.pow(2, pageZoom))) / (0.0254 / 96.0));
                                oldSb.innerHTML = buildScaleBarHtml(pgEffectiveScale, pageCenters[currentPage].lat, savedPrintRotation);
                            }

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
                if (svgOverlay.parentNode)  svgOverlay.parentNode.removeChild(svgOverlay);
                if (rect.parentNode)        rect.parentNode.removeChild(rect);
                if (toolbar.parentNode)     toolbar.parentNode.removeChild(toolbar);
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
                    '  #topNavbar, .top-navbar, #mapHudToolbar, .map-hud-toolbar, #mapLayersPopover, .map-layers-popover { display:none !important; }' +
                    '  #showSidebarBtn, .sidebar, .zoom-indicator,' +
                    '  .leaflet-control-zoom, .leaflet-control-layers, .leaflet-control-attribution { display:none !important; }' +
                    '  * { -webkit-print-color-adjust:exact; print-color-adjust:exact; }' +
                    '  @page { margin:0; size:' + viewW + 'px ' + viewH + 'px; }' +
                    '  html, body { margin:0!important;padding:0!important;' +
                    '    width:' + viewW + 'px!important;height:' + viewH + 'px!important;overflow:hidden!important; display:block!important; }' +
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
