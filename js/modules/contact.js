        var CONTACT_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzxZpFyOG_It31xpkAPi6KdojE4GEjS7Cmp2p9vBV9SxjbJFtlE9krbfiO7pYuqrdUNuA/exec';

        function openContactForm() {
            if (document.getElementById('contactModal')) return;

            var modal = document.createElement('div');
            modal.id = 'contactModal';
            modal.style.cssText = [
                'position:fixed;top:0;left:0;width:100%;height:100%',
                'background:rgba(0,0,0,0.6);z-index:20000',
                'display:flex;align-items:center;justify-content:center'
            ].join(';');

            modal.innerHTML =
                '<div style="background:white;border-radius:12px;padding:28px 28px 20px;' +
                             'width:360px;max-width:92vw;box-shadow:0 8px 32px rgba(0,0,0,0.3);font-family:inherit;">' +

                    '<h2 style="margin:0 0 4px;font-size:16px;color:#0066cc;">✉️ Contact Developer</h2>' +
                    '<p style="margin:0 0 18px;font-size:12px;color:#888;">Israel Flight Planner · v3.7</p>' +

                    '<label style="font-size:12px;color:#555;font-weight:600;">' +
                        'Name <span style="color:#dc3545;">*</span></label>' +
                    '<input id="cf-name" type="text" placeholder="Your full name" autocomplete="name" ' +
                        'style="display:block;width:100%;margin:4px 0 12px;padding:7px 10px;' +
                               'border:1px solid #ddd;border-radius:6px;font-size:13px;box-sizing:border-box;">' +

                    '<label style="font-size:12px;color:#555;font-weight:600;">' +
                        'Email <span style="color:#dc3545;">*</span></label>' +
                    '<input id="cf-email" type="email" placeholder="your@email.com" autocomplete="email" ' +
                        'style="display:block;width:100%;margin:4px 0 12px;padding:7px 10px;' +
                               'border:1px solid #ddd;border-radius:6px;font-size:13px;box-sizing:border-box;">' +

                    '<label style="font-size:12px;color:#555;font-weight:600;">' +
                        'Phone <span style="color:#aaa;font-weight:400;">(optional)</span></label>' +
                    '<input id="cf-phone" type="tel" placeholder="+972 50 000 0000" autocomplete="tel" ' +
                        'style="display:block;width:100%;margin:4px 0 12px;padding:7px 10px;' +
                               'border:1px solid #ddd;border-radius:6px;font-size:13px;box-sizing:border-box;">' +

                    '<label style="font-size:12px;color:#555;font-weight:600;">Message</label>' +
                    '<textarea id="cf-message" rows="4" placeholder="Write your message here…" ' +
                        'style="display:block;width:100%;margin:4px 0 4px;padding:7px 10px;' +
                               'border:1px solid #ddd;border-radius:6px;font-size:13px;' +
                               'box-sizing:border-box;resize:vertical;"></textarea>' +
                    '<p style="margin:0 0 14px;font-size:11px;color:#aaa;">Ctrl + Enter to send</p>' +

                    '<div id="cf-error" style="display:none;background:#fff0f0;border:1px solid #dc3545;' +
                         'border-radius:6px;padding:7px 10px;font-size:12px;color:#dc3545;margin-bottom:12px;"></div>' +
                    '<div id="cf-success" style="display:none;background:#f0fff4;border:1px solid #28a745;' +
                         'border-radius:6px;padding:7px 10px;font-size:12px;color:#28a745;margin-bottom:12px;"></div>' +

                    '<div style="display:flex;gap:10px;">' +
                        '<button id="cf-cancel-btn" onclick="cancelContactForm()" ' +
                            'style="flex:1;padding:8px;background:#f0f0f0;color:#333;border:none;' +
                                   'border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;">Cancel</button>' +
                        '<button id="cf-send-btn" onclick="sendContactForm()" ' +
                            'style="flex:2;padding:8px;background:#0066cc;color:white;border:none;' +
                                   'border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;">Send</button>' +
                    '</div>' +
                '</div>';

            document.body.appendChild(modal);

            // Reset field borders on input
            ['cf-name','cf-email','cf-phone','cf-message'].forEach(function(id) {
                var el = document.getElementById(id);
                if (el) el.addEventListener('input', function() {
                    this.style.borderColor = '#ddd';
                    document.getElementById('cf-error').style.display = 'none';
                });
            });

            // Ctrl+Enter in textarea sends
            document.getElementById('cf-message').addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && e.ctrlKey) sendContactForm();
            });

            document.getElementById('cf-name').focus();
        }

        function cancelContactForm() {
            var modal = document.getElementById('contactModal');
            if (!modal) return;
            // If already sent, close without asking
            if (modal.dataset.sent === 'true') {
                document.body.removeChild(modal);
                return;
            }
            var hasContent = ['cf-name','cf-email','cf-message'].some(function(id) {
                var el = document.getElementById(id);
                return el && el.value.trim() !== '';
            });
            if (hasContent && !confirm('Discard your message?')) return;
            document.body.removeChild(modal);
        }

        function sendContactForm() {
            var name    = (document.getElementById('cf-name').value    || '').trim();
            var email   = (document.getElementById('cf-email').value   || '').trim();
            var phone   = (document.getElementById('cf-phone').value   || '').trim();
            var message = (document.getElementById('cf-message').value || '').trim();

            if (!name) {
                cfError('Please enter your name.', 'cf-name'); return;
            }
            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                cfError('Please enter a valid email address.', 'cf-email'); return;
            }

            var sendBtn = document.getElementById('cf-send-btn');
            sendBtn.disabled = true;
            sendBtn.textContent = 'Sending…';

            var params = new URLSearchParams();
            params.append('from_name',  name);
            params.append('from_email', email);
            params.append('phone',      phone || 'Not provided');
            params.append('message',    message || '(no message)');

            fetch(CONTACT_ENDPOINT, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params.toString()
            })
            .then(function() {
                // no-cors returns an opaque response — if we get here it was sent
                document.getElementById('contactModal').dataset.sent = 'true';
                var successEl = document.getElementById('cf-success');
                successEl.textContent = '✓ Message sent! We\'ll get back to you soon.';
                successEl.style.display = 'block';
                sendBtn.style.display = 'none';
                document.getElementById('cf-cancel-btn').textContent = 'Close';
            })
            .catch(function(err) {
                sendBtn.disabled = false;
                sendBtn.textContent = 'Send';
                cfError('Failed to send: ' + err.message + '. Please try again.');
            });
        }

        function cfError(msg, focusId) {
            var errEl = document.getElementById('cf-error');
            errEl.textContent = msg;
            errEl.style.display = 'block';
            if (focusId) {
                var el = document.getElementById(focusId);
                if (el) { el.focus(); el.style.borderColor = '#dc3545'; }
            }
        }
