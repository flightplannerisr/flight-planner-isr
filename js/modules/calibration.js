        function transformToAirNavCoords(lat, lng) {
            // Air Nav map uses Israel TM Grid projection
            // Grid shown on map: 31°20'N to 33°20'N, 34°10'E to 35°50'E
            // Using bilinear interpolation with calibration points
            
            // Image bounds (with margins)
            var topMargin = 0.0300;
            var bottomMargin = 0.0210;
            var leftMargin = 0.0145;
            var rightMargin = 0.0145;
            
            // Map grid coordinates (what's shown on the chart)
            var gridSouth = 29.5;       // 29°30'N
            var gridNorth = 33.333333;  // 33°20'N
            var gridWest = 34.166667;   // 34°10'E
            var gridEast = 35.833333;   // 35°50'E
            
            var latSpan = gridNorth - gridSouth;
            var lngSpan = gridEast - gridWest;
            
            // Image bounds (including margins)
            var imageSouth = gridSouth - (bottomMargin * latSpan);
            var imageNorth = gridNorth + (topMargin * latSpan);
            var imageWest = gridWest - (leftMargin * lngSpan);
            var imageEast = gridEast + (rightMargin * lngSpan);
            
            // Calculate position within image (0 to 1)
            var latNorm = (lat - imageSouth) / (imageNorth - imageSouth);
            var lngNorm = (lng - imageWest) / (imageEast - imageWest);
            
            // Clamp to valid range
            latNorm = Math.max(0, Math.min(1, latNorm));
            lngNorm = Math.max(0, Math.min(1, lngNorm));
            
            // Calculate position within actual map grid (excluding margins)
            var marginTop = topMargin / (1 + topMargin + bottomMargin);
            var marginBottom = bottomMargin / (1 + topMargin + bottomMargin);
            var marginLeft = leftMargin / (1 + leftMargin + rightMargin);
            var marginRight = rightMargin / (1 + leftMargin + rightMargin);
            
            // Transform to grid coordinates
            var gridLatNorm = (latNorm - marginBottom) / (1 - marginTop - marginBottom);
            var gridLngNorm = (lngNorm - marginLeft) / (1 - marginLeft - marginRight);
            
            // Calculate final coordinates
            var finalLat = gridSouth + (gridLatNorm * latSpan);
            var finalLng = gridWest + (gridLngNorm * lngSpan);
            
            return { lat: finalLat, lng: finalLng };
        }
        

        var CALIB_LON_LINES = (function() {
            var a = [];
            for (var m = 10; m <= 110; m += 10) a.push(34 + m / 60);
            return a; // 34°10' .. 35°50' → 11 lines
        })();
        var CALIB_LAT_LINES = (function() {
            var a = [];
            for (var m = 0; 33 + 20/60 - m/60 >= 29 + 30/60 - 0.0001; m += 10)
                a.push(33 + 20/60 - m/60);
            return a; // 33°20' .. 29°30' → 24 lines
        })();

        var calibState = {
            active: false, mapName: null, phase: 'lon',
            lonPoints: [], latPoints: [], intersections: [],
            lonIdx: 0, latIdx: 0, intIdx: 0, intTarget: 5,
            markers: [], transform: null
        };

        function fitAffineTransform(points) {
            // Separate lon points (known lng, varying x) and lat points (known lat, varying y)
            var lonSet = {}, latSet = {};
            CALIB_LON_LINES.forEach(function(v) { lonSet[v.toFixed(6)] = true; });
            CALIB_LAT_LINES.forEach(function(v) { latSet[v.toFixed(6)] = true; });

            var lonPts = [], latPts = [];
            points.forEach(function(p) {
                if (lonSet[p.world.lng.toFixed(6)]) lonPts.push(p);
                if (latSet[p.world.lat.toFixed(6)]) latPts.push(p);
            });

            if (lonPts.length < 2 || latPts.length < 2) return null;

            // Sort for piecewise interpolation
            lonPts.sort(function(a,b){ return a.pixel.x - b.pixel.x; });
            latPts.sort(function(a,b){ return a.pixel.y - b.pixel.y; });

            return { lonPts: lonPts, latPts: latPts };
        }

        function piecewiseInterp1D(sortedPts, pixelVal, getPixel, getWorld) {
            // Find surrounding calibration points and interpolate
            var n = sortedPts.length;
            if (pixelVal <= getPixel(sortedPts[0]))   return getWorld(sortedPts[0]);
            if (pixelVal >= getPixel(sortedPts[n-1])) return getWorld(sortedPts[n-1]);
            for (var i = 0; i < n-1; i++) {
                var p1 = sortedPts[i], p2 = sortedPts[i+1];
                var x1 = getPixel(p1), x2 = getPixel(p2);
                if (pixelVal >= x1 && pixelVal <= x2) {
                    var t = (pixelVal - x1) / (x2 - x1);
                    return getWorld(p1) + t * (getWorld(p2) - getWorld(p1));
                }
            }
            return getWorld(sortedPts[n-1]);
        }

        function applyTransform(transform, latlng) {
            // latlng is raw Leaflet coords; use piecewise interpolation
            var lng = piecewiseInterp1D(transform.lonPts, latlng.lng,
                function(p){ return p.pixel.x; }, function(p){ return p.world.lng; });
            var lat = piecewiseInterp1D(transform.latPts, latlng.lat,
                function(p){ return p.pixel.y; }, function(p){ return p.world.lat; });
            return L.latLng(lat, lng);
        }

        function applyInverseTransform(transform, latlng) {
            // Inverse piecewise: real WGS84 → Leaflet display coords
            // lonPts sorted by pixel.x, world.lng also increases → invert
            var lonInv = transform.lonPts.slice().sort(function(a,b){ return a.world.lng - b.world.lng; });
            var latInv = transform.latPts.slice().sort(function(a,b){ return a.world.lat - b.world.lat; });
            var px = piecewiseInterp1D(lonInv, latlng.lng,
                function(p){ return p.world.lng; }, function(p){ return p.pixel.x; });
            var py = piecewiseInterp1D(latInv, latlng.lat,
                function(p){ return p.world.lat; }, function(p){ return p.pixel.y; });
            return L.latLng(py, px);
        }

        // Convert stored WGS84 coords to display coords for chart maps
        window.toDisplayLatLng = function(latlng) {
            var mapName = appState.currentMapName;
            if (mapName !== 'Air Nav Chart' && mapName !== 'AZM Chart') return latlng;
            var transform = calibTransforms[mapName];
            if (!transform) return latlng;
            return applyInverseTransform(transform, latlng);
        };

        // Reposition overlay markers (LSA, CVFR, airstrips, etc.) using display coords
        function refreshOverlayMarkers(mapName) {
            mapName = mapName || appState.currentMapName;
            // Only apply transform if this is the currently active map
            var isCurrentMap = (mapName === appState.currentMapName);
            var transform = isCurrentMap ? calibTransforms[mapName] : null;
            var isChartMap = (mapName === 'Air Nav Chart' || mapName === 'AZM Chart');

            function dispPos(realLL) {
                if (!transform || !isChartMap || !isCurrentMap) return realLL;
                return applyInverseTransform(transform, realLL);
            }

            // LSA points
            appState.lsaPoints.forEach(function(marker) {
                if (marker._realLatLng) marker.setLatLng(dispPos(marker._realLatLng));
            });
            // CVFR points
            appState.cvfrPoints.forEach(function(marker) {
                if (marker._realLatLng) marker.setLatLng(dispPos(marker._realLatLng));
            });
            // Airstrips
            appState.airstrips.forEach(function(marker) {
                if (marker._realLatLng) marker.setLatLng(dispPos(marker._realLatLng));
            });
        }

        function calibFileName(mapName) { return 'calibration_' + mapName.replace(/[^a-z0-9]/gi, '_') + '.json'; }

        async function saveCalibration(mapName, transform, points) {
            if (!_folderHandle) { alert('Set a working folder first to save calibration.'); return; }
            var data = { mapName: mapName, transform: transform, points: points, date: new Date().toISOString() };
            try {
                var fh = await _folderHandle.getFileHandle(calibFileName(mapName), { create: true });
                var wr = await fh.createWritable();
                await wr.write(JSON.stringify(data, null, 2));
                await wr.close();
            } catch(e) { alert('Could not save calibration: ' + e.message); }
        }

        // Embedded calibration points for Air Nav Chart (baked in at build time)
        var EMBEDDED_CALIBRATION = {
            'Air Nav Chart': [{"pixel":{"x":34.246723484312874,"y":33.030428814264944},"world":{"lng":34.166666666666664,"lat":33.030428814264944}},{"pixel":{"x":34.39028559392879,"y":33.028717318457744},"world":{"lng":34.333333333333336,"lat":33.028717318457744}},{"pixel":{"x":34.533847703544694,"y":33.03004373060628},"world":{"lng":34.5,"lat":33.03004373060628}},{"pixel":{"x":34.67710360176437,"y":33.02589327771029},"world":{"lng":34.666666666666664,"lat":33.02589327771029}},{"pixel":{"x":34.82066571138028,"y":33.02490912103726},"world":{"lng":34.833333333333336,"lat":33.02490912103726}},{"pixel":{"x":34.96460346396516,"y":33.243784832521555},"world":{"lng":35,"lat":33.243784832521555}},{"pixel":{"x":35.10772593027216,"y":33.260865894974145},"world":{"lng":35.166666666666664,"lat":33.260865894974145}},{"pixel":{"x":35.25084839657915,"y":33.25706368589016},"world":{"lng":35.333333333333336,"lat":33.25706368589016}},{"pixel":{"x":35.394043037604426,"y":33.25748616173813},"world":{"lng":35.5,"lat":33.25748616173813}},{"pixel":{"x":35.53694897975665,"y":33.2571240397078},"world":{"lng":35.666666666666664,"lat":33.2571240397078}},{"pixel":{"x":35.680117607116706,"y":33.25813999394796},"world":{"lng":35.833333333333336,"lat":33.25813999394796}},{"pixel":{"x":35.73205289713252,"y":33.24350618739461},"world":{"lng":35.73205289713252,"lat":33.333333333333336}},{"pixel":{"x":35.73646545410157,"y":33.092620175434696},"world":{"lng":35.73646545410157,"lat":33.16666666666667}},{"pixel":{"x":35.73693752288819,"y":32.94144775165421},"world":{"lng":35.73693752288819,"lat":33}},{"pixel":{"x":35.73700331470546,"y":32.79045349183996},"world":{"lng":35.73700331470546,"lat":32.833333333333336}},{"pixel":{"x":35.73771780796342,"y":32.638919618673384},"world":{"lng":35.73771780796342,"lat":32.66666666666667}},{"pixel":{"x":35.738993688781214,"y":32.48708557345855},"world":{"lng":35.738993688781214,"lat":32.5}},{"pixel":{"x":35.738381265988664,"y":32.3349517692279},"world":{"lng":35.738381265988664,"lat":32.333333333333336}},{"pixel":{"x":35.73659503284378,"y":32.18273459787912},"world":{"lng":35.73659503284378,"lat":32.16666666666667}},{"pixel":{"x":35.46634234836659,"y":32.02944598336014},"world":{"lng":35.46634234836659,"lat":32}},{"pixel":{"x":35.468711096343995,"y":31.876756072775212},"world":{"lng":35.468711096343995,"lat":31.833333333333336}},{"pixel":{"x":35.46360757307289,"y":31.72373142188384},"world":{"lng":35.46360757307289,"lat":31.666666666666668}},{"pixel":{"x":35.44972598977552,"y":31.570453703747372},"world":{"lng":35.44972598977552,"lat":31.500000000000004}},{"pixel":{"x":35.449113566982966,"y":31.416749385230997},"world":{"lng":35.449113566982966,"lat":31.333333333333336}},{"pixel":{"x":35.65302928503468,"y":31.262822143485614},"world":{"lng":35.65302928503468,"lat":31.166666666666668}},{"pixel":{"x":35.65242237041612,"y":31.108720359145156},"world":{"lng":35.65242237041612,"lat":31.000000000000004}},{"pixel":{"x":35.64914503147588,"y":30.954784438271904},"world":{"lng":35.64914503147588,"lat":30.833333333333336}},{"pixel":{"x":35.6489022656285,"y":30.800183007950118},"world":{"lng":35.6489022656285,"lat":30.666666666666668}},{"pixel":{"x":35.65539797760065,"y":30.645687293260725},"world":{"lng":35.65539797760065,"lat":30.500000000000004}},{"pixel":{"x":35.65539797760065,"y":30.49074585702965},"world":{"lng":35.65539797760065,"lat":30.333333333333336}},{"pixel":{"x":35.65484046936036,"y":30.33554651541684},"world":{"lng":35.65484046936036,"lat":30.166666666666668}},{"pixel":{"x":35.654411315917976,"y":30.180154036836655},"world":{"lng":35.654411315917976,"lat":30.000000000000004}},{"pixel":{"x":35.65501213073731,"y":30.02459039493858},"world":{"lng":35.65501213073731,"lat":29.833333333333336}},{"pixel":{"x":35.65475463867188,"y":29.868707842421205},"world":{"lng":35.65475463867188,"lat":29.666666666666668}},{"pixel":{"x":35.65501213073731,"y":29.71243225447675},"world":{"lng":35.65501213073731,"lat":29.500000000000004}},{"pixel":{"x":34.3894386291504,"y":32.94278032263393},"world":{"lng":34.333333333333336,"lat":33}},{"pixel":{"x":35.538756953239776,"y":32.940980091135124},"world":{"lng":35.666666666666664,"lat":33}},{"pixel":{"x":34.96117516484789,"y":31.569438250274985},"world":{"lng":35,"lat":31.500000000000004}},{"pixel":{"x":34.51427936553956,"y":30.336768810533894},"world":{"lng":34.5,"lat":30.166666666666668}},{"pixel":{"x":35.25405690756169,"y":30.645072587144828},"world":{"lng":35.333333333333336,"lat":30.500000000000004}}]
        };

        async function loadCalibration(mapName) {
            // Try loading from folder first (allows override with newer calibration)
            if (_folderHandle) {
                try {
                    var fh = await _folderHandle.getFileHandle(calibFileName(mapName));
                    var data = JSON.parse(await (await fh.getFile()).text());
                    if (data.points && data.points.length >= 3) {
                        return fitAffineTransform(data.points);
                    }
                } catch(e) {}
            }
            // Fall back to embedded calibration
            if (EMBEDDED_CALIBRATION[mapName] && EMBEDDED_CALIBRATION[mapName].length >= 3) {
                return fitAffineTransform(EMBEDDED_CALIBRATION[mapName]);
            }
            return null;
        }

        var calibTransforms = {};

        async function getCalibTransform(mapName) {
            if (calibTransforms[mapName] !== undefined) return calibTransforms[mapName];
            var t = await loadCalibration(mapName);
            calibTransforms[mapName] = t;
            setTimeout(function() {
                refreshOverlayMarkers(mapName);
                // Reposition LSA and CVFR markers to display coords for this map
                function repositionPoints(points) {
                    if (!points) return;
                    points.forEach(function(marker) {
                        var ll = marker._realLatLng;
                        if (!ll) return;
                        var disp = toDisplayLatLng(ll);
                        marker.setLatLng(disp);
                    });
                }
                repositionPoints(appState.lsaPoints);
                repositionPoints(appState.cvfrPoints);
                if (appState.waypoints && appState.waypoints.length > 1) updateRoute();
            }, 100);
            return t;
        }

        window.calibrateLatLng = async function(e) {
            var mapName = appState.currentMapName;
            if (mapName !== 'Air Nav Chart' && mapName !== 'AZM Chart') return e.latlng;
            var transform = await getCalibTransform(mapName);
            if (!transform) return e.latlng;
            return applyTransform(transform, e.latlng);
        };

        // Synchronous version: convert display (Leaflet) coords → real WGS84
        // Used during drag when we need immediate conversion
        function calibrateDisplayToReal(latlng) {
            var mapName = appState.currentMapName;
            if (mapName !== 'Air Nav Chart' && mapName !== 'AZM Chart') return latlng;
            var transform = calibTransforms[mapName];
            if (!transform) return latlng;
            return applyTransform(transform, latlng);
        }

        function dms(deg) {
            var d = Math.floor(Math.abs(deg)), m = Math.round((Math.abs(deg)-d)*60);
            return d + '\u00b0' + (m < 10 ? '0' : '') + m + "'";
        }

        function getIntersectionTargets() {
            return [
                { lng: CALIB_LON_LINES[1],  lat: CALIB_LAT_LINES[2]  },
                { lng: CALIB_LON_LINES[9],  lat: CALIB_LAT_LINES[2]  },
                { lng: CALIB_LON_LINES[5],  lat: CALIB_LAT_LINES[11] },
                { lng: CALIB_LON_LINES[2],  lat: CALIB_LAT_LINES[19] },
                { lng: CALIB_LON_LINES[7],  lat: CALIB_LAT_LINES[17] }
            ];
        }

        function updateCalibPanel() {
            var panel = document.getElementById('calibPanel');
            if (!panel) return;
            var ml = calibState.mapName, html = '';
            if (calibState.phase === 'lon') {
                var lon = CALIB_LON_LINES[calibState.lonIdx];
                html = '<div style="font-weight:700;color:#c0392b;font-size:13px;margin-bottom:8px;">\ud83d\udccd Calibration: ' + ml + '</div>' +
                    '<div style="font-size:12px;margin-bottom:6px;"><strong>Phase 1/3 \u2014 Longitude lines (' + (calibState.lonIdx+1) + '/' + CALIB_LON_LINES.length + ')</strong></div>' +
                    '<div style="font-size:12px;background:#fff3cd;padding:8px;border-radius:4px;margin-bottom:8px;">Click on the <strong>' + dms(lon) + ' E</strong> longitude line<br><span style="font-size:11px;color:#666;">Click anywhere along this vertical grid line</span></div>';
            } else if (calibState.phase === 'lat') {
                var lat = CALIB_LAT_LINES[calibState.latIdx];
                html = '<div style="font-weight:700;color:#c0392b;font-size:13px;margin-bottom:8px;">\ud83d\udccd Calibration: ' + ml + '</div>' +
                    '<div style="font-size:12px;margin-bottom:6px;"><strong>Phase 2/3 \u2014 Latitude lines (' + (calibState.latIdx+1) + '/' + CALIB_LAT_LINES.length + ')</strong></div>' +
                    '<div style="font-size:12px;background:#fff3cd;padding:8px;border-radius:4px;margin-bottom:8px;">Click on the <strong>' + dms(lat) + ' N</strong> latitude line<br><span style="font-size:11px;color:#666;">Click anywhere along this horizontal grid line</span></div>';
            } else if (calibState.phase === 'intersections') {
                var t = getIntersectionTargets()[calibState.intIdx];
                html = '<div style="font-weight:700;color:#c0392b;font-size:13px;margin-bottom:8px;">\ud83d\udccd Calibration: ' + ml + '</div>' +
                    '<div style="font-size:12px;margin-bottom:6px;"><strong>Phase 3/3 \u2014 Intersection points (' + (calibState.intIdx+1) + '/' + calibState.intTarget + ')</strong></div>' +
                    '<div style="font-size:12px;background:#d4edda;padding:8px;border-radius:4px;margin-bottom:8px;">Click exactly on intersection:<br><strong>' + dms(t.lng) + ' E / ' + dms(t.lat) + ' N</strong></div>';
            } else {
                html = '<div style="font-weight:700;color:#28a745;font-size:13px;margin-bottom:8px;">\u2705 Calibration Complete!</div>' +
                    '<div style="font-size:12px;margin-bottom:8px;">Transform saved for <strong>' + ml + '</strong>.</div>' +
                    '<button onclick="exitCalibrationMode()" style="width:100%;padding:7px;background:#0066cc;color:white;border:none;border-radius:5px;cursor:pointer;font-size:12px;font-weight:600;">Close Calibration</button>';
            }
            if (calibState.phase !== 'done') {
                html += '<div style="font-size:11px;color:#888;margin-top:4px;margin-bottom:6px;">Points: lon ' + calibState.lonPoints.length + ' | lat ' + calibState.latPoints.length + ' | int ' + calibState.intersections.length + '</div>' +
                    '<div style="display:flex;gap:6px;">' +
                    '<button onclick="calibUndo()" style="flex:1;padding:5px;background:#dc3545;color:white;border:none;border-radius:4px;cursor:pointer;font-size:11px;">\u21a9 Undo</button>' +
                    '<button onclick="exitCalibrationMode()" style="flex:1;padding:5px;background:#6c757d;color:white;border:none;border-radius:4px;cursor:pointer;font-size:11px;">\u2715 Cancel</button></div>';
            }
            panel.innerHTML = html;
        }

        function calibAddMarker(latlng, color, label) {
            var m = L.circleMarker(latlng, { radius: 6, color: color, fillColor: color, fillOpacity: 0.8, weight: 2 }).addTo(appState.map);
            if (label) m.bindTooltip(label, { permanent: true, direction: 'right', offset: [8, 0] });
            calibState.markers.push(m);
        }

        function calibClearMarkers() {
            calibState.markers.forEach(function(m) { appState.map.removeLayer(m); });
            calibState.markers = [];
        }

        window.calibMapClick = function(e) {
            if (!calibState.active) return;
            var latlng = e.latlng;
            // Use latlng as coordinate space — zoom-independent
            var pt = { x: latlng.lng, y: latlng.lat };
            if (calibState.phase === 'lon') {
                var lon = CALIB_LON_LINES[calibState.lonIdx];
                calibState.lonPoints.push({ pixel: { x: pt.x, y: pt.y }, world: { lng: lon, lat: latlng.lat } });
                calibAddMarker(latlng, '#e74c3c', dms(lon) + 'E');
                calibState.lonIdx++;
                if (calibState.lonIdx >= CALIB_LON_LINES.length) { calibState.phase = 'lat'; calibState.latIdx = 0; }
            } else if (calibState.phase === 'lat') {
                var lat = CALIB_LAT_LINES[calibState.latIdx];
                calibState.latPoints.push({ pixel: { x: pt.x, y: pt.y }, world: { lng: latlng.lng, lat: lat } });
                calibAddMarker(latlng, '#3498db', dms(lat) + 'N');
                calibState.latIdx++;
                if (calibState.latIdx >= CALIB_LAT_LINES.length) { calibState.phase = 'intersections'; calibState.intIdx = 0; }
            } else if (calibState.phase === 'intersections') {
                var targets = getIntersectionTargets(), target = targets[calibState.intIdx];
                calibState.intersections.push({ pixel: { x: pt.x, y: pt.y }, world: { lng: target.lng, lat: target.lat } });
                calibAddMarker(latlng, '#27ae60', dms(target.lng) + 'E/' + dms(target.lat) + 'N');
                calibState.intIdx++;
                if (calibState.intIdx >= calibState.intTarget) {
                    calibState.phase = 'done';
                }
            }

            // Save after every point — compute best available transform from all points so far
            var allPoints = calibState.lonPoints.concat(calibState.latPoints).concat(calibState.intersections);
            if (allPoints.length >= 3) {
                var transform = fitAffineTransform(allPoints);
                if (transform) {
                    calibTransforms[calibState.mapName] = transform;
                    saveCalibration(calibState.mapName, transform, allPoints);
                }
            }

            if (calibState.phase === 'done' && !fitAffineTransform(allPoints)) {
                alert('Could not compute transform. Please try again.');
                exitCalibrationMode();
                return;
            }

            updateCalibPanel();
        };

        window.calibUndo = function() {
            if (calibState.phase === 'lon' && calibState.lonIdx > 0) {
                calibState.lonIdx--; calibState.lonPoints.pop();
                if (calibState.markers.length) { appState.map.removeLayer(calibState.markers.pop()); }
            } else if (calibState.phase === 'lat' && calibState.latIdx > 0) {
                calibState.latIdx--; calibState.latPoints.pop();
                if (calibState.markers.length) { appState.map.removeLayer(calibState.markers.pop()); }
            } else if (calibState.phase === 'lat' && calibState.latIdx === 0) {
                calibState.phase = 'lon'; calibState.lonIdx = CALIB_LON_LINES.length - 1; calibState.lonPoints.pop();
                if (calibState.markers.length) { appState.map.removeLayer(calibState.markers.pop()); }
            } else if (calibState.phase === 'intersections' && calibState.intIdx > 0) {
                calibState.intIdx--; calibState.intersections.pop();
                if (calibState.markers.length) { appState.map.removeLayer(calibState.markers.pop()); }
            } else if (calibState.phase === 'intersections' && calibState.intIdx === 0) {
                calibState.phase = 'lat'; calibState.latIdx = CALIB_LAT_LINES.length - 1; calibState.latPoints.pop();
                if (calibState.markers.length) { appState.map.removeLayer(calibState.markers.pop()); }
            }
            updateCalibPanel();
        };

        window.exitCalibrationMode = function() {
            calibState.active = false; calibState.phase = 'lon';
            calibState.lonPoints = []; calibState.latPoints = []; calibState.intersections = [];
            calibState.lonIdx = 0; calibState.latIdx = 0; calibState.intIdx = 0;
            calibClearMarkers();
            appState.map.off('click', calibMapClick);
            document.getElementById('map').style.cursor = '';
            appState.map.getContainer().style.cursor = '';
            var panel = document.getElementById('calibPanel');
            if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
            var btn = document.getElementById('debugToggleBtn');
            if (btn) { btn.textContent = 'Calibrate'; btn.style.background = '#f0f0f0'; btn.style.color = '#333'; btn.style.borderColor = '#999'; }
        };

