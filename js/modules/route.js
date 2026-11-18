        function generateReverseRoute() {
            if (appState.waypoints.length < 2) {
                alert('Need at least 2 waypoints to create a reverse route');
                return;
            }

            // Reverse the waypoints array — last becomes first
            appState.waypoints.reverse();
            // Reverse circles to match new waypoint order
            appState.circles.reverse();

            // Reverse leg altitudes mapping
            var n = appState.waypoints.length;
            var newAlts = {};
            for (var i = 0; i < n - 1; i++) {
                var origIdx = n - 2 - i;
                if (appState.legAltitudes[origIdx] !== undefined)
                    newAlts[i] = appState.legAltitudes[origIdx];
            }
            appState.legAltitudes = newAlts;

            // Remap leg label positions (box for leg i becomes box for leg n-2-i)
            // Reverse leg label positions: swap wp1.num_wp2.num -> wp2.num_wp1.num
            var newLegPos = {};
            Object.keys(appState.legLabelDraggedPositions).forEach(function(key) {
                var parts = key.split('_');
                if (parts.length === 2) {
                    var newKey = parts[1] + '_' + parts[0];
                    newLegPos[newKey] = appState.legLabelDraggedPositions[key];
                }
            });
            appState.legLabelDraggedPositions = newLegPos;

            // Rotate text boxes 180° and rebuild markers to apply visually
            appState.textBoxes.forEach(function(tb) {
                var data = tb.textBoxData;
                data.rotation = ((data.rotation || 0) + 180) % 360;
            });
            updateTextBoxes();

            // Remap miniWaypoints: a mini WP at num X made leg X→Y a mini leg.
            // After reverse, that leg becomes Y→X, so the mini designation moves to Y.
            // Build a map of wp.num → its successor's wp.num (before reverse)
            // After waypoints.reverse(), we need to find for each old mini num,
            // which wp is now its successor in the reversed array.
            // Simpler: for each mini num, find the wp that came AFTER it originally,
            // that wp becomes the new mini wp in the reversed route.
            // miniWaypoints stay on the same WPs — no remapping needed
            // (the WP type doesn't change, only the route direction does)

            // WP labels: negate offsets so labels stay in same visual position
            // Pre-populate defaults so all WPs get negated
            appState.waypoints.forEach(function(wp) {
                var off = appState.waypointLabelOffsets[wp.num] || { x: 6, y: -18 };
                appState.waypointLabelOffsets[wp.num] = { x: -off.x, y: -off.y };
            });

            // WP label rotationDelta is heading-relative, so no change needed when reversing
            // (heading changes automatically, rotationDelta stays same)

            // Clear reverse route state
            appState.reverseRoute = [];
            appState.reverseRouteVisible = false;

            // Rebuild the route with reversed waypoints
            updateRoute();
            updateWaypointsList();
            updateStats();
            setTimeout(refreshLSARotation, 150);

            var btn = document.getElementById('toggleDirectionBtn');
            if (btn) btn.style.display = 'none';
        }


        function toggleDirectionVisibility() {
            // No longer used - reverse route is now applied directly
        }



        function showPreview(latlng) {
            var lastWP = appState.waypoints[appState.waypoints.length - 1];
            
            // Remove old preview
            if (appState.previewLine) {
                appState.map.removeLayer(appState.previewLine);
            }
            if (appState.previewLabel) {
                appState.map.removeLayer(appState.previewLabel);
            }
            appState.previewTimeMarkers.forEach(function(m) { appState.map.removeLayer(m); });
            appState.previewTimeMarkers = [];

            // Check if cursor is near a navigation point to snap preview
            var pt = appState.map.latLngToContainerPoint(latlng);
            var navMatch = (typeof findNearbyNavPoint === 'function') ? findNearbyNavPoint(pt) : null;
            if (navMatch) {
                latlng = L.latLng(navMatch.displayLat, navMatch.displayLng);
            }

            // latlng is display (Leaflet) coords — convert to real for math
            var realLatlng = navMatch ? L.latLng(navMatch.lat, navMatch.lng) : calibrateDisplayToReal(latlng);
            
            // Draw preview line using display coords
            var lastWPd = dCoord(lastWP);
            appState.previewLine = L.polyline([
                [lastWPd.lat, lastWPd.lng],
                [latlng.lat, latlng.lng]
            ], {
                color: navMatch ? '#28a745' : '#0066cc',
                weight: navMatch ? 3 : 2,
                opacity: navMatch ? 0.85 : 0.5,
                dashArray: '5, 10',
                interactive: false,
                className: 'preview-line'
            }).addTo(appState.map);
            
            // Calculate preview info
            var distance = calculateDistance(lastWP.lat, lastWP.lng, realLatlng.lat, realLatlng.lng);
            var heading = calculateBearing(lastWP.lat, lastWP.lng, realLatlng.lat, realLatlng.lng);
            var timeHours = distance / appState.cruiseSpeed;
            var totalSeconds = Math.round(timeHours * 3600);
            var displayMins = Math.floor(totalSeconds / 60);
            var displaySecs = totalSeconds % 60;
            var timeStr = (displayMins < 10 ? '0' : '') + displayMins + ':' + (displaySecs < 10 ? '0' : '') + displaySecs;
            // Calculate midpoint for label using display coords
            var midLat = (lastWPd.lat + latlng.lat) / 2;
            var midLng = (lastWPd.lng + latlng.lng) / 2;
            
            // Offset perpendicular to line
            var perpHeading = (heading + 90) % 360;
            var currentZoom = appState.map.getZoom();
            var offsetDistance = 0.03 / Math.pow(2, currentZoom - 10);
            var offsetLat = midLat + offsetDistance * Math.cos(perpHeading * Math.PI / 180);
            var offsetLng = midLng + offsetDistance * Math.sin(perpHeading * Math.PI / 180);
            
            var scale = Math.pow(1.5, currentZoom - 12);
            
            var sm = appState.infoBoxSizeMultiplier || 1.0;
            var fm = appState.infoBoxFontMultiplier || 1.0;
            var triangleBase = 30 * scale * sm;
            var triangleHeight = 30 * scale * sm;
            var boxWidth = 60 * scale * sm;
            var fontSize = 11 * scale * fm;
            var headingFontSize = 13 * scale * fm;
            var iconSize = 80 * scale * sm;
            
            var legInfoHtml = '<div style="pointer-events: none; transform: rotate(' + heading + 'deg); transform-origin: center center;">' +
                '<div style="display: flex; flex-direction: column; align-items: center;">' +
                '<div style="width: 0; height: 0; border-left: ' + triangleBase + 'px solid transparent; border-right: ' + triangleBase + 'px solid transparent; border-bottom: ' + triangleHeight + 'px solid #dc3545; position: relative;">' +
                '<div style="position: absolute; top: ' + (8 * scale * sm) + 'px; left: 50%; transform: translateX(-50%); color: white; font-weight: bold; font-size: ' + headingFontSize + 'px; white-space: nowrap;">' + getMagHeading(heading) + '°</div>' +
                '</div>' +
                '<div style="background: rgba(255,255,255,' + appState.infoBoxOpacity + '); padding: ' + (3 * scale * sm) + 'px ' + (6 * scale * sm) + 'px; border: ' + (2 * scale * sm) + 'px solid ' + (navMatch ? '#28a745' : '#0066cc') + '; border-radius: ' + (4 * scale * sm) + 'px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); display:inline-block; text-align: center; opacity: 0.85;">' +
                (navMatch ? '<div style="color: #28a745; font-weight: bold; font-size: ' + (fontSize * 1.05) + 'px; border-bottom: 1px solid #28a745; padding-bottom: 2px; margin-bottom: 2px; white-space: nowrap;">📍 ' + navMatch.name + '</div>' : '') +
                '<div style="color: #333; font-weight: bold; font-size: ' + fontSize + 'px;">' + timeStr + '</div>' +
                (appState.debugMode ?
                    '<div style="border-top: 1px solid #0066cc; margin: ' + (2 * scale * sm) + 'px 0;"></div>' +
                    (appState.showLegDistance !== false ? '<div style="color: #666; font-size: ' + (fontSize * 0.85) + 'px;">' + distance.toFixed(1) + ' nm</div>' : '') +
                    '<div style="color: #666; font-size: ' + (fontSize * 0.85) + 'px;">From: ' + lastWP.lat.toFixed(4) + '°N ' + lastWP.lng.toFixed(4) + '°E</div>' +
                    '<div style="color: #666; font-size: ' + (fontSize * 0.85) + 'px;">To: ' + latlng.lat.toFixed(4) + '°N ' + latlng.lng.toFixed(4) + '°E</div>'
                : '') +
                '</div>' +
                '</div>' +
                '</div>';
            
            appState.previewLabel = L.marker([offsetLat, offsetLng], {
                interactive: false,
                icon: L.divIcon({
                    className: 'leg-info-label preview-leg-info-label',
                    html: legInfoHtml,
                    iconSize: [Math.round(triangleBase * 2), iconSize],
                    iconAnchor: [Math.round(triangleBase), iconSize/2]
                })
            }).addTo(appState.map);

            // Draw preview time tick markers (no circle exclusion while drawing)
            var totalMinutesExact = timeHours * 60;
            var totalMinutes = Math.floor(totalMinutesExact);
            var tickInterval = appState.tickInterval || 1;
            var labelInterval = appState.labelInterval || 1;
            for (var min = 1; min <= totalMinutes; min++) {
                if (min % tickInterval !== 0) continue;
                var fraction = min / totalMinutesExact;
                var tickLat = lastWPd.lat + (latlng.lat - lastWPd.lat) * fraction;
                var tickLng = lastWPd.lng + (latlng.lng - lastWPd.lng) * fraction;

                var showLabel = (min % labelInterval === 0);
                var labelHtml = showLabel
                    ? '<div style="pointer-events: none; transform: rotate(' + heading + 'deg); color: #0066cc; font-weight: bold; font-size: ' + appState.labelFontSize + 'px; text-shadow: 1px 1px 2px white, -1px -1px 2px white, 1px -1px 2px white, -1px 1px 2px white;">' + min + '</div>'
                    : '';

                var labelMarker = L.marker([tickLat, tickLng], {
                    interactive: false,
                    icon: L.divIcon({
                        className: 'time-label preview-time-marker',
                        html: labelHtml,
                        iconSize: [50, 20],
                        iconAnchor: [25, 10]
                    })
                }).addTo(appState.map);
                appState.previewTimeMarkers.push(labelMarker);

                var perpLat1 = tickLat + 0.005 * Math.cos((heading + 90) * Math.PI / 180);
                var perpLng1 = tickLng + 0.005 * Math.sin((heading + 90) * Math.PI / 180);
                var perpLat2 = tickLat - 0.005 * Math.cos((heading + 90) * Math.PI / 180);
                var perpLng2 = tickLng - 0.005 * Math.sin((heading + 90) * Math.PI / 180);

                var tickLine = L.polyline([[perpLat1, perpLng1], [perpLat2, perpLng2]], {
                    color: '#0066cc',
                    weight: appState.lineWidth,
                    opacity: 0.5,
                    interactive: false,
                    className: 'preview-line'
                }).addTo(appState.map);
                appState.previewTimeMarkers.push(tickLine);
            }
        }
        

        function addWaypointByCoordinates() {
            var coordStr = prompt('Enter coordinates in format:\n31°57\'59.1"N 34°45\'12.4"E\n\nOr decimal format:\n31.9664 34.7534');
            if (!coordStr) return;
            
            var coords = parseCoordinates(coordStr);
            if (coords) {
                addWaypoint(coords.lat, coords.lng);
                appState.map.setView([coords.lat, coords.lng], appState.map.getZoom());
            } else {
                alert('Invalid coordinate format. Please use:\n31°57\'59.1"N 34°45\'12.4"E\nor\n31.9664 34.7534');
            }
        }
        
        function parseCoordinates(str) {
            str = str.trim();
            
            // Try DMS format: 31°57'59.1"N 34°45'12.4"E
            var dmsPattern = /(\d+)°(\d+)'([\d.]+)"([NS])\s+(\d+)°(\d+)'([\d.]+)"([EW])/;
            var dmsMatch = str.match(dmsPattern);
            
            if (dmsMatch) {
                var latDeg = parseInt(dmsMatch[1]);
                var latMin = parseInt(dmsMatch[2]);
                var latSec = parseFloat(dmsMatch[3]);
                var latDir = dmsMatch[4];
                
                var lngDeg = parseInt(dmsMatch[5]);
                var lngMin = parseInt(dmsMatch[6]);
                var lngSec = parseFloat(dmsMatch[7]);
                var lngDir = dmsMatch[8];
                
                var lat = latDeg + latMin/60 + latSec/3600;
                if (latDir === 'S') lat = -lat;
                
                var lng = lngDeg + lngMin/60 + lngSec/3600;
                if (lngDir === 'W') lng = -lng;
                
                return { lat: lat, lng: lng };
            }
            
            // Try decimal format: 31.9664 34.7534 or 31.9664, 34.7534
            var decPattern = /([-\d.]+)[\s,]+([-\d.]+)/;
            var decMatch = str.match(decPattern);
            
            if (decMatch) {
                var lat = parseFloat(decMatch[1]);
                var lng = parseFloat(decMatch[2]);
                
                if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                    return { lat: lat, lng: lng };
                }
            }
            
            return null;
        }
        
        function addWaypoint(lat, lng, name) {
            var waypointNum = appState.waypoints.length + 1;

            // For chart maps with calibration, store display coords separately
            var displayLat = lat, displayLng = lng;
            if (typeof toDisplayLatLng === 'function') {
                var disp = toDisplayLatLng(L.latLng(lat, lng));
                displayLat = disp.lat;
                displayLng = disp.lng;
            }

            appState.waypoints.push({
                lat: lat,
                lng: lng,
                displayLat: displayLat,
                displayLng: displayLng,
                num: waypointNum,
                name: name || ('WP' + waypointNum)
            });
            
            // Calculate tile coordinates for debugging
            var zoom13_tile = latLonToTile(lat, lng, 13);
            
            var circleRadius = appState.circleRadius > 0 ? appState.circleRadius : 0.3;
            var radiusMeters = circleRadius * 1852;
            
            var circle = L.circle([displayLat, displayLng], {
                color: '#0066cc',
                fillColor: '#0066cc',
                fillOpacity: appState.circleOpacity !== undefined ? appState.circleOpacity : 0.2,
                radius: radiusMeters,
                weight: 3,
                draggable: true
            }).addTo(appState.map);
            
            var _circleDragged = false;

            circle.on('drag', function(e) {
                _circleDragged = true;
                var newPos = e.target.getLatLng();
                var idx = appState.circles.indexOf(circle);
                if (idx >= 0 && idx < appState.waypoints.length) {
                    // newPos is in display coords; convert to real coords
                    var realPos = calibrateDisplayToReal(newPos);
                    appState.waypoints[idx].lat = realPos.lat;
                    appState.waypoints[idx].lng = realPos.lng;
                    appState.waypoints[idx].displayLat = newPos.lat;
                    appState.waypoints[idx].displayLng = newPos.lng;
                    updateRoute();
                    updateWaypointsList();
                    updateStats();
                }
            });
            
            circle.on('mousedown touchstart', function() {
                _circleDragged = false;
                appState.map.dragging.disable();
                appState.map.on('mousemove touchmove', moveHandler);
                appState.map.on('mouseup touchend', upHandler);
            });
            
            function moveHandler(e) {
                _circleDragged = true;
                var latlng = e.latlng;
                circle.setLatLng(latlng);
                var idx = appState.circles.indexOf(circle);
                if (idx >= 0) {
                    // latlng is display coords; convert to real coords
                    var realPos = calibrateDisplayToReal(latlng);
                    appState.waypoints[idx].lat = realPos.lat;
                    appState.waypoints[idx].lng = realPos.lng;
                    appState.waypoints[idx].displayLat = latlng.lat;
                    appState.waypoints[idx].displayLng = latlng.lng;
                    updateRoute();
                }
            }
            
            function upHandler() {
                appState.map.dragging.enable();
                appState.map.off('mousemove touchmove', moveHandler);
                appState.map.off('mouseup touchend', upHandler);
                updateWaypointsList();
                updateStats();
            }
            
            circle.on('click', function(e) {
                L.DomEvent.stopPropagation(e);
                if (_circleDragged) { _circleDragged = false; return; }
                var idx = appState.circles.indexOf(circle);
                if (idx >= 0) openWaypointPopup(idx, circle.getLatLng());
            });

            circle.on('mouseup', function() {
                // Reset drag flag after click event has fired
                setTimeout(function() { _circleDragged = false; }, 10);
            });
            
            appState.circles.push(circle);
            
            updateRoute();
            updateWaypointsList();
            updateStats();
            setTimeout(refreshLSARotation, 100);
        }
        
        function updateLegAltitude(legIndex, newAlt) {
            var alt = parseInt(newAlt);
            if (!isNaN(alt) && alt >= 0 && alt <= 50000) {
                appState.legAltitudes[legIndex] = alt;
                updateRoute();
            }
        }

        function getLegAltitude(legIndex) {
            return appState.legAltitudes[legIndex] !== undefined ? appState.legAltitudes[legIndex] : appState.defaultAltitude;
        }

        function openWaypointPopup(idx, latlng) {
            var wp = appState.waypoints[idx];
            if (!wp) return;
            latlng = latlng || appState.map.latLngToLayerPoint ? appState.circles[idx] && appState.circles[idx].getLatLng() : appState.map.getCenter();
            var curStyle = appState.waypointLabelStyles[wp.num] || { textColor: '#0066cc', fillColor: 'white' };
            var noFill = (curStyle.fillColor === 'transparent' || curStyle.fillColor === 'none' || curStyle.fillColor === '');
            var fillHex = noFill ? '#ffffff' : colorToHex(curStyle.fillColor);

            var popupHtml =
                '<div style="min-width:220px;font-family:inherit;">' +
                    '<div style="font-weight:700;color:#0066cc;margin-bottom:4px;font-size:13px;">Waypoint ' + wp.num + '</div>' +
                    '<div style="font-size:11px;color:#666;margin-bottom:8px;">' + wp.lat.toFixed(5) + '°N,&nbsp;' + wp.lng.toFixed(5) + '°E</div>' +
                    '<label style="font-size:11px;color:#555;display:block;margin-bottom:2px;">Name</label>' +
                    '<input id="wp-name-input-' + idx + '" type="text" value="' + wp.name.replace(/"/g,'&quot;') + '" ' +
                        'style="width:100%;padding:4px 6px;border:1px solid #0066cc;border-radius:4px;font-size:13px;font-weight:600;color:#0066cc;box-sizing:border-box;margin-bottom:8px;">' +
                    '<label style="font-size:11px;color:#555;display:block;margin-bottom:2px;">Label text color</label>' +
                    buildColorSwatches('wp-color-input-' + idx, curStyle.textColor) +
                    '<label style="font-size:11px;color:#555;display:flex;align-items:center;gap:5px;margin:8px 0 4px;cursor:pointer;">' +
                        '<input id="wp-nofill-input-' + idx + '" type="checkbox"' + (noFill ? ' checked' : '') +
                            ' onchange="var w=document.getElementById(\'wp-fill-swatches-' + idx + '\');w.style.opacity=this.checked?\'0.35\':\'1\';w.style.pointerEvents=this.checked?\'none\':\'auto\'">' +

                        'No fill (transparent)' +
                    '</label>' +
                    '<div id="wp-fill-swatches-' + idx + '" style="' + (noFill ? 'opacity:0.35;pointer-events:none;' : '') + '">' +
                        '<label style="font-size:11px;color:#555;display:block;margin-bottom:2px;">Label fill color</label>' +
                        buildColorSwatches('wp-fill-input-' + idx, fillHex) +
                    '</div>' +
                    '<div style="display:flex;gap:16px;margin-top:8px;margin-bottom:2px;">' +
                        '<label style="display:flex;align-items:center;gap:5px;font-size:11px;color:#555;cursor:pointer;">' +
                            '<input type="checkbox" id="wp-show-name-' + idx + '"' + (curStyle.showName !== false ? ' checked' : '') + '> Show name</label>' +
                        '<label style="display:flex;align-items:center;gap:5px;font-size:11px;color:#555;cursor:pointer;">' +
                            '<input type="checkbox" id="wp-show-time-' + idx + '"' + (curStyle.showTime !== false ? ' checked' : '') + '> Show time</label>' +
                    '</div>' +
                    '<div style="display:flex;gap:6px;margin-top:10px;">' +
                        '<button id="wp-save-btn-' + idx + '" style="flex:1;padding:5px;background:#0066cc;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;">Save</button>' +
                        '<button id="wp-mini-btn-' + idx + '" style="flex:1;padding:5px;background:' + (appState.miniWaypoints[wp.num] ? '#ff8c00' : '#6c757d') + ';color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;">' + (appState.miniWaypoints[wp.num] ? '★ Mini WP' : '☆ Mini WP') + '</button>' +
                    '<button id="wp-delete-btn-' + idx + '" style="flex:1;padding:5px;background:#dc3545;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;">Delete</button>' +
                    '</div>' +
                '</div>';

            L.popup({ closeButton: true, autoClose: true, offset: [0, -10] })
                .setLatLng(latlng)
                .setContent(popupHtml)
                .openOn(appState.map);

            setTimeout(function() {
                var inp = document.getElementById('wp-name-input-' + idx);
                if (!inp) return;
                inp.focus(); inp.select();

                function saveWp() {
                    var newName = (document.getElementById('wp-name-input-' + idx).value || '').trim();
                    if (!newName) return;
                    var colorInp = document.getElementById('wp-color-input-' + idx);
                    var newTextColor = (colorInp && colorInp.value) ? colorInp.value : '#0066cc';
                    var noFillNow = document.getElementById('wp-nofill-input-' + idx).checked;
                    var fillInp = document.getElementById('wp-fill-input-' + idx);
                    var newFillColor = noFillNow ? 'transparent' : ((fillInp && fillInp.value) ? fillInp.value : 'white');
                    var existingStyle = appState.waypointLabelStyles[wp.num] || {};
                    var showNameCb = document.getElementById('wp-show-name-' + idx);
                    var showTimeCb = document.getElementById('wp-show-time-' + idx);
                    appState.waypointLabelStyles[wp.num] = Object.assign({}, existingStyle, {
                        textColor: newTextColor,
                        fillColor: newFillColor,
                        showName: showNameCb ? showNameCb.checked : true,
                        showTime: showTimeCb ? showTimeCb.checked : true
                    });
                    appState.map.closePopup();
                    if (newName !== wp.name) {
                        renameWaypoint(idx, newName);
                    } else {
                        updateWaypointLabelMarker(idx);
                    }
                }

                document.getElementById('wp-save-btn-' + idx).onclick = saveWp;
                var miniBtn = document.getElementById('wp-mini-btn-' + idx);
                if (miniBtn) miniBtn.onclick = function() {
                    var isFirst = (idx === 0);
                    var isLast  = (idx === appState.waypoints.length - 1);
                    if (isFirst || isLast) {
                        alert('First and last waypoints cannot be mini waypoints.');
                        return;
                    }
                    appState.miniWaypoints[wp.num] = !appState.miniWaypoints[wp.num];
                    // Keep saved positions — box stays in place, only content changes
                    appState.map.closePopup();
                    updateLegLabelContent();
                    updateWaypointsList();
                };
                document.getElementById('wp-delete-btn-' + idx).onclick = function() {
                    appState.map.closePopup();
                    deleteWaypoint(idx);
                };
                var keyHandler = function(ev) {
                    if (ev.key === 'Enter')  { ev.preventDefault(); saveWp(); }
                    if (ev.key === 'Escape') { ev.preventDefault(); appState.map.closePopup(); }
                };
                document.addEventListener('keydown', keyHandler);
                appState.map.once('popupclose', function() {
                    document.removeEventListener('keydown', keyHandler);
                });
            }, 50);
        }

                function createWaypointLabelMarker(wp, heading, timeStr) {
            heading = heading || 0;
            var wpDisp = dCoord(wp);
            var offset = appState.waypointLabelOffsets[wp.num] || { x: 6, y: -18 };
            var style  = appState.waypointLabelStyles[wp.num]  || { textColor: '#0066cc', fillColor: 'white' };
            var rot    = heading + (style.rotationDelta !== undefined ? style.rotationDelta : 0);

            // Use L.Marker with a divIcon — markers live in markerPane which
            // Leaflet CSS-transforms during zoom, giving smooth animation for free
            var isTransparent = !style.fillColor || style.fillColor === 'transparent' || style.fillColor === 'none';
            var wlScale = getTextBoxScale();
            var nameFontSize = Math.round((appState.waypointLabelFontSize || 11) * wlScale);
            var timeFontSize = Math.round((appState.arrivalLabelFontSize || 9) * wlScale);
            var pad = Math.round(2 * wlScale) + 'px ' + Math.round(6 * wlScale) + 'px';
            var border = Math.max(1, Math.round(1.5 * wlScale));
            var bg = isTransparent ? 'transparent' : style.fillColor;
            var shadow = isTransparent ? '' : 'box-shadow:0 1px 3px rgba(0,0,0,0.25);';

            var isMiniWp = !!appState.miniWaypoints[wp.num];
            var showName = style.showName !== false;
            var showTime = style.showTime !== false;
            var isVisible = appState.waypointLabelsVisible !== false;
            var visStyle = isVisible ? '' : 'visibility:hidden;';
            var innerHtml =
                '<div style="display:inline-block;' + visStyle + 'background:' + bg + ';' + shadow +
                'border:' + border + 'px solid ' + style.textColor + ';border-radius:3px;padding:' + pad + ';' +
                'color:' + style.textColor + ';white-space:nowrap;cursor:move;text-align:center;' +
                'transform:rotate(' + rot + 'deg);transform-origin:center center;box-sizing:border-box;' +
                (isMiniWp ? 'opacity:' + (appState.miniWpLabelOpacity !== undefined ? appState.miniWpLabelOpacity : 0.70) + ';' : '') + '">' +
                (showName ? '<div style="font-size:' + nameFontSize + 'px;font-weight:700;">' + wp.name + '</div>' : '') +
                (showTime && timeStr && appState.legTimeVisible !== false ? '<div style="font-size:' + timeFontSize + 'px;font-weight:600;opacity:0.8;margin-top:1px;">' + timeStr + '</div>' : '') +
                '</div>';

            // Compute anchor: center of label at offset from waypoint
            var rad = heading * Math.PI / 180;
            var ox = offset.x * wlScale * Math.cos(rad) - offset.y * wlScale * Math.sin(rad);
            var oy = offset.x * wlScale * Math.sin(rad) + offset.y * wlScale * Math.cos(rad);

            // iconAnchor = negative of offset so marker is placed at (ox,oy) from wp
            // We set anchor to center of icon (iconSize/2) minus the desired pixel offset
            var iconW = 120, iconH = 40;
            var marker = L.marker([wpDisp.lat, wpDisp.lng], {
                icon: L.divIcon({
                    className: 'wl-div',
                    html: innerHtml,
                    iconSize: null,
                    iconAnchor: [-ox, -oy]
                }),
                interactive: true,
                keyboard: false,
                zIndexOffset: -100
            }).addTo(appState.map);

            marker._setVisibility = function(visible) {
                var el = marker.getElement();
                if (el) el.style.visibility = visible ? 'visible' : 'hidden';
            };
            if (!isVisible) {
                marker._setVisibility(false);
                marker.on('add', function() {
                    marker._setVisibility(false);
                });
            }

            // Click on marker icon = select; dblclick = popup
            // Selection overlay div (bbox + rotation handle), shown on single click
            var selDiv = null;
            function showSelection() {
                hideSelection();
                var el = marker.getElement();
                if (!el) return;
                var inner = el.querySelector('div');
                if (!inner) return;
                var r = inner.getBoundingClientRect();
                var currentRot = rot; // rot already includes rotationDelta
                selDiv = document.createElement('div');
                selDiv.style.cssText = 'position:fixed;pointer-events:none;z-index:9000;' +
                    'left:' + r.left + 'px;top:' + r.top + 'px;' +
                    'width:' + r.width + 'px;height:' + r.height + 'px;' +
                    'transform:rotate(' + currentRot + 'deg);transform-origin:center center;';
                var bbox = document.createElement('div');
                bbox.style.cssText = 'position:absolute;inset:-3px;border:1.5px dashed #0066cc;border-radius:2px;box-sizing:border-box;';
                var handle = document.createElement('div');
                handle.style.cssText = 'position:absolute;bottom:-10px;right:-10px;' +
                    'width:14px;height:14px;background:#0066cc;border:2px solid white;' +
                    'border-radius:50%;cursor:grab;pointer-events:auto;box-shadow:0 1px 3px rgba(0,0,0,0.5);';
                handle.title = 'Drag to rotate';
                selDiv.appendChild(bbox);
                selDiv.appendChild(handle);
                document.body.appendChild(selDiv);

                // Rotation drag on handle
                handle.addEventListener('mousedown', function(ev) {
                    if (ev.button !== 0) return;
                    ev.stopPropagation(); ev.preventDefault();
                    appState.map.dragging.disable();
                    var cx = r.left + r.width/2, cy = r.top + r.height/2;
                    var startAngle = Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI;
                    var sty = appState.waypointLabelStyles[wp.num] || {};
                    var baseRot = rot; // rot = heading + rotationDelta
                    function mmR(mev) {
                        var angle = Math.atan2(mev.clientY - cy, mev.clientX - cx) * 180 / Math.PI;
                        rot = Math.round(baseRot + angle - startAngle);
                        appState.waypointLabelStyles[wp.num] = Object.assign({}, sty, { rotationDelta: rot - heading });
                        if (selDiv) selDiv.style.transform = 'rotate(' + rot + 'deg)';
                        // Update the inner div transform directly for live preview
                        var el = marker.getElement();
                        if (el) { var inner = el.querySelector('div > div'); if (inner) inner.style.transform = 'rotate(' + rot + 'deg)'; }
                    }
                    function muR() {
                        document.removeEventListener('mousemove', mmR);
                        document.removeEventListener('mouseup', muR);
                        appState.map.dragging.enable();
                        // Rebuild marker to apply rotation properly
                        updateWaypointLabelMarker(appState.waypoints.indexOf(wp));
                    }
                    document.addEventListener('mousemove', mmR);
                    document.addEventListener('mouseup', muR);
                });
            }
            function hideSelection() {
                if (selDiv && selDiv.parentNode) selDiv.parentNode.removeChild(selDiv);
                selDiv = null;
            }

            marker.on('click', function(e) {
                L.DomEvent.stopPropagation(e);
                showSelection();
                // Hide selection when clicking elsewhere
                setTimeout(function() {
                    appState.map.once('click', hideSelection);
                }, 10);
            });
            marker.on('dblclick', function(e) {
                L.DomEvent.stopPropagation(e);
                hideSelection();
                var idx = appState.waypoints.indexOf(wp);
                if (idx >= 0) {
                    var circleLL = appState.circles[idx] ? appState.circles[idx].getLatLng() : L.latLng(wpDisp.lat, wpDisp.lng);
                    openWaypointPopup(idx, circleLL);
                }
            });

            // Drag to reposition offset
            var isDragging = false;
            marker.on('mousedown', function(e) {
                if (e.originalEvent.button !== 0) return;
                L.DomEvent.stopPropagation(e);
                appState.map.dragging.disable();
                var sx = e.originalEvent.clientX, sy = e.originalEvent.clientY;
                var startOff = { x: offset.x, y: offset.y };
                var moved = false;
                function mm(mev) {
                    var dx = mev.clientX - sx, dy = mev.clientY - sy;
                    if (Math.sqrt(dx*dx+dy*dy) > 3) { moved = true; isDragging = true; }
                    var r = -heading * Math.PI / 180, sc = getTextBoxScale();
                    offset = {
                        x: startOff.x + (dx * Math.cos(r) - dy * Math.sin(r)) / sc,
                        y: startOff.y + (dx * Math.sin(r) + dy * Math.cos(r)) / sc
                    };
                    appState.waypointLabelOffsets[wp.num] = offset;
                    // Update iconAnchor
                    var sc2 = getTextBoxScale(), rr = heading * Math.PI / 180;
                    var nx = offset.x * sc2 * Math.cos(rr) - offset.y * sc2 * Math.sin(rr);
                    var ny = offset.x * sc2 * Math.sin(rr) + offset.y * sc2 * Math.cos(rr);
                    var el = marker.getElement();
                    if (el) { el.style.marginLeft = nx + 'px'; el.style.marginTop = ny + 'px'; }
                }
                function mu() {
                    document.removeEventListener('mousemove', mm);
                    document.removeEventListener('mouseup', mu);
                    appState.map.dragging.enable();
                    setTimeout(function() { isDragging = false; }, 10);
                }
                document.addEventListener('mousemove', mm);
                document.addEventListener('mouseup', mu);
            });

            var pseudoLabel = {
                _marker: marker,
                getLatLng: function() { return marker.getLatLng(); },
                getElement: function() { return marker.getElement(); },
                remove: function() { hideSelection(); appState.map.removeLayer(marker); },
                removeFrom: function() { this.remove(); },
                _setVisibility: function(v) {
                    var el = marker.getElement();
                    if (el) el.style.visibility = v ? 'visible' : 'hidden';
                }
            };
            return pseudoLabel;
        }

        function toggleWaypointLabels() {
            appState.waypointLabelsVisible = !appState.waypointLabelsVisible;
            var btn = document.getElementById('waypointLabelsToggleBtn');
            var vis = appState.waypointLabelsVisible ? 'visible' : 'hidden';
            if (document.body) {
                document.body.classList.toggle('waypoint-labels-hidden', !appState.waypointLabelsVisible);
            }
            // Use setTimeout to ensure Leaflet DOM elements exist
            setTimeout(function() {
                appState.waypointLabels.forEach(function(lbl) {
                    if (!lbl) return;
                    if (lbl._setVisibility) { lbl._setVisibility(appState.waypointLabelsVisible); return; }
                    var el = lbl.getElement();
                    if (el) el.style.visibility = vis;
                });
            }, 0);
            if (btn) {
                if (appState.waypointLabelsVisible) {
                    btn.textContent = 'Hide WP Labels';
                    btn.classList.remove('btn-primary');
                    btn.classList.add('btn-secondary');
                } else {
                    btn.textContent = 'Show WP Labels';
                    btn.classList.remove('btn-secondary');
                    btn.classList.add('btn-primary');
                }
            }
        }

        function toggleLegTime() {
            appState.legTimeVisible = !appState.legTimeVisible;
            var btn = document.getElementById('legTimeToggleBtn');
            if (btn) {
                btn.textContent = appState.legTimeVisible ? 'Hide Leg Time' : 'Show Leg Time';
                btn.className = appState.legTimeVisible ? 'btn-primary' : 'btn-secondary';
            }
            updateRoute();
        }

        function updateLegLabelContent() {
            if (!appState.legLabels || !appState.legLabels.length) { updateRoute(); return; }
            // Save ALL current marker positions so zoom/updateRoute recreates them in the same place
            appState.legLabels.forEach(function(label, i) {
                if (!label || !label.getLatLng) return;
                var key = (appState.waypoints[i] && appState.waypoints[i+1]) ? appState.waypoints[i].num + '_' + appState.waypoints[i+1].num : 'leg_' + i;
                var pos = label.getLatLng();
                var realPos = calibrateDisplayToReal(pos);
                appState.legLabelDraggedPositions[key] = { lat: realPos.lat, lng: realPos.lng };
            });
            // Update circle styles for mini WPs
            appState.waypoints.forEach(function(wp, idx) {
                var circle = appState.circles[idx];
                if (circle) circle.setStyle({ dashArray: appState.miniWaypoints[wp.num] ? '6 5' : null });
            });

            // Rebuild WP labels (for accumulated time display)
            if (appState.waypointLabels) {
                appState.waypointLabels.forEach(function(lbl) { if (lbl && lbl.remove) lbl.remove(); else if (lbl) appState.map.removeLayer(lbl); });
            }
            appState.waypointLabels = [];
            var _wpTimeMap = {};
            for (var _ti = 0; _ti < appState.waypoints.length - 1; _ti++) {
                var _twp1 = appState.waypoints[_ti], _twp2 = appState.waypoints[_ti+1];
                var _tTotalSecs = Math.round(calculateDistance(_twp1.lat,_twp1.lng,_twp2.lat,_twp2.lng) / appState.cruiseSpeed * 3600);
                if (appState.miniWaypoints[_twp1.num]) {
                    var _accumSecs = _tTotalSecs, _fi = _ti - 1;
                    while (_fi >= 0 && appState.miniWaypoints[appState.waypoints[_fi].num]) {
                        _accumSecs += Math.round(calculateDistance(appState.waypoints[_fi].lat,appState.waypoints[_fi].lng,appState.waypoints[_fi+1].lat,appState.waypoints[_fi+1].lng) / appState.cruiseSpeed * 3600);
                        _fi--;
                    }
                    if (_fi >= 0) _accumSecs += Math.round(calculateDistance(appState.waypoints[_fi].lat,appState.waypoints[_fi].lng,appState.waypoints[_fi+1].lat,appState.waypoints[_fi+1].lng) / appState.cruiseSpeed * 3600);
                    var _m = Math.floor(_accumSecs/60), _s = _accumSecs%60;
                    _wpTimeMap[_ti+1] = (_m<10?'0':'')+_m+':'+(_s<10?'0':'')+_s;
                } else {
                    var _m = Math.floor(_tTotalSecs/60), _s = _tTotalSecs%60;
                    _wpTimeMap[_ti+1] = (_m<10?'0':'')+_m+':'+(_s<10?'0':'')+_s;
                }
            }
            appState.waypoints.forEach(function(wp, idx) {
                var heading = 0;
                if (appState.waypoints.length > 1) {
                    if (idx > 0) heading = calculateBearing(appState.waypoints[idx-1].lat, appState.waypoints[idx-1].lng, wp.lat, wp.lng);
                    else heading = calculateBearing(wp.lat, wp.lng, appState.waypoints[1].lat, appState.waypoints[1].lng);
                }
                appState.waypointLabels.push(createWaypointLabelMarker(wp, heading, _wpTimeMap[idx] || ''));
            });

            // Rebuild time markers (for accumulated minute display)
            if (appState.timeMarkers) {
                appState.timeMarkers.forEach(function(m) { if (m.remove) m.remove(); else appState.map.removeLayer(m); });
            }
            appState.timeMarkers = [];
            var tickInterval = appState.tickInterval || 1;
            var labelInterval = appState.labelInterval || 1;
            var radiusNm = appState.circleRadius;
            for (var i = 0; i < appState.waypoints.length - 1; i++) {
                var wp1 = appState.waypoints[i], wp2 = appState.waypoints[i+1];
                var d1 = dCoord(wp1), d2 = dCoord(wp2);
                var heading = calculateBearing(wp1.lat, wp1.lng, wp2.lat, wp2.lng);
                var timeHours = calculateDistance(wp1.lat, wp1.lng, wp2.lat, wp2.lng) / appState.cruiseSpeed;
                var totalMinutesExact = timeHours * 60;
                var totalMinutesForMarkers = Math.floor(totalMinutesExact);

                // Compute accumulated offset for this leg
                var accumMinOffset = 0;
                if (appState.miniWaypoints[wp1.num]) {
                    var _gi = i - 1;
                    while (_gi >= 0 && appState.miniWaypoints[appState.waypoints[_gi].num]) {
                        accumMinOffset += calculateDistance(appState.waypoints[_gi].lat,appState.waypoints[_gi].lng,appState.waypoints[_gi+1].lat,appState.waypoints[_gi+1].lng) / appState.cruiseSpeed * 60;
                        _gi--;
                    }
                    if (_gi >= 0) accumMinOffset += calculateDistance(appState.waypoints[_gi].lat,appState.waypoints[_gi].lng,appState.waypoints[_gi+1].lat,appState.waypoints[_gi+1].lng) / appState.cruiseSpeed * 60;
                }

                for (var min = 1; min <= totalMinutesForMarkers; min++) {
                    if (min % tickInterval !== 0) continue;
                    var fraction = min / totalMinutesExact;
                    var lat = d1.lat + (d2.lat - d1.lat) * fraction;
                    var lng = d1.lng + (d2.lng - d1.lng) * fraction;
                    if (radiusNm > 0) {
                        var rLat = wp1.lat + (wp2.lat-wp1.lat)*fraction, rLng = wp1.lng + (wp2.lng-wp1.lng)*fraction;
                        if (calculateDistance(wp1.lat,wp1.lng,rLat,rLng) < radiusNm || calculateDistance(wp2.lat,wp2.lng,rLat,rLng) < radiusNm) continue;
                    }
                    var displayMin = Math.round(accumMinOffset + min);
                    var showLabel = (min % labelInterval === 0);
                    var labelHtml = showLabel ? '<div style="transform:rotate('+heading+'deg);color:#0066cc;font-weight:bold;font-size:'+appState.labelFontSize+'px;text-shadow:1px 1px 2px white,-1px -1px 2px white,1px -1px 2px white,-1px 1px 2px white;">'+displayMin+'</div>' : '';
                    var lm = L.marker([lat,lng], { icon: L.divIcon({ className:'time-label', html:labelHtml, iconSize:[50,20], iconAnchor:[25,10] }) }).addTo(appState.map);
                    appState.timeMarkers.push(lm);

                    var perpH = (heading+90)%360;
                    var perpLat1 = lat+0.005*Math.cos(perpH*Math.PI/180), perpLng1 = lng+0.005*Math.sin(perpH*Math.PI/180);
                    var perpLat2 = lat-0.005*Math.cos(perpH*Math.PI/180), perpLng2 = lng-0.005*Math.sin(perpH*Math.PI/180);
                    appState.timeMarkers.push(L.polyline([[perpLat1,perpLng1],[perpLat2,perpLng2]],{color:'#0066cc',weight:appState.lineWidth,opacity:0.7}).addTo(appState.map));
                }
            }

            var wps = appState.waypoints;
            for (var i = 0; i < wps.length - 1; i++) {
                var label = appState.legLabels[i];
                if (!label) continue;
                var el = label.getElement ? label.getElement() : null;
                if (!el) continue;

                var wp1 = wps[i], wp2 = wps[i+1];
                var isMiniLeg = !!appState.miniWaypoints[wp1.num];
                var heading = calculateBearing(wp1.lat, wp1.lng, wp2.lat, wp2.lng);
                var distance = calculateDistance(wp1.lat, wp1.lng, wp2.lat, wp2.lng);
                var altitude = getLegAltitude(i);
                var timeHours = distance / appState.cruiseSpeed;
                var totalSeconds = Math.round(timeHours * 3600);

                // Accumulate time
                if (!isMiniLeg) {
                    var j = i + 1;
                    while (j < wps.length - 1 && appState.miniWaypoints[wps[j].num]) {
                        totalSeconds += Math.round(calculateDistance(wps[j].lat, wps[j].lng, wps[j+1].lat, wps[j+1].lng) / appState.cruiseSpeed * 3600);
                        j++;
                    }
                }
                var dm = Math.floor(totalSeconds/60), ds = totalSeconds%60;
                var timeStr = (dm<10?'0':'')+dm+':'+(ds<10?'0':'')+ds;

                var scale = Math.pow(1.5, appState.map.getZoom() - 12);
                var sm = appState.infoBoxSizeMultiplier || 1.0;
                var fm = appState.infoBoxFontMultiplier || 1.0;
                var triangleBase = 30*scale*sm, triangleHeight = 30*scale*sm;
                var fontSize = 11*scale*fm, headingFontSize = 13*scale*fm;
                var groupHeading = isMiniLeg ? heading : heading;

                var newHtml;
                if (isMiniLeg) {
                    newHtml =
                        '<div style="transform:rotate('+heading+'deg);transform-origin:center center;display:inline-flex;flex-direction:column;align-items:center;">' +
                        '<div style="width:0;height:0;border-left:'+triangleBase+'px solid transparent;border-right:'+triangleBase+'px solid transparent;border-bottom:'+triangleHeight+'px solid #dc3545;position:relative;">' +
                        '<div style="position:absolute;top:'+(8*scale*sm)+'px;left:50%;transform:translateX(-50%);color:white;font-weight:bold;font-size:'+headingFontSize+'px;white-space:nowrap;">'+getMagHeading(heading)+'°</div>' +
                        '</div>' +
                        '<div style="background:rgba(255,255,255,'+appState.infoBoxOpacity+');padding:'+(2*scale*sm)+'px 0;border:'+(2*scale*sm)+'px solid #dc3545;border-radius:'+(4*scale*sm)+'px;box-shadow:0 2px 4px rgba(0,0,0,0.2);width:'+Math.round(triangleBase*2)+'px;box-sizing:border-box;text-align:center;overflow:hidden;cursor:pointer;" title="Click to edit altitude">' +
                        '<div class="leg-altitude-display" style="color:#333;font-weight:bold;font-size:'+fontSize+'px;">'+altitude+'</div>' +
                        '</div></div>';
                } else {
                    newHtml =
                        '<div style="transform:rotate('+heading+'deg);transform-origin:center center;">' +
                        '<div style="display:flex;flex-direction:column;align-items:center;">' +
                        '<div style="width:0;height:0;border-left:'+triangleBase+'px solid transparent;border-right:'+triangleBase+'px solid transparent;border-bottom:'+triangleHeight+'px solid #dc3545;position:relative;">' +
                        '<div style="position:absolute;top:'+(8*scale*sm)+'px;left:50%;transform:translateX(-50%);color:white;font-weight:bold;font-size:'+headingFontSize+'px;white-space:nowrap;">'+getMagHeading(heading)+'°</div>' +
                        '</div>' +
                        '<div style="background:rgba(255,255,255,'+appState.infoBoxOpacity+');padding:'+(2*scale*sm)+'px 0;border:'+(2*scale*sm)+'px solid #0066cc;border-radius:'+(4*scale*sm)+'px;box-shadow:0 2px 4px rgba(0,0,0,0.2);width:'+Math.round(triangleBase*2)+'px;box-sizing:border-box;text-align:center;overflow:hidden;cursor:pointer;" title="Click to edit altitude">' +
                        '<div style="color:#333;font-weight:bold;font-size:'+fontSize+'px;">'+timeStr+'</div>' +
                        '<div style="border-top:1px solid #0066cc;margin:'+(2*scale*sm)+'px 0;"></div>' +
                        '<div class="leg-altitude-display" style="color:#333;font-weight:bold;font-size:'+fontSize+'px;">'+altitude+'</div>' +
                        (appState.showLegDistance !== false ? '<div style="border-top:1px solid #0066cc;margin:'+(4*scale*sm)+'px 0;"></div><div style="color:#333;font-weight:bold;font-size:'+fontSize+'px;">'+distance.toFixed(1)+'</div>' : '') +
                        '</div></div></div>';
                }
                el.innerHTML = newHtml;
            }
        }

        function toggleLegDistance() {
            appState.showLegDistance = !appState.showLegDistance;
            var btn = document.getElementById('legDistanceToggleBtn');
            if (btn) {
                btn.textContent = appState.showLegDistance ? 'Hide Distance (NM)' : 'Show Distance (NM)';
                btn.className = appState.showLegDistance ? 'btn-primary' : 'btn-secondary';
            }
            updateRoute();
        }

        function toggleDriftLines() {
            appState.driftLinesVisible = !appState.driftLinesVisible;
            var btn = document.getElementById('driftLinesToggleBtn');
            appState.driftLines.forEach(function(l) {
                if (appState.driftLinesVisible) {
                    l.addTo(appState.map);
                } else {
                    appState.map.removeLayer(l);
                }
            });
            if (btn) {
                if (appState.driftLinesVisible) {
                    btn.textContent = 'Hide Drift Lines';
                    btn.classList.remove('btn-secondary');
                    btn.classList.add('btn-primary');
                } else {
                    btn.textContent = 'Show Drift Lines';
                    btn.classList.remove('btn-primary');
                    btn.classList.add('btn-secondary');
                }
            }
        }

        function updateWaypointLabelMarker(idx) {
            if (appState.waypointLabels[idx]) {
                var _wl = appState.waypointLabels[idx]; if (_wl) { if (_wl.remove) _wl.remove(); else appState.map.removeLayer(_wl); }
            }
            var wp = appState.waypoints[idx];
            var heading = 0;
            if (appState.waypoints.length > 1) {
                if (idx > 0) {
                    var prev = appState.waypoints[idx - 1];
                    heading = calculateBearing(prev.lat, prev.lng, wp.lat, wp.lng);
                } else {
                    var next = appState.waypoints[idx + 1];
                    heading = calculateBearing(wp.lat, wp.lng, next.lat, next.lng);
                }
            }
            var timeStr = '';
            if (idx > 0) {
                var twp1 = appState.waypoints[idx-1], twp2 = wp;
                var tdist = calculateDistance(twp1.lat, twp1.lng, twp2.lat, twp2.lng);
                var tsecs = Math.round(tdist / appState.cruiseSpeed * 3600);
                var tmins = Math.floor(tsecs/60), ts = tsecs%60;
                timeStr = (tmins<10?'0':'')+tmins+':'+(ts<10?'0':'')+ts;
            }
            appState.waypointLabels[idx] = createWaypointLabelMarker(wp, heading, timeStr);
        }

        function renameWaypoint(idx, newName) {
            newName = newName.trim();
            if (!newName) return;
            if (idx >= 0 && idx < appState.waypoints.length) {
                appState.waypoints[idx].name = newName;
                updateWaypointLabelMarker(idx);
                updateWaypointsList();
            }
        }
        
        function deleteWaypoint(idx) {
            if (idx < 0 || idx >= appState.waypoints.length) return;

            var deletedWp = appState.waypoints[idx];

            // Remove the waypoint from array
            appState.waypoints.splice(idx, 1);

            // Remove the corresponding circle
            if (appState.circles[idx]) {
                appState.map.removeLayer(appState.circles[idx]);
                appState.circles.splice(idx, 1);
            }

            // Remove deleted WP's label offsets/styles
            delete appState.waypointLabelOffsets[deletedWp.num];
            delete appState.waypointLabelStyles[deletedWp.num];

            // Remap label offsets/styles for waypoints after deleted one
            // (their num will be decremented by renumbering below)
            var newOffsets = {}, newStyles = {};
            appState.waypoints.forEach(function(wp, i) {
                var oldNum = wp.num; // before renumbering
                if (appState.waypointLabelOffsets[oldNum]) newOffsets[i + 1] = appState.waypointLabelOffsets[oldNum];
                if (appState.waypointLabelStyles[oldNum])  newStyles[i + 1]  = appState.waypointLabelStyles[oldNum];
            });

            // Renumber remaining waypoints
            // Capture deleted wp num and old->new num mapping before renumbering
            var deletedNum = deletedWp.num;
            var numRemap = {};
            for (var i = 0; i < appState.waypoints.length; i++) {
                numRemap[appState.waypoints[i].num] = i + 1;
            }
            for (var i = 0; i < appState.waypoints.length; i++) {
                appState.waypoints[i].num = i + 1;
            }
            appState.waypointLabelOffsets = newOffsets;
            appState.waypointLabelStyles  = newStyles;

            // Remap miniWaypoints to new wp nums, removing deleted wp
            var newMini = {};
            Object.keys(appState.miniWaypoints).forEach(function(num) {
                if (parseInt(num) === deletedNum) return; // removed
                var newNum = numRemap[parseInt(num)];
                if (newNum) newMini[newNum] = appState.miniWaypoints[num];
            });
            appState.miniWaypoints = newMini;

            // Remap leg label positions to new wp nums, excluding deleted waypoint
            var newPos = {};
            Object.keys(appState.legLabelDraggedPositions).forEach(function(key) {
                var parts = key.split('_');
                if (parts.length !== 2) return;
                var n1 = parseInt(parts[0]), n2 = parseInt(parts[1]);
                if (n1 === deletedNum || n2 === deletedNum) return; // leg removed
                var newN1 = numRemap[n1], newN2 = numRemap[n2];
                if (newN1 && newN2) newPos[newN1 + '_' + newN2] = appState.legLabelDraggedPositions[key];
            });
            appState.legLabelDraggedPositions = newPos;

            // Shift leg altitudes: legs after deleted idx shift down
            var newAlts = {};
            Object.keys(appState.legAltitudes).forEach(function(k) {
                var ki = parseInt(k);
                if (ki < idx - 1) newAlts[ki] = appState.legAltitudes[k];
                else if (ki > idx) newAlts[ki - 1] = appState.legAltitudes[k];
            });
            appState.legAltitudes = newAlts;

            // Clear reverse route if it exists
            if (appState.reverseRoute && appState.reverseRoute.length > 0) {
                appState.reverseRoute.forEach(function(item) {
                    if (item.line) appState.map.removeLayer(item.line);
                    if (item.label) appState.map.removeLayer(item.label);
                    item.timeMarkers.forEach(function(m) { if (m.remove) m.remove(); else appState.map.removeLayer(m); });
                });
                appState.reverseRoute = [];
                var btn = document.getElementById('toggleDirectionBtn');
                if (btn) btn.style.display = 'none';
            }

            updateRoute();
            updateWaypointsList();
            updateStats();
        }

        window.openImportWaypointDialog = async function() {
            var grouped = {};

            if (_folderHandle) {
                try {
                    var fh = await _folderHandle.getFileHandle('waypoints.json');
                    var file = await fh.getFile();
                    var parsed = JSON.parse(await file.text());
                    // Support both old flat array format and new grouped object format
                    if (Array.isArray(parsed)) {
                        grouped['OpenStreetMap'] = parsed;
                    } else {
                        grouped = parsed;
                    }
                } catch(e) {}
            }

            // If no folder or no file, let user pick the file manually
            if (Object.keys(grouped).length === 0 && window.showOpenFilePicker) {
                try {
                    var [fileHandle] = await window.showOpenFilePicker({
                        types: [{ description: 'Waypoints JSON', accept: { 'application/json': ['.json'] } }]
                    });
                    var file = await fileHandle.getFile();
                    var parsed = JSON.parse(await file.text());
                    if (Array.isArray(parsed)) {
                        grouped['OpenStreetMap'] = parsed;
                    } else {
                        grouped = parsed;
                    }
                } catch(e) {
                    if (e.name !== 'AbortError') alert('Could not load waypoints file: ' + e.message);
                    return;
                }
            }

            var mapNames = Object.keys(grouped).filter(function(k) { return grouped[k] && grouped[k].length > 0; });
            if (mapNames.length === 0) {
                alert('No waypoints found. Save some waypoints first using "Save Plan".');
                return;
            }

            var currentMap = appState.currentMapName || 'OpenStreetMap';
            var selectedMap = mapNames.indexOf(currentMap) >= 0 ? currentMap : mapNames[0];

            // Show selection dialog
            var modal = document.createElement('div');
            modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:10000;display:flex;align-items:center;justify-content:center;';

            var dialog = document.createElement('div');
            dialog.style.cssText = 'background:white;padding:24px;border-radius:12px;width:380px;max-width:95vw;max-height:85vh;display:flex;flex-direction:column;';

            // Build map selector tabs
            var tabsHtml = '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;">';
            mapNames.forEach(function(name) {
                var isActive = name === selectedMap;
                tabsHtml += '<button onclick="switchWaypointMap(\'' + name.replace(/'/g, "\\'") + '\')" ' +
                    'id="wpMapTab_' + name.replace(/[^a-z0-9]/gi, '_') + '" ' +
                    'style="padding:4px 10px;font-size:11px;font-weight:600;border-radius:4px;cursor:pointer;border:2px solid #0066cc;' +
                    (isActive ? 'background:#0066cc;color:white;' : 'background:white;color:#0066cc;') + '">' +
                    name + ' (' + grouped[name].length + ')</button>';
            });
            tabsHtml += '</div>';

            var searchHtml =
                '<div style="font-weight:700;color:#0066cc;font-size:15px;margin-bottom:10px;">📍 Add Saved Waypoint</div>' +
                tabsHtml +
                '<input id="wpSearchInput" type="text" placeholder="Search by name..." ' +
                    'style="width:100%;padding:7px 10px;border:1px solid #0066cc;border-radius:6px;font-size:13px;box-sizing:border-box;margin-bottom:10px;">' +
                '<div id="wpSearchList" style="overflow-y:auto;max-height:280px;border:1px solid #ddd;border-radius:6px;"></div>' +
                '<button id="wpImportClose" style="margin-top:12px;padding:8px;background:#6c757d;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;">Close</button>';

            dialog.innerHTML = searchHtml;
            modal.appendChild(dialog);
            document.body.appendChild(modal);

            function renderList(filter) {
                var wpList = grouped[selectedMap] || [];
                var filtered = wpList.filter(function(wp) {
                    return !filter || wp.name.toLowerCase().indexOf(filter.toLowerCase()) >= 0;
                });
                var html = '';
                if (filtered.length === 0) {
                    html = '<div style="padding:12px;color:#999;text-align:center;font-size:13px;">No matches</div>';
                } else {
                    filtered.forEach(function(wp) {
                        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border-bottom:1px solid #f0f0f0;font-size:13px;">' +
                            '<div>' +
                                '<div style="font-weight:600;color:#333;">' + wp.name + '</div>' +
                                '<div style="font-size:11px;color:#888;">' + wp.lat.toFixed(5) + ', ' + wp.lng.toFixed(5) + '</div>' +
                            '</div>' +
                            '<button onclick="importSavedWaypoint(' + wp.lat + ',' + wp.lng + ',\'' + wp.name.replace(/'/g, "\\'") + '\')" ' +
                                'style="padding:4px 12px;background:#0066cc;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;flex-shrink:0;">Add</button>' +
                            '</div>';
                    });
                }
                document.getElementById('wpSearchList').innerHTML = html;
            }

            window.switchWaypointMap = function(name) {
                selectedMap = name;
                // Update tab styles
                mapNames.forEach(function(n) {
                    var tab = document.getElementById('wpMapTab_' + n.replace(/[^a-z0-9]/gi, '_'));
                    if (tab) {
                        tab.style.background = n === selectedMap ? '#0066cc' : 'white';
                        tab.style.color = n === selectedMap ? 'white' : '#0066cc';
                    }
                });
                document.getElementById('wpSearchInput').value = '';
                renderList('');
            };

            renderList('');

            document.getElementById('wpSearchInput').addEventListener('input', function() {
                renderList(this.value);
            });
            document.getElementById('wpSearchInput').focus();

            document.getElementById('wpImportClose').onclick = function() {
                document.body.removeChild(modal);
            };
            modal.addEventListener('click', function(e) {
                if (e.target === modal) document.body.removeChild(modal);
            });
        };

        window.importSavedWaypoint = function(lat, lng, name) {
            addWaypoint(lat, lng, name);
            appState.map.panTo([lat, lng]);
            // Close modal
            if (window._wpImportModal && window._wpImportModal.parentNode) {
                document.body.removeChild(window._wpImportModal);
                window._wpImportModal = null;
            }
        };
        
        function removeRouteLine() {
            if (!appState.routeLine) return;
            if (appState.routeLine._isSegmented) {
                appState.routeLine._segments.forEach(function(s) { appState.map.removeLayer(s); });
            } else {
                removeRouteLine();
            }
            appState.routeLine = null;
        }

        function dCoord(wp) {
            // Return display coordinates for rendering (falls back to real coords if no display coords)
            return {
                lat: wp.displayLat !== undefined ? wp.displayLat : wp.lat,
                lng: wp.displayLng !== undefined ? wp.displayLng : wp.lng
            };
        }

        function updateRoute() {
            if (appState.routeLine) {
                removeRouteLine();
            }
            
            if (appState.driftLines) {
                appState.driftLines.forEach(function(l) { appState.map.removeLayer(l); });
            }
            appState.driftLines = [];

            if (appState.timeMarkers) {
                appState.timeMarkers.forEach(function(marker) {
                    if (marker.remove) marker.remove(); else appState.map.removeLayer(marker);
                });
            }
            appState.timeMarkers = [];
            
            if (appState.legLabels) {
                appState.legLabels.forEach(function(label) {
                    appState.map.removeLayer(label);
                });
            }
            appState.legLabels = [];

            // Rebuild waypoint name labels
            if (appState.waypointLabels) {
                appState.waypointLabels.forEach(function(lbl) { if (lbl) { if (lbl.remove) lbl.remove(); else appState.map.removeLayer(lbl); } });
            }
            appState.waypointLabels = [];
            // Build arrival time map: wpIndex -> timeStr (leg i arrives at wp i+1)
            var _wpTimeMap = {};
            for (var _ti = 0; _ti < appState.waypoints.length - 1; _ti++) {
                var _twp1 = appState.waypoints[_ti], _twp2 = appState.waypoints[_ti+1];
                var _tdist = calculateDistance(_twp1.lat, _twp1.lng, _twp2.lat, _twp2.lng);
                var _tTotalSecs = Math.round(_tdist / appState.cruiseSpeed * 3600);

                if (appState.miniWaypoints[_twp1.num]) {
                    // Mini WP at start: show accumulated time from last non-mini WP
                    var _accumSecs = _tTotalSecs;
                    var _fi = _ti - 1;
                    while (_fi >= 0 && appState.miniWaypoints[appState.waypoints[_fi].num]) {
                        var _fd = calculateDistance(appState.waypoints[_fi].lat, appState.waypoints[_fi].lng,
                                                     appState.waypoints[_fi+1].lat, appState.waypoints[_fi+1].lng);
                        _accumSecs += Math.round(_fd / appState.cruiseSpeed * 3600);
                        _fi--;
                    }
                    // Add the original first leg of the group
                    if (_fi >= 0) {
                        var _fd0 = calculateDistance(appState.waypoints[_fi].lat, appState.waypoints[_fi].lng,
                                                      appState.waypoints[_fi+1].lat, appState.waypoints[_fi+1].lng);
                        _accumSecs += Math.round(_fd0 / appState.cruiseSpeed * 3600);
                    }
                    var _tMins = Math.floor(_accumSecs / 60), _tSecs = _accumSecs % 60;
                    _wpTimeMap[_ti+1] = (_tMins < 10 ? '0' : '') + _tMins + ':' + (_tSecs < 10 ? '0' : '') + _tSecs;
                } else {
                    var _tMins = Math.floor(_tTotalSecs / 60), _tSecs = _tTotalSecs % 60;
                    _wpTimeMap[_ti+1] = (_tMins < 10 ? '0' : '') + _tMins + ':' + (_tSecs < 10 ? '0' : '') + _tSecs;
                }
            }

            appState.waypoints.forEach(function(wp, idx) {
                var heading = 0;
                if (appState.waypoints.length > 1) {
                    if (idx > 0) {
                        // Use incoming leg heading (prev → current)
                        var prev = appState.waypoints[idx - 1];
                        heading = calculateBearing(prev.lat, prev.lng, wp.lat, wp.lng);
                    } else {
                        // First waypoint: use outgoing leg heading
                        var next = appState.waypoints[idx + 1];
                        heading = calculateBearing(wp.lat, wp.lng, next.lat, next.lng);
                    }
                }
                appState.waypointLabels.push(createWaypointLabelMarker(wp, heading, _wpTimeMap[idx] || ''));
            });

                // Update waypoint circle styles for mini WPs
                appState.waypoints.forEach(function(wp, idx) {
                    var circle = appState.circles[idx];
                    if (!circle) return;
                    var isMiniCircle = !!appState.miniWaypoints[wp.num];
                    circle.setStyle({
                        color: '#0066cc',
                        fillColor: '#0066cc',
                        dashArray: isMiniCircle ? '6 5' : null
                    });
                });

            appState.waypoints.forEach(function(wp, idx) {
            });
            
            if (appState.waypoints.length > 1) {
                // Draw route as individual segments, trimmed to stop at the circle edge of each waypoint
                var radiusNm = appState.circleRadius; // use actual radius (0 means no trimming)
                // Convert nm to degrees: 1 nm = 1/60 degree of latitude
                var radiusLatDeg = radiusNm / 60;

                function offsetPoint(lat, lng, bearingDeg, distNm) {
                    var R = 180 / Math.PI;
                    var d = distNm / 3440.065; // nm to radians
                    var b = bearingDeg * Math.PI / 180;
                    var lat1 = lat * Math.PI / 180;
                    var lng1 = lng * Math.PI / 180;
                    var lat2 = Math.asin(Math.sin(lat1)*Math.cos(d) + Math.cos(lat1)*Math.sin(d)*Math.cos(b));
                    var lng2 = lng1 + Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(lat1), Math.cos(d)-Math.sin(lat1)*Math.sin(lat2));
                    return { lat: lat2 * R, lng: lng2 * R };
                }

                var segmentLines = [];
                for (var si = 0; si < appState.waypoints.length - 1; si++) {
                    var wA = appState.waypoints[si];
                    var wB = appState.waypoints[si + 1];
                    var bear = calculateBearing(wA.lat, wA.lng, wB.lat, wB.lng);

                    // Use display coords for rendering, real coords for math
                    var dA = { lat: wA.displayLat !== undefined ? wA.displayLat : wA.lat,
                               lng: wA.displayLng !== undefined ? wA.displayLng : wA.lng };
                    var dB = { lat: wB.displayLat !== undefined ? wB.displayLat : wB.lat,
                               lng: wB.displayLng !== undefined ? wB.displayLng : wB.lng };

                    // Start: move from wA toward wB by radiusNm
                    var startPt = radiusNm > 0 ? offsetPoint(dA.lat, dA.lng, bear, radiusNm) : dA;
                    // End: move from wB toward wA by radiusNm
                    var endPt   = radiusNm > 0 ? offsetPoint(dB.lat, dB.lng, (bear + 180) % 360, radiusNm) : dB;

                    var seg = L.polyline([[startPt.lat, startPt.lng], [endPt.lat, endPt.lng]], {
                        color: '#0066cc',
                        weight: appState.lineWidth,
                        opacity: 0.7
                    }).addTo(appState.map);

                    // Click on leg line → offer to split
                    (function(legIdx, wpA, wpB) {
                        seg.on('click', function(e) {
                            if (appState.isDrawing) return; // don't interfere with drawing mode
                            L.DomEvent.stopPropagation(e);
                            var clickLat = e.latlng.lat, clickLng = e.latlng.lng;
                            var midLat = (wpA.lat + wpB.lat) / 2;
                            var midLng = (wpA.lng + wpB.lng) / 2;
                            var popupHtml =
                                '<div style="text-align:center;min-width:140px;">' +
                                '<strong style="font-size:13px;">Leg ' + (legIdx+1) + '</strong><br>' +
                                '<button id="split-leg-btn" style="margin-top:8px;padding:5px 14px;background:#0066cc;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:bold;">✂️ Split Leg</button>' +
                                '</div>';
                            L.popup({ closeButton: true, autoClose: true })
                                .setLatLng(e.latlng)
                                .setContent(popupHtml)
                                .openOn(appState.map);
                            setTimeout(function() {
                                var btn = document.getElementById('split-leg-btn');
                                if (!btn) return;
                                btn.onclick = function() {
                                    appState.map.closePopup();
                                    // Remove all existing circles from map
                                    appState.circles.forEach(function(c) { appState.map.removeLayer(c); });
                                    appState.circles = [];
                                    appState.waypointLabels.forEach(function(l) { if (l && l.remove) l.remove(); });
                                    appState.waypointLabels = [];

                                    // Snapshot old wp nums before insert
                                    var oldNums = appState.waypoints.map(function(w) { return w.num; });

                                    // Insert new waypoint at midpoint with temporary num
                                    var newWp = {
                                        lat: midLat, lng: midLng,
                                        displayLat: midLat, displayLng: midLng,
                                        name: 'WP?', num: -1
                                    };
                                    appState.waypoints.splice(legIdx + 1, 0, newWp);

                                    // Renumber all waypoints sequentially
                                    appState.waypoints.forEach(function(w, i) { w.num = i + 1; w.name = w.name === 'WP?' ? 'WP' + (i+1) : w.name; });

                                    // Build old->new num mapping (for waypoints that existed before)
                                    var numRemap = {};
                                    oldNums.forEach(function(oldNum, i) {
                                        // After insert, old WPs at index <= legIdx keep position, those after shift by 1
                                        var newIdx = i <= legIdx ? i : i + 1;
                                        numRemap[oldNum] = newIdx + 1;
                                    });

                                    // Remap legLabelDraggedPositions
                                    var newLegPos = {};
                                    Object.keys(appState.legLabelDraggedPositions).forEach(function(key) {
                                        var parts = key.split('_');
                                        if (parts.length !== 2) return;
                                        var n1 = numRemap[parseInt(parts[0])], n2 = numRemap[parseInt(parts[1])];
                                        if (n1 && n2) newLegPos[n1 + '_' + n2] = appState.legLabelDraggedPositions[key];
                                    });
                                    appState.legLabelDraggedPositions = newLegPos;

                                    // Remap miniWaypoints
                                    var newMini = {};
                                    Object.keys(appState.miniWaypoints).forEach(function(num) {
                                        var newNum = numRemap[parseInt(num)];
                                        if (newNum) newMini[newNum] = appState.miniWaypoints[num];
                                    });
                                    appState.miniWaypoints = newMini;

                                    // Remap waypointLabelStyles and waypointLabelOffsets
                                    var newStyles = {}, newOffsets = {};
                                    Object.keys(appState.waypointLabelStyles).forEach(function(num) {
                                        var newNum = numRemap[parseInt(num)];
                                        if (newNum) newStyles[newNum] = appState.waypointLabelStyles[num];
                                    });
                                    Object.keys(appState.waypointLabelOffsets).forEach(function(num) {
                                        var newNum = numRemap[parseInt(num)];
                                        if (newNum) newOffsets[newNum] = appState.waypointLabelOffsets[num];
                                    });
                                    appState.waypointLabelStyles = newStyles;
                                    appState.waypointLabelOffsets = newOffsets;

                                    // Shift leg altitudes
                                    var newAlts = {};
                                    Object.keys(appState.legAltitudes).forEach(function(k) {
                                        var ki = parseInt(k);
                                        if (ki > legIdx) newAlts[ki + 1] = appState.legAltitudes[k];
                                        else newAlts[ki] = appState.legAltitudes[k];
                                    });
                                    appState.legAltitudes = newAlts;

                                    // Re-create all circles
                                    var wps = appState.waypoints.slice();
                                    appState.waypoints = [];
                                    wps.forEach(function(wp) {
                                        addWaypoint(wp.lat, wp.lng);
                                        var idx = appState.waypoints.length - 1;
                                        appState.waypoints[idx].name = wp.name;
                                        // num already set correctly by renumbering above — addWaypoint assigns sequentially which matches
                                        if (appState.waypointLabels[idx]) {
                                            appState.waypointLabels[idx].remove();
                                            appState.waypointLabels[idx] = null;
                                        }
                                    });
                                    updateRoute();
                                    updateWaypointsList();
                                    updateStats();
                                };
                            }, 50);
                        });
                    })(si, wA, wB);

                    segmentLines.push(seg);
                }

                // Store all segment lines so they can be removed on next updateRoute
                // Re-use routeLine as a group by storing the array
                appState.routeLine = {
                    _segments: segmentLines,
                    addTo: function() {},
                    remove: function() { this._segments.forEach(function(s) { appState.map.removeLayer(s); }); }
                };
                // Needed for code that checks appState.routeLine existence
                appState.routeLine._isSegmented = true;

                // Draw 5-degree drift lines for each leg
                if (appState.driftLines) {
                    appState.driftLines.forEach(function(l) { appState.map.removeLayer(l); });
                }
                appState.driftLines = [];
                var DRIFT_DEG = 5;
                for (var di = 0; di < appState.waypoints.length - 1; di++) {
                    var dA = appState.waypoints[di];
                    var dB = appState.waypoints[di + 1];
                    var dBear = calculateBearing(dA.lat, dA.lng, dB.lat, dB.lng);
                    var dDist = calculateDistance(dA.lat, dA.lng, dB.lat, dB.lng);
                    var dAd = dCoord(dA), dBd = dCoord(dB);
                    var dMid = offsetPoint(dAd.lat, dAd.lng, dBear, dDist / 2);

                    // Line from A: start at circle edge along (heading - 5°), end at midpoint
                    var dStartA = radiusNm > 0 ? offsetPoint(dAd.lat, dAd.lng, (dBear - DRIFT_DEG + 360) % 360, radiusNm) : dAd;
                    var dEndA = offsetPoint(dAd.lat, dAd.lng, (dBear - DRIFT_DEG + 360) % 360, dDist / 2);
                    var dLineA = L.polyline([[dStartA.lat, dStartA.lng], [dEndA.lat, dEndA.lng]], {
                        color: appState.driftColor,
                        weight: appState.driftWidth,
                        opacity: 0.8,
                        dashArray: '6 4'
                    });
                    if (appState.driftLinesVisible) dLineA.addTo(appState.map);
                    appState.driftLines.push(dLineA);

                    // Line from B: start at circle edge along (reverse - 5°), end at midpoint
                    var dReverse = (dBear + 180) % 360;
                    var dStartB = radiusNm > 0 ? offsetPoint(dBd.lat, dBd.lng, (dReverse - DRIFT_DEG + 360) % 360, radiusNm) : dBd;
                    var dEndB = offsetPoint(dBd.lat, dBd.lng, (dReverse - DRIFT_DEG + 360) % 360, dDist / 2);
                    var dLineB = L.polyline([[dStartB.lat, dStartB.lng], [dEndB.lat, dEndB.lng]], {
                        color: appState.driftColor,
                        weight: appState.driftWidth,
                        opacity: 0.8,
                        dashArray: '6 4'
                    });
                    if (appState.driftLinesVisible) dLineB.addTo(appState.map);
                    appState.driftLines.push(dLineB);
                }
                
                for (var i = 0; i < appState.waypoints.length - 1; i++) {
                    var wp1 = appState.waypoints[i];
                    var wp2 = appState.waypoints[i + 1];
                    var isMiniLeg = !!appState.miniWaypoints[wp1.num]; // leg STARTS at mini WP → arrow only

                    var distance = calculateDistance(wp1.lat, wp1.lng, wp2.lat, wp2.lng);
                    var heading = calculateBearing(wp1.lat, wp1.lng, wp2.lat, wp2.lng);
                    var timeHours = distance / appState.cruiseSpeed;
                    var totalMinutes = Math.round(timeHours * 60);
                    var totalMinutesForMarkers = Math.floor(timeHours * 60);
                    var hours = Math.floor(totalMinutes / 60);
                    var mins = totalMinutes % 60;
                    var totalSeconds = Math.round(timeHours * 3600);
                    var displayMins = Math.floor(totalSeconds / 60);
                    var displaySecs = totalSeconds % 60;
                    var timeStr = (displayMins < 10 ? '0' : '') + displayMins + ':' + (displaySecs < 10 ? '0' : '') + displaySecs;

                    // For non-mini legs: accumulate time of all following mini legs
                    if (!isMiniLeg) {
                        var extraSecs = 0;
                        var j = i + 1;
                        while (j < appState.waypoints.length - 1 && appState.miniWaypoints[appState.waypoints[j].num]) {
                            var mDist = calculateDistance(appState.waypoints[j].lat, appState.waypoints[j].lng,
                                                          appState.waypoints[j+1].lat, appState.waypoints[j+1].lng);
                            extraSecs += Math.round(mDist / appState.cruiseSpeed * 3600);
                            j++;
                        }
                        if (extraSecs > 0) {
                            totalSeconds += extraSecs;
                            displayMins = Math.floor(totalSeconds / 60);
                            displaySecs = totalSeconds % 60;
                            timeStr = (displayMins < 10 ? '0' : '') + displayMins + ':' + (displaySecs < 10 ? '0' : '') + displaySecs;
                        }
                    }

                    var d1 = dCoord(wp1), d2 = dCoord(wp2);
                    var currentZoom = appState.map.getZoom();
                    var scale = Math.pow(1.5, currentZoom - 12);

                    // Compute offset in real geographic coords — stable across zoom/resize/map-switch
                    var realMidLat = (wp1.lat + wp2.lat) / 2;
                    var realMidLng = (wp1.lng + wp2.lng) / 2;
                    var perpHeading = (heading + 90) % 360;
                    // Fixed angular offset (~0.015° ≈ 1.6km, independent of zoom)
                    var angOffset = 0.015;
                    var realOffsetLat = realMidLat + angOffset * Math.cos(perpHeading * Math.PI / 180);
                    var realOffsetLng = realMidLng + angOffset / Math.cos(realMidLat * Math.PI / 180) * Math.sin(perpHeading * Math.PI / 180);
                    // Convert to display coords for current map
                    var offDisp = (typeof toDisplayLatLng === 'function')
                        ? toDisplayLatLng(L.latLng(realOffsetLat, realOffsetLng))
                        : L.latLng(realOffsetLat, realOffsetLng);
                    var offsetLat = offDisp.lat, offsetLng = offDisp.lng;
                    var altitude = getLegAltitude(i);

                    var rotation = heading;

                    var legKey = wp1.num + '_' + wp2.num;
                    var labelLat, labelLng;
                    var groupHeading = heading; // heading of this leg (first in group)

                    if (appState.legLabelDraggedPositions[legKey]) {
                        var savedPos = appState.legLabelDraggedPositions[legKey];
                        if (typeof toDisplayLatLng === 'function') {
                            var savedDisp = toDisplayLatLng(L.latLng(savedPos.lat, savedPos.lng));
                            labelLat = savedDisp.lat; labelLng = savedDisp.lng;
                        } else {
                            labelLat = savedPos.lat; labelLng = savedPos.lng;
                        }
                    } else {
                        labelLat = offsetLat; labelLng = offsetLng;
                    }

                    var scale = Math.pow(1.5, currentZoom - 12);
                    appState.infoBoxScale = scale;
                    
                    var sm = appState.infoBoxSizeMultiplier || 1.0;
                    var fm = appState.infoBoxFontMultiplier || 1.0;
                    var triangleBase = 30 * scale * sm;
                    var triangleHeight = 30 * scale * sm;
                    var fontSize = 11 * scale * fm;
                    var headingFontSize = 13 * scale * fm;
                    var iconSize = 80 * scale * sm;

                    var legInfoHtml, legLabel;

                    if (isMiniLeg) {
                        // Mini leg: same arrow as regular but heading-only (no box)
                        legInfoHtml =
                            '<div style="transform:rotate(' + heading + 'deg);transform-origin:center center;display:inline-flex;flex-direction:column;align-items:center;">' +
                            '<div style="width:0;height:0;border-left:' + triangleBase + 'px solid transparent;border-right:' + triangleBase + 'px solid transparent;border-bottom:' + triangleHeight + 'px solid #dc3545;position:relative;">' +
                            '<div style="position:absolute;top:' + (8*scale*sm) + 'px;left:50%;transform:translateX(-50%);color:white;font-weight:bold;font-size:' + headingFontSize + 'px;white-space:nowrap;">' + getMagHeading(heading) + '°</div>' +
                            '</div>' +
                            '<div style="background:rgba(255,255,255,' + appState.infoBoxOpacity + ');padding:' + (2*scale*sm) + 'px 0;border:' + (2*scale*sm) + 'px solid #dc3545;border-radius:' + (4*scale*sm) + 'px;box-shadow:0 2px 4px rgba(0,0,0,0.2);width:' + Math.round(triangleBase*2) + 'px;box-sizing:border-box;text-align:center;overflow:hidden;cursor:pointer;" title="Click to edit altitude">' +
                            '<div class="leg-altitude-display" style="color:#333;font-weight:bold;font-size:' + fontSize + 'px;">' + altitude + '</div>' +
                            '</div>' +
                            '</div>';
                        legLabel = L.marker([labelLat, labelLng], {
                            icon: L.divIcon({
                                className: 'leg-info-label',
                                html: legInfoHtml,
                                iconSize: [Math.round(triangleBase * 2), iconSize],
                                iconAnchor: [Math.round(triangleBase), iconSize/2]
                            }),
                            draggable: true,
                            interactive: true
                        }).addTo(appState.map);
                    } else {
                        // Normal leg: full info box
                        var legInfoHtml =
                            '<div style="transform: rotate(' + groupHeading + 'deg); transform-origin: center center;">' +
                            '<div style="display: flex; flex-direction: column; align-items: center;">' +
                            '<div style="width: 0; height: 0; border-left: ' + triangleBase + 'px solid transparent; border-right: ' + triangleBase + 'px solid transparent; border-bottom: ' + triangleHeight + 'px solid #dc3545; position: relative;">' +
                            '<div style="position: absolute; top: ' + (8 * scale * sm) + 'px; left: 50%; transform: translateX(-50%); color: white; font-weight: bold; font-size: ' + headingFontSize + 'px; white-space: nowrap;">' + getMagHeading(groupHeading) + '°</div>' +
                            '</div>' +
                            '<div style="background: rgba(255,255,255,' + appState.infoBoxOpacity + '); padding: ' + (2 * scale * sm) + 'px 0; border: ' + (2 * scale * sm) + 'px solid #0066cc; border-radius: ' + (4 * scale * sm) + 'px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); width:' + Math.round(triangleBase * 2) + 'px; box-sizing:border-box; text-align: center; overflow:hidden; cursor: pointer;" title="Click to edit altitude">' +
                            '<div style="color: #333; font-weight: bold; font-size: ' + fontSize + 'px;">' + timeStr + '</div>' +
                            '<div style="border-top: 1px solid #0066cc; margin: ' + (2 * scale * sm) + 'px 0;"></div>' +
                            '<div class="leg-altitude-display" style="color: #333; font-weight: bold; font-size: ' + fontSize + 'px;">' + altitude + '</div>' +
                            (appState.showLegDistance !== false ? '<div style="border-top: 1px solid #0066cc; margin: ' + (4 * scale * sm) + 'px 0;"></div><div style="color: #333; font-weight: bold; font-size: ' + fontSize + 'px;">' + distance.toFixed(1) + '</div>' : '') +
                            (appState.debugMode ?
                                '<div style="border-top: 1px solid #0066cc; margin: ' + (2 * scale * sm) + 'px 0;"></div>' +
                                '<div style="color: #666; font-size: ' + (fontSize * 0.85) + 'px;">From: ' + wp1.lat.toFixed(4) + '°N ' + wp1.lng.toFixed(4) + '°E</div>' +
                                '<div style="color: #666; font-size: ' + (fontSize * 0.85) + 'px;">To: ' + wp2.lat.toFixed(4) + '°N ' + wp2.lng.toFixed(4) + '°E</div>'
                            : '') +
                            '</div></div></div>';

                        var legLabel = L.marker([labelLat, labelLng], {
                            icon: L.divIcon({
                                className: 'leg-info-label',
                                html: legInfoHtml,
                                iconSize: [Math.round(triangleBase * 2), iconSize],
                                iconAnchor: [Math.round(triangleBase), iconSize/2]
                            }),
                            draggable: true
                        }).addTo(appState.map);
                    }
                    
                    (function(key, legIdx, isMini) {
                        // Both mini and normal legs get drag handler
                        legLabel.on('dragend', function(e) {
                            var pos = e.target.getLatLng();
                            var realPos = calibrateDisplayToReal(pos);
                            appState.legLabelDraggedPositions[key] = { lat: realPos.lat, lng: realPos.lng };
                        });
                        // Both get altitude click handler
                        legLabel.on('click', function(e) {
                            L.DomEvent.stopPropagation(e);
                            var currentAlt = appState.legAltitudes[legIdx] !== undefined ? appState.legAltitudes[legIdx] : (appState.defaultAltitude || 0);
                            var popupHtml = '<div style="text-align:center;padding:4px 8px;">' +
                                '<strong>Leg ' + (legIdx + 1) + ' Altitude</strong><br>' +
                                '<div style="display:flex;align-items:center;gap:4px;margin-top:6px;">' +
                                '<input id="leg-alt-input-' + legIdx + '" type="number" value="' + currentAlt + '" min="0" max="50000" step="100" ' +
                                'style="width:80px;padding:3px 5px;border:1px solid #0066cc;border-radius:4px;font-size:13px;font-weight:bold;" ' +
                                'onkeydown="if(event.key===\'Enter\'){updateLegAltitude(' + legIdx + ',this.value);appState.map.closePopup();}else if(event.key===\'Escape\'){appState.map.closePopup();}">' +
                                '<span style="font-size:12px;">ft</span>' +
                                '</div>' +
                                '<button onclick="updateLegAltitude(' + legIdx + ',document.getElementById(\'leg-alt-input-' + legIdx + '\').value);appState.map.closePopup();" ' +
                                'style="margin-top:6px;padding:4px 12px;background:#0066cc;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">Save</button>' +
                                '</div>';
                            L.popup({ closeButton: true, autoClose: true, offset: [0, 0] })
                                .setLatLng(e.latlng)
                                .setContent(popupHtml)
                                .openOn(appState.map);
                            setTimeout(function() {
                                var inp = document.getElementById('leg-alt-input-' + legIdx);
                                if (inp) { inp.focus(); inp.select(); }
                            }, 50);
                        });
                        if (!isMini) {
                        
                        legLabel.on('click', function(e) {
                            L.DomEvent.stopPropagation(e);
                            var currentAlt = getLegAltitude(legIdx);
                            var popupHtml =
                                '<div style="text-align:center; min-width:140px;">' +
                                '<strong>Leg ' + (legIdx + 1) + ' Altitude</strong><br>' +
                                '<div style="display:flex; align-items:center; gap:4px; margin-top:6px;">' +
                                '<input id="leg-alt-input-' + legIdx + '" type="number" value="' + currentAlt + '" min="0" max="50000" step="100" ' +
                                'style="width:80px; padding:3px 5px; border:1px solid #0066cc; border-radius:4px; font-size:13px; font-weight:bold;" ' +
                                'onkeydown="if(event.key===\'Enter\'){updateLegAltitude(' + legIdx + ',this.value);appState.map.closePopup();}else if(event.key===\'Escape\'){appState.map.closePopup();}">' +
                                '<span style="font-size:12px;">ft</span>' +
                                '</div>' +
                                '<button onclick="updateLegAltitude(' + legIdx + ', document.getElementById(\'leg-alt-input-' + legIdx + '\').value); appState.map.closePopup();" ' +
                                'style="margin-top:6px; padding:4px 12px; background:#0066cc; color:white; border:none; border-radius:4px; cursor:pointer; font-size:12px;">Save</button>' +
                                '</div>';
                            L.popup({ closeButton: true, autoClose: true, offset: [0, 0] })
                                .setLatLng(e.latlng)
                                .setContent(popupHtml)
                                .openOn(appState.map);
                            // Focus input after popup opens
                            setTimeout(function() {
                                var inp = document.getElementById('leg-alt-input-' + legIdx);
                                if (inp) { inp.focus(); inp.select(); }
                            }, 50);
                        });
                        } // end if (!isMini)
                    })(legKey, i, isMiniLeg);
                    
                    appState.legLabels.push(legLabel);
                    
                    var totalMinutesExact = timeHours * 60;
                    var radiusNm = appState.circleRadius;
                    var tickInterval = appState.tickInterval || 1;
                    var labelInterval = appState.labelInterval || 1;

                    // Compute accumulated minutes offset for this leg within its group
                    var accumMinOffset = 0;
                    if (isMiniLeg) {
                        // Count minutes from last non-mini WP
                        var _gi = i - 1;
                        while (_gi >= 0 && appState.miniWaypoints[appState.waypoints[_gi].num]) {
                            var _gd = calculateDistance(appState.waypoints[_gi].lat, appState.waypoints[_gi].lng,
                                                         appState.waypoints[_gi+1].lat, appState.waypoints[_gi+1].lng);
                            accumMinOffset += _gd / appState.cruiseSpeed * 60;
                            _gi--;
                        }
                        // Add first leg of group
                        if (_gi >= 0) {
                            var _gd0 = calculateDistance(appState.waypoints[_gi].lat, appState.waypoints[_gi].lng,
                                                          appState.waypoints[_gi+1].lat, appState.waypoints[_gi+1].lng);
                            accumMinOffset += _gd0 / appState.cruiseSpeed * 60;
                        }
                    }

                    for (var min = 1; min <= totalMinutesForMarkers; min++) {
                        // Skip if this minute is not on a tick interval
                        if (min % tickInterval !== 0) continue;

                        var fraction = (min / totalMinutesExact);
                        var lat = d1.lat + (d2.lat - d1.lat) * fraction;
                        var lng = d1.lng + (d2.lng - d1.lng) * fraction;

                        // Skip if inside either waypoint's circle — use real coords for distance
                        if (radiusNm > 0) {
                            var realLat = wp1.lat + (wp2.lat - wp1.lat) * fraction;
                            var realLng = wp1.lng + (wp2.lng - wp1.lng) * fraction;
                            var distFromStart = calculateDistance(wp1.lat, wp1.lng, realLat, realLng);
                            var distFromEnd   = calculateDistance(wp2.lat, wp2.lng, realLat, realLng);
                            if (distFromStart < radiusNm || distFromEnd < radiusNm) continue;
                        }

                        // Show accumulative minute label
                        var displayMin = Math.round(accumMinOffset + min);
                        var showLabel = (min % labelInterval === 0);
                        var labelHtml = showLabel
                            ? '<div style="transform: rotate(' + heading + 'deg); color: #0066cc; font-weight: bold; font-size: ' + appState.labelFontSize + 'px; text-shadow: 1px 1px 2px white, -1px -1px 2px white, 1px -1px 2px white, -1px 1px 2px white;">' + displayMin + '</div>'
                            : '';

                        var labelMarker = L.marker([lat, lng], {
                            icon: L.divIcon({
                                className: 'time-label',
                                html: labelHtml,
                                iconSize: [50, 20],
                                iconAnchor: [25, 10]
                            })
                        }).addTo(appState.map);
                        appState.timeMarkers.push(labelMarker);

                        var perpLat1 = lat + 0.005 * Math.cos((heading + 90) * Math.PI / 180);
                        var perpLng1 = lng + 0.005 * Math.sin((heading + 90) * Math.PI / 180);
                        var perpLat2 = lat - 0.005 * Math.cos((heading + 90) * Math.PI / 180);
                        var perpLng2 = lng - 0.005 * Math.sin((heading + 90) * Math.PI / 180);

                        var tickLine = L.polyline([[perpLat1, perpLng1], [perpLat2, perpLng2]], {
                            color: '#0066cc',
                            weight: appState.lineWidth,
                            opacity: 0.7
                        }).addTo(appState.map);
                        appState.timeMarkers.push(tickLine);
                    }


                }
            }
        }
        
        function calculateDistance(lat1, lng1, lat2, lng2) {
            var R = 3440.065;
            var dLat = (lat2 - lat1) * Math.PI / 180;
            var dLng = (lng2 - lng1) * Math.PI / 180;
            var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                    Math.sin(dLng/2) * Math.sin(dLng/2);
            var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            var distance = R * c;
            return distance;
        }
        
        function calculateBearing(lat1, lng1, lat2, lng2) {
            var dLng = (lng2 - lng1) * Math.PI / 180;
            var lat1Rad = lat1 * Math.PI / 180;
            var lat2Rad = lat2 * Math.PI / 180;
            var y = Math.sin(dLng) * Math.cos(lat2Rad);
            var x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
                    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
            var bearing = Math.atan2(y, x) * 180 / Math.PI;
            return Math.round((bearing + 360) % 360);
        }

        // Returns the magnetic heading by adding the stored mag variation to a true bearing
        function getMagHeading(trueBearing) {
            var mag = Math.round((trueBearing + (appState.magVar || 0) + 360) % 360);
            return mag;
        }
        
        function latLonToTile(lat, lon, zoom) {
            var n = Math.pow(2, zoom);
            var x = Math.floor((lon + 180) / 360 * n);
            var latRad = lat * Math.PI / 180;
            var y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
            return { x: x, y: y };
        }
        
        function getClosestPointOnLine(pointLat, pointLng, line1Lat, line1Lng, line2Lat, line2Lng) {
            // Find the closest point on line segment to a given point
            var dx = line2Lng - line1Lng;
            var dy = line2Lat - line1Lat;
            
            if (dx === 0 && dy === 0) {
                // Line segment is a point
                return { lat: line1Lat, lng: line1Lng };
            }
            
            // Calculate parameter t for the projection
            var t = ((pointLng - line1Lng) * dx + (pointLat - line1Lat) * dy) / (dx * dx + dy * dy);
            
            // Clamp t to [0, 1] to stay on the line segment
            t = Math.max(0, Math.min(1, t));
            
            return {
                lat: line1Lat + t * dy,
                lng: line1Lng + t * dx
            };
        }
        
        function updateStats() {
            var t = translations[appState.language];
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
            
            var statsHTML = '';
            statsHTML += '<div class="stat-card"><div class="stat-label">' + t.totalDistance + '</div><div class="stat-value">' + totalDistance.toFixed(1) + ' nm</div></div>';
            statsHTML += '<div class="stat-card"><div class="stat-label">' + t.totalTime + '</div><div class="stat-value">' + hours + 'h ' + minutes + 'm</div></div>';
            statsHTML += '<div class="stat-card"><div class="stat-label">' + t.fuelRequired + '</div><div class="stat-value">' + fuelRequired.toFixed(1) + ' L</div></div>';
            statsHTML += '<div class="stat-card"><div class="stat-label">' + t.numberOfLegs + '</div><div class="stat-value">' + Math.max(0, appState.waypoints.length - 1) + '</div></div>';
            
            document.getElementById('stats').innerHTML = statsHTML;
        }
        
        function updateWaypointsList() {
            var list = document.getElementById('waypoints-list');
            if (appState.waypoints.length === 0) {
                list.innerHTML = '<div style="text-align:center;color:#999;padding:1rem;">No waypoints yet. Click on the map to start.</div>';
                document.getElementById('waypoint-count').textContent = 0;
                return;
            }

            list.innerHTML = '';
            appState.waypoints.forEach(function(wp, idx) {
                var row = document.createElement('div');
                row.className = 'waypoint-item';
                row.dataset.idx = idx;
                row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:6px 4px;border-bottom:1px solid #f0f0f0;cursor:default;';

                row.innerHTML =
                    '<span class="wp-drag-handle" title="Drag to reorder" ' +
                        'style="cursor:grab;color:#bbb;font-size:16px;padding:0 4px;user-select:none;flex-shrink:0;">⠿</span>' +
                    '<div style="flex:1;min-width:0;">' +
                        '<div style="display:flex;align-items:center;gap:6px;">' +
                            '<span style="color:#999;font-size:0.75rem;min-width:20px;">#' + wp.num + '</span>' +
                            '<input type="text" value="' + wp.name.replace(/"/g,'&quot;') + '" ' +
                                'style="flex:1;font-weight:600;color:#0066cc;border:1px solid #ddd;border-radius:4px;padding:2px 6px;font-size:0.85rem;" ' +
                                'onchange="renameWaypoint(' + idx + ',this.value)" ' +
                                'onblur="renameWaypoint(' + idx + ',this.value)" ' +
                                'onkeydown="if(event.key===\'Enter\'){renameWaypoint(' + idx + ',this.value);this.blur();}" ' +
                                'title="Click to rename waypoint">' +
                        '</div>' +
                        '<div style="font-size:0.75rem;color:#888;margin-top:2px;">' + wp.lat.toFixed(4) + '°N, ' + wp.lng.toFixed(4) + '°E</div>' +
                    '</div>' +
                    '<button class="remove-btn" onclick="removeWaypoint(' + idx + ')">Remove</button>';

                list.appendChild(row);

                // Drag-to-reorder on the handle
                var handle = row.querySelector('.wp-drag-handle');
                handle.addEventListener('mousedown', function(e) {
                    e.preventDefault();
                    var fromIdx = parseInt(row.dataset.idx);
                    var rowH = row.offsetHeight;
                    var startY = e.clientY;
                    var ghost = row.cloneNode(true);
                    ghost.style.cssText += 'position:fixed;left:' + row.getBoundingClientRect().left + 'px;' +
                        'width:' + row.offsetWidth + 'px;opacity:0.85;background:white;' +
                        'box-shadow:0 4px 12px rgba(0,0,0,0.2);z-index:9999;pointer-events:none;border-radius:6px;';
                    ghost.style.top = row.getBoundingClientRect().top + 'px';
                    document.body.appendChild(ghost);
                    row.style.opacity = '0.3';

                    function onMove(me) {
                        var dy = me.clientY - startY;
                        ghost.style.top = (row.getBoundingClientRect().top + dy) + 'px';
                        // Determine target index
                        var toIdx = fromIdx + Math.round(dy / rowH);
                        toIdx = Math.max(0, Math.min(appState.waypoints.length - 1, toIdx));
                        // Highlight target row
                        list.querySelectorAll('.waypoint-item').forEach(function(r, i) {
                            r.style.background = (i === toIdx && i !== fromIdx) ? '#e8f4ff' : '';
                        });
                    }

                    function onUp(me) {
                        document.removeEventListener('mousemove', onMove);
                        document.removeEventListener('mouseup', onUp);
                        document.body.removeChild(ghost);
                        row.style.opacity = '';
                        list.querySelectorAll('.waypoint-item').forEach(function(r) { r.style.background = ''; });

                        var dy = me.clientY - startY;
                        var toIdx = fromIdx + Math.round(dy / rowH);
                        toIdx = Math.max(0, Math.min(appState.waypoints.length - 1, toIdx));

                        if (toIdx !== fromIdx) {
                            reorderWaypoint(fromIdx, toIdx);
                        }
                    }

                    document.addEventListener('mousemove', onMove);
                    document.addEventListener('mouseup', onUp);
                });
            });

            document.getElementById('waypoint-count').textContent = appState.waypoints.length;
        }

        function reorderWaypoint(fromIdx, toIdx) {
            // Reorder waypoints array
            var wp = appState.waypoints.splice(fromIdx, 1)[0];
            appState.waypoints.splice(toIdx, 0, wp);
            // Reorder circles array to match
            var circle = appState.circles.splice(fromIdx, 1)[0];
            appState.circles.splice(toIdx, 0, circle);
            // Renumber
            appState.waypoints.forEach(function(w, i) { w.num = i + 1; });
            updateRoute();
            updateWaypointsList();
            updateStats();
        }
        
        function removeWaypoint(idx) {
            appState.waypoints.splice(idx, 1);
            if (appState.circles[idx]) {
                appState.map.removeLayer(appState.circles[idx]);
                appState.circles.splice(idx, 1);
            }
            
            appState.waypoints.forEach(function(wp, i) {
                wp.num = i + 1;
            });
            
            updateRoute();
            updateWaypointsList();
            updateStats();
        }
        
        function updateAllCircles() {
            var radiusMeters = appState.circleRadius * 1852;
            var opacity = appState.circleOpacity !== undefined ? appState.circleOpacity : 0.2;
            appState.circles.forEach(function(circle) {
                circle.setRadius(radiusMeters);
                circle.setStyle({ fillOpacity: opacity });
            });
            refreshLSAVisibility();
        }
        
        function clearRoute() {
            appState.waypoints = [];
            appState.markers.forEach(function(m) { if (m) appState.map.removeLayer(m); });
            appState.markers = [];
            appState.circles.forEach(function(c) { if (c) appState.map.removeLayer(c); });
            appState.circles = [];
            if (appState.waypointLabels) {
                appState.waypointLabels.forEach(function(lbl) { if (lbl) { if (lbl.remove) lbl.remove(); else appState.map.removeLayer(lbl); } });
            }
            appState.waypointLabels = [];
            appState.waypointLabelOffsets = {};
            appState.waypointLabelStyles = {};
            if (appState.driftLines) {
                appState.driftLines.forEach(function(l) { appState.map.removeLayer(l); });
            }
            appState.driftLines = [];
            if (appState.timeMarkers) {
                appState.timeMarkers.forEach(function(marker) { if (marker.remove) marker.remove(); else appState.map.removeLayer(marker); });
            }
            appState.timeMarkers = [];
            if (appState.legLabels) {
                appState.legLabels.forEach(function(label) { appState.map.removeLayer(label); });
            }
            appState.legLabels = [];
            appState.arrivalLabelPositions = {};
            appState.legAltitudes = {};
            if (appState.routeLine) {
                removeRouteLine();
                appState.routeLine = null;
            }
            if (appState.previewLine) {
                appState.map.removeLayer(appState.previewLine);
                appState.previewLine = null;
            }
            if (appState.previewLabel) {
                appState.map.removeLayer(appState.previewLabel);
                appState.previewLabel = null;
            }
            appState.previewTimeMarkers.forEach(function(m) { appState.map.removeLayer(m); });
            appState.previewTimeMarkers = [];
            
            // Clear reverse route
            if (appState.reverseRoute) {
                appState.reverseRoute.forEach(function(item) {
                    if (item.line) appState.map.removeLayer(item.line);
                    if (item.label) appState.map.removeLayer(item.label);
                    item.timeMarkers.forEach(function(m) { if (m.remove) m.remove(); else appState.map.removeLayer(m); });
                });
                appState.reverseRoute = [];
            }
            
            // Hide toggle direction button
            var btn = document.getElementById('toggleDirectionBtn');
            if (btn) {
                btn.style.display = 'none';
            }
            
            // Clear all text boxes
            if (appState.textBoxes) {
                appState.textBoxes.forEach(function(marker) {
                    if (marker.remove) marker.remove(); else appState.map.removeLayer(marker);
                });
                appState.textBoxes = [];
            }
            
            updateWaypointsList();
            updateStats();
        }
        

        function startPlaneAnimation() {
            if (appState.waypoints.length < 2) {
                alert('Need at least 2 waypoints to fly!');
                return;
            }
            
            // Create plane marker
            var planeIcon = L.divIcon({
                className: 'plane-icon',
                html: '<div style="font-size: 24px; transform: rotate(0deg); transition: transform 0.3s;">✈️</div>',
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            });
            
            var planeMarker = L.marker([appState.waypoints[0].lat, appState.waypoints[0].lng], {
                icon: planeIcon,
                zIndexOffset: 1000
            }).addTo(appState.map);
            
            var currentSegment = 0;
            var progress = 0;
            var speed = 0.002; // Adjust for faster/slower animation
            
            function animatePlane() {
                if (currentSegment >= appState.waypoints.length - 1) {
                    // Animation complete
                    setTimeout(function() {
                        appState.map.removeLayer(planeMarker);
                    }, 1000);
                    return;
                }
                
                var wp1 = appState.waypoints[currentSegment];
                var wp2 = appState.waypoints[currentSegment + 1];
                
                progress += speed;
                
                if (progress >= 1) {
                    // Move to next segment
                    progress = 0;
                    currentSegment++;
                    if (currentSegment >= appState.waypoints.length - 1) {
                        appState.map.removeLayer(planeMarker);
                        return;
                    }
                    wp1 = appState.waypoints[currentSegment];
                    wp2 = appState.waypoints[currentSegment + 1];
                }
                
                // Interpolate position
                var lat = wp1.lat + (wp2.lat - wp1.lat) * progress;
                var lng = wp1.lng + (wp2.lng - wp1.lng) * progress;
                
                // Calculate bearing for rotation
                var bearing = calculateBearing(wp1.lat, wp1.lng, wp2.lat, wp2.lng);
                
                // Update plane position and rotation
                planeMarker.setLatLng([lat, lng]);
                var planeElement = planeMarker.getElement();
                if (planeElement) {
                    var planeDiv = planeElement.querySelector('div');
                    if (planeDiv) {
                        planeDiv.style.transform = 'rotate(' + (bearing - 90) + 'deg)';
                    }
                }
                
                // Continue animation
                requestAnimationFrame(animatePlane);
            }
            
            // Start animation
            animatePlane();
        }

        // ── Contact Developer ──────────────────────────────────────────────
        // Google Apps Script web app — forwards form submissions to flightplannerisr@gmail.com
