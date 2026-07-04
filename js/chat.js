"use strict";
window.SMC = window.SMC || {};
SMC.chat = (function () {
    var api = null, user = null;
    var myRole = '', isStaff = false, myMode = 'normal';
    var pollTimer = null, threadTimer = null, dirTimer = null;
    var contacts = [], dir = {}, mePhoto = '', threadMsgs = [];
    var openWith = null, openName = '', openRole = '';
    var built = false, panelOpen = false, view = 'list';
    var prevUnread = 0, firstPoll = true;
    var decCache = {}, decPending = {};
    var POLL_MS = 5000, THREAD_MS = 1500, DIR_MS = 60000;

    function esc(s) { return (SMC.ui && SMC.ui.esc) ? SMC.ui.esc(s) : String(s == null ? '' : s); }
    function el(id) { return document.getElementById(id); }
    function toast(m, k) { if (SMC.ui && SMC.ui.toast) SMC.ui.toast(m, k || 'ok'); }
    function avatarInner(photo, name) { if (photo) { return '<img src="' + esc(photo) + '" alt="">'; } return esc(String(name || '?').charAt(0).toUpperCase()); }
    function dirEntry(u) { return dir[String(u || '').toLowerCase()] || null; }
    function dirPhoto(u) { var d = dirEntry(u); return (d && d.photo) || ''; }
    function staffRole(r) { return r === 'admin' || r === 'co-admin'; }
    function badgeHtml(role) { return staffRole(role) ? '<span class="chat-badge">Guidance Office</span>' : ''; }

    function build() {
        if (built) return;
        api = SMC.api;
        var root = el('chatRoot');
        if (!root) { root = document.createElement('div'); root.id = 'chatRoot'; document.body.appendChild(root); }
        root.innerHTML =
            '<button class="chat-fab" id="chatFab" type="button" aria-label="Messages" title="Messages">' +
            '<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
            '<span class="chat-fab-badge" id="chatFabBadge" hidden>0</span></button>' +
            '<div class="chat-panel" id="chatPanel" aria-hidden="true">' +
            '<div class="chat-head">' +
            '<button class="chat-back" id="chatBack" type="button" aria-label="Back" hidden><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>' +
            '<div class="chat-htxt"><strong id="chatTitle">Messages</strong><small id="chatSub">Everyone</small></div>' +
            '<div class="chat-hact" id="chatHeadActions"></div>' +
            '<button class="chat-x" id="chatClose" type="button" aria-label="Close"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg></button>' +
            '</div>' +
            '<div class="chat-admin" id="chatAdmin" hidden></div>' +
            '<div class="chat-list" id="chatList"></div>' +
            '<div class="chat-thread" id="chatThread" hidden>' +
            '<div class="chat-msgs" id="chatMsgs"></div>' +
            '<form class="chat-compose" id="chatForm" autocomplete="off">' +
            '<input class="chat-input" id="chatInput" type="text" placeholder="Write a secure message" maxlength="2000" autocomplete="off"/>' +
            '<button class="chat-send" id="chatSend" type="submit" aria-label="Send"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/></svg></button>' +
            '</form><div class="chat-e2e">\uD83D\uDD12 End-to-end encrypted</div></div></div>';
        el('chatFab').addEventListener('click', togglePanel);
        el('chatClose').addEventListener('click', closePanel);
        el('chatBack').addEventListener('click', backToList);
        el('chatForm').addEventListener('submit', onSend);
        built = true;
    }

    function show() { var f = el('chatFab'); if (f) f.style.display = 'flex'; }
    function hide() { var f = el('chatFab'); if (f) f.style.display = 'none'; var p = el('chatPanel'); if (p) { p.classList.remove('on'); p.setAttribute('aria-hidden', 'true'); } panelOpen = false; }

    function togglePanel() { panelOpen ? closePanel() : openPanel(); }
    function openPanel() { var p = el('chatPanel'); p.classList.add('on'); p.setAttribute('aria-hidden', 'false'); panelOpen = true; backToList(); poll(); loadDirectory(); }
    function closePanel() { var p = el('chatPanel'); p.classList.remove('on'); p.setAttribute('aria-hidden', 'true'); panelOpen = false; stopThread(); }

    function setView(v) {
        view = v;
        el('chatList').hidden = v !== 'list';
        el('chatThread').hidden = v !== 'thread';
        el('chatAdmin').hidden = !(isStaff && v === 'list');
        el('chatBack').hidden = v === 'list';
        el('chatHeadActions').innerHTML = '';
    }

    function backToList() { openWith = null; openRole = ''; stopThread(); setView('list'); el('chatTitle').textContent = 'Messages'; el('chatSub').textContent = 'Everyone'; renderAdmin(); renderList(); }

    function fmtTime(iso) { if (!iso) return ''; var d = new Date(iso); if (isNaN(d.getTime())) return ''; var h = d.getHours(), m = d.getMinutes(), ap = h >= 12 ? 'PM' : 'AM'; h = h % 12; if (h === 0) h = 12; return h + ':' + (m < 10 ? '0' : '') + m + ' ' + ap; }
    function fmtDay(iso) { var d = new Date(iso); if (isNaN(d.getTime())) return ''; var now = new Date(); var same = function (a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }; if (same(d, now)) return 'Today'; var y = new Date(now); y.setDate(now.getDate() - 1); if (same(d, y)) return 'Yesterday'; return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
    function lastSeenText(c) { if (!c) return ''; if (c.online) return 'Active now'; if (!c.lastSeen) return 'Offline'; return 'Last seen ' + fmtTime(c.lastSeen); }
    function findContact(u) { for (var i = 0; i < contacts.length; i++) { if (contacts[i].username === u) return contacts[i]; } return null; }
    function setBadge(n, prio) { var b = el('chatFabBadge'); if (!b) return; if (n > 0) { b.hidden = false; b.textContent = n > 99 ? '99+' : String(n); if (prio) b.classList.add('prio'); else b.classList.remove('prio'); } else { b.hidden = true; b.classList.remove('prio'); } }

    function applySidebarAvatar() {
        var meName = (user && (user.name || user.username)) || '';
        var html = avatarInner(mePhoto, meName);
        var a = el('sbAv'); if (a) a.innerHTML = html;
        var b = el('pmAv'); if (b) b.innerHTML = html;
    }

    function ensurePeerKey(u) {
        var d = dirEntry(u);
        if (d && d.pubKey) return Promise.resolve(d.pubKey);
        if (!api) return Promise.resolve('');
        return api.getPublicKey(u).then(function (r) {
            var k = (r && r.publicKey) || '';
            if (k) { var e = dirEntry(u); if (e) e.pubKey = k; else dir[String(u).toLowerCase()] = { username: u, pubKey: k }; }
            return k;
        }).catch(function () { return ''; });
    }
    function encryptFor(u, text) {
        return ensurePeerKey(u).then(function (pk) {
            if (!pk) throw new Error('This person has not opened secure messaging yet. Ask them to open the app once, then try again.');
            return SMC.crypto.encrypt(pk, text);
        });
    }
    function decryptThread(msgs, peer) {
        return ensurePeerKey(peer).then(function (pk) {
            var jobs = [];
            for (var i = 0; i < msgs.length; i++) {
                (function (m) {
                    if (m.kind === 'removed') { m.plain = ''; return; }
                    if (m.kind === 'announcement') { m.plain = m.text; return; }
                    if (!SMC.crypto.isEnvelope(m.text)) { m.plain = m.text; return; }
                    if (!pk) { m.plain = '\uD83D\uDD12 Encrypted message'; return; }
                    jobs.push(SMC.crypto.decrypt(pk, m.text).then(function (pt) { m.plain = (pt == null) ? '\uD83D\uDD12 Unable to decrypt' : pt; }));
                })(msgs[i]);
            }
            return Promise.all(jobs).then(function () { return msgs; });
        });
    }

    function loadDirectory() {
        if (!api || !user) return;
        api.chatDirectory().then(function (d) {
            dir = {}; var us = (d && d.users) || [];
            for (var i = 0; i < us.length; i++) { dir[String(us[i].username).toLowerCase()] = us[i]; }
            mePhoto = (d && d.mePhoto) || '';
            applySidebarAvatar();
            if (panelOpen && view === 'list') renderList();
        }).catch(function () { });
    }

    function poll() {
        if (!user || !api) return;
        api.chatPoll().then(function (d) {
            contacts = (d && d.contacts) || [];
            myMode = (d && d.myMode) || 'normal';
            var total = (d && d.totalUnread) || 0;
            var staffUnread = false;
            for (var i = 0; i < contacts.length; i++) { if (contacts[i].unread && staffRole(contacts[i].role)) staffUnread = true; }
            setBadge(total, staffUnread);
            if (!firstPoll && total > prevUnread && staffUnread) toast('New message from the Guidance Office', 'ok');
            prevUnread = total; firstPoll = false;
            if (panelOpen && view === 'list') { renderAdmin(); renderList(); }
            if (panelOpen && view === 'thread' && openWith) { var c = findContact(openWith); if (c) el('chatSub').textContent = lastSeenText(c); renderThreadActions(); }
        }).catch(function () { });
    }

    function renderAdmin() {
        var box = el('chatAdmin'); if (!box) return;
        if (!isStaff) { box.hidden = true; box.innerHTML = ''; return; }
        box.hidden = (view !== 'list');
        var modes = [['normal', 'Normal'], ['always', 'Always active'], ['invisible', 'Invisible']];
        var opts = '';
        for (var i = 0; i < modes.length; i++) { opts += '<option value="' + modes[i][0] + '"' + (myMode === modes[i][0] ? ' selected' : '') + '>' + modes[i][1] + '</option>'; }
        box.innerHTML =
            '<div class="chat-admin-row">' +
            '<button type="button" class="chat-atool" id="chatAnnounce"><svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 11l18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg> Announce</button>' +
            '<label class="chat-presence">Status <select id="chatPresence">' + opts + '</select></label>' +
            '</div>';
        el('chatAnnounce').addEventListener('click', doAnnounce);
        el('chatPresence').addEventListener('change', function () { setPresence(this.value); });
    }

    function previewText(c) {
        var t = c.lastText || '';
        if (!t) return null;
        if (!SMC.crypto.isEnvelope(t)) return t.slice(0, 42);
        if (decCache[t] != null) return decCache[t].slice(0, 42);
        schedulePreview(c.username, t);
        return '\uD83D\uDD12 Encrypted message';
    }
    function schedulePreview(peer, cipher) {
        if (decPending[cipher]) return; decPending[cipher] = true;
        ensurePeerKey(peer).then(function (pk) {
            if (!pk) { decCache[cipher] = '\uD83D\uDD12 Encrypted message'; return; }
            return SMC.crypto.decrypt(pk, cipher).then(function (pt) { decCache[cipher] = (pt == null) ? '\uD83D\uDD12 Message' : pt; });
        }).then(function () { delete decPending[cipher]; if (panelOpen && view === 'list') renderList(); }).catch(function () { delete decPending[cipher]; });
    }

    function renderList() {
        var list = el('chatList'); if (!list) return;
        var meName = (user && (user.name || user.username)) || 'You';
        var selfDot = myMode === 'invisible' ? '' : 'on';
        var selfSub = myMode === 'invisible' ? 'Invisible (hidden)' : (myMode === 'always' ? 'Always active' : 'Active now');
        var selfRow = '<div class="chat-self"><span class="chat-av">' + avatarInner(mePhoto, meName) + '<span class="chat-dot ' + selfDot + '"></span></span><span class="chat-ci-main"><span class="chat-ci-top"><strong>' + esc(meName) + ' (you)</strong>' + badgeHtml(myRole) + '</span><span class="chat-ci-sub">' + esc(selfSub) + '</span></span></div>';
        if (!contacts.length) { list.innerHTML = selfRow + '<div class="chat-empty">No one else has an account yet. Chats and active status will show up here as soon as another person signs in.</div>'; return; }
        var sorted = contacts.slice().sort(function (a, b) { var sa = staffRole(a.role) ? 0 : 1, sb = staffRole(b.role) ? 0 : 1; if (sa !== sb) return sa - sb; return String(b.lastTs || '').localeCompare(String(a.lastTs || '')); });
        var h = selfRow, section = '';
        for (var i = 0; i < sorted.length; i++) {
            var c = sorted[i];
            var label = staffRole(c.role) ? 'Guidance Office' : 'People';
            if (label !== section) { h += '<div class="chat-sec-label">' + esc(label) + '</div>'; section = label; }
            var pv = previewText(c);
            var sub = pv ? esc(pv) : ('<em>' + (c.online ? 'Active now' : 'Tap to start chatting') + '</em>');
            h += '<button class="chat-ci" type="button" data-u="' + esc(c.username) + '" data-n="' + esc(c.name || c.username) + '" data-r="' + esc(c.role || '') + '">' +
                '<span class="chat-av">' + avatarInner(dirPhoto(c.username), c.name || c.username) + '<span class="chat-dot ' + (c.online ? 'on' : '') + '"></span></span>' +
                '<span class="chat-ci-main"><span class="chat-ci-top"><strong>' + esc(c.name || c.username) + '</strong>' + (staffRole(c.role) ? '<span class="chat-badge sm">Staff</span>' : '') + '<small>' + esc(fmtTime(c.lastTs)) + '</small></span>' +
                '<span class="chat-ci-sub">' + (c.muted ? '<span class="chat-muted">Muted</span> ' : '') + sub + '</span></span>' +
                (c.unread ? '<span class="chat-unread">' + (c.unread > 99 ? '99+' : c.unread) + '</span>' : '') +
                '</button>';
        }
        list.innerHTML = h;
        var btns = list.querySelectorAll('.chat-ci');
        for (var k = 0; k < btns.length; k++) { btns[k].addEventListener('click', function () { openThread(this.getAttribute('data-u'), this.getAttribute('data-n'), this.getAttribute('data-r')); }); }
    }

    function renderThreadActions() {
        var box = el('chatHeadActions'); if (!box) return;
        if (view !== 'thread' || !isStaff || !openWith || staffRole(openRole)) { box.innerHTML = ''; return; }
        var c = findContact(openWith) || {};
        var muted = !!c.muted;
        box.innerHTML = '<button type="button" class="chat-hbtn" id="chatMuteBtn" title="' + (muted ? 'Unmute user' : 'Mute user') + '">' + (muted ? 'Unmute' : 'Mute') + '</button>';
        el('chatMuteBtn').addEventListener('click', function () { doMute(openWith, !muted); });
    }

    function openThread(u, name, role) {
        openWith = u; openName = name || u; openRole = role || ((findContact(u) || {}).role) || ''; threadMsgs = [];
        setView('thread');
        el('chatTitle').textContent = openName;
        el('chatSub').textContent = lastSeenText(findContact(u));
        renderThreadActions();
        el('chatMsgs').innerHTML = '<div class="chat-loading">Loading...</div>';
        loadThread(true); startThread();
        setTimeout(function () { var inp = el('chatInput'); if (inp) inp.focus(); }, 60);
    }

    function loadThread(scroll) {
        if (!openWith) return;
        var peer = openWith;
        api.getThread(peer).then(function (d) {
            var msgs = (d && d.messages) || [];
            return decryptThread(msgs, peer).then(function () { if (openWith === peer) renderThread(msgs, scroll); poll(); });
        }).catch(function () { });
    }

    function renderThread(msgs, scroll) {
        var box = el('chatMsgs'); if (!box) return;
        threadMsgs = msgs;
        var nearBottom = (box.scrollHeight - box.scrollTop - box.clientHeight) < 90;
        if (!msgs.length) { box.innerHTML = ''; return; }
        var partnerPhoto = dirPhoto(openWith), partnerName = openName || openWith;
        var h = '', lastDay = '';
        for (var i = 0; i < msgs.length; i++) {
            var m = msgs[i], day = fmtDay(m.ts);
            if (m.kind === 'removed') { h += '<div class="chat-row ' + (m.mine ? 'me' : 'them') + ' last"><span class="chat-bub removed"><em>Message removed</em></span></div>'; lastDay = day; continue; }
            if (day && day !== lastDay) { h += '<div class="chat-day"><span>' + esc(day) + '</span></div>'; lastDay = day; }
            var ann = m.kind === 'announcement';
            var next = msgs[i + 1];
            var lastOfGroup = !next || next.mine !== m.mine || fmtDay(next.ts) !== day;
            var av = m.mine ? '' : '<span class="chat-mav">' + (lastOfGroup ? avatarInner(partnerPhoto, partnerName) : '') + '</span>';
            var meta = lastOfGroup ? '<span class="chat-t">' + esc(fmtTime(m.ts)) + (m.pending ? ' \u00b7 sending\u2026' : '') + '</span>' : '';
            var del = (isStaff && m.id && String(m.id).indexOf('tmp') !== 0) ? '<button type="button" class="chat-del" data-id="' + esc(m.id) + '" title="Delete message">\u00d7</button>' : '';
            var annTag = ann ? '<span class="chat-anntag">ANNOUNCEMENT</span>' : '';
            var incomingStaff = (!m.mine && staffRole(openRole)) ? ' staff' : '';
            var body = (m.plain != null) ? m.plain : m.text;
            h += '<div class="chat-row ' + (m.mine ? 'me' : 'them') + (lastOfGroup ? ' last' : '') + '">' + av + '<span class="chat-bub' + (m.pending ? ' pending' : '') + (ann ? ' ann' : '') + incomingStaff + '">' + annTag + esc(body) + meta + '</span>' + del + '</div>';
        }
        box.innerHTML = h;
        var dels = box.querySelectorAll('.chat-del');
        for (var k = 0; k < dels.length; k++) { dels[k].addEventListener('click', function (e) { e.stopPropagation(); doDeleteMessage(this.getAttribute('data-id')); }); }
        if (scroll || nearBottom) box.scrollTop = box.scrollHeight;
    }

    function onSend(e) {
        e.preventDefault();
        var inp = el('chatInput'); var text = (inp.value || '').trim();
        if (!text || !openWith) return;
        inp.value = '';
        var to = openWith;
        var optimistic = { id: 'tmp' + Date.now(), from: 'me', to: to, text: text, plain: text, ts: new Date().toISOString(), mine: true, pending: true };
        renderThread(threadMsgs.concat([optimistic]), true);
        encryptFor(to, text).then(function (cipher) {
            return api.sendMessage(to, cipher);
        }).then(function () { loadThread(true); poll(); }).catch(function (err) { toast((err && err.message) || 'Could not send.', 'err'); inp.value = text; loadThread(true); });
    }

    function doAnnounce() {
        var text = window.prompt('Send an announcement to everyone:');
        if (text == null) return;
        text = String(text).trim();
        if (!text) return;
        api.broadcast(text).then(function (d) { toast('Announcement sent to ' + ((d && d.sent) || 0) + ' people.', 'ok'); poll(); }).catch(function (err) { toast((err && err.message) || 'Could not send announcement.', 'err'); });
    }

    function doMute(u, muted) {
        api.setChatMute(u, muted).then(function () { var c = findContact(u); if (c) c.muted = muted; toast(muted ? 'User muted.' : 'User unmuted.', 'ok'); renderThreadActions(); poll(); }).catch(function (err) { toast((err && err.message) || 'Could not update.', 'err'); });
    }

    function doDeleteMessage(id, cb) {
        if (!id) return;
        if (!window.confirm('Delete this message for everyone?')) return;
        api.deleteMessage(id).then(function () { toast('Message deleted.', 'ok'); if (cb) cb(); else if (openWith) loadThread(false); poll(); }).catch(function (err) { toast((err && err.message) || 'Could not delete.', 'err'); });
    }

    function setPresence(mode) {
        api.setPresenceMode(mode).then(function (d) { myMode = (d && d.mode) || mode; toast('Your status is now: ' + myMode + '.', 'ok'); renderList(); }).catch(function (err) { toast((err && err.message) || 'Could not update.', 'err'); poll(); });
    }

    function startThread() { stopThread(); threadTimer = setInterval(function () { if (openWith) loadThread(false); }, THREAD_MS); }
    function stopThread() { if (threadTimer) { clearInterval(threadTimer); threadTimer = null; } }
    function startPolling() { stopPolling(); firstPoll = true; poll(); loadDirectory(); pollTimer = setInterval(poll, POLL_MS); dirTimer = setInterval(loadDirectory, DIR_MS); }
    function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } if (dirTimer) { clearInterval(dirTimer); dirTimer = null; } }

    function setUser(u) {
        user = u;
        myRole = (u && u.role) || '';
        isStaff = staffRole(myRole);
        if (u) {
            build(); show(); startPolling();
            if (SMC.crypto && SMC.crypto.supported()) {
                SMC.crypto.ensureKeys().then(function (pub) { if (pub && api) return api.setPublicKey(pub); }).catch(function () { });
            }
        }
        else { stopPolling(); stopThread(); hide(); contacts = []; dir = {}; mePhoto = ''; openWith = null; prevUnread = 0; firstPoll = true; myMode = 'normal'; decCache = {}; decPending = {}; }
    }

    return { setUser: setUser };
})();
