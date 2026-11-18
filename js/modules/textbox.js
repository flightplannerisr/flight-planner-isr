        function startAddingTextBox() {
            appState.addingTextBox = true;
            var btn = document.getElementById('addTextBoxBtn2');
            btn.textContent = 'Click map to place...';
            btn.classList.add('btn-primary');
            
            var instruction = document.createElement('div');
            instruction.id = 'textBoxInstruction';
            instruction.style.cssText = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: rgba(0,102,204,0.95); color: white; padding: 15px 30px; border-radius: 8px; z-index: 10000; font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.3);';
            instruction.textContent = 'Click on the map to place text box';
            document.body.appendChild(instruction);
            
            var cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            cancelBtn.style.cssText = 'margin-left: 15px; padding: 5px 15px; background: white; color: #0066cc; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;';
            cancelBtn.onclick = function() {
                appState.addingTextBox = false;
                btn.textContent = 'Add Text Box';
                btn.classList.remove('btn-primary');
                document.body.removeChild(instruction);
                appState.map.off('click', textBoxClickHandler);
            };
            instruction.appendChild(cancelBtn);
            
            var textBoxClickHandler = function(e) {
                createTextBox(e.latlng);
                appState.addingTextBox = false;
                btn.textContent = 'Add Text Box';
                btn.classList.remove('btn-primary');
                document.body.removeChild(instruction);
                appState.map.off('click', textBoxClickHandler);
            };
            
            appState.map.on('click', textBoxClickHandler);
        }
        
        function createTextBox(latlng) {
            // Find closest leg heading as default rotation
            var closestHeading = 0;
            var minDistance = Infinity;
            for (var i = 0; i < appState.waypoints.length - 1; i++) {
                var wp1 = appState.waypoints[i];
                var wp2 = appState.waypoints[i + 1];
                var midLat = (wp1.lat + wp2.lat) / 2;
                var midLng = (wp1.lng + wp2.lng) / 2;
                var dist = Math.sqrt(Math.pow(latlng.lat - midLat, 2) + Math.pow(latlng.lng - midLng, 2));
                if (dist < minDistance) {
                    minDistance = dist;
                    closestHeading = calculateBearing(wp1.lat, wp1.lng, wp2.lat, wp2.lng);
                }
            }

            var popupHtml = buildTextBoxPopupHtml('', 'black', 'orange', closestHeading, false);

            var popup = L.popup({ closeButton: true, autoClose: false, offset: [0, 0] })
                .setLatLng(latlng)
                .setContent(popupHtml)
                .openOn(appState.map);

            setTimeout(function() {
                var inp = document.getElementById('tb-text-input');
                if (inp) { inp.focus(); }
                // Wire no-fill toggle
                var nofillCb = document.getElementById('tb-nofill-input');
                var fillSwatches = document.getElementById('tb-fill-swatches');
                if (nofillCb && fillSwatches) {
                    nofillCb.onchange = function() {
                        fillSwatches.style.opacity = this.checked ? '0.35' : '1';
                        fillSwatches.style.pointerEvents = this.checked ? 'none' : '';
                    };
                }
                document.getElementById('tb-save-btn').onclick = function() {
                    var text = document.getElementById('tb-text-input').value.trim();
                    if (!text) return;
                    var textColor = document.getElementById('tb-color-input').value || '#000000';
                    var noFill = document.getElementById('tb-nofill-input').checked;
                    var fillColor = noFill ? 'transparent' : (document.getElementById('tb-fill-input').value || '#ff9900');
                    var rotation = parseInt(document.getElementById('tb-rotation-input').value) || 0;
                    appState.map.closePopup();
                    createTextBoxMarker(latlng, text, textColor, fillColor, rotation);
                };
                document.getElementById('tb-text-input').onkeydown = function(e) {
                    if (e.key === 'Enter') document.getElementById('tb-save-btn').click();
                    if (e.key === 'Escape') appState.map.closePopup();
                };
            }, 50);
        }

        function buildTextBoxPopupHtml(text, textColor, fillColor, rotation, isEdit, fontSize) {
            var noFill = (fillColor === 'transparent' || fillColor === 'none' || fillColor === '');
            var fillHex = noFill ? '#ffffff' : colorToHex(fillColor);
            var textHex = colorToHex(textColor || '#000000');
            return '<div style="min-width:220px;">' +
                '<div style="font-weight:700;color:#0066cc;margin-bottom:8px;font-size:13px;">' + (isEdit ? 'Edit Text Box' : 'New Text Box') + '</div>' +
                '<label style="font-size:11px;color:#555;display:block;margin-bottom:2px;">Text</label>' +
                '<input id="tb-text-input" type="text" value="' + text.replace(/"/g,'&quot;') + '" placeholder="Enter text..." ' +
                    'style="width:100%;padding:4px 6px;border:1px solid #0066cc;border-radius:4px;font-size:13px;box-sizing:border-box;margin-bottom:8px;">' +
                '<label style="font-size:11px;color:#555;display:block;margin-bottom:2px;">Text color</label>' +
                buildColorSwatches('tb-color-input', textHex) +
                '<label style="font-size:11px;color:#555;display:block;margin-top:8px;margin-bottom:2px;">Fill color</label>' +
                '<label style="font-size:11px;color:#555;display:flex;align-items:center;gap:5px;margin-bottom:4px;cursor:pointer;">' +
                    '<input id="tb-nofill-input" type="checkbox"' + (noFill ? ' checked' : '') + ' onchange="var w=document.getElementById(\'tb-fill-swatches\');w.style.opacity=this.checked?\'0.35\':\'1\';w.style.pointerEvents=this.checked?\'none\':\'auto\';">No fill (transparent)</label>' +
                '<div id="tb-fill-swatches" style="' + (noFill ? 'opacity:0.35;pointer-events:none;' : '') + '">' +
                buildColorSwatches('tb-fill-input', fillHex) +
                '</div>' +
                '<div style="display:flex;gap:8px;margin-bottom:8px;">' +
                '<div style="flex:1;">' +
                '<label style="font-size:11px;color:#555;display:block;margin-top:8px;margin-bottom:2px;">Rotation (°)</label>' +
                '<input id="tb-rotation-input" type="number" value="' + rotation + '" min="0" max="360" ' +
                    'style="width:100%;padding:4px 6px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;">' +
                '</div>' +
                '<div style="flex:1;">' +
                '<label style="font-size:11px;color:#555;display:block;margin-top:8px;margin-bottom:2px;">Font size (px)</label>' +
                '<input id="tb-fontsize-input" type="number" value="' + (fontSize || 14) + '" min="6" max="72" ' +
                    'style="width:100%;padding:4px 6px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;">' +
                '</div></div>' +
                '<div style="display:flex;gap:6px;">' +
                '<button id="tb-save-btn" style="flex:1;padding:6px;background:#0066cc;color:white;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:600;">Save</button>' +
                (isEdit ? '<button id="tb-delete-btn" style="flex:1;padding:6px;background:#dc3545;color:white;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:600;">Delete</button>' : '') +
                '</div>' +
                '</div>';
        }

        function colorToHex(color) {
            // If already a hex color return as-is, otherwise map named colors
            if (/^#[0-9a-fA-F]{3,6}$/.test(color)) return color;
            var ctx = document.createElement('canvas').getContext('2d');
            ctx.fillStyle = color;
            return ctx.fillStyle; // browser resolves named colors to hex
        }

        window.selectColorSwatch = function(swatchEl, inputId, hex) {
            // Update hidden input value
            var inp = document.getElementById(inputId);
            if (inp) inp.value = hex;
            // Update swatch borders — find parent flex container
            var container = swatchEl ? swatchEl.parentNode : (inp ? inp.parentNode : null);
            if (container) {
                container.querySelectorAll('div').forEach(function(d) {
                    d.style.border = '2px solid #ccc';
                });
                if (swatchEl) swatchEl.style.border = '3px solid #333';
            }
        };

        // Predefined palette used in all color pickers

        var COLOR_PALETTE = [
            { hex: '#0066cc', name: 'Blue' },
            { hex: '#dc3545', name: 'Red' },
            { hex: '#28a745', name: 'Green' },
            { hex: '#ff8c00', name: 'Orange' },
            { hex: '#6f42c1', name: 'Purple' },
            { hex: '#17a2b8', name: 'Cyan' },
            { hex: '#e83e8c', name: 'Pink' },
            { hex: '#fd7e14', name: 'Amber' },
            { hex: '#000000', name: 'Black' },
            { hex: '#555555', name: 'Dark grey' },
            { hex: '#ffffff', name: 'White' },
            { hex: '#ffff00', name: 'Yellow' }
        ];

        function buildColorSwatches(inputId, selectedColor) {
            var selHex = colorToHex(selectedColor || '#000000');
            var html = '<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:4px;">';
            COLOR_PALETTE.forEach(function(c) {
                var active = (selHex === c.hex);
                html += '<div title="' + c.name + '" ' +
                    'onclick="selectColorSwatch(this,\'' + inputId + '\',\'' + c.hex + '\')" ' +
                    'style="width:22px;height:22px;border-radius:4px;cursor:pointer;background:' + c.hex + ';' +
                    'border:' + (active ? '3px solid #333' : '2px solid #ccc') + ';' +
                    'box-sizing:border-box;flex-shrink:0;"></div>';
            });
            html += '<input type="color" id="' + inputId + '" value="' + selHex + '" ' +
                'title="Custom color" ' +
                'onchange="selectColorSwatch(null,\'' + inputId + '\',this.value)" ' +
                'style="width:22px;height:22px;padding:1px;border:2px solid #ccc;border-radius:4px;cursor:pointer;">';
            html += '</div>';
            return html;
        }
        
        function getTextBoxScale() {
            var zoom = appState.map.getZoom();
            return Math.pow(1.5, zoom - 12);
        }

        function createTextBoxMarker(latlng, text, textColor, fillColor, rotation, fontSize) {
            var isTransparent = (fillColor === 'transparent' || fillColor === 'none' || fillColor === '');
            var scale = getTextBoxScale();
            var boxFontSize = fontSize || appState.textBoxFontSize;
            var scaledFont    = Math.round(boxFontSize * scale);
            var scaledPadH    = Math.round(2  * scale);
            var scaledPadV    = Math.round(1 * scale);
            var scaledBorder  = Math.max(1, Math.round(2 * scale));
            var scaledRadius  = Math.round(4 * scale);
            var textBoxHtml = '<div style="transform: rotate(' + rotation + 'deg); transform-origin: center center; position: relative;">' +
                '<div style="background: ' + (isTransparent ? 'transparent' : fillColor) + '; color: ' + textColor + '; padding: ' + scaledPadH + 'px ' + scaledPadV + 'px; border: ' + scaledBorder + 'px solid ' + textColor + '; border-radius: ' + scaledRadius + 'px; font-weight: bold; font-size: ' + scaledFont + 'px; line-height: 1; white-space: nowrap;' + (isTransparent ? '' : ' box-shadow: 0 2px 4px rgba(0,0,0,0.3);') + ' display: inline-block; position: relative;">' +
                text +
                '</div>' +
                '</div>';
            
            var textMarker = L.marker([latlng.lat, latlng.lng], {
                icon: L.divIcon({
                    className: 'text-box-label',
                    html: textBoxHtml,
                    iconSize: [null, null], // Auto-size
                    iconAnchor: [0, 0]
                }),
                draggable: true
            }).addTo(appState.map);
            
            // Store text box data including real geographic coords
            var realLL = (typeof calibrateDisplayToReal === 'function')
                ? calibrateDisplayToReal(latlng)
                : latlng;
            textMarker.textBoxData = {
                text: text,
                textColor: textColor,
                fillColor: fillColor,
                rotation: rotation,
                fontSize: boxFontSize,
                _realLat: realLL.lat,
                _realLng: realLL.lng
            };
            
            // Single click = show selection box with rotation handle (like WP labels)
            var tbSelDiv = null;
            function showTbSelection() {
                hideTbSelection();
                var el = textMarker.getElement();
                if (!el) return;
                var inner = el.querySelector('div');
                if (!inner) return;
                var r = inner.getBoundingClientRect();
                var curRot = textMarker.textBoxData.rotation || 0;
                tbSelDiv = document.createElement('div');
                tbSelDiv.style.cssText = 'position:fixed;pointer-events:none;z-index:9000;' +
                    'left:' + r.left + 'px;top:' + r.top + 'px;' +
                    'width:' + r.width + 'px;height:' + r.height + 'px;' +
                    'transform:rotate(' + curRot + 'deg);transform-origin:center center;';
                var bbox = document.createElement('div');
                bbox.style.cssText = 'position:absolute;inset:-3px;border:1.5px dashed #ff9900;border-radius:2px;box-sizing:border-box;';
                var handle = document.createElement('div');
                handle.style.cssText = 'position:absolute;bottom:-10px;right:-10px;' +
                    'width:14px;height:14px;background:#ff9900;border:2px solid white;' +
                    'border-radius:50%;cursor:grab;pointer-events:auto;box-shadow:0 1px 3px rgba(0,0,0,0.5);';
                handle.title = 'Drag to rotate';
                tbSelDiv.appendChild(bbox);
                tbSelDiv.appendChild(handle);
                document.body.appendChild(tbSelDiv);

                handle.addEventListener('mousedown', function(ev) {
                    if (ev.button !== 0) return;
                    ev.stopPropagation(); ev.preventDefault();
                    appState.map.dragging.disable();
                    var cx = r.left + r.width/2, cy = r.top + r.height/2;
                    var startAngle = Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI;
                    var baseRot = textMarker.textBoxData.rotation || 0;
                    function mmR(mev) {
                        var angle = Math.atan2(mev.clientY - cy, mev.clientX - cx) * 180 / Math.PI;
                        var newRot = Math.round(baseRot + angle - startAngle);
                        textMarker.textBoxData.rotation = ((newRot % 360) + 360) % 360;
                        if (tbSelDiv) tbSelDiv.style.transform = 'rotate(' + textMarker.textBoxData.rotation + 'deg)';
                        var elNow = textMarker.getElement();
                        if (elNow) { var d = elNow.querySelector('div'); if (d) d.style.transform = 'rotate(' + textMarker.textBoxData.rotation + 'deg)'; }
                    }
                    function muR() {
                        document.removeEventListener('mousemove', mmR);
                        document.removeEventListener('mouseup', muR);
                        appState.map.dragging.enable();
                        // Rebuild to apply rotation
                        var ll = textMarker.getLatLng();
                        var d = textMarker.textBoxData;
                        appState.map.removeLayer(textMarker);
                        var idx = appState.textBoxes.indexOf(textMarker);
                        if (idx > -1) appState.textBoxes.splice(idx, 1);
                        createTextBoxMarker(ll, d.text, d.textColor, d.fillColor, d.rotation);
                    }
                    document.addEventListener('mousemove', mmR);
                    document.addEventListener('mouseup', muR);
                });
            }
            function hideTbSelection() {
                if (tbSelDiv && tbSelDiv.parentNode) tbSelDiv.parentNode.removeChild(tbSelDiv);
                tbSelDiv = null;
            }

            textMarker.on('click', function(e) {
                L.DomEvent.stopPropagation(e);
                showTbSelection();
                setTimeout(function() { appState.map.once('click', hideTbSelection); }, 10);
            });

            // Double click = open edit popup
            textMarker.on('dblclick', function(e) {
                L.DomEvent.stopPropagation(e);
                hideTbSelection();
                var oldLatLng = textMarker.getLatLng();
                var popupHtml = buildTextBoxPopupHtml(
                    textMarker.textBoxData.text,
                    textMarker.textBoxData.textColor,
                    textMarker.textBoxData.fillColor,
                    textMarker.textBoxData.rotation,
                    true,
                    textMarker.textBoxData.fontSize
                );
                var popup = L.popup({ closeButton: true, autoClose: false, offset: [0, 0] })
                    .setLatLng(oldLatLng)
                    .setContent(popupHtml)
                    .openOn(appState.map);
                setTimeout(function() {
                    var inp = document.getElementById('tb-text-input');
                    if (inp) { inp.focus(); inp.select(); }
                    var nofillCb = document.getElementById('tb-nofill-input');
                    var fillSwatches = document.getElementById('tb-fill-swatches');
                    if (nofillCb && fillSwatches) {
                        nofillCb.onchange = function() {
                            fillSwatches.style.opacity = this.checked ? '0.35' : '1';
                            fillSwatches.style.pointerEvents = this.checked ? 'none' : '';
                        };
                    }
                    document.getElementById('tb-save-btn').onclick = function() {
                        var newText = document.getElementById('tb-text-input').value.trim();
                        if (!newText) return;
                        var newTextColor = document.getElementById('tb-color-input').value || '#000000';
                        var noFill = document.getElementById('tb-nofill-input').checked;
                        var newFillColor = noFill ? 'transparent' : (document.getElementById('tb-fill-input').value || '#ff9900');
                        var newRotation = parseInt(document.getElementById('tb-rotation-input').value) || 0;
                        var newFontSize = parseInt(document.getElementById('tb-fontsize-input').value) || appState.textBoxFontSize;
                        appState.map.closePopup();
                        appState.map.removeLayer(textMarker);
                        var index = appState.textBoxes.indexOf(textMarker);
                        if (index > -1) appState.textBoxes.splice(index, 1);
                        createTextBoxMarker(oldLatLng, newText, newTextColor, newFillColor, newRotation, newFontSize);
                    };
                    document.getElementById('tb-text-input').onkeydown = function(e) {
                        if (e.key === 'Enter') document.getElementById('tb-save-btn').click();
                    };
                    // Wire up delete button if present
                    var delBtn = document.getElementById('tb-delete-btn');
                    if (delBtn) delBtn.onclick = function() {
                        appState.map.closePopup();
                        appState.map.removeLayer(textMarker);
                        var index = appState.textBoxes.indexOf(textMarker);
                        if (index > -1) appState.textBoxes.splice(index, 1);
                    };
                }, 50);
            });
            
            appState.textBoxes.push(textMarker);
        }

        function updateTextBoxes() {
            // Rebuild all text boxes at the current zoom scale
            var boxes = appState.textBoxes.slice();
            appState.textBoxes = [];
            boxes.forEach(function(marker) {
                var d = marker.textBoxData;
                var ll = marker.getLatLng();
                appState.map.removeLayer(marker);
                createTextBoxMarker(ll, d.text, d.textColor, d.fillColor, d.rotation, d.fontSize);
            });
        }

        function startRotation(marker, event) {
            var markerLatLng = marker.getLatLng();
            var startPoint = appState.map.latLngToContainerPoint(markerLatLng);
            var initialRotation = marker.textBoxData.rotation;
            
            var mouseMoveHandler = function(e) {
                var currentPoint = L.point(e.containerPoint.x, e.containerPoint.y);
                var dx = currentPoint.x - startPoint.x;
                var dy = currentPoint.y - startPoint.y;
                var angle = Math.atan2(dy, dx) * (180 / Math.PI);
                var newRotation = (angle + 90) % 360;
                if (newRotation < 0) newRotation += 360;
                
                marker.textBoxData.rotation = Math.round(newRotation);
                
                // Update marker
                var element = marker.getElement();
                if (element) {
                    var innerDiv = element.querySelector('div > div');
                    if (innerDiv) {
                        innerDiv.parentElement.style.transform = 'rotate(' + marker.textBoxData.rotation + 'deg)';
                    }
                }
            };
            
            var mouseUpHandler = function() {
                appState.map.off('mousemove', mouseMoveHandler);
                appState.map.off('mouseup', mouseUpHandler);
            };
            
            appState.map.on('mousemove', mouseMoveHandler);
            appState.map.on('mouseup', mouseUpHandler);
        }
