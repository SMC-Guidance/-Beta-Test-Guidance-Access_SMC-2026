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
    var monA = '', monB = '', monMsgs = [];
    var POLL_MS = 5000, THREAD_MS = 500, DIR_MS = 60000;
    var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    var DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

    function esc(s) { return (SMC.ui && SMC.ui.esc) ? SMC.ui.esc(s) : String(s == null ? '' : s); }
    function el(id) { return document.getElementById(id); }
    function toast(m, k) { if (SMC.ui && SMC.ui.toast) SMC.ui.toast(m, k || 'ok'); }
    function avatarInner(photo, name) { if (photo) { return '<img src="' + esc(photo) + '" alt="">'; } return esc(String(name || '?').charAt(0).toUpperCase()); }
    function dirEntry(u) { return dir[String(u || '').toLowerCase()] || null; }
    function dirPhoto(u) { var d = dirEntry(u); return (d && d.photo) || ''; }
    function dispName(u) { var d = dirEntry(u); return (d && d.name) || u; }
    function staffRole(r) { return r === 'admin' || r === 'co-admin'; }
    function badgeHtml(role) { return staffRole(role) ? '<span class="chat-badge">Guidance Office</span>' : ''; }
    function byName(a, b) { return String(a.name || a.username).localeCompare(String(b.name || b.username)); }

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
            '<div class="chat-htxt"><strong id="chatTitle">Messages</strong><small id="chatSub">People</small></div>' +
            '<div class="chat-hact" id="chatHeadActions"></div>' +
            '<button class="chat-x" id="chatClose" type="button" aria-label="Close"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg></button>' +
            '</div>' +
            '<div class="chat-admin" id="chatAdmin" hidden></div>' +
            '<div class="chat-list" id="chatList"></div>' +
            '<div class="chat-thread" id="chatThread" hidden>' +
            '<div class="chat-msgs" id="chatMsgs"></div>' +
            '<form class="chat-compose" id="chatForm" autocomplete="off">' +
            '<input class="chat-input" id="chatInput" type="text" placeholder="Write a message" maxlength="2000" autocomplete="off"/>' +
            '<button class="chat-send" id="chatSend" type="submit" aria-label="Send"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/></svg></button>' +
            '</form></div></div>';
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
        el('chatThread').hidden = !(v === 'thread' || v === 'monitor');
        el('chatForm').style.display = (v === 'thread') ? '' : 'none';
        el('chatAdmin').hidden = true;
        el('chatBack').hidden = v === 'list';
        el('chatHeadActions').innerHTML = '';
    }

    function backToList() {
        openWith = null; openRole = ''; stopThread(); monMsgs = [];
        setView('list');
        if (isStaff) { el('chatTitle').textContent = 'Guidance Console'; el('chatSub').textContent = 'Manage messages'; renderConsole(); }
        else { el('chatTitle').textContent = 'Messages'; el('chatSub').textContent = 'People'; renderList(); }
    }

    function fmtTime(iso) { if (!iso) return ''; var d = new Date(iso); if (isNaN(d.getTime())) return ''; var h = d.getHours(), m = d.getMinutes(), ap = h >= 12 ? 'PM' : 'AM'; h = h % 12; if (h === 0) h = 12; return h + ':' + (m < 10 ? '0' : '') + m + ' ' + ap; }
    function fmtDay(iso) { var d = new Date(iso); if (isNaN(d.getTime())) return ''; var now = new Date(); var same = function (a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }; if (same(d, now)) return 'Today'; var y = new Date(now); y.setDate(now.getDate() - 1); if (same(d, y)) return 'Yesterday'; return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
    function fmtLastSeen(iso) { if (!iso) return 'Offline'; var d = new Date(iso); if (isNaN(d.getTime())) return 'Offline'; var diff = Date.now() - d.getTime(); if (diff < 86400000) return 'Last seen ' + fmtTime(iso); return 'Last seen ' + MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + DAYS[d.getDay()] + ', ' + fmtTime(iso); }
    function lastSeenText(c) { if (!c) return ''; if (c.online) return 'Active now'; return fmtLastSeen(c.lastSeen); }
    function findContact(u) { for (var i = 0; i < contacts.length; i++) { if (contacts[i].username === u) return contacts[i]; } return null; }
    function setBadge(n) { var b = el('chatFabBadge'); if (!b) return; if (n > 0) { b.hidden = false; b.textContent = n > 99 ? '99+' : String(n); } else { b.hidden = true; } }

    function applySidebarAvatar() {
        var meName = (user && (user.name || user.username)) || '';
        var html = avatarInner(mePhoto, meName);
        var a = el('sbAv'); if (a) a.innerHTML = html;
        var b = el('pmAv'); if (b) b.innerHTML = html;
    }

    function showAnnounce(a) {
        if (!a || !a.id) return;
        var seen = null; try { seen = localStorage.getItem('smc-ann-seen'); } catch (e) { }
        if (seen === a.id) return;
        var f = el('annFloat');
        if (!f) { f = document.createElement('div'); f.id = 'annFloat'; f.className = 'ann-float'; document.body.appendChild(f); }
        f.innerHTML = '<div class="ann-float-card"><span class="ann-float-ic">\uD83D\uDCE3</span><div class="ann-float-main"><strong>Announcement</strong><span class="ann-float-from">from ' + esc(dispName(a.from)) + '</span><p>' + esc(a.text) + '</p></div><button class="ann-float-x" id="annFloatX" aria-label="Dismiss">&times;</button></div>';
        f.classList.add('on');
        el('annFloatX').addEventListener('click', function () { try { localStorage.setItem('smc-ann-seen', a.id); } catch (e) { } f.classList.remove('on'); });
    }

    function loadDirectory() {
        if (!api || !user) return;
        api.chatDirectory().then(function (d) {
            dir = {}; var us = (d && d.users) || [];
            for (var i = 0; i < us.length; i++) { dir[String(us[i].username).toLowerCase()] = us[i]; }
            mePhoto = (d && d.mePhoto) || '';
            applySidebarAvatar();
            if (panelOpen && view === 'list') { isStaff ? renderConsole() : renderList(); }
        }).catch(function () { });
    }

    function poll() {
        if (!user || !api) return;
        api.chatPoll().then(function (d) {
            contacts = (d && d.contacts) || [];
            myMode = (d && d.myMode) || 'normal';
            var total = (d && d.totalUnread) || 0;
            setBadge(total);
            if (!firstPoll && total > prevUnread) toast('New message', 'ok');
            prevUnread = total; firstPoll = false;
            if (d && d.announcement) showAnnounce(d.announcement);
            if (panelOpen && view === 'list') { isStaff ? renderConsole() : renderList(); }
            if (panelOpen && view === 'thread' && openWith) { var c = findContact(openWith); if (c) el('chatSub').textContent = lastSeenText(c); }
        }).catch(function () { });
    }

    /* ---------- Non-staff contact list ---------- */
    function renderList() {
        var list = el('chatList'); if (!list) return;
        var meName = (user && (user.name || user.username)) || 'You';
        var selfSub = myMode === 'invisible' ? 'Invisible (hidden)' : 'Active now';
        var selfDot = myMode === 'invisible' ? '' : 'on';
        var selfRow = '<div class="chat-self"><span class="chat-av">' + avatarInner(mePhoto, meName) + '<span class="chat-dot ' + selfDot + '"></span></span><span class="chat-ci-main"><span class="chat-ci-top"><strong>' + esc(meName) + ' (you)</strong></span><span class="chat-ci-sub">' + esc(selfSub) + '</span></span></div>';
        if (!contacts.length) { list.innerHTML = selfRow + '<div class="chat-empty">No one else has an account yet. Chats and active status will show up here as soon as another person signs in.</div>'; return; }
        var sorted = contacts.slice().sort(function (a, b) { return String(b.lastTs || '').localeCompare(String(a.lastTs || '')); });
        var h = selfRow;
        for (var i = 0; i < sorted.length; i++) {
            var c = sorted[i];
            var pv = c.lastText ? esc(c.lastText.slice(0, 42)) : ('<em>' + (c.online ? 'Active now' : 'Tap to start chatting') + '</em>');
            h += '<button class="chat-ci" type="button" data-u="' + esc(c.username) + '" data-n="' + esc(c.name || c.username) + '" data-r="' + esc(c.role || '') + '">' +
                '<span class="chat-av">' + avatarInner(dirPhoto(c.username), c.name || c.username) + '<span class="chat-dot ' + (c.online ? 'on' : '') + '"></span></span>' +
                '<span class="chat-ci-main"><span class="chat-ci-top"><strong>' + esc(c.name || c.username) + '</strong><small>' + esc(fmtTime(c.lastTs)) + '</small></span>' +
                '<span class="chat-ci-sub">' + pv + '</span></span>' +
                (c.unread ? '<span class="chat-unread">' + (c.unread > 99 ? '99+' : c.unread) + '</span>' : '') +
                '</button>';
        }
        list.innerHTML = h;
        var btns = list.querySelectorAll('.chat-ci');
        for (var k = 0; k < btns.length; k++) { btns[k].addEventListener('click', function () { openThread(this.getAttribute('data-u'), this.getAttribute('data-n'), this.getAttribute('data-r')); }); }
    }

    /* ---------- Staff admin console ---------- */
    function renderConsole() {
        var list = el('chatList'); if (!list) return;
        var modes = [['normal', 'Normal'], ['always', 'Always active'], ['invisible', 'Invisible']];
        var opts = '';
        for (var i = 0; i < modes.length; i++) { opts += '<option value="' + modes[i][0] + '"' + (myMode === modes[i][0] ? ' selected' : '') + '>' + modes[i][1] + '</option>'; }
        var online = [], offline = [];
        for (var j = 0; j < contacts.length; j++) { (contacts[j].online ? online : offline).push(contacts[j]); }
        online.sort(byName);
        offline.sort(function (a, b) { return String(b.lastSeen || '').localeCompare(String(a.lastSeen || '')); });
        var h = '<div class="chat-admin-row">' +
            '<button type="button" class="chat-atool" id="cAnnounce">\uD83D\uDCE3 Announce</button>' +
            '<button type="button" class="chat-atool" id="cMsgOne">\u2709\uFE0F Message someone</button>' +
            '<label class="chat-presence">Status <select id="chatPresence">' + opts + '</select></label>' +
            '</div>';
        h += '<div class="chat-sec-label">Online \u2014 ' + online.length + '</div>';
        if (!online.length) h += '<div class="chat-empty sm">No one is online right now.</div>';
        else for (var a = 0; a < online.length; a++) h += rosterRow(online[a]);
        h += '<div class="chat-sec-label">Offline \u2014 ' + offline.length + '</div>';
        if (!offline.length) h += '<div class="chat-empty sm">Everyone is online.</div>';
        else for (var b = 0; b < offline.length; b++) h += rosterRow(offline[b]);
        list.innerHTML = h;
        el('cAnnounce').addEventListener('click', function () { doAnnounce(''); });
        el('cMsgOne').addEventListener('click', doMessageSomeone);
        el('chatPresence').addEventListener('change', function () { setPresence(this.value); });
        var mb = list.querySelectorAll('[data-mute]');
        for (var x = 0; x < mb.length; x++) { mb[x].addEventListener('click', function () { var u = this.getAttribute('data-mute'); var muted = this.getAttribute('data-muted') === '1'; doMute(u, !muted); }); }
    }
    function rosterRow(c) {
        return '<div class="chat-ci ro">' +
            '<span class="chat-av">' + avatarInner(dirPhoto(c.username), c.name || c.username) + '<span class="chat-dot ' + (c.online ? 'on' : '') + '"></span></span>' +
            '<span class="chat-ci-main"><span class="chat-ci-top"><strong>' + esc(c.name || c.username) + '</strong>' + (staffRole(c.role) ? '<span class="chat-badge sm">Staff</span>' : '') + '</span>' +
            '<span class="chat-ci-sub">' + esc(c.online ? 'Active now' : fmtLastSeen(c.lastSeen)) + (c.muted ? ' \u00b7 <span class="chat-muted">Muted</span>' : '') + '</span></span>' +
            (staffRole(c.role) ? '' : '<button type="button" class="chat-hbtn mini" data-mute="' + esc(c.username) + '" data-muted="' + (c.muted ? '1' : '') + '">' + (c.muted ? 'Unmute' : 'Mute') + '</button>') +
            '</div>';
    }

    /* ---------- Staff monitor (read-only) ---------- */
    function openMonitor() {
        setView('monitor');
        el('chatTitle').textContent = 'Monitor conversations';
        el('chatSub').textContent = 'Read-only';
        renderMonitor();
    }
    function renderMonitor() {
        var box = el('chatMsgs'); if (!box) return;
        var users = contacts.slice().sort(byName);
        var optHtml = function (sel) { var o = '<option value="">Choose\u2026</option>'; for (var i = 0; i < users.length; i++) { var u = users[i]; o += '<option value="' + esc(u.username) + '"' + (sel === u.username ? ' selected' : '') + '>' + esc(u.name || u.username) + '</option>'; } return o; };
        var head = '<div class="mon-pick"><select id="monA">' + optHtml(monA) + '</select><span>and</span><select id="monB">' + optHtml(monB) + '</select><button type="button" class="chat-atool" id="monGo">View</button></div>';
        var body;
        if (monMsgs.length) {
            body = '';
            for (var i = 0; i < monMsgs.length; i++) {
                var m = monMsgs[i];
                var mineSide = m.from === monA;
                if (m.kind === 'removed') { body += '<div class="chat-row ' + (mineSide ? 'me' : 'them') + ' last"><span class="chat-bub removed"><em>Message removed</em></span></div>'; continue; }
                var ann = m.kind === 'announcement';
                var del = (m.id && String(m.id).indexOf('tmp') !== 0) ? '<button type="button" class="chat-del" data-id="' + esc(m.id) + '" title="Delete message">\u00d7</button>' : '';
                body += '<div class="chat-row ' + (mineSide ? 'me' : 'them') + ' last"><span class="mon-who">' + esc(dispName(m.from)) + '</span><span class="chat-bub' + (ann ? ' ann' : '') + '">' + (ann ? '<span class="chat-anntag">ANNOUNCEMENT</span>' : '') + esc(m.text) + '<span class="chat-t">' + esc(fmtTime(m.ts)) + '</span></span>' + del + '</div>';
            }
        } else { body = '<div class="chat-empty">Pick two people, then tap View to see their conversation.</div>'; }
        box.innerHTML = head + '<div class="mon-thread">' + body + '</div>';
        el('monA').addEventListener('change', function () { monA = this.value; });
        el('monB').addEventListener('change', function () { monB = this.value; });
        el('monGo').addEventListener('click', loadMonitor);
        var dels = box.querySelectorAll('.chat-del');
        for (var k = 0; k < dels.length; k++) { dels[k].addEventListener('click', function (e) { e.stopPropagation(); doDeleteMessage(this.getAttribute('data-id')); }); }
    }
    function loadMonitor() {
        if (!monA || !monB) { toast('Pick two people first.', 'err'); return; }
        if (monA === monB) { toast('Pick two different people.', 'err'); return; }
        api.adminThread(monA, monB).then(function (d) { monMsgs = (d && d.messages) || []; renderMonitor(); }).catch(function (err) { toast((err && err.message) || 'Could not load.', 'err'); });
    }

    /* ---------- Non-staff thread ---------- */
    function openThread(u, name, role) {
        openWith = u; openName = name || u; openRole = role || ((findContact(u) || {}).role) || ''; threadMsgs = [];
        setView('thread');
        el('chatTitle').textContent = openName;
        el('chatSub').textContent = lastSeenText(findContact(u));
        el('chatMsgs').innerHTML = '<div class="chat-loading">Loading...</div>';
        loadThread(true); startThread();
        setTimeout(function () { var inp = el('chatInput'); if (inp) inp.focus(); }, 60);
    }
    function loadThread(scroll) {
        if (!openWith) return; var peer = openWith;
        api.getThread(peer).then(function (d) { var msgs = (d && d.messages) || []; if (openWith === peer) renderThread(msgs, scroll); poll(); }).catch(function () { });
    }
    function renderThread(msgs, scroll) {
        var box = el('chatMsgs'); if (!box) return;
        threadMsgs = msgs;
        var nearBottom = (box.scrollHeight - box.scrollTop - box.clientHeight) < 90;
        if (!msgs.length) { box.innerHTML = '<div class="chat-empty">No messages yet. Say hello!</div>'; return; }
        var partnerPhoto = dirPhoto(openWith), partnerName = openName || openWith;
        var h = '', lastDay = '';
        for (var i = 0; i < msgs.length; i++) {
            var m = msgs[i], day = fmtDay(m.ts);
            if (m.kind === 'removed') { h += '<div class="chat-row ' + (m.mine ? 'me' : 'them') + ' last"><span class="chat-bub removed"><em>' + (m.mine ? 'You unsent a message' : 'Message removed') + '</em></span></div>'; lastDay = day; continue; }
            if (day && day !== lastDay) { h += '<div class="chat-day"><span>' + esc(day) + '</span></div>'; lastDay = day; }
            var ann = m.kind === 'announcement';
            var next = msgs[i + 1];
            var lastOfGroup = !next || next.mine !== m.mine || fmtDay(next.ts) !== day;
            var av = m.mine ? '' : '<span class="chat-mav">' + (lastOfGroup ? avatarInner(partnerPhoto, partnerName) : '') + '</span>';
            var meta = lastOfGroup ? '<span class="chat-t">' + esc(fmtTime(m.ts)) + (m.pending ? ' \u00b7 sending\u2026' : '') + '</span>' : '';
            var unsend = (m.mine && m.id && String(m.id).indexOf('tmp') !== 0 && !m.pending) ? '<button type="button" class="chat-del" data-id="' + esc(m.id) + '" title="Unsend">\u00d7</button>' : '';
            h += '<div class="chat-row ' + (m.mine ? 'me' : 'them') + (lastOfGroup ? ' last' : '') + '">' + av + '<span class="chat-bub' + (m.pending ? ' pending' : '') + (ann ? ' ann' : '') + '">' + (ann ? '<span class="chat-anntag">ANNOUNCEMENT</span>' : '') + esc(m.text) + meta + '</span>' + unsend + '</div>';
        }
        box.innerHTML = h;
        var dels = box.querySelectorAll('.chat-del');
        for (var k = 0; k < dels.length; k++) { dels[k].addEventListener('click', function (e) { e.stopPropagation(); doUnsend(this.getAttribute('data-id')); }); }
        if (scroll || nearBottom) box.scrollTop = box.scrollHeight;
    }
    function onSend(e) {
        e.preventDefault();
        var inp = el('chatInput'); var text = (inp.value || '').trim();
        if (!text || !openWith) return;
        inp.value = '';
        var to = openWith;
        var optimistic = { id: 'tmp' + Date.now(), from: 'me', to: to, text: text, ts: new Date().toISOString(), mine: true, pending: true };
        renderThread(threadMsgs.concat([optimistic]), true);
        api.sendMessage(to, text).then(function () { loadThread(true); poll(); }).catch(function (err) { toast((err && err.message) || 'Could not send.', 'err'); inp.value = text; loadThread(true); });
    }
    function doUnsend(id) {
        if (!id) return;
        if (!window.confirm('Unsend this message?')) return;
        api.unsendMessage(id).then(function () { toast('Message unsent.', 'ok'); if (openWith) loadThread(false); }).catch(function (err) { toast((err && err.message) || 'Could not unsend.', 'err'); });
    }

    /* ---------- Staff actions ---------- */
    function doAnnounce(to) {
        var text = window.prompt(to ? 'Send a message to this person:' : 'Send an announcement to everyone:');
        if (text == null) return; text = String(text).trim(); if (!text) return;
        api.broadcast(text, to).then(function (d) { var n = (d && d.sent) || 0; toast('Sent to ' + n + ' ' + (n === 1 ? 'person' : 'people') + '.', 'ok'); }).catch(function (err) { toast((err && err.message) || 'Could not send.', 'err'); });
    }
    function doMessageSomeone() {
        var us = contacts.filter(function (c) { return !staffRole(c.role); });
        if (!us.length) { toast('No users to message.', 'err'); return; }
        us.sort(byName);
        var names = us.map(function (c, i) { return (i + 1) + '. ' + (c.name || c.username); }).join('\n');
        var pick = window.prompt('Message a specific person \u2014 type the number:\n' + names);
        if (pick == null) return; var idx = parseInt(pick, 10) - 1;
        if (isNaN(idx) || idx < 0 || idx >= us.length) { toast('Invalid choice.', 'err'); return; }
        doAnnounce(us[idx].username);
    }
    function doMute(u, muted) {
        api.setChatMute(u, muted).then(function () { var c = findContact(u); if (c) c.muted = muted; toast(muted ? 'User muted.' : 'User unmuted.', 'ok'); renderConsole(); }).catch(function (err) { toast((err && err.message) || 'Could not update.', 'err'); });
    }
    function doDeleteMessage(id) {
        if (!id) return;
        if (!window.confirm('Delete this message for everyone?')) return;
        api.deleteMessage(id).then(function () { toast('Message deleted.', 'ok'); if (view === 'monitor') loadMonitor(); }).catch(function (err) { toast((err && err.message) || 'Could not delete.', 'err'); });
    }
    function setPresence(mode) {
        api.setPresenceMode(mode).then(function (d) { myMode = (d && d.mode) || mode; toast('Your status is now: ' + myMode + '.', 'ok'); }).catch(function (err) { toast((err && err.message) || 'Could not update.', 'err'); poll(); });
    }

    function startThread() { stopThread(); threadTimer = setInterval(function () { if (openWith) loadThread(false); }, THREAD_MS); }
    function stopThread() { if (threadTimer) { clearInterval(threadTimer); threadTimer = null; } }
    function startPolling() { stopPolling(); firstPoll = true; poll(); loadDirectory(); pollTimer = setInterval(poll, POLL_MS); dirTimer = setInterval(loadDirectory, DIR_MS); }
    function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } if (dirTimer) { clearInterval(dirTimer); dirTimer = null; } }

    function setUser(u) {
        user = u;
        myRole = (u && u.role) || '';
        isStaff = staffRole(myRole);
        if (u) { build(); show(); startPolling(); }
        else { stopPolling(); stopThread(); hide(); contacts = []; dir = {}; mePhoto = ''; openWith = null; prevUnread = 0; firstPoll = true; myMode = 'normal'; monA = ''; monB = ''; monMsgs = []; }
    }

    return { setUser: setUser };
})();
