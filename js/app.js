"use strict";
window.SMC = window.SMC || {};
SMC.app = (function () {
    var ui = SMC.ui, api = SMC.api;
    var user = null, warnTimer = null, hardTimer = null;
    var maintenance = {}, currentView = 'dashboard';
    function showScreen(id) {
        document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); });
        document.getElementById(id).classList.add('active');
    }
    var VIEW_META = {
        dashboard: { el: 'dashView', nav: 'navDash', title: 'Dashboard', sub: 'Stella Maris College \u00b7 Guidance Office' },
        counselors: { el: 'counselorsView', nav: 'navCounselors', title: 'Staff & Counselors', sub: 'Manage accounts and access levels' },
        evaluations: { el: 'evalView', nav: 'navEval', title: 'Teacher Evaluations', sub: 'Track evaluation tasks and cross-checking' },
        procedures: { el: 'proceduresView', nav: 'navProcedures', title: 'Assessment Procedures', sub: 'Reference for student & teacher applicants' },
        evalResults: { el: 'evalProcView', nav: 'navEvalProc', title: 'Evaluation Results', sub: 'Compute & summarize teacher evaluations' },
        profile: { el: 'profileView', nav: 'navProfile', title: 'My Profile', sub: 'Your photo, notes & profile guide' },
        evalDash: { el: 'evalDashView', nav: 'navEvalDash', title: 'Eval Dashboard', sub: 'Results overview — teachers, averages, sections' }
    };
    function isAdminUser() { return !!(user && user.role === 'admin'); }
    function maintHost() { return document.querySelector('.main') || document.body; }
    function showMaintNotice(title) {
        var n = document.getElementById('maintNotice');
        if (!n) {
            n = document.createElement('div');
            n.id = 'maintNotice';
            n.className = 'maint-notice';
            maintHost().appendChild(n);
        }
        n.innerHTML = '<div class="maint-card"><div class="maint-ic"><svg width="46" height="46" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.1-2.1 2.6-2.6z"/></svg></div><h3>' + ui.esc(title) + ' is under maintenance</h3><p>This section is temporarily unavailable. Please check back later.</p></div>';
        n.style.display = '';
    }
    function hideMaintNotice() { var n = document.getElementById('maintNotice'); if (n)
        n.style.display = 'none'; }
    function showAdminBanner() {
        var b = document.getElementById('maintAdminBanner');
        if (!b) {
            b = document.createElement('div');
            b.id = 'maintAdminBanner';
            b.className = 'maint-admin-banner';
            var host = maintHost();
            host.insertBefore(b, host.children[1] || null);
        }
        b.innerHTML = '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span>This tab is <strong>under maintenance</strong> \u2014 only you can see it. Others get an "under maintenance" notice. Use the header button to bring it back online.</span>';
        b.style.display = '';
    }
    function hideAdminBanner() { var b = document.getElementById('maintAdminBanner'); if (b)
        b.style.display = 'none'; }
    function updateSearchVisibility() {
        var onDash = !!user && currentView === 'dashboard';
        var top = document.getElementById('topSearch');
        if (top)
            top.style.display = onDash ? '' : 'none';
        var mob = document.getElementById('mobSearchWrap');
        if (mob)
            mob.style.display = (onDash && window.innerWidth <= 768) ? 'flex' : 'none';
    }
    function showView(v) {
        if (!VIEW_META[v])
            v = 'dashboard';
        currentView = v;
        updateSearchVisibility();
        document.querySelectorAll('.sbi').forEach(function (b) { b.classList.remove('on'); });
        var nav = document.getElementById(VIEW_META[v].nav);
        if (nav)
            nav.classList.add('on');
        document.getElementById('viewTitle').textContent = VIEW_META[v].title;
        document.getElementById('viewSub').textContent = VIEW_META[v].sub;
        updateMaintBtn();
        var locked = !!maintenance[v];
        if (locked && !isAdminUser()) {
            Object.keys(VIEW_META).forEach(function (k) { var el = document.getElementById(VIEW_META[k].el); if (el)
                el.style.display = 'none'; });
            hideAdminBanner();
            showMaintNotice(VIEW_META[v].title);
            return;
        }
        hideMaintNotice();
        Object.keys(VIEW_META).forEach(function (k) { var el = document.getElementById(VIEW_META[k].el); if (el)
            el.style.display = k === v ? '' : 'none'; });
        if (locked && isAdminUser())
            showAdminBanner();
        else
            hideAdminBanner();
        if (v === 'counselors')
            renderCounselors();
        if (v === 'evaluations')
            SMC.evaluations.load();
        if (v === 'procedures')
            SMC.procedures.render();
        if (v === 'evalResults')
            SMC.evalproc.render();
        if (v === 'profile' && SMC.profile && SMC.profile.render)
            SMC.profile.render();
        if (v === 'evalDash' && SMC.evalDash)
            SMC.evalDash.render();
    }
    function updateMaintBtn() {
        var btn = document.getElementById('maintBtn');
        if (!btn)
            return;
        if (!isAdminUser()) {
            btn.style.display = 'none';
            return;
        }
        btn.style.display = '';
        var locked = !!maintenance[currentView];
        btn.classList.toggle('on', locked);
        btn.innerHTML = locked
            ? '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg><span>Under maintenance</span>'
            : '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg><span>Set maintenance</span>';
    }
    function applyNavLocks() {
        Object.keys(VIEW_META).forEach(function (k) {
            var nav = document.getElementById(VIEW_META[k].nav);
            if (nav)
                nav.classList.toggle('nav-maint', !!maintenance[k] && isAdminUser());
        });
    }
    function persistMaintLocal() { try {
        localStorage.setItem('smc-maintenance', JSON.stringify(maintenance));
    }
    catch (e) { } }
    function loadMaintenance() {
        try {
            var raw = localStorage.getItem('smc-maintenance');
            if (raw)
                maintenance = JSON.parse(raw) || {};
        }
        catch (e) {
            maintenance = {};
        }
        applyNavLocks();
        updateMaintBtn();
        if (api.getMaintenance)
            api.getMaintenance().then(function (r) { if (r && r.maintenance) {
                maintenance = r.maintenance;
                persistMaintLocal();
                applyNavLocks();
                showView(currentView);
            } }).catch(function () { });
    }
    function toggleMaintenance() {
        if (!isAdminUser())
            return;
        var v = currentView, turnOn = !maintenance[v];
        if (turnOn)
            maintenance[v] = true;
        else
            delete maintenance[v];
        persistMaintLocal();
        applyNavLocks();
        showView(v);
        ui.toast(turnOn ? (VIEW_META[v].title + ' is now under maintenance.') : (VIEW_META[v].title + ' is back online.'), 'ok');
        if (api.setMaintenance)
            api.setMaintenance(v, turnOn).then(function (r) { if (r && r.maintenance) {
                maintenance = r.maintenance;
                persistMaintLocal();
                applyNavLocks();
            } }).catch(function () { ui.toast('Saved on this device. Redeploy the backend to apply it for everyone.', 'warn'); });
    }
    function startTimers(expiresAt) {
        clearTimers();
        if (!expiresAt)
            return;
        var warnAt = expiresAt - SMC.config.warnBefore;
        if (warnAt > Date.now())
            warnTimer = setTimeout(function () { document.getElementById('sesNote').classList.add('on'); }, warnAt - Date.now());
        hardTimer = setTimeout(function () {
            ui.toast('Session expired \u2014 please sign in again.', 'err');
            setTimeout(function () { SMC.auth.doLogout(); }, 1500);
        }, Math.max(0, expiresAt - Date.now()));
    }
    function clearTimers() {
        clearTimeout(hardTimer);
        clearTimeout(warnTimer);
        hardTimer = warnTimer = null;
        var n = document.getElementById('sesNote');
        if (n)
            n.classList.remove('on');
    }
    function openSidebar() {
        document.getElementById('sidebar').classList.add('expanded');
        document.getElementById('mobOverlay').classList.add('on');
        document.body.style.overflow = 'hidden';
    }
    function closeSidebar() {
        document.getElementById('sidebar').classList.remove('expanded');
        document.getElementById('mobOverlay').classList.remove('on');
        document.body.style.overflow = '';
    }
    function renderCounselors() {
        var tb = document.getElementById('cTbody');
        var isAdmin = user && user.role === 'admin';
        tb.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--mist);padding:20px">Loading\u2026</td></tr>';
        api.listUsers().then(function (users) {
            var html = '';
            (users || []).forEach(function (u, i) {
                var isSelf = user && u.username === user.username;
                var canRemove = u.role !== 'admin' && !isSelf;
                var roleCls = u.role === 'admin' ? 'ra' : (u.role === 'co-admin' ? 'rco' : 'rc');
                var roleBtn = '';
                if (isAdmin && u.role !== 'admin' && !isSelf) {
                    roleBtn = (u.role === 'co-admin')
                        ? '<button class="tbtn bp" data-role-set="counselor" data-role-user="' + ui.esc(u.username) + '">Revoke co-admin</button>'
                        : '<button class="tbtn bp" data-role-set="co-admin" data-role-user="' + ui.esc(u.username) + '">Make co-admin</button>';
                }
                var delBtn = canRemove
                    ? '<button class="tbtn bdel" data-del="' + ui.esc(u.username) + '">Remove</button>'
                    : '<span style="font-size:11px;color:var(--mist)">' + (isSelf ? '(you)' : '\u2014') + '</span>';
                html += '<tr>' +
                    '<td style="color:var(--mist);font-size:11px">' + (i + 1) + '</td>' +
                    '<td style="font-weight:500">' + ui.esc(u.name) + '</td>' +
                    '<td style="color:var(--mist)">' + ui.esc(u.username) + '</td>' +
                    '<td><span class="rpill ' + roleCls + '">' + ui.esc(u.role) + '</span></td>' +
                    '<td><div class="action-col" style="display:flex;gap:4px;flex-wrap:wrap">' + roleBtn + delBtn + '</div></td></tr>';
            });
            tb.innerHTML = html || '<tr><td colspan="5" style="text-align:center;color:var(--mist);padding:20px">No accounts found.</td></tr>';
        }).catch(function (e) {
            tb.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--red);padding:20px">' + ui.esc(e.message || 'Could not load.') + '</td></tr>';
        });
    }
    function bindCounselors() {
        document.getElementById('cTbody').addEventListener('click', function (e) {
            var del = e.target.closest('button[data-del]');
            var role = e.target.closest('button[data-role-set]');
            if (del) {
                var username = del.getAttribute('data-del');
                if (!confirm('Remove account "' + username + '"? This cannot be undone.'))
                    return;
                api.deleteUser(username).then(function () {
                    ui.toast('Account removed.', 'ok');
                    renderCounselors();
                }).catch(function (er) { ui.toast(er.message || 'Could not remove account.', 'err'); });
            }
            else if (role) {
                var tgt = role.getAttribute('data-role-user');
                var newRole = role.getAttribute('data-role-set');
                var verb = newRole === 'co-admin' ? 'Make "' + tgt + '" a co-admin?' : 'Revoke co-admin access from "' + tgt + '"?';
                if (!confirm(verb))
                    return;
                api.setRole(tgt, newRole).then(function () {
                    ui.toast('Access level updated.', 'ok');
                    renderCounselors();
                }).catch(function (er) { ui.toast(er.message || 'Could not update access.', 'err'); });
            }
        });
    }
    function loadData() {
        document.getElementById('tableLoader').classList.add('on');
        api.records().then(function (rows) {
            document.getElementById('tableLoader').classList.remove('on');
            SMC.records.setData(rows);
        }).catch(function (e) {
            document.getElementById('tableLoader').classList.remove('on');
            document.getElementById('tbody').innerHTML =
                '<tr><td colspan="7"><div class="empty">' +
                    '<svg width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">' +
                    '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>' +
                    '<line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' +
                    '<p>' + ui.esc(e.message || 'Could not load data.') + '</p></div></td></tr>';
            if (e.code === 'AUTH')
                setTimeout(function () { SMC.auth.doLogout(); }, 1200);
        });
    }
    function boot(u) {
        user = u;
        var initial = (u.name || '?').charAt(0).toUpperCase();
        document.getElementById('sbAv').textContent = initial;
        document.getElementById('sbName').textContent = u.name;
        document.getElementById('sbRole').textContent = u.role;
        var pmAvEl = document.getElementById('pmAv'); if (pmAvEl) pmAvEl.textContent = initial;
        var pmNameEl = document.getElementById('pmName'); if (pmNameEl) pmNameEl.textContent = u.name;
        var pmRoleEl = document.getElementById('pmRole'); if (pmRoleEl) pmRoleEl.textContent = u.role;
        var staff = u.role === 'admin' || u.role === 'co-admin';
        document.getElementById('navCounselors').style.display = staff ? '' : 'none';
        document.getElementById('navEval').style.display = '';
        document.getElementById('navProcedures').style.display = '';
        document.getElementById('navEvalProc').style.display = '';
        var np = document.getElementById('navProfile');
        if (np)
            np.style.display = '';
        var nd = document.getElementById('navEvalDash');
        if (nd)
            nd.style.display = '';
        SMC.evaluations.setUser(u);
        loadMaintenance();
        SMC.evaluations.refreshChrome();
        if (SMC.settings && SMC.settings.setUser) SMC.settings.setUser(u);
        startTimers(u.expiresAt);
        showScreen('appScreen');
        showView('dashboard');
        loadData();
        refreshEvalStats();
        updateSearchVisibility();
    }
    function refreshEvalStats() {
        var el = document.getElementById('stEv');
        if (!el || !api.listEvaluations)
            return;
        api.listEvaluations().then(function (rows) {
            rows = rows || [];
            var done = rows.filter(function (o) { return (o.status || '') === 'Done'; }).length;
            el.textContent = rows.length;
            var sub = document.getElementById('stEvSub');
            if (sub)
                sub.textContent = done + ' done · ' + (rows.length - done) + ' open';
        }).catch(function () { });
    }
    function reset() {
        user = null;
        clearTimers();
        SMC.charts.destroy();
    }
    function init() {
        SMC.auth.bind();
        SMC.records.bind();
        bindCounselors();
        SMC.evaluations.bind();
        if (SMC.settings && SMC.settings.bind) SMC.settings.bind();
        document.getElementById('navDash').addEventListener('click', function () { showView('dashboard'); });
        document.getElementById('navCounselors').addEventListener('click', function () { showView('counselors'); });
        document.getElementById('navEval').addEventListener('click', function () { showView('evaluations'); });
        document.getElementById('navProcedures').addEventListener('click', function () { showView('procedures'); });
        document.getElementById('navEvalProc').addEventListener('click', function () { showView('evalResults'); });
        (function () {
            var pm = document.getElementById('profileMenu');
            var pb = document.getElementById('profileBtn');
            var menu = document.getElementById('profileDropdown');
            if (pm && pb && menu) {
                var positionMenu = function () {
                    if (window.innerWidth <= 768) { menu.style.top = ''; menu.style.right = ''; menu.style.left = ''; return; }
                    var r = pb.getBoundingClientRect();
                    menu.style.top = (r.bottom + 8) + 'px';
                    menu.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
                    menu.style.left = 'auto';
                };
                var closeMenu = function () { pm.classList.remove('open'); pb.setAttribute('aria-expanded', 'false'); };
                var openMenu = function () { positionMenu(); pm.classList.add('open'); pb.setAttribute('aria-expanded', 'true'); };
                var pick = function (view) { closeMenu(); showView(view); if (window.innerWidth <= 768) closeSidebar(); };
                pb.addEventListener('click', function (e) { e.stopPropagation(); if (pm.classList.contains('open')) closeMenu(); else openMenu(); });
                document.getElementById('pmProfile').addEventListener('click', function () { pick('profile'); });
                document.getElementById('pmSettings').addEventListener('click', function () { closeMenu(); if (window.innerWidth <= 768) closeSidebar(); if (SMC.settings && SMC.settings.open) SMC.settings.open(user); });
                document.getElementById('pmHelp').addEventListener('click', function () { closeMenu(); showTutorial(); });
                document.getElementById('pmLogout').addEventListener('click', function () { closeMenu(); SMC.auth.doLogout(); });
                document.addEventListener('click', function (e) { if (pm.classList.contains('open') && !pm.contains(e.target)) closeMenu(); });
                window.addEventListener('resize', function () { if (pm.classList.contains('open')) { if (window.innerWidth <= 768) closeMenu(); else positionMenu(); } });
            }
        })();
        (function () {
            var tut = document.getElementById('tutorial');
            if (!tut) return;
            var closeTut = function () { tut.classList.remove('on'); tut.setAttribute('aria-hidden', 'true'); };
            document.getElementById('tutClose').addEventListener('click', closeTut);
            document.getElementById('tutDone').addEventListener('click', closeTut);
            tut.addEventListener('click', function (e) { if (e.target === tut) closeTut(); });
            document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && tut.classList.contains('on')) closeTut(); });
        })();
        document.getElementById('navEvalDash').addEventListener('click', function () { showView('evalDash'); });
        var mb = document.getElementById('maintBtn');
        if (mb)
            mb.addEventListener('click', toggleMaintenance);
        (function () {
            var tb = document.getElementById('themeToggle');
            if (!tb)
                return;
            function sync() { var d = document.documentElement.getAttribute('data-theme') === 'dark'; var sp = tb.querySelector('span'); if (sp)
                sp.textContent = d ? 'Light mode' : 'Dark mode'; tb.setAttribute('aria-pressed', d ? 'true' : 'false'); }
            sync();
            tb.addEventListener('click', function () { var d = document.documentElement.getAttribute('data-theme') === 'dark'; if (d) {
                document.documentElement.removeAttribute('data-theme');
            }
            else {
                document.documentElement.setAttribute('data-theme', 'dark');
            } try {
                localStorage.setItem('smc-theme', d ? 'light' : 'dark');
            }
            catch (e) { } sync(); });
        })();
        document.getElementById('mobMenuBtn').addEventListener('click', openSidebar);
        document.getElementById('mobOverlay').addEventListener('click', closeSidebar);
        document.getElementById('sidebar').addEventListener('click', function (e) {
            if (window.innerWidth <= 768 && e.target.closest('.sbi'))
                closeSidebar();
        });
        window.addEventListener('resize', function () {
            if (window.innerWidth > 768) {
                closeSidebar();
            }
            updateSearchVisibility();
        });
        function finishBoot() { document.getElementById('boot').classList.add('gone'); }
        if (api.getToken()) {
            api.me().then(function (u) { finishBoot(); boot(u); })
                .catch(function () { api.clearToken(); finishBoot(); showScreen('authScreen'); loadPublicStats(); });
        }
        else {
            finishBoot();
            showScreen('authScreen');
            loadPublicStats();
        }
    }
    function loadPublicStats() {
        api.publicStats().then(function (s) {
            if (!s)
                return;
            if (s.totalSessions != null)
                document.getElementById('authTotal').textContent = s.totalSessions;
            if (s.totalStudents != null)
                document.getElementById('authStudents').textContent = s.totalStudents;
        }).catch(function () { });
    }
    function showTutorial() {
        var t = document.getElementById('tutorial');
        if (!t)
            return;
        t.classList.add('on');
        t.setAttribute('aria-hidden', 'false');
        var pm = document.getElementById('profileMenu');
        if (pm)
            pm.classList.remove('open');
    }
    return { init: init, boot: boot, reset: reset, showScreen: showScreen, refreshEvalStats: refreshEvalStats, showTutorial: showTutorial };
})();
window.addEventListener('DOMContentLoaded', SMC.app.init);
