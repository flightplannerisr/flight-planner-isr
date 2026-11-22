        // Highlight Circles Module - allows adding non-route red highlight circles on map
        
        function startAddingHighlightCircle() {
            appState.addingHighlightCircle = true;
            var btn = document.getElementById('addHighlightCircleBtn');
            var origText = btn ? btn.innerHTML : '🔴 Add Red Circle';
            if (btn) {
                btn.textContent = 'Click map to place...';
                btn.classList.add('btn-primary');
                btn.classList.remove('btn-secondary');
            }
            
            var instruction = document.createElement('div');
            instruction.id = 'highlightCircleInstruction';
            instruction.style.cssText = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: rgba(220,53,69,0.95); color: white; padding: 15px 30px; border-radius: 8px; z-index: 10000; font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.3); font-family: -apple-system,BlinkMacSystemFont,sans-serif;';
            instruction.textContent = 'Click on the map to place highlight circle';
            
            var cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            cancelBtn.style.cssText = 'margin-left: 15px; padding: 5px 15px; background: white; color: #dc3545; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;';
            cancelBtn.onclick = function() {
                cleanup();
            };
            instruction.appendChild(cancelBtn);
            document.body.appendChild(instruction);
            
            function cleanup() {
                appState.addingHighlightCircle = false;
                if (btn) {
                    btn.innerHTML = origText;
                    btn.classList.remove('btn-primary');
                    btn.classList.add('btn-secondary');
                }
                if (instruction.parentNode) {
                    instruction.parentNode.removeChild(instruction);
                }
                appState.map.off('click', mapClickHandler);
            }
            
            var mapClickHandler = function(e) {
                if (e.originalEvent && e.originalEvent.target && (
                    e.originalEvent.target.closest('#mapHudToolbar') ||
                    e.originalEvent.target.closest('#mapLayersPopover') ||
                    e.originalEvent.target.closest('#topNavbar') ||
                    e.originalEvent.target.closest('.sidebar')
                )) {
                    return;
                }
                createHighlightCircle(e.latlng);
                cleanup();
            };
            
            appState.map.on('click', mapClickHandler);
        }

        function createHighlightCircle(latlng, radiusNm, label, color, opacity) {
            var rNm = (radiusNm !== undefined && radiusNm > 0) ? radiusNm : (appState.highlightCircleRadius || 0.5);
            var col = color || appState.highlightCircleColor || '#dc3545';
            var opac = (opacity !== undefined) ? opacity : (appState.highlightCircleOpacity !== undefined ? appState.highlightCircleOpacity : 0.25);
            var radiusMeters = rNm * 1852;
            
            var realLL = (typeof calibrateDisplayToReal === 'function')
                ? calibrateDisplayToReal(latlng)
                : latlng;
                
            var circle = L.circle([latlng.lat, latlng.lng], {
                color: col,
                fillColor: col,
                fillOpacity: opac,
                radius: radiusMeters,
                weight: 2.5,
                interactive: true
            }).addTo(appState.map);
            
            circle._radiusNm = rNm;
            circle._color = col;
            circle._opacity = opac;
            circle._label = label || '';
            circle._realLat = realLL.lat;
            circle._realLng = realLL.lng;
            
            updateHighlightCircleTooltip(circle);
            
            var _dragged = false;
            circle.on('mousedown touchstart', function(e) {
                if (e.originalEvent && e.originalEvent.button !== 0) return;
                _dragged = false;
                appState.map.dragging.disable();
                
                function onMove(ev) {
                    _dragged = true;
                    circle.setLatLng(ev.latlng);
                }
                
                function onUp() {
                    appState.map.dragging.enable();
                    appState.map.off('mousemove touchmove', onMove);
                    appState.map.off('mouseup touchend', onUp);
                    var curLL = circle.getLatLng();
                    var updatedReal = (typeof calibrateDisplayToReal === 'function')
                        ? calibrateDisplayToReal(curLL)
                        : curLL;
                    circle._realLat = updatedReal.lat;
                    circle._realLng = updatedReal.lng;
                }
                
                appState.map.on('mousemove touchmove', onMove);
                appState.map.on('mouseup touchend', onUp);
            });
            
            circle.on('click', function(e) {
                if (_dragged) return;
                L.DomEvent.stopPropagation(e);
                openHighlightCirclePopup(circle);
            });
            
            appState.highlightCircles.push(circle);
            return circle;
        }

        function updateHighlightCircleTooltip(circle) {
            if (!circle) return;
            circle.unbindTooltip();
            if (circle._label && circle._label.trim() !== '') {
                circle.bindTooltip(
                    '<span style="font-weight:700;color:' + circle._color + ';">' + circle._label.replace(/"/g, '&quot;') + '</span>',
                    { permanent: true, direction: 'top', className: 'highlight-circle-tooltip', opacity: 0.95 }
                );
            } else {
                circle.bindTooltip(
                    'Highlight Point (' + circle._radiusNm.toFixed(1) + ' nm)',
                    { permanent: false, direction: 'top' }
                );
            }
        }

        function openHighlightCirclePopup(circle) {
            var latlng = circle.getLatLng();
            var realLat = circle._realLat !== undefined ? circle._realLat : latlng.lat;
            var realLng = circle._realLng !== undefined ? circle._realLng : latlng.lng;
            
            var popupHtml =
                '<div style="min-width:210px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">' +
                    '<div style="font-weight:700;color:' + circle._color + ';margin-bottom:4px;font-size:13px;">🔴 Highlight Point</div>' +
                    '<div style="font-size:11px;color:#666;margin-bottom:8px;">' + realLat.toFixed(4) + '°N, ' + realLng.toFixed(4) + '°E</div>' +
                    '<label style="font-size:11px;color:#555;display:block;margin-bottom:2px;">Radius (NM)</label>' +
                    '<input id="hc-radius-input" type="number" step="0.1" min="0.1" max="20" value="' + circle._radiusNm.toFixed(1) + '" ' +
                        'style="width:100%;padding:4px 6px;border:1px solid #ccc;border-radius:4px;font-size:13px;box-sizing:border-box;margin-bottom:8px;">' +
                    '<label style="font-size:11px;color:#555;display:block;margin-bottom:2px;">Label / Note (optional)</label>' +
                    '<input id="hc-label-input" type="text" value="' + (circle._label || '').replace(/"/g, '&quot;') + '" placeholder="e.g. Mast, Caution, Landmark..." ' +
                        'style="width:100%;padding:4px 6px;border:1px solid #ccc;border-radius:4px;font-size:13px;box-sizing:border-box;margin-bottom:8px;">' +
                    '<label style="font-size:11px;color:#555;display:block;margin-bottom:2px;">Color</label>' +
                    '<div style="display:flex;gap:6px;margin-bottom:10px;">' +
                        '<div onclick="window._setHcColor(\'#dc3545\')" style="width:20px;height:20px;border-radius:4px;background:#dc3545;cursor:pointer;border:2px solid ' + (circle._color === '#dc3545' ? '#000' : '#ddd') + ';" title="Red"></div>' +
                        '<div onclick="window._setHcColor(\'#ff8c00\')" style="width:20px;height:20px;border-radius:4px;background:#ff8c00;cursor:pointer;border:2px solid ' + (circle._color === '#ff8c00' ? '#000' : '#ddd') + ';" title="Orange"></div>' +
                        '<div onclick="window._setHcColor(\'#6f42c1\')" style="width:20px;height:20px;border-radius:4px;background:#6f42c1;cursor:pointer;border:2px solid ' + (circle._color === '#6f42c1' ? '#000' : '#ddd') + ';" title="Purple"></div>' +
                        '<div onclick="window._setHcColor(\'#0066cc\')" style="width:20px;height:20px;border-radius:4px;background:#0066cc;cursor:pointer;border:2px solid ' + (circle._color === '#0066cc' ? '#000' : '#ddd') + ';" title="Blue"></div>' +
                        '<div onclick="window._setHcColor(\'#28a745\')" style="width:20px;height:20px;border-radius:4px;background:#28a745;cursor:pointer;border:2px solid ' + (circle._color === '#28a745' ? '#000' : '#ddd') + ';" title="Green"></div>' +
                    '</div>' +
                    '<input type="hidden" id="hc-color-val" value="' + circle._color + '">' +
                    '<div style="display:flex;gap:6px;">' +
                        '<button id="hc-save-btn" style="flex:1;padding:6px;background:#0066cc;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;">Save</button>' +
                        '<button id="hc-delete-btn" style="flex:1;padding:6px;background:#dc3545;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;">Delete</button>' +
                    '</div>' +
                '</div>';
                
            var popup = L.popup({ closeButton: true, autoClose: true, offset: [0, -5] })
                .setLatLng(latlng)
                .setContent(popupHtml)
                .openOn(appState.map);
                
            window._setHcColor = function(c) {
                var inp = document.getElementById('hc-color-val');
                if (inp) inp.value = c;
                var swatches = document.querySelectorAll('[onclick^="window._setHcColor"]');
                swatches.forEach(function(s) {
                    if (s.getAttribute('onclick').indexOf(c) > -1) s.style.border = '2px solid #000';
                    else s.style.border = '2px solid #ddd';
                });
            };
            
            setTimeout(function() {
                var saveBtn = document.getElementById('hc-save-btn');
                var delBtn = document.getElementById('hc-delete-btn');
                
                if (saveBtn) {
                    saveBtn.onclick = function() {
                        var radVal = parseFloat(document.getElementById('hc-radius-input').value);
                        if (!isNaN(radVal) && radVal > 0) {
                            circle._radiusNm = radVal;
                            circle.setRadius(radVal * 1852);
                        }
                        var labelVal = (document.getElementById('hc-label-input').value || '').trim();
                        circle._label = labelVal;
                        var colVal = document.getElementById('hc-color-val').value || '#dc3545';
                        circle._color = colVal;
                        circle.setStyle({ color: colVal, fillColor: colVal });
                        updateHighlightCircleTooltip(circle);
                        appState.map.closePopup();
                    };
                }
                
                if (delBtn) {
                    delBtn.onclick = function() {
                        appState.map.closePopup();
                        appState.map.removeLayer(circle);
                        var idx = appState.highlightCircles.indexOf(circle);
                        if (idx > -1) {
                            appState.highlightCircles.splice(idx, 1);
                        }
                    };
                }
            }, 50);
        }

        function updateAllHighlightCircles(newRadiusNm, newOpacity) {
            if (newRadiusNm !== undefined && newRadiusNm > 0) {
                appState.highlightCircleRadius = newRadiusNm;
            }
            if (newOpacity !== undefined) {
                appState.highlightCircleOpacity = newOpacity;
            }
            var radiusMeters = (appState.highlightCircleRadius || 0.5) * 1852;
            var opac = (appState.highlightCircleOpacity !== undefined) ? appState.highlightCircleOpacity : 0.25;
            
            appState.highlightCircles.forEach(function(c) {
                c.setRadius((c._radiusNm || appState.highlightCircleRadius || 0.5) * 1852);
                c.setStyle({ fillOpacity: (c._opacity !== undefined ? c._opacity : opac) });
            });
        }

        function repositionHighlightCircles() {
            appState.highlightCircles.forEach(function(c) {
                if (c._realLat !== undefined && c._realLng !== undefined) {
                    var dispLL = (typeof toDisplayLatLng === 'function')
                        ? toDisplayLatLng(L.latLng(c._realLat, c._realLng))
                        : L.latLng(c._realLat, c._realLng);
                    c.setLatLng(dispLL);
                }
            });
        }

        function clearAllHighlightCircles() {
            if (appState.highlightCircles) {
                appState.highlightCircles.forEach(function(c) {
                    if (c.remove) c.remove();
                    else appState.map.removeLayer(c);
                });
                appState.highlightCircles = [];
            }
        }
