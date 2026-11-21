        function showFolderRestoreBanner(stored) {
            if (document.getElementById('folderRestoreBanner')) return;
            var banner = document.createElement('div');
            banner.id = 'folderRestoreBanner';
            banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;' +
                'background:#0066cc;color:white;padding:10px 20px;' +
                'display:flex;align-items:center;justify-content:space-between;gap:10px;' +
                'font-size:14px;font-weight:500;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
            banner.innerHTML =
                '<span>📁 Click to restore access to your working folder</span>' +
                '<button id="folderRestoreBtn" style="padding:6px 16px;background:white;color:#0066cc;' +
                'border:none;border-radius:5px;font-weight:700;cursor:pointer;font-size:13px;">Restore Folder</button>' +
                '<button id="folderRestoreDismiss" style="padding:6px 10px;background:transparent;color:white;' +
                'border:1px solid rgba(255,255,255,0.5);border-radius:5px;cursor:pointer;font-size:13px;">✕</button>';
            document.body.appendChild(banner);

            document.getElementById('folderRestoreBtn').onclick = async function() {
                try {
                    var perm = await stored.requestPermission({ mode: 'readwrite' });
                    if (perm === 'granted') {
                        _folderHandle = stored;
                        if (banner.parentNode) banner.parentNode.removeChild(banner);
                        confirmAndReload();
                        return;
                    }
                } catch(e) {}
                if (banner.parentNode) banner.parentNode.removeChild(banner);
                showNoFolderWarning();
            };
            document.getElementById('folderRestoreDismiss').onclick = function() {
                if (banner.parentNode) banner.parentNode.removeChild(banner);
            };
        }

        function showNoFolderWarning() {
            if (document.getElementById('noFolderWarning')) return;
            var banner = document.createElement('div');
            banner.id = 'noFolderWarning';
            banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;' +
                'background:#cc3300;color:white;padding:10px 20px;' +
                'display:flex;align-items:center;justify-content:space-between;gap:10px;' +
                'font-size:14px;font-weight:500;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
            banner.innerHTML =
                '<span>⚠️ No working folder selected — saving plans, settings and calibration is disabled</span>' +
                '<button id="noFolderSelectBtn" style="padding:6px 16px;background:white;color:#cc3300;' +
                'border:none;border-radius:5px;font-weight:700;cursor:pointer;font-size:13px;">Select Folder</button>' +
                '<button id="noFolderDismiss" style="padding:6px 10px;background:transparent;color:white;' +
                'border:1px solid rgba(255,255,255,0.5);border-radius:5px;cursor:pointer;font-size:13px;">✕</button>';
            document.body.appendChild(banner);

            document.getElementById('noFolderSelectBtn').onclick = function() {
                if (banner.parentNode) banner.parentNode.removeChild(banner);
                window.selectWorkingFolder();
            };
            document.getElementById('noFolderDismiss').onclick = function() {
                if (banner.parentNode) banner.parentNode.removeChild(banner);
            };
        }
        

        var _folderHandle   = null;  // DirectoryHandle for root folder

        async function getStoredFolderHandle() {
            if (_folderHandle) return _folderHandle;
            try {
                var stored = await idbGet('flightPlannerFolder');
                if (stored) {
                    var perm = await stored.queryPermission({ mode: 'readwrite' });
                    if (perm === 'granted') { _folderHandle = stored; return _folderHandle; }
                    perm = await stored.requestPermission({ mode: 'readwrite' });
                    if (perm === 'granted') { _folderHandle = stored; return _folderHandle; }
                }
            } catch(e) {}
            return null;
        }

        async function saveWaypointsFile() {
            if (!_folderHandle) return;
            var mapName = appState.currentMapName || 'OpenStreetMap';
            var wpData = appState.waypoints.map(function(wp) {
                return { name: wp.name, lat: wp.lat, lng: wp.lng, num: wp.num };
            });
            try {
                // Load existing file to merge
                var existing = {};
                try {
                    var fh = await _folderHandle.getFileHandle('waypoints.json');
                    var file = await fh.getFile();
                    var parsed = JSON.parse(await file.text());
                    // Support both old flat array format and new grouped object format
                    if (Array.isArray(parsed)) {
                        existing['OpenStreetMap'] = parsed;
                    } else {
                        existing = parsed;
                    }
                } catch(e) {}
                // Merge current map's waypoints into the grouped object
                existing[mapName] = wpData;
                var fh = await _folderHandle.getFileHandle('waypoints.json', { create: true });
                var writable = await fh.createWritable();
                await writable.write(JSON.stringify(existing, null, 2));
                await writable.close();
            } catch(e) { console.warn('Could not save waypoints:', e); }
        }
        function idbGet(key) {
            return new Promise(function(resolve, reject) {
                var req = indexedDB.open('flightPlannerDB', 1);
                req.onupgradeneeded = function(e) { e.target.result.createObjectStore('handles'); };
                req.onsuccess = function(e) {
                    var tx = e.target.result.transaction('handles', 'readonly');
                    var r = tx.objectStore('handles').get(key);
                    r.onsuccess = function() { resolve(r.result); };
                    r.onerror   = function() { resolve(null); };
                };
                req.onerror = function() { resolve(null); };
            });
        }

        function idbSet(key, value) {
            return new Promise(function(resolve, reject) {
                var req = indexedDB.open('flightPlannerDB', 1);
                req.onupgradeneeded = function(e) { e.target.result.createObjectStore('handles'); };
                req.onsuccess = function(e) {
                    var tx = e.target.result.transaction('handles', 'readwrite');
                    tx.objectStore('handles').put(value, key);
                    tx.oncomplete = function() { resolve(); };
                    tx.onerror    = function() { resolve(); };
                };
                req.onerror = function() { resolve(); };
            });
        }

        window.selectWorkingFolder = async function() {
            if (!window.showDirectoryPicker) {
                alert('Your browser does not support folder access.\nPlease use Chrome or Edge.');
                return;
            }
            try {
                var handle = await window.showDirectoryPicker({ mode: 'readwrite' });
                _folderHandle = handle;
                await idbSet('flightPlannerFolder', handle);
                confirmAndReload();
            } catch(e) {
                if (e.name !== 'AbortError') alert('Could not access folder: ' + e.message);
            }
        };

        function confirmAndReload() {
            if (appState.waypoints && appState.waypoints.length > 0) {
                var modal = document.createElement('div');
                modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;';
                var dialog = document.createElement('div');
                dialog.style.cssText = 'background:white;border-radius:12px;padding:28px 32px;max-width:420px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.3);font-family:sans-serif;';
                dialog.innerHTML =
                    '<h3 style="margin:0 0 12px;color:#cc3300;font-size:1.1rem;">&#9888; Unsaved Work</h3>' +
                    '<p style="margin:0 0 10px;font-size:0.875rem;color:#444;">You have an active route drawn on the map that has not been saved.</p>' +
                    '<p style="margin:0 0 20px;font-size:0.8rem;color:#666;background:#fff8e1;border:1px solid #ffe082;border-radius:6px;padding:8px 12px;">Not reloading may cause compatibility issues with your working folder settings.</p>' +
                    '<div style="display:flex;gap:10px;">' +
                    '<button id="cfmReloadYes" style="flex:1;padding:10px;background:#0066cc;color:white;border:none;border-radius:7px;font-size:0.9rem;font-weight:600;cursor:pointer;">Reload Now</button>' +
                    '<button id="cfmReloadNo" style="flex:1;padding:10px;background:#f0f0f0;color:#333;border:none;border-radius:7px;font-size:0.9rem;font-weight:600;cursor:pointer;">Stay (not recommended)</button>' +
                    '</div>';
                modal.appendChild(dialog);
                document.body.appendChild(modal);
                document.getElementById('cfmReloadYes').onclick = function() { location.reload(); };
                document.getElementById('cfmReloadNo').onclick  = function() { document.body.removeChild(modal); };
            } else {
                location.reload();
            }
        }

        function updateFolderDisplay() {
            var display = document.getElementById('folderPathDisplay');
            var text    = document.getElementById('folderPathText');
            if (_folderHandle) {
                display.style.display = 'block';
                text.textContent = _folderHandle.name;
            } else {
                display.style.display = 'none';
            }
        }

        var DEFAULT_SETTINGS = {
            cruiseSpeed:          90,
            fuelFlow:             17,
            magVar:               -5,
            defaultAltitude:      400,
            circleRadius:         0.3,
            circleOpacity:        0.2,
            lineWidth:            4,
            labelFontSize:        15,
            tickInterval:         1,
            labelInterval:        1,
            infoBoxSizeMultiplier:1.2,
            infoBoxFontMultiplier:1.6364,
            textBoxFontSize:      14,
            infoBoxOpacity:       0.70,
            miniWpLabelOpacity:   0.70,
            driftColor:           '#cc6600',
            driftWidth:           2,
            arrivalLabelFontSize: 16
        };

        function collectSettings() {
            return {
                cruiseSpeed:          appState.cruiseSpeed,
                fuelFlow:             appState.fuelFlow,
                magVar:               appState.magVar,
                defaultAltitude:      appState.defaultAltitude,
                circleRadius:         appState.circleRadius,
                circleOpacity:        appState.circleOpacity,
                lineWidth:            appState.lineWidth,
                labelFontSize:        appState.labelFontSize,
                tickInterval:         appState.tickInterval,
                labelInterval:        appState.labelInterval,
                infoBoxSizeMultiplier:appState.infoBoxSizeMultiplier,
                infoBoxFontMultiplier:appState.infoBoxFontMultiplier,
                textBoxFontSize:      appState.textBoxFontSize,
                infoBoxOpacity:       appState.infoBoxOpacity,
                miniWpLabelOpacity:   appState.miniWpLabelOpacity,
                driftColor:           appState.driftColor,
                driftWidth:           appState.driftWidth,
                arrivalLabelFontSize: appState.arrivalLabelFontSize,
                miniWaypoints: appState.miniWaypoints
            };
        }

        function applySettings(s) {
            appState.cruiseSpeed          = s.cruiseSpeed          !== undefined ? s.cruiseSpeed          : DEFAULT_SETTINGS.cruiseSpeed;
            appState.fuelFlow             = s.fuelFlow             !== undefined ? s.fuelFlow             : DEFAULT_SETTINGS.fuelFlow;
            appState.magVar               = s.magVar               !== undefined ? s.magVar               : DEFAULT_SETTINGS.magVar;
            appState.defaultAltitude      = s.defaultAltitude      !== undefined ? s.defaultAltitude      : DEFAULT_SETTINGS.defaultAltitude;
            appState.circleRadius         = s.circleRadius         !== undefined ? s.circleRadius         : DEFAULT_SETTINGS.circleRadius;
            appState.circleOpacity        = s.circleOpacity        !== undefined ? s.circleOpacity        : DEFAULT_SETTINGS.circleOpacity;
            appState.lineWidth            = s.lineWidth            !== undefined ? s.lineWidth            : DEFAULT_SETTINGS.lineWidth;
            appState.labelFontSize        = s.labelFontSize        !== undefined ? s.labelFontSize        : DEFAULT_SETTINGS.labelFontSize;
            appState.tickInterval         = s.tickInterval         !== undefined ? s.tickInterval         : DEFAULT_SETTINGS.tickInterval;
            appState.labelInterval        = s.labelInterval        !== undefined ? s.labelInterval        : DEFAULT_SETTINGS.labelInterval;
            appState.infoBoxSizeMultiplier= s.infoBoxSizeMultiplier!== undefined ? s.infoBoxSizeMultiplier: DEFAULT_SETTINGS.infoBoxSizeMultiplier;
            appState.infoBoxFontMultiplier= s.infoBoxFontMultiplier !== undefined
                ? s.infoBoxFontMultiplier : DEFAULT_SETTINGS.infoBoxFontMultiplier;
            appState.textBoxFontSize      = s.textBoxFontSize      !== undefined ? s.textBoxFontSize      : DEFAULT_SETTINGS.textBoxFontSize;
            appState.infoBoxOpacity       = s.infoBoxOpacity       !== undefined ? s.infoBoxOpacity       : DEFAULT_SETTINGS.infoBoxOpacity;
            appState.miniWpLabelOpacity   = s.miniWpLabelOpacity   !== undefined ? s.miniWpLabelOpacity   : DEFAULT_SETTINGS.miniWpLabelOpacity;
            appState.driftColor           = s.driftColor           !== undefined ? s.driftColor           : DEFAULT_SETTINGS.driftColor;
            appState.driftWidth           = s.driftWidth           !== undefined ? s.driftWidth           : DEFAULT_SETTINGS.driftWidth;
            appState.arrivalLabelFontSize = s.arrivalLabelFontSize !== undefined ? s.arrivalLabelFontSize : DEFAULT_SETTINGS.arrivalLabelFontSize;

            // Sync all UI controls
            document.getElementById('cruiseSpeed').value             = appState.cruiseSpeed;
            document.getElementById('fuelFlow').value                = appState.fuelFlow;
            document.getElementById('magVar').value                  = appState.magVar;
            document.getElementById('defaultAltitude').value         = appState.defaultAltitude;
            document.getElementById('circleRadius').value            = Math.round(appState.circleRadius * 10);
            document.getElementById('radiusValue').textContent       = appState.circleRadius.toFixed(1);
            document.getElementById('circleOpacity').value           = Math.round(appState.circleOpacity * 100);
            document.getElementById('circleOpacityValue').textContent= Math.round(appState.circleOpacity * 100);
            document.getElementById('lineWidth').value               = appState.lineWidth;
            document.getElementById('lineWidthValue').textContent    = appState.lineWidth;
            document.getElementById('labelFontSize').value           = appState.labelFontSize;
            document.getElementById('fontSizeValue').textContent     = appState.labelFontSize;
            document.getElementById('arrivalLabelFontSize').value = appState.arrivalLabelFontSize || 9;
            document.getElementById('arrivalLabelFontSizeValue').textContent = appState.arrivalLabelFontSize || 9;
            document.getElementById('waypointLabelFontSize').value = appState.waypointLabelFontSize || 11;
            document.getElementById('waypointLabelFontSizeValue').textContent = appState.waypointLabelFontSize || 11;
            document.getElementById('tickInterval').value            = appState.tickInterval;
            document.getElementById('tickIntervalValue').textContent = appState.tickInterval;
            document.getElementById('labelInterval').value           = appState.labelInterval;
            document.getElementById('labelIntervalValue').textContent= appState.labelInterval;
            document.getElementById('arrivalLabelFontSize').value    = appState.arrivalLabelFontSize;
            document.getElementById('arrivalLabelFontSizeValue').textContent = appState.arrivalLabelFontSize;
            document.getElementById('infoBoxSize').value             = Math.round(appState.infoBoxSizeMultiplier * 100);
            document.getElementById('infoBoxSizeValue').textContent  = Math.round(appState.infoBoxSizeMultiplier * 100);
            document.getElementById('infoBoxFontSize').value         = Math.round(appState.infoBoxFontMultiplier * 11);
            document.getElementById('infoBoxFontSizeValue').textContent = Math.round(appState.infoBoxFontMultiplier * 11);
            document.getElementById('textBoxFontSize').value         = appState.textBoxFontSize;
            document.getElementById('textBoxFontSizeValue').textContent = appState.textBoxFontSize;
            document.getElementById('infoBoxOpacity').value          = Math.round(appState.infoBoxOpacity * 100);
            document.getElementById('opacityValue').textContent      = Math.round(appState.infoBoxOpacity * 100);
            document.getElementById('miniWpLabelOpacity').value      = Math.round(appState.miniWpLabelOpacity * 100);
            document.getElementById('lsaClipToCircles').checked      = !!appState.lsaClipToCircles;
            document.getElementById('miniWpOpacityValue').textContent = Math.round(appState.miniWpLabelOpacity * 100);
            document.getElementById('driftColor').value              = appState.driftColor;
            document.getElementById('driftWidth').value              = appState.driftWidth;
            document.getElementById('driftWidthValue').textContent   = appState.driftWidth;

            updateAllCircles();
            updateRoute();
            updateStats();
        }

        function showSettingsStatus(msg, isError) {
            var el = document.getElementById('settingsStatusMsg');
            el.textContent = msg;
            el.style.color = isError ? '#dc3545' : '#28a745';
            el.style.display = 'block';
            setTimeout(function() { el.style.display = 'none'; }, 3000);
        }

        window.saveSettingsFile = async function() {
            var folder = await getStoredFolderHandle();
            if (!folder) {
                showSettingsStatus('Set a folder first.', true);
                return;
            }
            try {
                var fh = await folder.getFileHandle('settings.json', { create: true });
                var writable = await fh.createWritable();
                await writable.write(JSON.stringify(collectSettings(), null, 2));
                await writable.close();
                showSettingsStatus('✓ Settings saved.', false);
            } catch(e) {
                showSettingsStatus('Save failed: ' + e.message, true);
            }
        };

        window.loadSettingsFile = async function() {
            var folder = await getStoredFolderHandle();
            if (!folder) {
                showSettingsStatus('Set a folder first.', true);
                return;
            }
            try {
                var fh = await folder.getFileHandle('settings.json');
                var file = await fh.getFile();
                var text = await file.text();
                var s = JSON.parse(text);
                applySettings(s);
                showSettingsStatus('✓ Settings loaded.', false);
            } catch(e) {
                showSettingsStatus('No settings file found.', true);
            }
        };

        window.revertSettings = function() {
            if (!confirm('Revert all display settings to defaults?')) return;
            applySettings(DEFAULT_SETTINGS);
            showSettingsStatus('✓ Reverted to defaults.', false);
        };

        function planToJson(planName) {
            var textBoxesData = appState.textBoxes.map(function(marker) {
                var latlng = marker.getLatLng();
                return { lat: latlng.lat, lng: latlng.lng,
                    text: marker.textBoxData.text, textColor: marker.textBoxData.textColor,
                    fillColor: marker.textBoxData.fillColor, rotation: marker.textBoxData.rotation,
                    fontSize: marker.textBoxData.fontSize,
                    realLat: marker.textBoxData._realLat, realLng: marker.textBoxData._realLng };
            });
            return {
                name: planName,
                date: new Date().toISOString(),
                appVersion: document.title.match(/v[\d.]+[a-z0-9]*/i)?.[0] || 'unknown',
                mapName: appState.currentMapName,
                waypoints: appState.waypoints,
                textBoxes: textBoxesData,
                waypointLabelOffsets: appState.waypointLabelOffsets,
                waypointLabelStyles: appState.waypointLabelStyles,
                legLabelPositions: appState.legLabelDraggedPositions,
                arrivalLabelPositions: appState.arrivalLabelPositions,
                cruiseSpeed: appState.cruiseSpeed,
                fuelFlow: appState.fuelFlow,
                magVar: appState.magVar,
                circleRadius: appState.circleRadius,
                legAltitudes: appState.legAltitudes,
                defaultAltitude: appState.defaultAltitude,
                tickInterval: appState.tickInterval,
                labelInterval: appState.labelInterval,
                driftColor: appState.driftColor,
                driftWidth: appState.driftWidth,
                arrivalLabelFontSize: appState.arrivalLabelFontSize,
                miniWaypoints: appState.miniWaypoints
            };
        }

        async function savePlan() {
            var planName = document.getElementById('plan-name').value.trim();
            if (!planName) { alert('Please enter a flight plan name'); return; }
            if (appState.waypoints.length === 0) { alert('No waypoints to save!'); return; }

            var plan = planToJson(planName);
            var folder = await getStoredFolderHandle();

            if (folder) {
                var fileName = planName.replace(/[^a-z0-9_\-\s]/gi, '_') + '.json';
                // Check if file exists and prompt override if it matches current plan
                var fileExists = false;
                try {
                    await folder.getFileHandle(fileName, { create: false });
                    fileExists = true;
                } catch(e) {}

                if (fileExists) {
                    if (!confirm('Override "' + planName + '"?\n\nThis will replace the existing saved plan.')) return;
                }

                try {
                    var fh = await folder.getFileHandle(fileName, { create: true });
                    var writable = await fh.createWritable();
                    await writable.write(JSON.stringify(plan, null, 2));
                    await writable.close();
                    await saveWaypointsFile();
                    appState.currentPlanName = planName;
                    await loadPlansFromFolder();
                    alert('Flight plan saved!');
                } catch(e) {
                    alert('Save failed: ' + e.message);
                }
            } else {
                // Fallback: localStorage
                var plans = JSON.parse(localStorage.getItem('flightPlans') || '[]');
                var existingIdx = plans.findIndex(function(p) { return p.name === planName; });
                if (existingIdx >= 0) {
                    if (!confirm('Override "' + planName + '"?')) return;
                    plans[existingIdx] = plan;
                } else {
                    plans.push(plan);
                }
                localStorage.setItem('flightPlans', JSON.stringify(plans));
                appState.currentPlanName = planName;
                loadSavedPlans();
                alert('Saved to browser storage. Set a folder to save as files.');
            }
        }

        window.loadPlansFromFolder = async function() {
            var folder = await getStoredFolderHandle();
            if (!folder) { loadSavedPlans(); return; }

            var plans = [];
            try {
                for await (var [name, handle] of folder.entries()) {
                    if (handle.kind === 'file' && name.endsWith('.json')) {
                        try {
                            var file = await handle.getFile();
                            var text = await file.text();
                            var plan = JSON.parse(text);
                            if (plan.waypoints) plans.push({ plan: plan, handle: handle, name: name });
                        } catch(e) {}
                    }
                }
            } catch(e) { loadSavedPlans(); return; }

            plans.sort(function(a, b) { return new Date(b.plan.date) - new Date(a.plan.date); });

            var html = '';
            if (plans.length === 0) {
                html = '<div style="text-align:center;color:#999;padding:1rem;font-size:0.813rem;">No saved plans in folder</div>';
            } else {
                plans.forEach(function(item, idx) {
                    var date = new Date(item.plan.date).toLocaleDateString();
                    html += '<div class="saved-plan">';
                    html += '<div><div class="saved-plan-name">' + item.plan.name + '</div>';
                    html += '<div class="saved-plan-info">' + item.plan.waypoints.length + ' waypoints &bull; ' + date + '</div></div>';
                    html += '<div>';
                    html += '<button class="btn-secondary" style="padding:0.25rem 0.5rem;font-size:0.75rem;margin-right:0.25rem;" onclick="loadPlanFromFolder(' + idx + ')">Load</button>';
                    html += '<button class="btn-danger" style="padding:0.25rem 0.5rem;font-size:0.75rem;" onclick="deletePlanFromFolder(' + idx + ')">Delete</button>';
                    html += '</div></div>';
                });
            }
            document.getElementById('saved-plans').innerHTML = html;
            window._folderPlans = plans;
        };

        window.loadPlanFromFolder = async function(idx) {
            if (!window._folderPlans || !window._folderPlans[idx]) return;
            var plan = window._folderPlans[idx].plan;
            applyPlan(plan);
            // Set after applyPlan (which calls clearRoute which clears the field)
            setTimeout(function() {
                appState.currentPlanName = plan.name;
                document.getElementById('plan-name').value = plan.name;
            }, 100);
        };

        window.deletePlanFromFolder = async function(idx) {
            if (!window._folderPlans || !window._folderPlans[idx]) return;
            if (!confirm('Delete "' + window._folderPlans[idx].plan.name + '"?')) return;
            try {
                var folder = await getStoredFolderHandle();
                await folder.removeEntry(window._folderPlans[idx].name);
                await loadPlansFromFolder();
            } catch(e) { alert('Delete failed: ' + e.message); }
        };

        function applyPlan(plan) {
            clearRoute();
            appState.currentPlanName = null;

            // Switch to the map the plan was drawn on
            var targetMap = plan.mapName;
            if (!targetMap) {
                // Old plan without mapName — show clickable modal to select map
                var mapOptions = Object.keys(appState.baseMaps || {});
                var modal = document.createElement('div');
                modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:10000;display:flex;align-items:center;justify-content:center;';
                var dialog = document.createElement('div');
                dialog.style.cssText = 'background:white;padding:24px;border-radius:12px;width:320px;max-width:95vw;box-shadow:0 8px 32px rgba(0,0,0,0.3);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
                var html = '<div style="font-weight:700;color:#0066cc;font-size:15px;margin-bottom:6px;">🗺️ Select Map</div>' +
                    '<div style="font-size:12px;color:#666;margin-bottom:14px;">This plan has no map info. Which map should it be drawn on?</div>' +
                    '<div style="display:flex;flex-direction:column;gap:8px;">';
                mapOptions.forEach(function(name) {
                    html += '<button onclick="window._selectPlanMap(\'' + name.replace(/'/g, "\\'") + '\')" ' +
                        'style="padding:10px 14px;background:#f0f6ff;color:#0066cc;border:2px solid #0066cc;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;text-align:left;">' +
                        name + '</button>';
                });
                html += '</div>';
                dialog.innerHTML = html;
                modal.appendChild(dialog);
                document.body.appendChild(modal);

                window._selectPlanMap = function(name) {
                    document.body.removeChild(modal);
                    delete window._selectPlanMap;
                    _finishApplyPlan(plan, name);
                };
                return; // wait for user click
            }

            _finishApplyPlan(plan, targetMap);
        }

        function _finishApplyPlan(plan, targetMap) {
            if (appState.baseMaps && targetMap !== appState.currentMapName) {
                Object.keys(appState.baseMaps).forEach(function(name) {
                    appState.map.removeLayer(appState.baseMaps[name]);
                });
                appState.baseMaps[targetMap].addTo(appState.map);
                appState.map.fire('baselayerchange', { name: targetMap });
            }

            appState.cruiseSpeed    = plan.cruiseSpeed    || 120;
            appState.fuelFlow       = plan.fuelFlow       || 17;
            appState.magVar         = plan.magVar !== undefined ? plan.magVar : -5;
            appState.circleRadius   = plan.circleRadius   || 0.3;
            appState.legAltitudes   = plan.legAltitudes   || {};
            appState.defaultAltitude = plan.defaultAltitude !== undefined ? plan.defaultAltitude : 400;
            appState.tickInterval   = plan.tickInterval   || 1;
            appState.labelInterval  = plan.labelInterval  || 1;
            appState.driftColor           = plan.driftColor           || '#cc6600';
            appState.driftWidth           = plan.driftWidth           || 2;
            appState.arrivalLabelFontSize = plan.arrivalLabelFontSize || 9;
            appState.waypointLabelFontSize = plan.waypointLabelFontSize || 11;
            // Restore label/box positions and styles BEFORE building route so they take effect immediately
            appState.waypointLabelOffsets = plan.waypointLabelOffsets || {};
            appState.waypointLabelOffsetsReverse = plan.waypointLabelOffsetsReverse || {};
            appState.waypointLabelStylesReverse = plan.waypointLabelStylesReverse || {};
            appState.waypointLabelStyles  = plan.waypointLabelStyles  || {};
            appState.miniWaypoints = plan.miniWaypoints || {};
            // Convert old absolute 'rotation' to heading-relative 'rotationDelta' if needed
            // (old plans stored absolute rotation; new plans store rotationDelta)
            Object.keys(appState.waypointLabelStyles).forEach(function(k) {
                var sty = appState.waypointLabelStyles[k];
                if (sty && sty.rotation !== undefined && sty.rotationDelta === undefined) {
                    // Old format: rotation is absolute. We don't know heading at load time,
                    // so store as rotationDelta=0 and keep rotation for display compatibility.
                    // The label will use rotationDelta=0 (aligned with leg heading).
                    sty.rotationDelta = 0;
                    delete sty.rotation;
                }
            });
            // Load leg label positions — convert to real coords for map-independence
            appState.legLabelDraggedPositions = {};
            var planVer = (plan.appVersion || '').replace(/[^0-9.]/g,'').split('.');
            var isNewFormat = planVer.length >= 3 &&
                (parseInt(planVer[0]) > 3 || (parseInt(planVer[0]) === 3 && parseInt(planVer[1]) > 5) ||
                (parseInt(planVer[0]) === 3 && parseInt(planVer[1]) === 5 && parseInt((planVer[2]||'0')) >= 3));
            Object.keys(plan.legLabelPositions || {}).forEach(function(k) {
                var p = plan.legLabelPositions[k];
                if (isNewFormat) {
                    // Already real coords
                    appState.legLabelDraggedPositions[k] = { lat: p.lat, lng: p.lng };
                } else {
                    // Old format: display coords — convert to real using calibration
                    var real = calibrateDisplayToReal(L.latLng(p.lat, p.lng));
                    appState.legLabelDraggedPositions[k] = { lat: real.lat, lng: real.lng };
                }
            });
            appState.arrivalLabelPositions = plan.arrivalLabelPositions || {};
            document.getElementById('cruiseSpeed').value    = appState.cruiseSpeed;
            document.getElementById('fuelFlow').value       = appState.fuelFlow;
            document.getElementById('magVar').value         = appState.magVar;
            document.getElementById('defaultAltitude').value = appState.defaultAltitude;
            document.getElementById('circleRadius').value   = Math.round(appState.circleRadius * 10);
            document.getElementById('radiusValue').textContent = appState.circleRadius.toFixed(1);
            document.getElementById('tickInterval').value   = appState.tickInterval;
            document.getElementById('tickIntervalValue').textContent = appState.tickInterval;
            document.getElementById('labelInterval').value  = appState.labelInterval;
            document.getElementById('labelIntervalValue').textContent = appState.labelInterval;
            document.getElementById('driftColor').value     = appState.driftColor;
            document.getElementById('driftWidth').value     = appState.driftWidth;
            document.getElementById('driftWidthValue').textContent = appState.driftWidth;
            document.getElementById('arrivalLabelFontSize').value = appState.arrivalLabelFontSize;
            document.getElementById('arrivalLabelFontSizeValue').textContent = appState.arrivalLabelFontSize;
            plan.waypoints.forEach(function(wp) {
                addWaypoint(wp.lat, wp.lng);
                if (wp.name) {
                    var i = appState.waypoints.length - 1;
                    appState.waypoints[i].name = wp.name;
                    updateWaypointLabelMarker(i);
                }
            });
            // Build mapping from saved wp.num to loaded sequential wp.num
            // plan.waypoints[i].num -> appState.waypoints[i].num (which is i+1)
            var savedNumToLoadedNum = {};
            plan.waypoints.forEach(function(savedWp, i) {
                savedNumToLoadedNum[savedWp.num] = i + 1;
            });

            // Convert all leg label position keys to loaded wp nums
            var convertedPos = {};
            Object.keys(appState.legLabelDraggedPositions).forEach(function(k) {
                if (/^\d+_\d+$/.test(k)) {
                    // New format: wp1.num_wp2.num — remap to loaded nums
                    var parts = k.split('_');
                    var n1 = savedNumToLoadedNum[parseInt(parts[0])];
                    var n2 = savedNumToLoadedNum[parseInt(parts[1])];
                    if (n1 && n2) convertedPos[n1 + '_' + n2] = appState.legLabelDraggedPositions[k];
                } else {
                    // Old format leg_N — convert using waypoint order
                    var match = k.match(/^leg_(\d+)$/);
                    if (match) {
                        var legIdx = parseInt(match[1]);
                        var wp1 = appState.waypoints[legIdx];
                        var wp2 = appState.waypoints[legIdx + 1];
                        if (wp1 && wp2) convertedPos[wp1.num + '_' + wp2.num] = appState.legLabelDraggedPositions[k];
                    }
                }
            });
            appState.legLabelDraggedPositions = convertedPos;

            // Also remap miniWaypoints from saved nums to loaded nums
            var newMini = {};
            Object.keys(appState.miniWaypoints).forEach(function(num) {
                var loadedNum = savedNumToLoadedNum[parseInt(num)];
                if (loadedNum) newMini[loadedNum] = appState.miniWaypoints[num];
            });
            appState.miniWaypoints = newMini;
            updateRoute();

            if (plan.textBoxes && plan.textBoxes.length > 0) {
                var tbsToLoad = plan.textBoxes.slice();
                setTimeout(function() {
                    tbsToLoad.forEach(function(tb) {
                        var displayLL;
                        if (tb.realLat !== undefined && typeof toDisplayLatLng === 'function') {
                            displayLL = toDisplayLatLng(L.latLng(tb.realLat, tb.realLng));
                        } else if (tb.realLat !== undefined) {
                            displayLL = L.latLng(tb.realLat, tb.realLng);
                        } else {
                            displayLL = L.latLng(tb.lat, tb.lng);
                        }
                        createTextBoxMarker(displayLL, tb.text,
                            tb.textColor || 'black', tb.fillColor || 'orange', tb.rotation || 0, tb.fontSize);
                    });
                }, 100);
            }
        }

        // ── localStorage fallback ───────────────────────────────────────────
        function loadSavedPlans() {
            var plans = JSON.parse(localStorage.getItem('flightPlans') || '[]');
            var html = '';
            if (plans.length === 0) {
                html = '<div style="text-align:center;color:#999;padding:1rem;font-size:0.813rem;">No saved plans yet</div>';
            } else {
                plans.forEach(function(plan, idx) {
                    var date = new Date(plan.date).toLocaleDateString();
                    html += '<div class="saved-plan">';
                    html += '<div><div class="saved-plan-name">' + plan.name + '</div>';
                    html += '<div class="saved-plan-info">' + plan.waypoints.length + ' waypoints &bull; ' + date + '</div></div>';
                    html += '<div><button class="btn-secondary" style="padding:0.25rem 0.5rem;font-size:0.75rem;margin-right:0.25rem;" onclick="loadPlan(' + idx + ')">Load</button>';
                    html += '<button class="btn-danger" style="padding:0.25rem 0.5rem;font-size:0.75rem;" onclick="deletePlan(' + idx + ')">Delete</button></div>';
                    html += '</div>';
                });
            }
            document.getElementById('saved-plans').innerHTML = html;
        }

        function loadPlan(idx) {
            var plans = JSON.parse(localStorage.getItem('flightPlans') || '[]');
            if (idx < 0 || idx >= plans.length) return;
            applyPlan(plans[idx]);
        }

        function deletePlan(idx) {
            if (!confirm('Delete this flight plan?')) return;
            var plans = JSON.parse(localStorage.getItem('flightPlans') || '[]');
            plans.splice(idx, 1);
            localStorage.setItem('flightPlans', JSON.stringify(plans));
            loadSavedPlans();
        }
        
