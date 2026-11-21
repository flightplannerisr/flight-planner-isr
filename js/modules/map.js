        function toDDMMSS(decimal, isLat) {
            var absolute = Math.abs(decimal);
            var degrees = Math.floor(absolute);
            var minutesDecimal = (absolute - degrees) * 60;
            var minutes = Math.floor(minutesDecimal);
            var seconds = ((minutesDecimal - minutes) * 60).toFixed(2);
            
            var direction = '';
            if (isLat) {
                direction = decimal >= 0 ? 'N' : 'S';
            } else {
                direction = decimal >= 0 ? 'E' : 'W';
            }
            
            return degrees + '° ' + minutes + "' " + seconds + '" ' + direction;
        }
        
        function toggleCoordDisplayMode() {
            appState.coordDisplayMode = !appState.coordDisplayMode;
            var btn = document.getElementById('coordModeBtn');
            var t = translations[appState.language];
            
            if (appState.coordDisplayMode) {
                enableCoordDisplay();
                btn.textContent = t.hideCoordinates;
                btn.classList.remove('btn-secondary');
                btn.classList.add('btn-primary');
            } else {
                disableCoordDisplay();
                btn.textContent = t.showCoordinates;
                btn.classList.remove('btn-primary');
                btn.classList.add('btn-secondary');
            }
        }
        
        function enableCoordDisplay() {
            if (!appState.coordDisplayTooltip) {
                appState.coordDisplayTooltip = L.tooltip({
                    permanent: false,
                    direction: 'right',
                    className: 'coord-tooltip',
                    offset: [10, 0]
                });
            }
            appState.map.on('mousemove', showCoordinatesOnHover);
            // Change cursor to crosshair instead of grab
            var mapContainer = appState.map.getContainer();
            mapContainer.classList.add('coord-mode-active');
        }
        
        function disableCoordDisplay() {
            appState.map.off('mousemove', showCoordinatesOnHover);
            if (appState.coordDisplayTooltip && appState.map.hasLayer(appState.coordDisplayTooltip)) {
                appState.map.closeTooltip(appState.coordDisplayTooltip);
            }
            // Restore normal cursor
            var mapContainer = appState.map.getContainer();
            mapContainer.classList.remove('coord-mode-active');
        }
        
        function showCoordinatesOnHover(e) {
            var lat = e.latlng.lat;
            var lng = e.latlng.lng;
            
            // In Air Nav mode, transform coordinates based on map grid
            if (appState.airNavOnlyMode) {
                var transformed = transformToAirNavCoords(lat, lng);
                lat = transformed.lat;
                lng = transformed.lng;
            }
            
            var content = '<strong>Coordinates:</strong><br>' +
                         'Decimal: ' + lat.toFixed(6) + '°, ' + lng.toFixed(6) + '°<br>' +
                         'DMS: ' + toDDMMSS(lat, true) + ', ' + toDDMMSS(lng, false);
            
            appState.coordDisplayTooltip
                .setLatLng(e.latlng)
                .setContent(content)
                .addTo(appState.map);
        }
        

        function toggleAirNavMode() {
            appState.airNavOnlyMode = !appState.airNavOnlyMode;
            var btn = document.getElementById('airNavBtn');
            var t = translations[appState.language];
            
            if (appState.airNavOnlyMode) {
                // Remove OSM tile layer
                appState.map.eachLayer(function(layer) {
                    if (layer instanceof L.TileLayer) {
                        appState.map.removeLayer(layer);
                    }
                });
                
                // Add blank base layer (very light gray)
                if (!appState.airNavBaseLayer) {
                    appState.airNavBaseLayer = L.tileLayer('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', {
                        attribution: ''
                    });
                }
                appState.airNavBaseLayer.addTo(appState.map);
                
                // Turn off Airstrips in chart-only mode
                if (appState.airstripsVisible) {
                    toggleAirstrips();
                }
                
                // Remove any existing overlay
                if (appState.airNavMapOverlay) {
                    appState.map.removeLayer(appState.airNavMapOverlay);
                }
                
                // Air Nav combined map coordinates (North + South combined)
                // The map shows grid lines from 29°30'N to 33°20'N, 34°10'E to 35°50'E
                // These are the ACTUAL coordinates shown on the map itself
                var southWestLat = 29.5;       // 29°30'N (bottom of map grid)
                var southWestLng = 34.166667;  // 34°10'E (left of map grid)
                var northEastLat = 33.333333;  // 33°20'N (top of map grid)
                var northEastLng = 35.833333;  // 35°50'E (right of map grid)
                
                // Account for white margins
                var latSpan = northEastLat - southWestLat;  // 2.0 degrees
                var lngSpan = northEastLng - southWestLng;  // 1.666667 degrees
                
                var topMargin = 0.0300;
                var bottomMargin = 0.0210;
                var leftMargin = 0.0145;
                var rightMargin = 0.0145;
                
                // Expand bounds to include margins
                var imageSouthWestLat = southWestLat - (bottomMargin * latSpan);
                var imageSouthWestLng = southWestLng - (leftMargin * lngSpan);
                var imageNorthEastLat = northEastLat + (topMargin * latSpan);
                var imageNorthEastLng = northEastLng + (rightMargin * lngSpan);
                
                var mapBounds = [
                    [imageSouthWestLat, imageSouthWestLng],  // SW corner
                    [imageNorthEastLat, imageNorthEastLng]   // NE corner
                ];
                
                appState.airNavMapOverlay = L.imageOverlay(
                    './images/layers/air_nav_combined_aligned.jpg',
                    mapBounds,
                    { opacity: 1.0, interactive: false }
                ).addTo(appState.map);
                
                btn.textContent = t.exitAirNavMode;
                btn.classList.remove('btn-secondary');
                btn.classList.add('btn-primary');
                
                // Fit map to chart bounds
                appState.map.fitBounds(mapBounds);
                
            } else {
                // Remove Air Nav overlay
                if (appState.airNavMapOverlay) {
                    appState.map.removeLayer(appState.airNavMapOverlay);
                    appState.airNavMapOverlay = null;
                }
                
                // Remove blank base layer
                if (appState.airNavBaseLayer) {
                    appState.map.removeLayer(appState.airNavBaseLayer);
                    appState.airNavBaseLayer = null;
                }
                
                // Restore OSM tiles
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19,
                    attribution: '© OpenStreetMap contributors'
                }).addTo(appState.map);
                
                btn.textContent = t.airNavChartMode;
                btn.classList.remove('btn-primary');
                btn.classList.add('btn-secondary');
            }
        }

        function toggleAzmMode() {
            appState.azmOnlyMode = !appState.azmOnlyMode;
            var btn = document.getElementById('azmBtn');
            var t = translations[appState.language];

            if (appState.azmOnlyMode) {
                // Remove OSM tile layer
                appState.map.eachLayer(function(layer) {
                    if (layer instanceof L.TileLayer) {
                        appState.map.removeLayer(layer);
                    }
                });

                // Add blank base layer
                if (!appState.azmBaseLayer) {
                    appState.azmBaseLayer = L.tileLayer('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', {
                        attribution: ''
                    });
                }
                appState.azmBaseLayer.addTo(appState.map);

                if (appState.airstripsVisible) { toggleAirstrips(); }
                if (appState.lsaPointsVisible) { toggleLSAPoints(); }

                if (appState.azmMapOverlay) {
                    appState.map.removeLayer(appState.azmMapOverlay);
                }

                var southWestLat = 29.5;
                var southWestLng = 34.166667;
                var northEastLat = 33.333333;
                var northEastLng = 35.833333;
                var latSpan = northEastLat - southWestLat;
                var lngSpan = northEastLng - southWestLng;
                var topMargin = 0.0300;
                var bottomMargin = 0.0210;
                var leftMargin = 0.0145;
                var rightMargin = 0.0145;
                var mapBounds = [
                    [southWestLat - (bottomMargin * latSpan), southWestLng - (leftMargin * lngSpan)],
                    [northEastLat + (topMargin * latSpan),    northEastLng + (rightMargin * lngSpan)]
                ];

                appState.azmMapOverlay = L.imageOverlay(
                    './images/layers/air_nav_combined_aligned_AZM.jpg',
                    mapBounds,
                    { opacity: 1.0, interactive: false }
                ).addTo(appState.map);

                if (btn) {
                    btn.textContent = t.exitAirNavMode || 'Switch to Street Map';
                    btn.classList.remove('btn-secondary');
                    btn.classList.add('btn-primary');
                }

                appState.map.fitBounds(mapBounds);

            } else {
                if (appState.azmMapOverlay) {
                    appState.map.removeLayer(appState.azmMapOverlay);
                    appState.azmMapOverlay = null;
                }
                if (appState.azmBaseLayer) {
                    appState.map.removeLayer(appState.azmBaseLayer);
                    appState.azmBaseLayer = null;
                }
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19,
                    attribution: '© OpenStreetMap contributors'
                }).addTo(appState.map);

                if (btn) {
                    btn.textContent = 'AZM Chart';
                    btn.classList.remove('btn-primary');
                    btn.classList.add('btn-secondary');
                }
            }
        }
        

        function initMap() {
            // Center on Ben Gurion Airport
            var centerLat = 32.0114;  // Ben Gurion Airport
            var centerLon = 34.8867;
            var defaultZoom = 12;

            // Prevent Leaflet from trying to load marker icon PNGs (breaks dom-to-image)
            delete L.Icon.Default.prototype._getIconUrl;
            L.Icon.Default.mergeOptions({
                iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
                iconRetinaUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
                shadowUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
            });
            appState.map = L.map('map', { 
                zoomControl: true,
                tap: true,
                tapTolerance: 15,
                zoomSnap: 0.25,  // Allow zoom in 0.25 increments (12, 12.25, 12.5, 12.75, 13, etc.)
                zoomDelta: 0.25  // Each zoom button click changes by 0.25
            }).setView([centerLat, centerLon], defaultZoom);
            
            // Base layers
            var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19
            });
            
            var googleStreets = L.tileLayer('http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=he', {
                maxZoom: 20,
                subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
                attribution: '© Google Maps'
            });
            
            var googleSatellite = L.tileLayer('http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}&hl=he', {
                maxZoom: 20,
                subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
                attribution: '© Google Maps'
            });
            
            var googleHybrid = L.tileLayer('http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}&hl=he', {
                maxZoom: 20,
                subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
                attribution: '© Google Maps'
            });
            
            // Exact Leaflet WGS84 bounds derived directly from QGIS EPSG:3857 world files
            var airNavBounds = [[29.505837, 34.087530], [33.425343, 35.938721]];
            var azmCombinedBounds = [[29.507471, 34.079555], [33.424702, 35.938279]];

            // Air Nav Chart layer (image overlay on blank base)
            var airNavChart = L.layerGroup();
            var blankTilesAirNav = L.tileLayer('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', {
                attribution: 'Israel AIP Air Navigation Chart'
            });
            var airNavOverlay = L.imageOverlay('./images/layers/air_nav_combined_aligned.jpg', airNavBounds, {
                opacity: 1.0,
                interactive: false
            });
            airNavChart.addLayer(blankTilesAirNav);
            airNavChart.addLayer(airNavOverlay);

            // AZM Chart layer (image overlay on blank base)
            var azmChart = L.layerGroup();
            var blankTilesAzm = L.tileLayer('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', {
                attribution: 'Israel Civil Aviation Authority – AZM Low Level Chart'
            });
            var azmOverlay = L.imageOverlay('./images/layers/air_nav_combined_aligned_AZM.jpg', azmCombinedBounds, {
                opacity: 1.0,
                interactive: false
            });
            azmChart.addLayer(blankTilesAzm);
            azmChart.addLayer(azmOverlay);
            
            appState.airNavBounds = airNavBounds;
            appState.airNavMapOverlay = airNavOverlay;
            appState.azmCombinedBounds = azmCombinedBounds;
            appState.azmMapOverlay = azmOverlay;
            appState.chartBaseBounds = airNavBounds;
            appState.chartOverlays = {
                'Air Nav Chart': airNavOverlay,
                'AZM Chart': azmOverlay
            };

            // Apply any saved chart map shift
            if (typeof applyChartMapShift === 'function') {
                applyChartMapShift('Air Nav Chart');
                applyChartMapShift('AZM Chart');
            }

            // Start with OpenStreetMap as default
            osm.addTo(appState.map);
            appState.currentMapName = 'OpenStreetMap';
            
            // Layer control
            var baseMaps = {
                "Air Nav Chart": airNavChart,
                "AZM Chart": azmChart,
                "Google Satellite": googleSatellite,
                "Google Hybrid": googleHybrid,
                "Google Streets": googleStreets,
                "OpenStreetMap": osm
            };
            
            L.control.layers(baseMaps).addTo(appState.map);
            appState.baseMaps = baseMaps; // store for programmatic layer switching
            
            // Listen for base layer changes
            appState.map.on('baselayerchange', function(e) {
                // Track current map name for waypoint grouping
                appState.currentMapName = e.name;
                if (e.name === 'Air Nav Chart' || e.name === 'AZM Chart') {
                    if (typeof getCalibTransform === 'function') {
                        getCalibTransform(e.name);
                    }
                    if (typeof applyChartMapShift === 'function') {
                        applyChartMapShift(e.name);
                    }
                }
                setTimeout(function() {
                    if (typeof refreshOverlayMarkers === 'function') {
                        refreshOverlayMarkers(e.name);
                    }
                }, 150);
                if (typeof updateAlignButtonUI === 'function') {
                    updateAlignButtonUI();
                }

                // Recompute displayLat/displayLng for all waypoints based on new map
                appState.waypoints.forEach(function(wp) {
                    if (typeof toDisplayLatLng === 'function') {
                        var disp = toDisplayLatLng(L.latLng(wp.lat, wp.lng));
                        wp.displayLat = disp.lat;
                        wp.displayLng = disp.lng;
                    } else {
                        wp.displayLat = wp.lat;
                        wp.displayLng = wp.lng;
                    }
                });

                // Reposition waypoint circles
                appState.circles.forEach(function(circle, idx) {
                    var wp = appState.waypoints[idx];
                    if (wp) circle.setLatLng([wp.displayLat, wp.displayLng]);
                });

                // Clear old-format positions on map switch (they're display coords, wrong on new map)
                if (!appState.legLabelPositionsAreReal) {
                    appState.legLabelPositions = {};
                }

                // Reposition LSA and CVFR markers to display coords for new map
                function repositionMarkerList(points) {
                    if (!points) return;
                    points.forEach(function(marker) {
                        var ll = marker._realLatLng;
                        if (!ll) return;
                        var disp = (typeof toDisplayLatLng === 'function') ? toDisplayLatLng(ll) : ll;
                        marker.setLatLng(disp);
                    });
                }
                repositionMarkerList(appState.lsaPoints);
                repositionMarkerList(appState.cvfrPoints);
                repositionMarkerList(appState.airstrips);
                repositionMarkerList(appState.reportingPoints);
                repositionAirspaceZones();
                repositionCTRZones();

                updateRoute();

                // Reposition text boxes
                appState.textBoxes.forEach(function(tb) {
                    var data = tb.textBoxData;
                    if (data._realLat !== undefined) {
                        var dispLL = (typeof toDisplayLatLng === 'function')
                            ? toDisplayLatLng(L.latLng(data._realLat, data._realLng))
                            : L.latLng(data._realLat, data._realLng);
                        tb.setLatLng(dispLL);
                    }
                });

                // Reposition highlight circles
                if (typeof repositionHighlightCircles === 'function') {
                    repositionHighlightCircles();
                }

                if (typeof updateAlignButtonUI === 'function') {
                    updateAlignButtonUI();
                }

                // Show AZM-specific warning (once per session)
                var isChartLayer = (e.name === 'Air Nav Chart' || e.name === 'AZM Chart');
                var isAZM = (e.name === 'AZM Chart');
                var azmBanner = document.getElementById('azmWarning');
                var mapEl2 = document.getElementById('map');
                if (isAZM && !window._azmWarningDismissed) {
                    azmBanner.style.display = 'block';
                    mapEl2.classList.add('azm-warning-visible');
                } else {
                    azmBanner.style.display = 'none';
                    mapEl2.classList.remove('azm-warning-visible');
                }

                // If switching to a chart layer, hide CVFR and Airstrips
                if (isChartLayer) {
                    if (appState.cvfrPointsVisible) {
                        toggleCVFRPoints();
                    }
                    if (appState.airstripsVisible) {
                        toggleAirstrips();
                    }
                }
            });
            
            // Initialize airspace zones (hidden by default)
            initAirspaceZones();
            initCTRZones();
            
            // Initialize reporting points (hidden by default)
            initReportingPoints();
            initFrequencies();
            initAirstrips();
            initCVFRPoints();
            initLSAPoints();
            setTimeout(refreshLSARotation, 500);
            // Pre-load calibration for chart maps at startup
            if (appState.currentMapName === 'Air Nav Chart' || appState.currentMapName === 'AZM Chart') {
                getCalibTransform(appState.currentMapName);
            }
            setTimeout(showWhatsNewIfNeeded, 800);
            
            // Show airstrips by default
            if (appState.airstripsVisible) {
                appState.airstrips.forEach(function(marker) {
                    marker.addTo(appState.map);
                });
                var airstripsBtn = document.getElementById('airstripsToggleBtn');
                if (airstripsBtn) {
                    airstripsBtn.textContent = translations[appState.language].hideAirstrips || 'Hide Airstrips';
                    airstripsBtn.classList.add('btn-primary');
                    airstripsBtn.classList.remove('btn-secondary');
                }
            }
            
            // Show CVFR points by default
            if (appState.cvfrPointsVisible) {
                appState.cvfrPoints.forEach(function(marker) {
                    marker.addTo(appState.map);
                });
                var cvfrBtn = document.getElementById('cvfrPointsToggleBtn');
                if (cvfrBtn) {
                    cvfrBtn.textContent = translations[appState.language].hideCVFRPoints || 'Hide CVFR Points';
                    cvfrBtn.classList.add('btn-primary');
                    cvfrBtn.classList.remove('btn-secondary');
                }
            }
            
            
            // Show LSA points by default
            if (appState.lsaPointsVisible) {
                appState.lsaPoints.forEach(function(marker) {
                    marker.addTo(appState.map);
                });
                var lsaBtn = document.getElementById('lsaPointsToggleBtn');
                if (lsaBtn) {
                    lsaBtn.textContent = translations[appState.language].hideLSAPoints || 'Hide LSA Points';
                    lsaBtn.classList.add('btn-primary');
                    lsaBtn.classList.remove('btn-secondary');
                }
            }

            // Update zoom indicator
            function updateZoomIndicator() {
                var zoom = appState.map.getZoom();
                document.getElementById('zoom-indicator').textContent = 'Zoom: ' + zoom;
            }
            
            appState.map.on('zoomend', function() {
                updateZoomIndicator();
                updateRoute();
                updateTextBoxes();
                refreshLSAVisibility();
                setTimeout(refreshLSARotation, 150);
            });
            appState.map.on('moveend', function() {
                setTimeout(refreshLSARotation, 100);
            });
            updateZoomIndicator();

            // Fix Leaflet popup close button — prevent the <a href="#"> from
            // triggering "open external link" prompts in certain environments.
            appState.map.on('popupopen', function() {
                var closeBtn = document.querySelector('.leaflet-popup-close-button');
                if (closeBtn) {
                    closeBtn.removeAttribute('href');
                    closeBtn.style.cursor = 'pointer';
                    closeBtn.addEventListener('click', function(e) {
                        e.preventDefault();
                    }, { once: true });
                }
            });
            
            // Map click handler
            appState.map.on('click', function(e) {
                if (!appState.isDrawing) return;
                if (appState._drawClickHandled) { appState._drawClickHandled = false; return; }

                var clickPt = appState.map.latLngToContainerPoint(e.latlng);
                var navPoint = (typeof findNearbyNavPoint === 'function') ? findNearbyNavPoint(clickPt, e.originalEvent) : null;
                if (navPoint) {
                    addWaypoint(navPoint.lat, navPoint.lng, navPoint.name);
                    return;
                }

                // Apply calibration correction if on a calibrated chart map
                var latlng = e.latlng;
                if (typeof calibrateLatLng === 'function') {
                    calibrateLatLng(e).then(function(corrected) {
                        addWaypoint(corrected.lat, corrected.lng);
                    });
                } else {
                    addWaypoint(latlng.lat, latlng.lng);
                }
            });
            
            // Mouse move for preview
            appState.map.on('mousemove', function(e) {
                if (!appState.isDrawing || appState.waypoints.length === 0) {
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
                    return;
                }
                
                showPreview(e.latlng);
            });

            if (typeof updateAlignButtonUI === 'function') {
                updateAlignButtonUI();
            }
        }

        function initAirspaceZones() {
            // Remove existing layers if any
            if (appState.airspaceZones && appState.airspaceZones.length > 0) {
                appState.airspaceZones.forEach(function(zone) {
                    if (appState.map && appState.map.hasLayer(zone)) {
                        appState.map.removeLayer(zone);
                    }
                });
            }
            appState.airspaceZones = [];

            if (typeof specialAirspaceData === 'undefined' || !Array.isArray(specialAirspaceData)) {
                return;
            }

            specialAirspaceData.forEach(function(zone) {
                var style = {
                    className: 'special-airspace-layer',
                    weight: 2,
                    interactive: true
                };

                var typeLabelEn = zone.type;
                var typeLabelHe = zone.type;
                var headerColor = '#d32f2f';

                if (zone.type === 'Prohibited') {
                    style.color = '#c62828';
                    style.fillColor = '#d32f2f';
                    style.fillOpacity = 0.22;
                    typeLabelEn = 'Prohibited Area';
                    typeLabelHe = 'אזור אסור לטיסה (LLP)';
                    headerColor = '#b71c1c';
                } else if (zone.type === 'Restricted') {
                    style.color = '#e65100';
                    style.fillColor = '#ef6c00';
                    style.fillOpacity = 0.20;
                    typeLabelEn = 'Restricted Area';
                    typeLabelHe = 'אזור מוגבל לטיסה (LLR)';
                    headerColor = '#bf360c';
                } else if (zone.type === 'Danger') {
                    style.color = '#f57f17';
                    style.fillColor = '#fbc02d';
                    style.fillOpacity = 0.18;
                    style.dashArray = '5, 5';
                    typeLabelEn = 'Danger Area';
                    typeLabelHe = 'אזור מסוכן לטיסה (LLD)';
                    headerColor = '#e65100';
                } else if (zone.type === 'UAS_NoFly') {
                    style.color = '#6a1b9a';
                    style.fillColor = '#8e24aa';
                    style.fillOpacity = 0.15;
                    style.weight = 1.5;
                    style.dashArray = '4, 4';
                    typeLabelEn = 'UAS / Drone No-Fly Zone';
                    typeLabelHe = 'איסור הטסת כטב"ם/רחפנים (LLU)';
                    headerColor = '#4a148c';
                } else if (zone.type === 'CTR') {
                    style.color = '#1565c0';
                    style.fillColor = '#1976d2';
                    style.fillOpacity = 0.15;
                    typeLabelEn = 'Control Zone (CTR)';
                    typeLabelHe = 'אזור פיקוח שדה תעופה (CTR)';
                    headerColor = '#0d47a1';
                } else {
                    style.color = '#546e7a';
                    style.fillColor = '#78909c';
                    style.fillOpacity = 0.18;
                }

                var layer = null;
                if (zone.geom.type === 'Circle') {
                    var centerLL = L.latLng(zone.geom.center[0], zone.geom.center[1]);
                    var dispLL = (typeof toDisplayLatLng === 'function') ? toDisplayLatLng(centerLL) : centerLL;
                    var opts = Object.assign({}, style, { radius: zone.geom.radius });
                    layer = L.circle([dispLL.lat, dispLL.lng], opts);
                    layer._realLatLng = centerLL;
                    layer._geomType = 'Circle';
                } else if (zone.geom.type === 'Polygon') {
                    var realLatLngs = zone.geom.coordinates.map(function(c) {
                        return L.latLng(c[0], c[1]);
                    });
                    var dispLatLngs = realLatLngs.map(function(ll) {
                        return (typeof toDisplayLatLng === 'function') ? toDisplayLatLng(ll) : ll;
                    });
                    layer = L.polygon(dispLatLngs, style);
                    layer._realLatLngs = realLatLngs;
                    layer._geomType = 'Polygon';
                }

                if (!layer) return;

                layer._airspaceData = zone;

                var isHebrew = (appState.language !== 'en');
                var popupContent = '<div style="direction: ' + (isHebrew ? 'rtl' : 'ltr') + '; text-align: ' + (isHebrew ? 'right' : 'left') + '; font-family: sans-serif; font-size: 12px; line-height: 1.4; min-width: 170px;">' +
                    '<div style="font-weight: bold; font-size: 13px; color: ' + headerColor + '; border-bottom: 1px solid #ccc; padding-bottom: 3px; margin-bottom: 5px;">' +
                    zone.code + ' &bull; ' + (isHebrew ? typeLabelHe : typeLabelEn) +
                    '</div>' +
                    (zone.name ? '<div style="font-weight: 600; font-size: 12px; margin-bottom: 5px; color: #222;">' + zone.name + '</div>' : '') +
                    '<div style="font-size: 11px; color: #444;">' +
                    '<div><strong>' + (isHebrew ? 'גובה מזערי (Floor):' : 'Floor:') + '</strong> ' + (zone.floor || 'GND') + '</div>' +
                    '<div><strong>' + (isHebrew ? 'גובה מרבי (Ceiling):' : 'Ceiling:') + '</strong> ' + (zone.ceiling || 'UNL') + '</div>' +
                    '</div>' +
                    '<div style="font-size: 10px; color: #777; margin-top: 6px; border-top: 1px dotted #ccc; padding-top: 3px;">' +
                    (isHebrew ? '⚠️ נתוני פמ"ת 26A — יש לוודא עדכניות מול פמ"ת/נוטאם' : '⚠️ Valid for AIP 26A — verify latest AIP/NOTAMs') +
                    '</div>' +
                    '</div>';

                layer.bindPopup(popupContent);
                var verticalLimits = (zone.floor || 'GND') + ' – ' + (zone.ceiling || 'UNL');
                var tooltipHtml = '<div style="font-size: 11px; line-height: 1.35; text-align: center;">' +
                    '<strong>' + zone.code + '</strong>' + (zone.name ? ' &bull; ' + zone.name : '') + '<br>' +
                    '<span style="font-weight: 600; color: #0d47a1;">↕ ' + verticalLimits + '</span>' +
                    '</div>';
                layer.bindTooltip(tooltipHtml, { sticky: true, opacity: 0.95 });

                appState.airspaceZones.push(layer);
            });
        }

        function repositionAirspaceZones() {
            if (!appState.airspaceZones) return;
            appState.airspaceZones.forEach(function(layer) {
                if (layer._geomType === 'Circle' && layer._realLatLng) {
                    var disp = (typeof toDisplayLatLng === 'function') ? toDisplayLatLng(layer._realLatLng) : layer._realLatLng;
                    layer.setLatLng(disp);
                } else if (layer._geomType === 'Polygon' && layer._realLatLngs) {
                    var dispLatLngs = layer._realLatLngs.map(function(ll) {
                        return (typeof toDisplayLatLng === 'function') ? toDisplayLatLng(ll) : ll;
                    });
                    layer.setLatLngs(dispLatLngs);
                }
            });
        }
        
        function toggleAirspace() {
            appState.airspaceVisible = !appState.airspaceVisible;
            var btn = document.getElementById('airspaceToggleBtn');
            var noticeEl = document.getElementById('airspaceNotice');
            var isHebrew = (appState.language !== 'en');
            
            if (appState.airspaceVisible) {
                if (btn) {
                    btn.textContent = (translations[appState.language] && translations[appState.language].hideAirspace) || (isHebrew ? 'הסתר מרחב אווירי' : 'Hide Airspace');
                    btn.classList.add('btn-primary');
                    btn.classList.remove('btn-secondary');
                }
                if (noticeEl) {
                    noticeEl.style.display = 'block';
                }
                appState.airspaceZones.forEach(function(zone) {
                    zone.addTo(appState.map);
                });
            } else {
                if (btn) {
                    btn.textContent = (translations[appState.language] && translations[appState.language].airspaceToggle) || (isHebrew ? 'הצג מרחב אווירי' : 'Show Airspace');
                    btn.classList.remove('btn-primary');
                    btn.classList.add('btn-secondary');
                }
                if (noticeEl) {
                    noticeEl.style.display = 'none';
                }
                appState.airspaceZones.forEach(function(zone) {
                    appState.map.removeLayer(zone);
                });
            }
        }
        
        function initCTRZones() {
            // Remove existing layers if any
            if (appState.ctrZones && appState.ctrZones.length > 0) {
                appState.ctrZones.forEach(function(zone) {
                    if (appState.map && appState.map.hasLayer(zone)) {
                        appState.map.removeLayer(zone);
                    }
                });
            }
            appState.ctrZones = [];

            if (typeof ctrZonesData === 'undefined' || !Array.isArray(ctrZonesData)) {
                return;
            }

            ctrZonesData.forEach(function(zone) {
                var style = {
                    className: 'ctr-layer',
                    color: '#1565c0',
                    weight: 2,
                    fillColor: '#1976d2',
                    fillOpacity: 0.16,
                    interactive: true
                };

                var layer = null;
                if (zone.geom.type === 'Circle') {
                    var centerLL = L.latLng(zone.geom.center[0], zone.geom.center[1]);
                    var dispLL = (typeof toDisplayLatLng === 'function') ? toDisplayLatLng(centerLL) : centerLL;
                    var opts = Object.assign({}, style, { radius: zone.geom.radius });
                    layer = L.circle([dispLL.lat, dispLL.lng], opts);
                    layer._realLatLng = centerLL;
                    layer._geomType = 'Circle';
                } else if (zone.geom.type === 'Polygon') {
                    var realLatLngs = zone.geom.coordinates.map(function(c) {
                        return L.latLng(c[0], c[1]);
                    });
                    var dispLatLngs = realLatLngs.map(function(ll) {
                        return (typeof toDisplayLatLng === 'function') ? toDisplayLatLng(ll) : ll;
                    });
                    layer = L.polygon(dispLatLngs, style);
                    layer._realLatLngs = realLatLngs;
                    layer._geomType = 'Polygon';
                }

                if (!layer) return;

                layer._ctrData = zone;

                var isHebrew = (appState.language !== 'en');
                var zoneName = isHebrew ? (zone.nameHe || zone.name) : (zone.nameEn || zone.name);
                var popupContent = '<div style="direction: ' + (isHebrew ? 'rtl' : 'ltr') + '; text-align: ' + (isHebrew ? 'right' : 'left') + '; font-family: sans-serif; font-size: 12px; line-height: 1.4; min-width: 170px;">' +
                    '<div style="font-weight: bold; font-size: 13px; color: #0d47a1; border-bottom: 1px solid #ccc; padding-bottom: 3px; margin-bottom: 5px;">' +
                    zone.code + ' &bull; ' + (isHebrew ? 'אזור פיקוח (CTR)' : 'Control Zone (CTR)') +
                    '</div>' +
                    '<div style="font-weight: 600; font-size: 12px; margin-bottom: 5px; color: #222;">' + zoneName + '</div>' +
                    '<div style="font-size: 11px; color: #444;">' +
                    (zone.airspaceClass ? '<div><strong>' + (isHebrew ? 'סיווג מרחב:' : 'Class:') + '</strong> ' + zone.airspaceClass + '</div>' : '') +
                    '<div><strong>' + (isHebrew ? 'גובה מזערי (Floor):' : 'Floor:') + '</strong> ' + (zone.floor || 'SFC') + '</div>' +
                    '<div><strong>' + (isHebrew ? 'גובה מרבי (Ceiling):' : 'Ceiling:') + '</strong> ' + (zone.ceiling || 'UNL') + '</div>' +
                    (zone.callsign ? '<div><strong>' + (isHebrew ? 'קריאה (Callsign):' : 'Callsign:') + '</strong> ' + zone.callsign + '</div>' : '') +
                    '</div>' +
                    '<div style="font-size: 10px; color: #777; margin-top: 6px; border-top: 1px dotted #ccc; padding-top: 3px;">' +
                    (isHebrew ? '⚠️ נתוני פמ"ת 26A / eAIP AD 2.17' : '⚠️ Valid for AIP 26A / eAIP AD 2.17') +
                    '</div>' +
                    '</div>';

                layer.bindPopup(popupContent);

                var verticalLimits = (zone.floor || 'SFC') + ' – ' + (zone.ceiling || 'UNL');
                var tooltipHtml = '<div style="font-size: 11px; line-height: 1.35; text-align: center;">' +
                    '<strong>' + zone.code + '</strong>' + (zoneName ? ' &bull; ' + zoneName : '') + '<br>' +
                    '<span style="font-weight: 600; color: #0d47a1;">↕ ' + verticalLimits + '</span>' +
                    '</div>';
                layer.bindTooltip(tooltipHtml, { sticky: true, opacity: 0.95 });

                appState.ctrZones.push(layer);
            });

            if (appState.ctrsVisible && appState.map) {
                appState.ctrZones.forEach(function(zone) {
                    zone.addTo(appState.map);
                });
            }
        }

        function repositionCTRZones() {
            if (!appState.ctrZones) return;
            appState.ctrZones.forEach(function(layer) {
                if (layer._geomType === 'Circle' && layer._realLatLng) {
                    var disp = (typeof toDisplayLatLng === 'function') ? toDisplayLatLng(layer._realLatLng) : layer._realLatLng;
                    layer.setLatLng(disp);
                } else if (layer._geomType === 'Polygon' && layer._realLatLngs) {
                    var dispLatLngs = layer._realLatLngs.map(function(ll) {
                        return (typeof toDisplayLatLng === 'function') ? toDisplayLatLng(ll) : ll;
                    });
                    layer.setLatLngs(dispLatLngs);
                }
            });
        }

        function toggleCTRs() {
            var now = Date.now();
            if (toggleCTRs._lastClick && (now - toggleCTRs._lastClick < 200)) {
                return;
            }
            toggleCTRs._lastClick = now;

            if (!appState.ctrZones || appState.ctrZones.length === 0) {
                initCTRZones();
            }

            appState.ctrsVisible = !appState.ctrsVisible;
            var btn = document.getElementById('ctrToggleBtn');
            var isHebrew = (appState.language !== 'en');
            var t = (typeof translations !== 'undefined' && translations[appState.language]) || {};

            if (appState.ctrsVisible) {
                if (btn) {
                    btn.textContent = t.hideCTRs || (isHebrew ? 'הסתר אזורי פיקוח (CTR)' : 'Hide CTRs');
                    btn.classList.add('btn-primary');
                    btn.classList.remove('btn-secondary');
                }
                appState.ctrZones.forEach(function(zone) {
                    zone.addTo(appState.map);
                });
            } else {
                if (btn) {
                    btn.textContent = t.showCTRs || (isHebrew ? 'הצג אזורי פיקוח (CTR)' : 'Show CTRs');
                    btn.classList.remove('btn-primary');
                    btn.classList.add('btn-secondary');
                }
                appState.ctrZones.forEach(function(zone) {
                    appState.map.removeLayer(zone);
                });
            }
        }
        

        function initReportingPoints() {
            reportingPointsData.forEach(function(point) {
                var bgColor = '#FF6B00'; // Orange for VFR
                if (point.type === 'Airfield') bgColor = '#9C27B0'; // Purple for airfields
                
                var icon = L.divIcon({
                    className: 'reporting-point-marker',
                    html: '<div style="background: ' + bgColor + '; color: white; padding: 3px 6px; border-radius: 3px; font-size: 10px; font-weight: bold; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.3); border: 1px solid white;">' + 
                          point.name + 
                          '</div>',
                    iconSize: [null, null],
                    iconAnchor: [0, 0]
                });
                
                var marker = L.marker([point.lat, point.lng], {
                    icon: icon,
                    title: point.name + ' (' + point.type + ')'
                });
                marker._realLatLng = L.latLng(point.lat, point.lng);
                marker._navPoint = point;
                
                marker.bindPopup(
                    '<strong>' + point.name + '</strong><br>' +
                    'Type: ' + point.type + '<br>' +
                    'Position: ' + point.lat.toFixed(4) + '°N, ' + point.lng.toFixed(4) + '°E'
                );
                
                appState.reportingPoints.push(marker);
            });
        }
        
        function toggleReportingPoints() {
            appState.reportingPointsVisible = !appState.reportingPointsVisible;
            var btn = document.getElementById('reportingPointsToggleBtn');
            
            if (appState.reportingPointsVisible) {
                appState.reportingPoints.forEach(function(marker) {
                    marker.addTo(appState.map);
                });
                if (btn) {
                    btn.textContent = translations[appState.language].hideReportingPoints || 'Hide Reporting Points';
                    btn.classList.add('btn-primary');
                    btn.classList.remove('btn-secondary');
                }
            } else {
                appState.reportingPoints.forEach(function(marker) {
                    appState.map.removeLayer(marker);
                });
                if (btn) {
                    btn.textContent = translations[appState.language].showReportingPoints || 'Show Reporting Points';
                    btn.classList.remove('btn-primary');
                    btn.classList.add('btn-secondary');
                }
            }
        }
        
        function initFrequencies() {
            frequenciesData.forEach(function(freq) {
                var icon = L.divIcon({
                    className: 'frequency-marker',
                    html: '<div style="background: #00BCD4; color: white; padding: 3px 6px; border-radius: 3px; font-size: 10px; font-weight: bold; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.3); border: 1px solid white;">' + 
                          freq.name + 
                          '</div>',
                    iconSize: [null, null],
                    iconAnchor: [0, 0]
                });
                
                var marker = L.marker([freq.lat, freq.lng], {
                    icon: icon,
                    title: freq.name
                });
                
                marker.bindPopup(
                    '<strong>' + freq.name + '</strong><br>' +
                    'Position: ' + freq.lat.toFixed(4) + '°N, ' + freq.lng.toFixed(4) + '°E'
                );
                
                appState.frequencies.push(marker);
            });
        }
        
        function toggleFrequencies() {
            appState.frequenciesVisible = !appState.frequenciesVisible;
            var btn = document.getElementById('frequenciesToggleBtn');
            
            if (appState.frequenciesVisible) {
                appState.frequencies.forEach(function(marker) {
                    marker.addTo(appState.map);
                });
                if (btn) {
                    btn.textContent = translations[appState.language].hideFrequencies || 'Hide Frequencies';
                    btn.classList.add('btn-primary');
                    btn.classList.remove('btn-secondary');
                }
            } else {
                appState.frequencies.forEach(function(marker) {
                    appState.map.removeLayer(marker);
                });
                if (btn) {
                    btn.textContent = translations[appState.language].showFrequencies || 'Show Frequencies';
                    btn.classList.remove('btn-primary');
                    btn.classList.add('btn-secondary');
                }
            }
        }
        
        function initAirstrips() {
            airstripsData.forEach(function(strip) {
                // Create runway icon (larger and more visible)
                var runwayWidth = 30;
                var runwayHeight = 6;
                
                // Get runway heading if available, otherwise use default (horizontal)
                var runwayHeading = strip.heading || 90; // degrees from north (90 = east-west)
                
                var svgRunway = '<svg width="' + runwayWidth + '" height="' + runwayHeight + '" style="overflow: visible;">' +
                    '<rect x="0" y="0" width="' + runwayWidth + '" height="' + runwayHeight + '" ' +
                    'fill="#555" stroke="#222" stroke-width="1"/>' +
                    // Centerline dashes (more visible)
                    '<line x1="' + (runwayWidth * 0.2) + '" y1="' + (runwayHeight/2) + '" ' +
                    'x2="' + (runwayWidth * 0.35) + '" y2="' + (runwayHeight/2) + '" ' +
                    'stroke="#FFF" stroke-width="1"/>' +
                    '<line x1="' + (runwayWidth * 0.45) + '" y1="' + (runwayHeight/2) + '" ' +
                    'x2="' + (runwayWidth * 0.55) + '" y2="' + (runwayHeight/2) + '" ' +
                    'stroke="#FFF" stroke-width="1"/>' +
                    '<line x1="' + (runwayWidth * 0.65) + '" y1="' + (runwayHeight/2) + '" ' +
                    'x2="' + (runwayWidth * 0.8) + '" y2="' + (runwayHeight/2) + '" ' +
                    'stroke="#FFF" stroke-width="1"/>' +
                    '</svg>';
                
                var icon = L.divIcon({
                    className: 'airstrip-marker',
                    html: '<div style="position: relative; text-align: center;">' +
                          // Runway icon with rotation
                          '<div style="margin-left: -' + (runwayWidth/2) + 'px; ' +
                          'transform: rotate(' + runwayHeading + 'deg); transform-origin: center;">' + 
                          svgRunway + 
                          '</div>' +
                          // Name label below (not rotated)
                          '<div style="position: absolute; left: 50%; transform: translateX(-50%); top: ' + (runwayHeight + 4) + 'px; ' +
                          'white-space: nowrap; font-size: 9px; font-weight: bold; color: #000; ' +
                          'background: #FF9800; padding: 2px 5px; border-radius: 3px; ' +
                          'box-shadow: 0 1px 3px rgba(0,0,0,0.3);">' + 
                          strip.name + 
                          '</div>' +
                          '</div>',
                    iconSize: [runwayWidth, runwayHeight],
                    iconAnchor: [runwayWidth/2, runwayHeight/2]
                });
                
                var marker = L.marker([strip.lat, strip.lng], {
                    icon: icon,
                    title: strip.name
                });
                marker._realLatLng = L.latLng(strip.lat, strip.lng);
                marker._navPoint = strip;
                
                marker.bindPopup(
                    '<strong>' + strip.name + '</strong><br>' +
                    'Type: Airstrip<br>' +
                    'Position: ' + strip.lat.toFixed(4) + '°N, ' + strip.lng.toFixed(4) + '°E'
                );
                
                appState.airstrips.push(marker);
            });
        }
        
        function toggleAirstrips() {
            appState.airstripsVisible = !appState.airstripsVisible;
            var btn = document.getElementById('airstripsToggleBtn');
            
            if (appState.airstripsVisible) {
                appState.airstrips.forEach(function(marker) {
                    marker.addTo(appState.map);
                });
                if (btn) {
                    btn.textContent = translations[appState.language].hideAirstrips || 'Hide Airstrips';
                    btn.classList.add('btn-primary');
                    btn.classList.remove('btn-secondary');
                }
            } else {
                appState.airstrips.forEach(function(marker) {
                    appState.map.removeLayer(marker);
                });
                if (btn) {
                    btn.textContent = translations[appState.language].showAirstrips || 'Show Airstrips';
                    btn.classList.remove('btn-primary');
                    btn.classList.add('btn-secondary');
                }
            }
        }
        
        function initCVFRPoints() {
            cvfrPointsData.forEach(function(point) {
                // Always show Hebrew names for CVFR points on the map
                var displayName = point.name_he;
                
                // Create triangle marker based on type
                var isMandatory = point.type === 'compulsory';
                var triangleColor = isMandatory ? '#000000' : 'none'; // Black fill for mandatory, empty for on-request
                var triangleStroke = '#000000'; // Black stroke for both
                var triangleSize = 10; // Size of triangle
                
                // Create SVG triangle marker
                var svgTriangle = '<svg width="' + triangleSize + '" height="' + triangleSize + '" style="overflow: visible;">' +
                    '<polygon points="' + (triangleSize/2) + ',0 ' + triangleSize + ',' + triangleSize + ' 0,' + triangleSize + '" ' +
                    'fill="' + triangleColor + '" stroke="' + triangleStroke + '" stroke-width="1.5"/>' +
                    '</svg>';
                
                var icon = L.divIcon({
                    className: 'cvfr-triangle-marker',
                    html: '<div style="position: relative; text-align: center;">' +
                          '<div style="margin-left: -' + (triangleSize/2) + 'px;">' + svgTriangle + '</div>' +
                          '<div style="position: absolute; left: 50%; transform: translateX(-50%); top: ' + (triangleSize + 2) + 'px; ' +
                          'white-space: nowrap; font-size: 9px; font-weight: bold; color: #000; ' +
                          'text-shadow: -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff;">' + 
                          displayName + 
                          '</div>' +
                          '</div>',
                    iconSize: [triangleSize, triangleSize],
                    iconAnchor: [triangleSize/2, triangleSize/2]
                });
                
                var dispPos = (typeof toDisplayLatLng === 'function') ? toDisplayLatLng(L.latLng(point.lat, point.lng)) : L.latLng(point.lat, point.lng);
                var marker = L.marker([dispPos.lat, dispPos.lng], {
                    icon: icon,
                    title: displayName
                });
                marker._realLatLng = L.latLng(point.lat, point.lng);
                marker._navPoint = point;
                
                var pointType = isMandatory ? 'Compulsory Reporting' : 'On-Request Reporting';
                marker.bindPopup(
                    '<strong>' + point.name + '</strong><br>' +
                    '<strong>' + point.name_he + '</strong><br>' +
                    'Type: CVFR ' + pointType + '<br>' +
                    'Position: ' + point.lat.toFixed(4) + '°N, ' + point.lng.toFixed(4) + '°E'
                );
                
                appState.cvfrPoints.push(marker);
            });
        }
        

        function initLSAPoints() {
            lsaPointsData.forEach(function(point) {
                // Always show Hebrew names
                var displayName = point.name_he;
                
                // Create triangle marker based on type
                var isMandatory = point.type === 'compulsory';
                var triangleColor = isMandatory ? '#000000' : 'none'; // Black fill for mandatory, empty for on-request
                var triangleStroke = '#000000'; // Black stroke for both
                var triangleSize = 10; // Size of triangle
                
                // Create SVG triangle marker
                var svgTriangle = '<svg width="' + triangleSize + '" height="' + triangleSize + '" style="overflow: visible;">' +
                    '<polygon points="' + (triangleSize/2) + ',0 ' + triangleSize + ',' + triangleSize + ' 0,' + triangleSize + '" ' +
                    'fill="' + triangleColor + '" stroke="' + triangleStroke + '" stroke-width="1.5"/>' +
                    '</svg>';
                
                var icon = L.divIcon({
                    className: 'lsa-triangle-marker',
                    html: '<div style="position: relative; text-align: center;">' +
                          '<div class="lsa-tri" style="margin-left: -' + (triangleSize/2) + 'px;display:inline-block;transform-origin:center center;">' + svgTriangle + '</div>' +
                          '<div style="position: absolute; left: 50%; transform: translateX(-50%); top: ' + (triangleSize + 2) + 'px; ' +
                          'white-space: nowrap; font-size: 9px; font-weight: bold; color: #000; ' +
                          'text-shadow: -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff;">' + 
                          displayName + 
                          '</div>' +
                          '</div>',
                    iconSize: [triangleSize, triangleSize],
                    iconAnchor: [triangleSize/2, triangleSize/2]
                });
                
                var dispPos = (typeof toDisplayLatLng === 'function') ? toDisplayLatLng(L.latLng(point.lat, point.lng)) : L.latLng(point.lat, point.lng);
                var marker = L.marker([dispPos.lat, dispPos.lng], {
                    icon: icon,
                    title: displayName
                });
                marker._realLatLng = L.latLng(point.lat, point.lng);
                marker._navPoint = point;
                
                var pointType = isMandatory ? 'Compulsory Reporting' : 'On-Request Reporting';
                marker.bindPopup(
                    '<strong>' + point.name + '</strong><br>' +
                    '<strong>' + point.name_he + '</strong><br>' +
                    'Type: LSA/AZM ' + pointType + '<br>' +
                    'Position: ' + point.lat.toFixed(4) + '°N, ' + point.lng.toFixed(4) + '°E'
                );
                
                appState.lsaPoints.push(marker);
            });
        }
        
        function toggleCVFRPoints() {
            appState.cvfrPointsVisible = !appState.cvfrPointsVisible;
            var btn = document.getElementById('cvfrPointsToggleBtn');
            
            if (appState.cvfrPointsVisible) {
                appState.cvfrPoints.forEach(function(marker) {
                    marker.addTo(appState.map);
                });
                if (btn) {
                    btn.textContent = translations[appState.language].hideCVFRPoints || 'Hide CVFR Points';
                    btn.classList.add('btn-primary');
                    btn.classList.remove('btn-secondary');
                }
            } else {
                appState.cvfrPoints.forEach(function(marker) {
                    appState.map.removeLayer(marker);
                });
                if (btn) {
                    btn.textContent = translations[appState.language].showCVFRPoints || 'Show CVFR Points';
                    btn.classList.remove('btn-primary');
                    btn.classList.add('btn-secondary');
                }
            }
        }
        
        function updateCVFRPointsLanguage() {
            // Remove old markers
            appState.cvfrPoints.forEach(function(marker) {
                appState.map.removeLayer(marker);
            });
            appState.cvfrPoints = [];
            
            // Re-initialize with new language
            initCVFRPoints();
            
            // Re-add to map if they were visible
            if (appState.cvfrPointsVisible) {
                appState.cvfrPoints.forEach(function(marker) {
                    marker.addTo(appState.map);
                });
            }
        }
        

        function showWhatsNewIfNeeded(force) {
            var CURRENT_VERSION = 'v3.7';

            // Full changelog — each entry has version, icon, title, and items
                            var CHANGELOG = [
                {
                    version: 'v3.7',
                    icon: '&#128506;',
                    title: 'Air Nav Chart',
                    items: [
                        'Updated the Air Nav Chart to the 2026 edition'
                    ]
                },
                {
                    version: 'v3.6.9',
                    icon: '🔧',
                    title: 'Bug Fixes',
                    items: [
                        'LSA/CVFR icons now correctly reposition when switching between maps',
                        'Text boxes now correctly reposition when switching between maps',
                        'The AirNav/AZM projection warning banner is shown only once per session',
                        'Select Area capture now works correctly on both OSM and AirNav maps'
                    ]
                },
                {
                    version: 'v3.6.9',
                    icon: '&#9888;',
                    title: 'AZM Map',
                    items: [
                        'Added a notice banner when switching to the AZM map, warning that route distances and headings are currently inaccurate due to projection differences'
                    ]
                },
                {
                    version: 'v3.6.9',
                    icon: '&#128465;',
                    title: 'Display',
                    items: [
                        'Removed the Hide Leg Time button — use the per-waypoint label settings instead'
                    ]
                },
                {
                    version: 'v3.6.7',
                    icon: '&#127968;',
                    title: 'Infrastructure',
                    items: [
                        'The app is now hosted on GitHub Pages for improved reliability and faster load times'
                    ]
                },
                {
                    version: 'v3.6.7',
                    icon: '&#128196;',
                    title: 'Print & Export',
                    items: [
                        'A3 paper size is now supported alongside A4',
                        'Multi-page print significantly improved: pages can be freely dragged to cover any map area, each page can be set to portrait or landscape independently'
                    ]
                },
                {
                    version: 'v3.6.3',
                    icon: '&#128296;',
                    title: 'Bug Fixes',
                    items: [
                        'Info boxes now stay in place when adding or removing mini waypoints',
                        'Leg label positions are correctly restored when loading saved plans',
                        'LSA points now stay visible on AirNav map according to your Hide/Show preference'
                    ]
                },
                {
                    version: 'v3.6.2',
                    icon: '&#128296;',
                    title: 'Bug Fixes',
                    items: [
                        'LSA points now correctly positioned on Air Nav map without requiring a working folder'
                    ]
                },
                {
                    version: 'v3.6.1',
                    icon: '&#128296;',
                    title: 'Bug Fixes',
                    items: [
                        'LSA points now correctly positioned on Air Nav map without requiring a working folder'
                    ]
                },
                {
                    version: 'v3.6',
                    icon: '&#128507;',
                    title: 'Map',
                    items: [
                        'The Air Nav chart is now calibrated — it can be used for accurate route planning',
                        'Switching a route between maps is now more reliable (AZM support coming soon)'
                    ]
                },
                {
                    version: 'v3.6',
                    icon: '&#9992;',
                    title: 'Mini Legs',
                    items: [
                        'Group consecutive legs to accumulate their distance and time — click an existing waypoint and choose Mini to get started'
                    ]
                },
                {
                    version: 'v3.6',
                    icon: '&#128065;',
                    title: 'Display',
                    items: [
                        'LSA reporting points can now be automatically hidden when they overlap waypoint circles, info boxes, or text boxes — enable in Display Settings'
                    ]
                }
                ];

            var seen = localStorage.getItem('flightPlannerLastSeenVersion');
            if (!force && seen === CURRENT_VERSION) return;

            // Determine which entries to show
            // force = show all; otherwise show only entries newer than last seen
            var versionOrder = ['v3.6', 'v3.6.1', 'v3.6.2', 'v3.6.3', 'v3.6.4', 'v3.6.5', 'v3.6.6', 'v3.6.7', 'v3.6.8', 'v3.6.9', 'v3.7'];
            var seenIdx = versionOrder.indexOf(seen);
            var entriesToShow = force
                ? CHANGELOG
                : CHANGELOG.filter(function(e) { return versionOrder.indexOf(e.version) > seenIdx; });

            if (entriesToShow.length === 0) return;

            // Group entries by version for display
            var grouped = {};
            var groupOrder = [];
            entriesToShow.forEach(function(e) {
                if (!grouped[e.version]) { grouped[e.version] = []; groupOrder.push(e.version); }
                grouped[e.version].push(e);
            });

            var title = force ? 'What\'s New in ' + CURRENT_VERSION : 'What\'s New Since ' + (seen || 'last time');

            var sectionsHtml = '';
            groupOrder.forEach(function(ver) {
                if (force && groupOrder.length > 1) {
                    sectionsHtml += '<div style="font-size:0.7rem;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.08em;margin:14px 0 8px;">' + ver + '</div>';
                }
                grouped[ver].forEach(function(e) {
                    sectionsHtml +=
                        '<div style="margin-bottom:14px;">' +
                        '<div style="font-size:0.75rem;font-weight:700;color:#0066cc;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">' + e.icon + ' ' + e.title + '</div>' +
                        '<ul style="margin:0;padding-left:18px;font-size:0.875rem;color:#444;line-height:1.8;">' +
                        e.items.map(function(item) { return '<li>' + item + '</li>'; }).join('') +
                        '</ul></div>';
                });
            });

            var modal = document.createElement('div');
            modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;';
            modal.innerHTML =
                '<div style="background:white;border-radius:12px;padding:28px 32px;max-width:500px;width:90%;max-height:80vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.3);">' +
                '<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">' +
                '<span style="font-size:2rem;">🛩️</span>' +
                '<div><h2 style="margin:0;font-size:1.3rem;color:#0066cc;">' + title + '</h2>' +
                '<p style="margin:2px 0 0;font-size:0.8rem;color:#888;">Israel Flight Path Planner</p></div></div>' +
                sectionsHtml +
                '<button id="whatsNewContinue" style="width:100%;margin-top:10px;padding:12px;background:#0066cc;color:white;border:none;border-radius:8px;font-size:1rem;font-weight:600;cursor:pointer;">Got it, let\'s fly! ✈️</button>' +
                '</div>';

            document.body.appendChild(modal);
            document.getElementById('whatsNewContinue').onclick = function() {
                localStorage.setItem('flightPlannerLastSeenVersion', CURRENT_VERSION);
                document.body.removeChild(modal);
            };
        }

        function toggleLSAPoints() {
            appState.lsaPointsVisible = !appState.lsaPointsVisible;
            var btn = document.getElementById('lsaPointsToggleBtn');
            
            if (appState.lsaPointsVisible) {
                appState.lsaPoints.forEach(function(marker) {
                    marker.addTo(appState.map);
                });
                refreshLSAVisibility();
                setTimeout(refreshLSARotation, 200);
                if (btn) {
                    btn.textContent = translations[appState.language].hideLSAPoints || 'Hide LSA Points';
                    btn.classList.add('btn-primary');
                    btn.classList.remove('btn-secondary');
                }
            } else {
                appState.lsaPoints.forEach(function(marker) {
                    appState.map.removeLayer(marker);
                });
                if (btn) {
                    btn.textContent = translations[appState.language].showLSAPoints || 'Show LSA Points';
                    btn.classList.remove('btn-primary');
                    btn.classList.add('btn-secondary');
                }
            }
        }
        
        function refreshLSARotation() {
            if (!appState.waypoints || appState.waypoints.length < 2) {
                return;
            }
            function rotateMarkerList(points) {
                if (!points) return;
                points.forEach(function(marker) {
                    var ll = marker._realLatLng;
                    if (!ll) return;
                    var bestHeading = 0, bestDist = Infinity;
                    for (var i = 0; i < appState.waypoints.length - 1; i++) {
                        var wp1 = appState.waypoints[i], wp2 = appState.waypoints[i+1];
                        var midLat = (wp1.lat + wp2.lat) / 2;
                        var midLng = (wp1.lng + wp2.lng) / 2;
                        var d = calculateDistance(ll.lat, ll.lng, midLat, midLng);
                        if (d < bestDist) {
                            bestDist = d;
                            bestHeading = calculateBearing(wp1.lat, wp1.lng, wp2.lat, wp2.lng);
                        }
                    }
                    var el = marker.getElement ? marker.getElement() : null;
                    if (el) {
                        var outer = el.querySelector('div');
                        if (outer) {
                            outer.style.transform = 'rotate(' + bestHeading + 'deg)';
                            outer.style.transformOrigin = 'center center';
                        }
                    }
                });
            }
            rotateMarkerList(appState.lsaPoints);
            rotateMarkerList(appState.cvfrPoints);
        }

        function refreshLSAVisibility() {
            if (!appState.lsaPointsVisible) return;
            // Compute icon half-size in nm at current zoom for pixel-accurate clipping
            var iconHalfNm = 0;
            if (appState.lsaClipToCircles && appState.map) {
                var zoom = appState.map.getZoom();
                // LSA icon is ~10px triangle + ~20px label width; use 15px as half-width buffer
                var metersPerPx = 40075016.686 * Math.cos(31.5 * Math.PI / 180) / Math.pow(2, zoom + 8);
                iconHalfNm = (15 * metersPerPx) / 1852;
            }
            appState.lsaPoints.forEach(function(marker) {
                var ll = marker._realLatLng;
                var hidden = false;
                if (appState.lsaClipToCircles && ll) {
                    for (var i = 0; i < appState.waypoints.length; i++) {
                        var wp = appState.waypoints[i];
                        var r = (appState.circleRadius > 0 ? appState.circleRadius : 0.3) + iconHalfNm;
                        if (calculateDistance(wp.lat, wp.lng, ll.lat, ll.lng) < r) {
                            hidden = true; break;
                        }
                    }
                }
                if (hidden) appState.map.removeLayer(marker);
                else marker.addTo(appState.map);
            });
            // Rotate after markers are rendered
            setTimeout(refreshLSARotation, 100);
        }

        function updateLSAPointsLanguage() {
            // Remove old markers
            appState.lsaPoints.forEach(function(marker) {
                appState.map.removeLayer(marker);
            });
            appState.lsaPoints = [];
            
            // Re-initialize (LSA always shows Hebrew, so this just recreates)
            initLSAPoints();
            
            // Re-add to map if they were visible
            if (appState.lsaPointsVisible) {
                appState.lsaPoints.forEach(function(marker) {
                    marker.addTo(appState.map);
                });
            }
        }
        

        // Find predefined navigation point at or near click position (within snap radius)
        window.findNearbyNavPoint = function(clickPt, e, maxDistancePx) {
            if (!clickPt || !appState || !appState.map) return null;
            if (e && e.shiftKey) return null; // Hold Shift to bypass snapping and place free waypoint

            maxDistancePx = maxDistancePx !== undefined ? maxDistancePx : 25; // 25px snap radius

            // Identify the last waypoint added to the route (origin of the current leg)
            var lastWP = (appState.isDrawing && appState.waypoints && appState.waypoints.length > 0)
                ? appState.waypoints[appState.waypoints.length - 1]
                : null;

            function isLastWaypoint(lat, lng) {
                if (!lastWP) return false;
                return (Math.abs(lat - lastWP.lat) < 0.0005 && Math.abs(lng - lastWP.lng) < 0.0005);
            }

            // 1. Direct hit check on a visible marker DOM element
            if (e && e.target) {
                var markerEl = e.target.closest('.cvfr-triangle-marker, .lsa-triangle-marker, .airstrip-marker, .reporting-point-marker');
                if (markerEl) {
                    var visibleMarkers = [];
                    if (appState.airstripsVisible && Array.isArray(appState.airstrips)) visibleMarkers = visibleMarkers.concat(appState.airstrips);
                    if (appState.cvfrPointsVisible && Array.isArray(appState.cvfrPoints)) visibleMarkers = visibleMarkers.concat(appState.cvfrPoints);
                    if (appState.lsaPointsVisible && Array.isArray(appState.lsaPoints)) visibleMarkers = visibleMarkers.concat(appState.lsaPoints);
                    if (appState.reportingPointsVisible && Array.isArray(appState.reportingPoints)) visibleMarkers = visibleMarkers.concat(appState.reportingPoints);

                    for (var i = 0; i < visibleMarkers.length; i++) {
                        var vm = visibleMarkers[i];
                        if (!vm || !vm._navPoint) continue;
                        var el = (typeof vm.getElement === 'function') ? vm.getElement() : vm._icon;
                        if (el && (el === markerEl || el.contains(e.target))) {
                            var pData = vm._navPoint;
                            if (isLastWaypoint(pData.lat, pData.lng)) continue; // Don't snap to origin of current leg
                            var pName = (appState.language === 'en') ? (pData.name || pData.name_he) : (pData.name_he || pData.name);
                            var realLL = vm._realLatLng || L.latLng(pData.lat, pData.lng);
                            var dispLL = vm.getLatLng ? vm.getLatLng() : ((typeof toDisplayLatLng === 'function') ? toDisplayLatLng(realLL) : realLL);
                            return {
                                name: pName,
                                lat: realLL.lat,
                                lng: realLL.lng,
                                displayLat: dispLL.lat,
                                displayLng: dispLL.lng,
                                distance: 0
                            };
                        }
                    }
                }
            }

            // 2. Spatial proximity check against all navigation points
            var bestMatch = null;
            var minDistance = maxDistancePx;

            function checkCandidate(ptData, customName, markerDispLL) {
                if (!ptData || typeof ptData.lat !== 'number' || typeof ptData.lng !== 'number') return;
                if (isLastWaypoint(ptData.lat, ptData.lng)) return; // Skip immediate previous waypoint
                var realLL = L.latLng(ptData.lat, ptData.lng);
                var dispLL = markerDispLL || ((typeof toDisplayLatLng === 'function') ? toDisplayLatLng(realLL) : realLL);
                var screenPt = appState.map.latLngToContainerPoint(dispLL);
                var dist = clickPt.distanceTo(screenPt);
                if (dist <= minDistance) {
                    minDistance = dist;
                    var name;
                    if (customName) {
                        name = customName;
                    } else if (appState.language === 'en') {
                        name = ptData.name || ptData.name_he || '';
                    } else {
                        name = ptData.name_he || ptData.name || '';
                    }
                    bestMatch = {
                        name: name,
                        lat: realLL.lat,
                        lng: realLL.lng,
                        displayLat: dispLL.lat,
                        displayLng: dispLL.lng,
                        distance: dist
                    };
                }
            }

            // Check visible markers first (priority if clicked near a visible icon)
            if (appState.airstripsVisible && Array.isArray(appState.airstrips)) {
                appState.airstrips.forEach(function(m) { if (m && m._navPoint) checkCandidate(m._navPoint, m._navPoint.name, m.getLatLng()); });
            }
            if (appState.cvfrPointsVisible && Array.isArray(appState.cvfrPoints)) {
                appState.cvfrPoints.forEach(function(m) { if (m && m._navPoint) checkCandidate(m._navPoint, null, m.getLatLng()); });
            }
            if (appState.lsaPointsVisible && Array.isArray(appState.lsaPoints)) {
                appState.lsaPoints.forEach(function(m) { if (m && m._navPoint) checkCandidate(m._navPoint, null, m.getLatLng()); });
            }
            if (appState.reportingPointsVisible && Array.isArray(appState.reportingPoints)) {
                appState.reportingPoints.forEach(function(m) { if (m && m._navPoint) checkCandidate(m._navPoint, m._navPoint.name, m.getLatLng()); });
            }

            // Also check all points in the datasets (allows snapping even when vector layer is hidden or on chart maps)
            if (typeof airstripsData !== 'undefined' && Array.isArray(airstripsData)) {
                airstripsData.forEach(function(strip) { checkCandidate(strip, strip.name); });
            }
            if (typeof cvfrPointsData !== 'undefined' && Array.isArray(cvfrPointsData)) {
                cvfrPointsData.forEach(function(pt) { checkCandidate(pt); });
            }
            if (typeof lsaPointsData !== 'undefined' && Array.isArray(lsaPointsData)) {
                lsaPointsData.forEach(function(pt) { checkCandidate(pt); });
            }
            if (typeof reportingPointsData !== 'undefined' && Array.isArray(reportingPointsData)) {
                reportingPointsData.forEach(function(pt) { checkCandidate(pt, pt.name); });
            }

            return bestMatch;
        };
