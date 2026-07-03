"use strict";
window.SMC = window.SMC || {};
SMC.chat = (function () {
    var api = null, user = null;
    var pollTimer = null, threadTimer = null;
    var contacts = [], openWith = null, openName = '';
    var built = false, panelOpen = false;
    var POLL_MS = 20000, THREAD_MS = 8000;

    function esc(s) { return (SMC.ui && SMC.ui.esc) ? SMC.ui.esc(s) : String(s == null ? '' : s); }
    function el(id) { return document.getElementById(id); }
    function isStaff(u) { return !!(u && (u.role === 'admin' || u.role === 'co-admin')); }

    function build() {
        if (built) return;
        api = SMC.api;
        var root = el('chatRoot');
        if (!root) { root = document.createElement('div'); root.id = 'chatRoot'; document.body.appendChild(root); }
        root.innerHTML =
            '<button class="chat-fab" id="chatFab" type="button" aria-label="Staff messages" title="Staff messages">' +
            '<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
            '<span class="chat-fab-badge" id="chatFabBadge" hidden>0</span></button>' +
            '<div class="chat-panel" id="chatPanel" aria-hidden="true">' +
            '<div class="chat-head">' +
            '<button class="chat-back" id="chatBack" type="button" aria-label="Back" hidden><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>' +
            '<div class="chat-htxt"><strong id="chatTitle">Messages</strong><small id="chatSub">Staff only</small></div>' +
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
    function openPanel() { var p = el('chatPanel'); p.classList.add('on'); p.setAttribute('aria-hidden', 'false'); panelOpen = true; backToList(); poll(); }
    function closePanel() { var p = el('chatPanel'); p.classList.remove('on'); p.setAttribute('aria-hidden', 'true'); panelOpen = false; stopThread(); }

    function backToList() { openWith = null; stopThread(); el('chatThread').hidden = true; el('chatList').hidden = false; el('chatBack').hidden = true; el('chatTitle').textContent = 'Messages'; el('chatSub').textContent = 'Staff only'; renderList(); }

    function fmtTime(iso) { if (!iso) return ''; var d = new Date(iso); if (isNaN(d.getTime())) return ''; var h = d.getHours(), m = d.getMinutes(), ap = h >= 12 ? 'PM' : 'AM'; h = h % 12; if (h === 0) h = 12; return h + ':' + (m < 10 ? '0' : '') + m + ' ' + ap; }
    function lastSeenText(c) { if (!c) return ''; if (c.online) return 'Active now'; if (!c.lastSeen) return 'Offline'; return 'Last seen ' + fmtTime(c.lastSeen); }
    function findContact(u) { for (var i = 0; i < contacts.length; i++) { if (contacts[i].username === u) return contacts[i]; } return null; }
    function setBadge(n) { var b = el('chatFabBadge'); if (!b) return; if (n > 0) { b.hidden = false; b.textContent = n > 99 ? '99+' : String(n); } else { b.hidden = true; } }

    function poll() {
        if (!isStaff(user) || !api) return;
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
        var meInitial = String(meName || '?').charAt(0).toUpperCase();
        var selfRow = '<div class="chat-self"><span class="chat-av">' + esc(meInitial) + '<span class="chat-dot on"></span></span><span class="chat-ci-main"><span class="chat-ci-top"><strong>' + esc(meName) + ' (you)</strong></span><span class="chat-ci-sub">Active now</span></span></div>';
        if (!contacts.length) { list.innerHTML = selfRow + '<div class="chat-empty">No other staff members are online yet. Active status and chats appear here when another admin or co-admin opens the app.</div>'; return; }
        var h = selfRow + '<div class="chat-sec-label">Staff</div>';
        for (var i = 0; i < contacts.length; i++) {
            var c = contacts[i];
            var initial = (c.name || c.username || '?').charAt(0).toUpperCase();
            var sub = c.lastText ? esc(c.lastText.slice(0, 42)) : ('<em>' + (c.online ? 'Active now' : 'No messages yet') + '</em>');
            h += '<button class="chat-ci" type="button" data-u="' + esc(c.username) + '" data-n="' + esc(c.name || c.username) + '">' +
                '<span class="chat-av">' + esc(initial) + '<span class="chat-dot ' + (c.online ? 'on' : '') + '"></span></span>' +
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
        openWith = u; openName = name || u;
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
        var nearBottom = (box.scrollHeight - box.scrollTop - box.clientHeight) < 60;
        if (!msgs.length) { box.innerHTML = '<div class="chat-empty">No messages yet. Say hello!</div>'; return; }
        var h = '';
        for (var i = 0; i < msgs.length; i++) {
            var m = msgs[i];
            h += '<div class="chat-msg ' + (m.mine ? 'me' : 'them') + '"><span class="chat-bub">' + esc(m.text) + '</span><span class="chat-t">' + esc(fmtTime(m.ts)) + '</span></div>';
        }
        box.innerHTML = h;
        if (scroll || nearBottom) box.scrollTop = box.scrollHeight;
    }

    function onSend(e) {
        e.preventDefault();
        var inp = el('chatInput'); var text = (inp.value || '').trim();
        if (!text || !openWith) return;
        inp.value = '';
        api.sendMessage(openWith, text).then(function () { loadThread(true); poll(); }).catch(function (err) { if (SMC.ui && SMC.ui.toast) SMC.ui.toast((err && err.message) || 'Could not send.'); inp.value = text; });
    }

    function startThread() { stopThread(); threadTimer = setInterval(function () { if (openWith) loadThread(false); }, THREAD_MS); }
    function stopThread() { if (threadTimer) { clearInterval(threadTimer); threadTimer = null; } }
    function startPolling() { stopPolling(); poll(); pollTimer = setInterval(poll, POLL_MS); }
    function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }

    function setUser(u) {
        user = u;
        if (isStaff(u)) { build(); show(); startPolling(); }
        else { stopPolling(); stopThread(); hide(); contacts = []; openWith = null; }
    }

    return { setUser: setUser };
})();
