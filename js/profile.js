"use strict";
window.SMC = window.SMC || {};
SMC.profile = (function () {
    var KEY = 'smc-profile';
    var current = null;
    var pendingPhoto = null;
    var photoTouched = false;
    var loadedFromServer = false;
    function ui() { return SMC.ui || { toast: function (m) { try {
            alert(m);
        }
        catch (e) { } } }; }
    function api() { return SMC.api || null; }
    function esc(s) { return (SMC.ui && SMC.ui.esc) ? SMC.ui.esc(s == null ? '' : s) : String(s == null ? '' : s); }
    function loadLocal() { try {
        return JSON.parse(localStorage.getItem(KEY) || '{}');
    }
    catch (e) {
        return {};
    } }
    function saveLocal(d) { try {
        localStorage.setItem(KEY, JSON.stringify(d));
    }
    catch (e) { } }
    function compress(dataUrl, maxDim, quality) {
        return new Promise(function (resolve) {
            try {
                var img = new Image();
                img.onload = function () {
                    var w = img.width || 1, h = img.height || 1;
                    var scale = Math.min(1, maxDim / Math.max(w, h));
                    var cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
                    var cv = document.createElement('canvas');
                    cv.width = cw;
                    cv.height = ch;
                    var ctx = cv.getContext('2d');
                    ctx.fillStyle = '#fff';
                    ctx.fillRect(0, 0, cw, ch);
                    ctx.drawImage(img, 0, 0, cw, ch);
                    var q = quality, out;
                    try {
                        out = cv.toDataURL('image/jpeg', q);
                    }
                    catch (e) {
                        resolve(dataUrl);
                        return;
                    }
                    while (out.length > 44000 && q > 0.4) {
                        q -= 0.1;
                        out = cv.toDataURL('image/jpeg', q);
                    }
                    resolve(out);
                };
                img.onerror = function () { resolve(dataUrl); };
                img.src = dataUrl;
            }
            catch (e) {
                resolve(dataUrl);
            }
        });
    }
    function currentPhoto() { return photoTouched ? (pendingPhoto || '') : ((current && current.photo) || ''); }
    function guideHtml() {
        var steps = [
            ['Open the Profile tab', 'Click My Profile in the top navigation (the person icon). This is where your photo and notes live.'],
            ['Upload a photo', 'Click Upload photo and pick an image. It is automatically resized and compressed, then a preview appears instantly.'],
            ['Add your details', 'Type your display name, role/title, and any notes you want to keep \u2014 reminders, links, anything.'],
            ['Save', 'Click Save profile. Your photo and details are written to the Profiles database on the server, so they follow you on any device you sign in from.'],
            ['Offline safety net', 'If the server is briefly unreachable, your profile is also cached on this device and re-synced the next time you save.']
        ];
        var h = '<ol class="pf-steps">';
        steps.forEach(function (s) { h += '<li><strong>' + esc(s[0]) + '</strong><span>' + esc(s[1]) + '</span></li>'; });
        return h + '</ol>';
    }
    function render() {
        var host = document.getElementById('profileView');
        if (!host)
            return;
        if (!current)
            current = loadLocal();
        var photo = currentPhoto();
        var syncBadge = loadedFromServer
            ? '<span class="pf-sync pf-sync-ok">Synced with server</span>'
            : '<span class="pf-sync pf-sync-wait">Loading from server\u2026</span>';
        host.innerHTML =
            '<div class="pf-grid">' +
                '<div class="panel pf-card"><div class="ph"><span class="ph-t">My Profile</span>' + syncBadge + '</div><div class="pf-body">' +
                '<div class="pf-photo-wrap"><div class="pf-photo" id="pfPhoto">' +
                (photo ? '<img src="' + photo + '" alt="Profile photo">' : '<span class="pf-photo-ph">No photo yet</span>') +
                '</div><div class="pf-photo-acts"><label class="mbtn mbtn-pr" for="pfFile">Upload photo</label><input type="file" id="pfFile" accept="image/*" hidden>' +
                (photo ? '<button class="mbtn mbtn-cl" id="pfClear">Remove</button>' : '') +
                '</div></div>' +
                '<div class="fg"><label for="pfName">Display name</label><input type="text" id="pfName" value="' + esc((current && current.name) || '') + '" placeholder="Your name"></div>' +
                '<div class="fg"><label for="pfRole">Role / title</label><input type="text" id="pfRole" value="' + esc((current && current.role) || '') + '" placeholder="e.g. Guidance Counselor"></div>' +
                '<div class="fg"><label for="pfNotes">Notes</label><textarea id="pfNotes" rows="6" placeholder="Notes, reminders, links...">' + esc((current && current.notes) || '') + '</textarea></div>' +
                '<div class="pf-actbar"><button class="mbtn mbtn-pr" id="pfSave">Save profile</button><span class="pf-saved" id="pfSaved"></span></div>' +
                '</div></div>' +
                '<div class="panel"><div class="ph"><span class="ph-t">How your profile is stored</span></div><div class="pf-guide">' + guideHtml() + '</div></div>' +
                '</div>';
        wire();
    }
    function fetchFromServer() {
        var a = api();
        if (!a || !a.getProfile) {
            loadedFromServer = false;
            return;
        }
        a.getProfile().then(function (res) {
            if (res && res.profile) {
                current = {
                    name: res.profile.name || '', role: res.profile.role || '',
                    notes: res.profile.notes || '', photo: res.profile.photo || '',
                    updatedAt: res.profile.updatedAt || ''
                };
                saveLocal(current);
                loadedFromServer = true;
                photoTouched = false;
                pendingPhoto = null;
                if (document.getElementById('profileView'))
                    render();
            }
        }).catch(function () { loadedFromServer = false; });
    }
    function wire() {
        var file = document.getElementById('pfFile');
        if (file)
            file.onchange = function () {
                var f = file.files && file.files[0];
                if (!f)
                    return;
                if (f.type.indexOf('image/') !== 0) {
                    ui().toast('Please choose an image file.', 'err');
                    return;
                }
                var rd = new FileReader();
                rd.onload = function () {
                    compress(String(rd.result), 360, 0.72).then(function (small) {
                        pendingPhoto = small;
                        photoTouched = true;
                        render();
                        ui().toast('Photo ready \u2014 click Save profile to keep it.', 'ok');
                    });
                };
                rd.readAsDataURL(f);
            };
        var clr = document.getElementById('pfClear');
        if (clr)
            clr.onclick = function () { pendingPhoto = ''; photoTouched = true; render(); };
        var sv = document.getElementById('pfSave');
        if (sv)
            sv.onclick = function () {
                var n = document.getElementById('pfName'), r = document.getElementById('pfRole'), o = document.getElementById('pfNotes');
                var data = {
                    name: n ? n.value : '', role: r ? r.value : '', notes: o ? o.value : '',
                    photo: currentPhoto()
                };
                var sp = document.getElementById('pfSaved');
                sv.disabled = true;
                if (sp) {
                    sp.textContent = 'Saving\u2026';
                    sp.className = 'pf-saved';
                }
                var a = api();
                function done(serverOk) {
                    current = { name: data.name, role: data.role, notes: data.notes, photo: data.photo, updatedAt: new Date().toISOString() };
                    saveLocal(current);
                    photoTouched = false;
                    pendingPhoto = null;
                    sv.disabled = false;
                    if (sp) {
                        sp.textContent = serverOk ? 'Saved to server' : 'Saved on this device';
                        setTimeout(function () { if (sp)
                            sp.textContent = ''; }, 2600);
                    }
                    ui().toast(serverOk ? 'Profile saved to the database.' : 'Saved locally. Reconnect to sync to the server.', serverOk ? 'ok' : 'warn');
                }
                if (a && a.saveProfile) {
                    a.saveProfile(data).then(function (res) {
                        if (res && res.profile)
                            current = res.profile;
                        loadedFromServer = true;
                        done(true);
                    }).catch(function (e) {
                        done(false);
                        if (e && e.message)
                            ui().toast(e.message, 'err');
                    });
                }
                else {
                    done(false);
                }
            };
    }
    return {
        render: function () { render(); fetchFromServer(); },
        setUser: function () { current = null; loadedFromServer = false; photoTouched = false; pendingPhoto = null; }
    };
})();
