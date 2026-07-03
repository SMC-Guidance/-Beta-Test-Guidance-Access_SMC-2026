"use strict";
window.SMC = window.SMC || {};
SMC.chat = (function () {
    var api = null, user = null;
    var pollTimer = null, threadTimer = null, dirTimer = null;
    var contacts = [], dir = {}, mePhoto = '', threadMsgs = [];
    var openWith = null, openName = '';
    var built = false, panelOpen = false;
    var POLL_MS = 5000, THREAD_MS = 1500, DIR_MS = 60000;

    function esc(s) { return (SMC.ui && SMC.ui.esc) ? SMC.ui.esc(s) : String(s == null ? '' : s); }
    function el(id) { return document.getElementById(id); }
    function avatarInner(photo, name) { if (photo) { return '<img src="' + esc(photo) + '" alt="">'; } return esc(String(name || '?').charAt(0).toUpperCase()); }
    function dirPhoto(username) { var d = dir[String(username || '').toLowerCase()]; return (d && d.photo) || ''; }

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
            '<button class="chat-x" id="chatClose" type="button" aria-label="Close"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg></button>' +
            '</div>' +
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

    function backToList() { openWith = null; stopThread(); el('chatThread').hidden = true; el('chatList').hidden = false; el('chatBack').hidden = true; el('chatTitle').textContent = 'Messages'; el('chatSub').textContent = 'Everyone'; renderList(); }

    function fmtTime(iso) { if (!iso) return ''; var d = new Date(iso); if (isNaN(d.getTime())) return ''; var h = d.getHours(), m = d.getMinutes(), ap = h >= 12 ? 'PM' : 'AM'; h = h % 12; if (h === 0) h = 12; return h + ':' + (m < 10 ? '0' : '') + m + ' ' + ap; }
    function fmtDay(iso) { var d = new Date(iso); if (isNaN(d.getTime())) return ''; var now = new Date(); var same = function (a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }; if (same(d, now)) return 'Today'; var y = new Date(now); y.setDate(now.getDate() - 1); if (same(d, y)) return 'Yesterday'; return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
    function lastSeenText(c) { if (!c) return ''; if (c.online) return 'Active now'; if (!c.lastSeen) return 'Offline'; return 'Last seen ' + fmtTime(c.lastSeen); }
    function findContact(u) { for (var i = 0; i < contacts.length; i++) { if (contacts[i].username === u) return contacts[i]; } return null; }
    function setBadge(n) { var b = el('chatFabBadge'); if (!b) return; if (n > 0) { b.hidden = false; b.textContent = n > 99 ? '99+' : String(n); } else { b.hidden = true; } }

    function applySidebarAvatar() {
        var meName = (user && (user.name || user.username)) || '';
        var html = avatarInner(mePhoto, meName);
        var a = el('sbAv'); if (a) a.innerHTML = html;
        var b = el('pmAv'); if (b) b.innerHTML = html;
    }

    function loadDirectory() {
        if (!api || !user) return;
        api.chatDirectory().then(function (d) {
            dir = {}; var us = (d && d.users) || [];
            for (var i = 0; i < us.length; i++) { dir[String(us[i].username).toLowerCase()] = us[i]; }
            mePhoto = (d && d.mePhoto) || '';
            applySidebarAvatar();
            if (panelOpen && !openWith) renderList();
        }).catch(function () { });
    }

    function poll() {
        if (!user || !api) return;
        api.chatPoll().then(function (d) {
            contacts = (d && d.contacts) || [];
            setBadge((d && d.totalUnread) || 0);
            if (panelOpen && !openWith) renderList();
            if (panelOpen && openWith) { var c = findContact(openWith); if (c) el('chatSub').textContent = lastSeenText(c); }
        }).catch(function () { });
    }

    function renderList() {
        var list = el('chatList'); if (!list) return;
        var meName = (user && (user.name || user.username)) || 'You';
        var selfRow = '<div class="chat-self"><span class="chat-av">' + avatarInner(mePhoto, meName) + '<span class="chat-dot on"></span></span><span class="chat-ci-main"><span class="chat-ci-top"><strong>' + esc(meName) + ' (you)</strong></span><span class="chat-ci-sub">Active now</span></span></div>';
        if (!contacts.length) { list.innerHTML = selfRow + '<div class="chat-empty">No one else has an account yet. Chats and active status will show up here as soon as another person signs in.</div>'; return; }
        var h = selfRow + '<div class="chat-sec-label">People</div>';
        for (var i = 0; i < contacts.length; i++) {
            var c = contacts[i];
            var sub = c.lastText ? esc(c.lastText.slice(0, 42)) : ('<em>' + (c.online ? 'Active now' : 'Tap to start chatting') + '</em>');
            h += '<button class="chat-ci" type="button" data-u="' + esc(c.username) + '" data-n="' + esc(c.name || c.username) + '">' +
                '<span class="chat-av">' + avatarInner(dirPhoto(c.username), c.name || c.username) + '<span class="chat-dot ' + (c.online ? 'on' : '') + '"></span></span>' +
                '<span class="chat-ci-main"><span class="chat-ci-top"><strong>' + esc(c.name || c.username) + '</strong><small>' + esc(fmtTime(c.lastTs)) + '</small></span>' +
                '<span class="chat-ci-sub">' + sub + '</span></span>' +
                (c.unread ? '<span class="chat-unread">' + (c.unread > 99 ? '99+' : c.unread) + '</span>' : '') +
                '</button>';
        }
        list.innerHTML = h;
        var btns = list.querySelectorAll('.chat-ci');
        for (var k = 0; k < btns.length; k++) { btns[k].addEventListener('click', function () { openThread(this.getAttribute('data-u'), this.getAttribute('data-n')); }); }
    }

    function openThread(u, name) {
        openWith = u; openName = name || u; threadMsgs = [];
        el('chatList').hidden = true; el('chatThread').hidden = false; el('chatBack').hidden = false;
        el('chatTitle').textContent = openName;
        el('chatSub').textContent = lastSeenText(findContact(u));
        el('chatMsgs').innerHTML = '<div class="chat-loading">Loading...</div>';
        loadThread(true); startThread();
        setTimeout(function () { var inp = el('chatInput'); if (inp) inp.focus(); }, 60);
    }

    function loadThread(scroll) {
        if (!openWith) return;
        api.getThread(openWith).then(function (d) { renderThread((d && d.messages) || [], scroll); poll(); }).catch(function () { });
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
            if (day && day !== lastDay) { h += '<div class="chat-day"><span>' + esc(day) + '</span></div>'; lastDay = day; }
            var next = msgs[i + 1];
            var lastOfGroup = !next || next.mine !== m.mine || fmtDay(next.ts) !== day;
            var av = m.mine ? '' : '<span class="chat-mav">' + (lastOfGroup ? avatarInner(partnerPhoto, partnerName) : '') + '</span>';
            var meta = lastOfGroup ? '<span class="chat-t">' + esc(fmtTime(m.ts)) + (m.pending ? ' \u00b7 sending\u2026' : '') + '</span>' : '';
            h += '<div class="chat-row ' + (m.mine ? 'me' : 'them') + (lastOfGroup ? ' last' : '') + '">' + av + '<span class="chat-bub' + (m.pending ? ' pending' : '') + '">' + esc(m.text) + meta + '</span></div>';
        }
        box.innerHTML = h;
        if (scroll || nearBottom) box.scrollTop = box.scrollHeight;
    }

    function onSend(e) {
        e.preventDefault();
        var inp = el('chatInput'); var text = (inp.value || '').trim();
        if (!text || !openWith) return;
        inp.value = '';
        var optimistic = { id: 'tmp' + Date.now(), from: 'me', to: openWith, text: text, ts: new Date().toISOString(), mine: true, pending: true };
        renderThread(threadMsgs.concat([optimistic]), true);
        api.sendMessage(openWith, text).then(function () { loadThread(true); poll(); }).catch(function (err) { if (SMC.ui && SMC.ui.toast) SMC.ui.toast((err && err.message) || 'Could not send.'); inp.value = text; loadThread(true); });
    }

    function startThread() { stopThread(); threadTimer = setInterval(function () { if (openWith) loadThread(false); }, THREAD_MS); }
    function stopThread() { if (threadTimer) { clearInterval(threadTimer); threadTimer = null; } }
    function startPolling() { stopPolling(); poll(); loadDirectory(); pollTimer = setInterval(poll, POLL_MS); dirTimer = setInterval(loadDirectory, DIR_MS); }
    function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } if (dirTimer) { clearInterval(dirTimer); dirTimer = null; } }

    function setUser(u) {
        user = u;
        if (u) { build(); show(); startPolling(); }
        else { stopPolling(); stopThread(); hide(); contacts = []; dir = {}; mePhoto = ''; openWith = null; }
    }

    return { setUser: setUser };
})();
