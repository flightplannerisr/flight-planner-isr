        function setupEventListeners() {
            document.getElementById('toggleDrawBtn').addEventListener('click', toggleDrawing);
            document.getElementById('clearBtn').addEventListener('click', clearRoute);
            document.getElementById('addCoordBtn').addEventListener('click', addWaypointByCoordinates);
            document.getElementById('airspaceToggleBtn').addEventListener('click', toggleAirspace);
            var ctrBtn = document.getElementById('ctrToggleBtn');
            if (ctrBtn) ctrBtn.addEventListener('click', toggleCTRs);
            document.getElementById('reverseRouteBtn').addEventListener('click', generateReverseRoute);
            document.getElementById('toggleDirectionBtn').addEventListener('click', toggleDirectionVisibility);
            document.getElementById('addTextBoxBtn2').addEventListener('click', startAddingTextBox);
            document.getElementById('toggleWaypointsBtn').addEventListener('click', toggleWaypointsList);
            document.getElementById('saveBtn').addEventListener('click', savePlan);
            document.getElementById('exportGPXBtn').addEventListener('click', exportGPX);
            document.getElementById('screenshotBtn').addEventListener('click', saveMapScreenshot);
            document.getElementById('printDetailsBtn').addEventListener('click', printRouteDetails);
            
            // ESC key stops drawing
            document.addEventListener('keydown', function(e) {
                // ESC always closes popup even from inputs
                if (e.key === 'Escape' && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
                    if (appState.map.getPopup()) appState.map.closePopup();
                    return;
                }
                // Disable all keyboard shortcuts when typing in any input or textarea
                if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
                    return; // Don't process any shortcuts when typing
                }
                
                if (e.key === 'Escape') {
                    if (appState.map.getPopup()) appState.map.closePopup();
                    if (appState.isDrawing) toggleDrawing();
                    return;
                }
                // L key starts plane animation
                if (e.key === 'l' || e.key === 'L') {
                    startPlaneAnimation();
                }
                // M key toggles sidebar
                if (e.key === 'm' || e.key === 'M') {
                    toggleSidebar();
                }
                // P key saves portrait screenshot
                if (e.key === 'p' || e.key === 'P') {
                    window.captureOrientation = 'portrait';
                    performCaptureSimple();
                }
            });
            
            document.getElementById('lineWidth').addEventListener('input', function(e) {
                appState.lineWidth = parseFloat(e.target.value);
                document.getElementById('lineWidthValue').textContent = appState.lineWidth;
                updateRoute();
            });
            
            document.getElementById('circleRadius').addEventListener('input', function(e) {
                appState.circleRadius = parseFloat(e.target.value) * 0.1;
                document.getElementById('radiusValue').textContent = appState.circleRadius.toFixed(1);
                updateAllCircles();
                updateRoute();
            });

            document.getElementById('circleOpacity').addEventListener('input', function(e) {
                appState.circleOpacity = parseFloat(e.target.value) / 100;
                document.getElementById('circleOpacityValue').textContent = e.target.value;
                updateAllCircles();
            });
            
            document.getElementById('cruiseSpeed').addEventListener('input', function(e) {
                appState.cruiseSpeed = parseFloat(e.target.value);
                updateStats();
                updateRoute();
            });

            document.getElementById('defaultAltitude').addEventListener('input', function(e) {
                appState.defaultAltitude = parseInt(e.target.value) || 400;
                updateRoute();
            });
            
            document.getElementById('fuelFlow').addEventListener('input', function(e) {
                appState.fuelFlow = parseFloat(e.target.value);
                updateStats();
            });

            document.getElementById('magVar').addEventListener('input', function(e) {
                appState.magVar = parseFloat(e.target.value) || 0;
                updateRoute();
            });
            
            document.getElementById('labelFontSize').addEventListener('input', function(e) {
                appState.labelFontSize = parseFloat(e.target.value);
                document.getElementById('fontSizeValue').textContent = appState.labelFontSize;
                updateRoute();
            });

            document.getElementById('tickInterval').addEventListener('input', function(e) {
                appState.tickInterval = parseInt(e.target.value);
                document.getElementById('tickIntervalValue').textContent = appState.tickInterval;
                updateRoute();
            });

            document.getElementById('labelInterval').addEventListener('input', function(e) {
                appState.labelInterval = parseInt(e.target.value);
                document.getElementById('labelIntervalValue').textContent = appState.labelInterval;
                updateRoute();
            });

            document.getElementById('infoBoxFontSize').addEventListener('input', function(e) {
                appState.infoBoxFontMultiplier = parseFloat(e.target.value) / 11;
                document.getElementById('infoBoxFontSizeValue').textContent = e.target.value;
                updateRoute();
            });

            document.getElementById('infoBoxSize').addEventListener('input', function(e) {
                appState.infoBoxSizeMultiplier = parseFloat(e.target.value) / 100;
                document.getElementById('infoBoxSizeValue').textContent = e.target.value;
                updateRoute();
            });
            
            document.getElementById('textBoxFontSize').addEventListener('input', function(e) {
                appState.textBoxFontSize = parseFloat(e.target.value);
                document.getElementById('textBoxFontSizeValue').textContent = appState.textBoxFontSize;
                // Update all existing text boxes
                appState.textBoxes.forEach(function(marker) {
                    var latlng = marker.getLatLng();
                    var data = marker.textBoxData;
                    if (marker.remove) marker.remove(); else appState.map.removeLayer(marker);
                    var index = appState.textBoxes.indexOf(marker);
                    if (index > -1) {
                        appState.textBoxes.splice(index, 1);
                    }
                    createTextBoxMarker(latlng, data.text, data.textColor, data.fillColor, data.rotation);
                });
            });
            
            document.getElementById('infoBoxOpacity').addEventListener('input', function(e) {
                appState.infoBoxOpacity = parseFloat(e.target.value) / 100;
                document.getElementById('opacityValue').textContent = e.target.value;
                updateRoute();
            });
            document.getElementById('lsaClipToCircles').addEventListener('change', function(e) {
                appState.lsaClipToCircles = e.target.checked;
                refreshLSAVisibility();
            });
            document.getElementById('miniWpLabelOpacity').addEventListener('input', function(e) {
                appState.miniWpLabelOpacity = parseFloat(e.target.value) / 100;
                document.getElementById('miniWpOpacityValue').textContent = e.target.value;
                updateRoute();
            });

            document.getElementById('driftColor').addEventListener('input', function(e) {
                appState.driftColor = e.target.value;
                updateRoute();
            });

            document.getElementById('driftWidth').addEventListener('input', function(e) {
                appState.driftWidth = parseInt(e.target.value);
                document.getElementById('driftWidthValue').textContent = e.target.value;
                updateRoute();
            });

            document.getElementById('arrivalLabelFontSize').addEventListener('input', function(e) {
                appState.arrivalLabelFontSize = parseInt(e.target.value);
                document.getElementById('arrivalLabelFontSizeValue').textContent = e.target.value;
                updateRoute();
            });
            document.getElementById('waypointLabelFontSize').addEventListener('input', function(e) {
                appState.waypointLabelFontSize = parseInt(e.target.value);
                document.getElementById('waypointLabelFontSizeValue').textContent = e.target.value;
                updateRoute();
            });
        }
        

        function toggleDisplaySettings() {
            var panel = document.getElementById('displaySettingsPanel');
            var arrow = document.getElementById('displaySettingsArrow');
            
            if (panel.style.display === 'none') {
                panel.style.display = 'block';
                arrow.textContent = '▲';
            } else {
                panel.style.display = 'none';
                arrow.textContent = '▼';
            }
        }
        
        function toggleDrawing() {
            appState.isDrawing = !appState.isDrawing;
            var btn = document.getElementById('toggleDrawBtn');
            if (appState.isDrawing) {
                if (btn) { btn.textContent = 'Stop Drawing'; btn.classList.remove('btn-primary'); btn.classList.add('btn-danger'); }
                appState.map.getContainer().style.cursor = 'crosshair';
                document.body.classList.add('drawing-mode');

                // Track mousedown time and position to distinguish a click from a pan/drag
                appState._drawMouseDown = function(e) {
                    appState._drawDownTime = Date.now();
                    appState._drawDownX = e.clientX;
                    appState._drawDownY = e.clientY;
                };
                appState.map.getContainer().addEventListener('mousedown', appState._drawMouseDown, true);

                // Capture-phase listener intercepts clicks on markers/overlays
                // before their own handlers fire, so every click adds a waypoint.
                appState._drawClickCapture = function(e) {
                    if (!appState.isDrawing) return;

                    // Ignore if the press was an actual pan/drag (>600ms or moved >15px)
                    if (appState._drawDownTime) {
                        var elapsed = Date.now() - appState._drawDownTime;
                        var dx = e.clientX - (appState._drawDownX || e.clientX);
                        var dy = e.clientY - (appState._drawDownY || e.clientY);
                        var moved = Math.sqrt(dx * dx + dy * dy);
                        if (elapsed > 600 || moved > 15) {
                            e.stopPropagation();
                            e.preventDefault();
                            return;
                        }
                    }

                    var mapEl = appState.map.getContainer();
                    var rect  = mapEl.getBoundingClientRect();
                    var clickPt = L.point(e.clientX - rect.left, e.clientY - rect.top);
                    var clickLL = appState.map.containerPointToLatLng(clickPt);

                    e.stopPropagation();
                    e.preventDefault();
                    appState._drawClickHandled = true;

                    // 1. Check if clicked on or near a predefined navigation point first!
                    var navPoint = (typeof findNearbyNavPoint === 'function') ? findNearbyNavPoint(clickPt, e) : null;
                    if (navPoint) {
                        addWaypoint(navPoint.lat, navPoint.lng, navPoint.name);
                        return;
                    }

                    // 2. Only if NOT clicking a navigation point, check if clicking right on an existing waypoint center (tight 10px target)
                    var hitCircle = null;
                    for (var i = 0; i < appState.circles.length; i++) {
                        var c = appState.circles[i];
                        if (!c) continue;
                        var cPt = appState.map.latLngToContainerPoint(c.getLatLng());
                        if (clickPt.distanceTo(cPt) <= 10) {
                            hitCircle = i;
                            break;
                        }
                    }

                    if (hitCircle !== null) {
                        // Fire the circle's popup without adding a waypoint
                        appState.circles[hitCircle].fire('click', { latlng: clickLL });
                        return;
                    }

                    // Apply calibration correction if on a calibrated chart map or aligned map
                    if (typeof calibrateLatLng === 'function') {
                        calibrateLatLng({ latlng: clickLL, containerPoint: clickPt }).then(function(corrected) {
                            addWaypoint(corrected.lat, corrected.lng);
                        });
                    } else {
                        addWaypoint(clickLL.lat, clickLL.lng);
                    }
                };
                appState.map.getContainer().addEventListener('click', appState._drawClickCapture, true);

                // Dedicated ESC handler for drawing mode
                appState._drawEscHandler = function(e) {
                    if (e.key === 'Escape') { e.stopPropagation(); toggleDrawing(); }
                };
                document.addEventListener('keydown', appState._drawEscHandler, true);
            } else {
                if (btn) { btn.textContent = 'Start Drawing'; btn.classList.remove('btn-danger'); btn.classList.add('btn-primary'); }
                appState.map.getContainer().style.cursor = '';
                document.body.classList.remove('drawing-mode');

                // Remove capture listener
                if (appState._drawClickCapture) {
                    appState.map.getContainer().removeEventListener('click', appState._drawClickCapture, true);
                    appState._drawClickCapture = null;
                }
                if (appState._drawMouseDown) {
                    appState.map.getContainer().removeEventListener('mousedown', appState._drawMouseDown, true);
                    appState._drawMouseDown = null;
                }
                if (appState._drawEscHandler) {
                    document.removeEventListener('keydown', appState._drawEscHandler, true);
                    appState._drawEscHandler = null;
                }
                appState._drawDownTime = null;
                appState._drawDownX = null;
                appState._drawDownY = null;

                // Clear preview
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
            }
        }
        

        // ── CALIBRATION SYSTEM ────────────────────────────────────────────────


        function toggleDebugMode() {
            var mapName = appState.currentMapName;
            if (mapName !== 'Air Nav Chart' && mapName !== 'AZM Chart') {
                alert('Calibration is only available on Air Nav Chart or AZM Chart.\nPlease switch to one of those maps first.');
                return;
            }
            if (!_folderHandle) {
                alert('Please set a working folder first (in the "Save Flight Plan" panel) before calibrating.\n\nThe calibration data needs to be saved to a folder.');
                return;
            }
            if (calibState.active) { exitCalibrationMode(); return; }
            calibState.active = true; calibState.mapName = mapName; calibState.phase = 'lon';
            calibState.lonPoints = []; calibState.latPoints = []; calibState.intersections = [];
            calibState.lonIdx = 0; calibState.latIdx = 0; calibState.intIdx = 0;
            calibClearMarkers();
            var btn = document.getElementById('debugToggleBtn');
            if (btn) { btn.textContent = 'Calibrating\u2026'; btn.style.background = '#c0392b'; btn.style.color = 'white'; btn.style.borderColor = '#c0392b'; }
            appState.map.on('click', calibMapClick);
            document.getElementById('map').style.cursor = 'crosshair';
            appState.map.getContainer().style.cursor = 'crosshair';
            var panel = document.createElement('div');
            panel.id = 'calibPanel';
            panel.style.cssText = 'position:fixed;top:80px;right:365px;z-index:9000;background:white;border:2px solid #c0392b;border-radius:8px;padding:14px;width:270px;box-shadow:0 4px 16px rgba(0,0,0,0.3);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:12px;';
            document.body.appendChild(panel);
            updateCalibPanel();
        }

        
        function toggleWaypointsList() {
            var list = document.getElementById('waypoints-list');
            var btn = document.getElementById('toggleWaypointsBtn');
            
            if (list.style.display === 'none') {
                list.style.display = 'block';
                btn.textContent = 'Hide';
            } else {
                list.style.display = 'none';
                btn.textContent = 'Show';
            }
        }
        
        function toggleSidebar() {
            var sidebar = document.querySelector('.sidebar');
            var showBtn = document.getElementById('showSidebarBtn');
            
            if (sidebar.style.display === 'none') {
                // Show sidebar
                sidebar.style.display = 'flex';
                if (showBtn) showBtn.style.display = 'none';
            } else {
                // Hide sidebar
                sidebar.style.display = 'none';
                
                // Create or show the "Show Menu" button
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
            }
        }
        
        function toggleLanguage() {
            appState.language = appState.language === 'en' ? 'he' : 'en';
            initAirspaceZones();
            if (appState.airspaceVisible) {
                appState.airspaceZones.forEach(function(zone) { zone.addTo(appState.map); });
            }
            initCTRZones();
            updateUILanguage();
            // CVFR points always show Hebrew names, no need to update them
        }
        
        function updateUILanguage() {
            var t = translations[appState.language];
            var isHebrew = appState.language === 'he';
            
            // Update direction for Hebrew
            var sidebar = document.querySelector('.sidebar');
            if (sidebar) {
                sidebar.style.direction = isHebrew ? 'rtl' : 'ltr';
            }
            
            // Update title and subtitle
            var titleElements = document.querySelectorAll('.panel h1');
            if (titleElements[0]) titleElements[0].innerHTML = t.title;
            var subtitleElements = document.querySelectorAll('.panel p');
            if (subtitleElements[0]) subtitleElements[0].textContent = t.subtitle;
            
            // Update Flight Controls and section headings
            var h2Elements = document.querySelectorAll('.panel h2');
            if (h2Elements[0]) h2Elements[0].textContent = t.flightControls;
            
            var h3Elements = document.querySelectorAll('.panel h3');
            if (h3Elements[0]) h3Elements[0].textContent = t.mapLayers;
            if (h3Elements[1]) h3Elements[1].textContent = t.export;
            
            // Update language toggle button
            var langBtn = document.getElementById('languageToggleBtn');
            if (langBtn) langBtn.textContent = isHebrew ? 'EN / עב' : 'EN / עב';
            
            // Update all buttons
            var toggleDrawBtn = document.getElementById('toggleDrawBtn');
            if (toggleDrawBtn) toggleDrawBtn.textContent = appState.isDrawing ? t.stopDrawing : t.startDrawing;
            
            var debugBtn = document.getElementById('debugToggleBtn');
            if (debugBtn) debugBtn.textContent = appState.debugMode ? 'Debug ✓' : 'Debug';
            
            var elements = {
                'addCoordBtn': t.addByCoords,
                'clearBtn': t.clearRoute,
                'reverseRouteBtn': t.reverseRoute,
                'toggleDirectionBtn': appState.reverseRouteVisible ? t.showOutbound : t.showReturn,
                'addTextBoxBtn': t.addTextBox,
                'addTextBoxBtn2': t.addTextBox,
                'airspaceToggleBtn': appState.airspaceVisible ? t.hideAirspace : t.airspaceToggle,
                'ctrToggleBtn': appState.ctrsVisible ? t.hideCTRs : t.showCTRs,
                'reportingPointsToggleBtn': appState.reportingPointsVisible ? t.hideReportingPoints : t.showReportingPoints,
                'frequenciesToggleBtn': appState.frequenciesVisible ? t.hideFrequencies : t.showFrequencies,
                'airstripsToggleBtn': appState.airstripsVisible ? t.hideAirstrips : t.showAirstrips,
                'cvfrPointsToggleBtn': appState.cvfrPointsVisible ? t.hideCVFRPoints : t.showCVFRPoints,
                'lsaPointsToggleBtn': appState.lsaPointsVisible ? t.hideLSAPoints : t.showLSAPoints,
                'exportGPXBtn': t.exportGPX,
                'screenshotBtn': t.saveMapImage,
                'printDetailsBtn': t.printDetails,
                'saveBtn': t.saveBtn
            };
            
            for (var id in elements) {
                var el = document.getElementById(id);
                if (el) el.textContent = elements[id];
            }
            if (typeof updateAlignButtonUI === 'function') {
                updateAlignButtonUI();
            }
            
            // Update input placeholder
            var planNameInput = document.getElementById('plan-name');
            if (planNameInput) planNameInput.placeholder = t.planName;
            
            var airspaceNoticeTextEl = document.getElementById('airspaceNoticeText');
            if (airspaceNoticeTextEl && t.airspaceNotice) {
                airspaceNoticeTextEl.textContent = t.airspaceNotice;
            }
            
            // Update info tooltip
            var infoBox = document.querySelector('.info-box');
            if (infoBox) infoBox.textContent = t.infoTooltip;
            
            // Update all labels in Flight Parameters section
            var cruiseLabel = document.querySelector('label[for="cruiseSpeed"]');
            if (cruiseLabel) cruiseLabel.textContent = t.cruiseSpeed;
            
            var fuelLabel = document.querySelector('label[for="fuelFlow"]');
            if (fuelLabel) fuelLabel.textContent = t.fuelFlow;
            
            // Update Display Settings panel
            var displaySettingsBtn = document.getElementById('toggleDisplaySettingsBtn');
            if (displaySettingsBtn) {
                var arrow = document.getElementById('displaySettingsArrow').textContent;
                displaySettingsBtn.innerHTML = '<span>⚙️ ' + t.displaySettings + '</span><span id="displaySettingsArrow">' + arrow + '</span>';
            }
            
            // Update slider labels in Display Settings
            var lineWidthLabel = document.querySelector('label[for="lineWidth"]');
            if (lineWidthLabel) {
                var value = document.getElementById('lineWidthValue').textContent;
                lineWidthLabel.innerHTML = t.lineWidth + ': <strong><span id="lineWidthValue">' + value + '</span>px</strong>';
            }
            
            var circleRadiusLabel = document.querySelector('label[for="circleRadius"]');
            if (circleRadiusLabel) {
                var value = document.getElementById('radiusValue').textContent;
                circleRadiusLabel.innerHTML = t.waypointCircleRadius + ': <strong><span id="radiusValue">' + value + '</span> nm</strong>';
            }
            
            var labelFontSizeLabel = document.querySelector('label[for="labelFontSize"]');
            if (labelFontSizeLabel) {
                var value = document.getElementById('fontSizeValue').textContent;
                labelFontSizeLabel.innerHTML = t.timeLabelFontSize + ': <strong><span id="fontSizeValue">' + value + '</span>px</strong>';
            }
            
            var textBoxFontSizeLabel = document.querySelector('label[for="textBoxFontSize"]');
            if (textBoxFontSizeLabel) {
                var value = document.getElementById('textBoxFontSizeValue').textContent;
                textBoxFontSizeLabel.innerHTML = t.textBoxFontSize + ': <strong><span id="textBoxFontSizeValue">' + value + '</span>px</strong>';
            }
            
            var infoBoxOpacityLabel = document.querySelector('label[for="infoBoxOpacity"]');
            if (infoBoxOpacityLabel) {
                var value = document.getElementById('opacityValue').textContent;
                infoBoxOpacityLabel.innerHTML = t.infoBoxOpacity + ': <strong><span id="opacityValue">' + value + '</span>%</strong>';
            }
            
            // Update panel headers
            var h2Elements = document.querySelectorAll('.panel h2, .panel h3');
            h2Elements.forEach(function(header) {
                var html = header.innerHTML;
                
                // Flight Controls
                if (html.includes('Flight Controls') || html.includes('בקרות טיסה')) {
                    header.textContent = t.flightControls;
                }
                // Waypoints with count and toggle button
                else if (html.includes('Waypoints') || html.includes('נקודות ציון')) {
                    var count = document.getElementById('waypoint-count') ? document.getElementById('waypoint-count').textContent : '0';
                    var waypointsList = document.getElementById('waypoints-list');
                    var isVisible = waypointsList && waypointsList.style.display !== 'none';
                    header.innerHTML = '<span>' + t.waypoints + ' (<span id="waypoint-count">' + count + '</span>)</span>' +
                        '<button id="toggleWaypointsBtn" onclick="toggleWaypointsList()" style="padding: 4px 12px; background: #0066cc; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">' + 
                        (isVisible ? t.hide : t.show) + '</button>';
                }
                // Statistics
                else if (html.includes('Statistics') || html.includes('סטטיסטיקה')) {
                    header.textContent = t.stats;
                }
                // Actions
                else if (html.includes('Actions') || html.includes('פעולות')) {
                    header.textContent = t.actions;
                }
                // Save Flight Plan
                else if (html.includes('Save Flight Plan') || html.includes('שמור תוכנית טיסה')) {
                    header.textContent = t.savePlan;
                }
                // Keyboard Shortcuts
                else if (html.includes('Keyboard Shortcuts') || html.includes('קיצורי מקלדת')) {
                    header.textContent = t.keyboardShortcuts;
                }
            });
            
            // Update keyboard shortcut descriptions
            var shortcuts = document.querySelectorAll('.panel:last-of-type .panel > div > div');
            if (shortcuts.length >= 4) {
                shortcuts[0].innerHTML = '<span><strong>ESC</strong></span><span>' + t.escKey + '</span>';
                shortcuts[1].innerHTML = '<span><strong>L</strong></span><span>' + t.lKey + '</span>';
                shortcuts[2].innerHTML = '<span><strong>M</strong></span><span>' + t.mKey + '</span>';
                shortcuts[3].innerHTML = '<span><strong>P</strong></span><span>' + t.pKey + '</span>';
            }
            
            // Force update stats to get translated labels
            updateStats();
        }
        

        window.addEventListener('load', function() {
            initMap();
            setupEventListeners();
            loadSavedPlans();
            // Restore previously selected folder
            idbGet('flightPlannerFolder').then(function(stored) {
                if (!stored) {
                    // No folder ever selected
                    showNoFolderWarning();
                    return;
                }
                // Try to get permission silently first
                stored.queryPermission({ mode: 'readwrite' }).then(function(perm) {
                    if (perm === 'granted') {
                        // Permission already granted — restore immediately
                        _folderHandle = stored;
                        updateFolderDisplay();
                        loadPlansFromFolder();
                        loadSettingsFile();
                        getCalibTransform('Air Nav Chart');
                        getCalibTransform('AZM Chart');
                    } else {
                        // Need user gesture — show banner
                        showFolderRestoreBanner(stored);
                    }
                }).catch(function() {
                    showFolderRestoreBanner(stored);
                });
            }).catch(function() {});
        });
