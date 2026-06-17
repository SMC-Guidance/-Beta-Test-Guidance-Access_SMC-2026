"use strict";
window.SMC = window.SMC || {};
SMC.settings = (function () {
    var THEME_KEY = 'smc-theme', REPORTS_KEY = 'smc-reports';
    var user = null;
    function ui() { return SMC.ui || {}; }
    function api() { return SMC.api || {}; }
    function toast(m, t) { if (ui().toast) ui().toast(m, t); }
    function esc(s) { s = (s == null) ? '' : String(s); return ui().esc ? ui().esc(s) : s; }
    function fmtDate(s) { return ui().fmtDate ? ui().fmtDate(s) : esc(s); }
    function isAdmin() { return !!(user && user.role === 'admin'); }
    function isDark() { return document.documentElement.getAttribute('data-theme') === 'dark'; }
    function applyTheme(dark) {
        if (dark) document.documentElement.setAttribute('data-theme', 'dark');
        else document.documentElement.removeAttribute('data-theme');
        try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch (e) {}
        syncThemeUI();
    }
    function syncThemeUI() {
        var t = document.getElementById('setThemeToggle');
        if (!t) return;
        var d = isDark();
        t.classList.toggle('on', d);
        t.setAttribute('aria-checked', d ? 'true' : 'false');
    }
    function localReports() { try { return JSON.parse(localStorage.getItem(REPORTS_KEY) || '[]') || []; } catch (e) { return []; } }
    function saveLocalReport(rep) {
        var arr = localReports();
        arr.unshift(rep);
        try { localStorage.setItem(REPORTS_KEY, JSON.stringify(arr.slice(0, 200))); } catch (e) {}
    }
    function sendReport() {
        var ta = document.getElementById('setReportMsg');
        var btn = document.getElementById('setReportSend');
        if (!ta) return;
        var msg = (ta.value || '').trim();
        if (!msg) { toast('Please describe the problem first.', 'warn'); return; }
        var rep = { id: 'r' + Date.now(), message: msg, name: (user && user.name) || 'You', role: (user && user.role) || '', username: (user && user.username) || '', status: 'Open', createdAt: new Date().toISOString() };
        if (btn) { btn.disabled = true; btn.textContent = 'Sending\u2026'; }
        function done(local) {
            if (btn) { btn.disabled = false; btn.textContent = 'Send report'; }
            ta.value = '';
            toast(local ? 'Report saved on this device. Redeploy the backend so admins can see it online.' : 'Report sent. Thank you!', local ? 'warn' : 'ok');
            renderReports();
        }
        if (api().saveReport) {
            api().saveReport(msg).then(function () { done(false); }).catch(function () { saveLocalReport(rep); done(true); });
        } else { saveLocalReport(rep); done(true); }
    }
    function renderReports() {
        var sec = document.getElementById('setReportsAdmin');
        if (!sec) return;
        if (!isAdmin()) { sec.style.display = 'none'; return; }
        sec.style.display = '';
        var list = document.getElementById('setReportsList');
        var cnt = document.getElementById('setReportsCount');
        if (!list) return;
        list.innerHTML = '<div class="set-empty">Loading\u2026</div>';
        function paint(rows, local) {
            rows = rows || [];
            if (cnt) cnt.textContent = rows.length ? '(' + rows.length + ')' : '';
            if (!rows.length) { list.innerHTML = '<div class="set-empty">No reports yet.</div>'; return; }
            list.innerHTML = rows.map(function (r) {
                return '<div class="set-report-item">' +
                    '<div class="set-report-top"><strong>' + esc(r.name || r.username || 'Unknown') + '</strong>' +
                    (r.role ? '<span class="set-report-role">' + esc(r.role) + '</span>' : '') +
                    '<span class="set-report-date">' + fmtDate(r.createdAt) + '</span></div>' +
                    '<div class="set-report-msg">' + esc(r.message) + '</div>' +
                    (local ? '<div class="set-report-local">On this device only</div>' : '') +
                    '</div>';
            }).join('');
        }
        if (api().listReports) {
            api().listReports().then(function (rows) { paint(rows, false); }).catch(function () { paint(localReports(), true); });
        } else { paint(localReports(), true); }
    }
    function open(u) {
        if (u) user = u;
        syncThemeUI();
        renderReports();
        var m = document.getElementById('settingsModal');
        if (m) { m.classList.add('on'); m.setAttribute('aria-hidden', 'false'); }
    }
    function close() {
        var m = document.getElementById('settingsModal');
        if (m) { m.classList.remove('on'); m.setAttribute('aria-hidden', 'true'); }
    }
    function setUser(u) { user = u; }
    function bind() {
        var t = document.getElementById('setThemeToggle');
        if (t) t.addEventListener('click', function () { applyTheme(!isDark()); });
        var sc = document.getElementById('setClose');
        if (sc) sc.addEventListener('click', close);
        var sr = document.getElementById('setReportSend');
        if (sr) sr.addEventListener('click', sendReport);
        var m = document.getElementById('settingsModal');
        if (m) m.addEventListener('click', function (e) { if (e.target === m) close(); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { var mm = document.getElementById('settingsModal'); if (mm && mm.classList.contains('on')) close(); } });
        syncThemeUI();
    }
    return { open: open, close: close, bind: bind, setUser: setUser };
})();
