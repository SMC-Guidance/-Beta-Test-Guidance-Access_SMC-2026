"use strict";
window.SMC = window.SMC || {};
SMC.incidents = (function () {
    var ui = SMC.ui, api = SMC.api;
    var user = null, cache = [];
    var TYPES = ['Bullying', 'Physical Altercation', 'Verbal Abuse', 'Property Damage', 'Misconduct', 'Cyber Incident', 'Health / Medical', 'Accident', 'Other'];
    var SEV = ['Low', 'Medium', 'High', 'Critical'];
    var STAT = ['Open', 'Under Investigation', 'Resolved', 'Closed'];
    var ROLES = ['Involved', 'Complainant', 'Respondent', 'Witness', 'Victim', 'Other'];
    function setUser(u) { user = u; }
    function esc(s) { return ui.esc(s); }
    function isStaff() { return !!(user && (user.role === 'admin' || user.role === 'co-admin')); }
    function host() { return document.getElementById('incidentsView'); }
    function fmtWhen(s) {
        if (!s) return '\u2014';
        var d = new Date(String(s).replace(' ', 'T'));
        if (isNaN(d.getTime())) return s;
        return d.toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
    function toLocalInput(s) {
        if (!s) return '';
        var d = new Date(String(s).replace(' ', 'T'));
        if (isNaN(d.getTime())) return '';
        var p = function (n) { return (n < 10 ? '0' : '') + n; };
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
    }
    function parseInvolved(inc) {
        var arr = inc.involved;
        if (typeof arr === 'string') { try { arr = JSON.parse(arr || '[]'); } catch (e) { arr = []; } }
        return Array.isArray(arr) ? arr : [];
    }
    function sevPill(s) { return '<span class="inc-sev sev-' + String(s || '').toLowerCase() + '">' + esc(s || '\u2014') + '</span>'; }
    function statPill(s) { return '<span class="inc-st st-' + String(s || 'open').toLowerCase().replace(/[^a-z]+/g, '') + '">' + esc(s || 'Open') + '</span>'; }
    function involvedSummary(inc) {
        var arr = parseInvolved(inc);
        if (!arr.length) return '\u2014';
        var first = arr[0].name || '(unnamed)';
        return esc(first) + (arr.length > 1 ? ' <span class="inc-more">+' + (arr.length - 1) + '</span>' : '');
    }
    function find(id) { for (var i = 0; i < cache.length; i++) { if (cache[i].id === id) return cache[i]; } return null; }
    function render() {
        var el = host();
        if (!el) return;
        el.innerHTML =
            '<div class="inc-wrap">' +
            '<header class="inc-head">' +
            '<div class="inc-head-l">' +
            '<span class="inc-head-ic"><svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>' +
            '<div><h2 class="inc-head-t">Incident Reports</h2><p class="inc-head-s">Log, view, print and manage reports. Each report can involve one or many individuals.</p></div>' +
            '</div>' +
            '<div class="inc-head-r">' +
            '<button class="inc-btn ghost" id="incBackBtn"><svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg> Dashboard</button>' +
            '<button class="inc-btn primary" id="incNewBtn"><svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg> New Report</button>' +
            '</div>' +
            '</header>' +
            '<div class="inc-tools">' +
            '<div class="inc-search-wrap"><svg class="inc-search-ic" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>' +
            '<input type="text" id="incSearch" class="inc-search" placeholder="Search incidents, people or locations"></div>' +
            '<select id="incStatusFilter" class="inc-filter"><option value="">All statuses</option>' +
            STAT.map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('') + '</select>' +
            '</div>' +
            '<div id="incList" class="inc-list"><div class="inc-loading">Loading reports&hellip;</div></div>' +
            '</div>';
        document.getElementById('incNewBtn').addEventListener('click', function () { openForm(null); });
        document.getElementById('incBackBtn').addEventListener('click', function () { if (SMC.app && SMC.app.go) SMC.app.go('dashboard'); });
        document.getElementById('incSearch').addEventListener('input', renderRows);
        document.getElementById('incStatusFilter').addEventListener('change', renderRows);
        document.getElementById('incList').addEventListener('click', function (e) {
            var v = e.target.closest('button[data-inc-view]');
            var ed = e.target.closest('button[data-inc-edit]');
            var pr = e.target.closest('button[data-inc-print]');
            var dl = e.target.closest('button[data-inc-del]');
            var en = e.target.closest('#incEmptyNew');
            if (v) openView(v.getAttribute('data-inc-view'));
            else if (ed) openForm(ed.getAttribute('data-inc-edit'));
            else if (pr) printOne(pr.getAttribute('data-inc-print'));
            else if (dl) doDelete(dl.getAttribute('data-inc-del'));
            else if (en) openForm(null);
        });
        load();
    }
    function load() {
        api.listIncidents().then(function (rows) { cache = rows || []; renderRows(); }).catch(function (e) {
            var box = document.getElementById('incList');
            if (box) box.innerHTML = '<div class="inc-empty"><p class="inc-empty-t" style="color:var(--red)">' + esc(e.message || 'Could not load incidents.') + '</p></div>';
        });
    }
    function metaBit(icon, text) {
        return '<span class="inc-m"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">' + icon + '</svg><span>' + text + '</span></span>';
    }
    function renderRows() {
        var box = document.getElementById('incList');
        if (!box) return;
        var q = (document.getElementById('incSearch').value || '').toLowerCase();
        var sf = document.getElementById('incStatusFilter').value || '';
        var rows = cache.filter(function (inc) {
            if (sf && (inc.status || 'Open') !== sf) return false;
            if (!q) return true;
            var hay = [inc.title, inc.type, inc.location, inc.description].join(' ').toLowerCase();
            var inv = parseInvolved(inc).map(function (p) { return p.name + ' ' + p.grade + ' ' + p.section; }).join(' ').toLowerCase();
            return hay.indexOf(q) !== -1 || inv.indexOf(q) !== -1;
        });
        if (!rows.length) {
            box.innerHTML = '<div class="inc-empty"><div class="inc-empty-ic"><svg width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>' +
                '<p class="inc-empty-t">No incident reports' + (q || sf ? ' match your filter' : ' yet') + '</p>' +
                '<p class="inc-empty-s">' + (q || sf ? 'Try a different search term or status.' : 'Create your first report to start logging incidents.') + '</p>' +
                (q || sf ? '' : '<button class="inc-btn primary" id="incEmptyNew"><svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg> New Report</button>') +
                '</div>';
            return;
        }
        box.innerHTML = rows.map(function (inc) {
            var sev = String(inc.severity || '').toLowerCase();
            var inv = parseInvolved(inc);
            var names = inv.filter(function (p) { return p.name; }).map(function (p) { return esc(p.name); });
            var invText = names.length ? (names.slice(0, 3).join(', ') + (names.length > 3 ? ' +' + (names.length - 3) + ' more' : '')) : (inv.length ? inv.length + ' recorded' : 'No individuals');
            var typeTag = inc.type ? '<span class="inc-tag">' + esc(inc.type) + '</span>' : '';
            var bits = metaBit('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>', esc(fmtWhen(inc.dateOccurred)));
            if (inc.location) bits += metaBit('<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>', esc(inc.location));
            bits += metaBit('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/>', invText);
            return '<article class="inc-card sev-edge-' + sev + '">' +
                '<div class="inc-card-main">' +
                '<div class="inc-card-top"><h3 class="inc-card-title">' + esc(inc.title || '(untitled)') + '</h3>' + statPill(inc.status) + '</div>' +
                '<div class="inc-card-tags">' + sevPill(inc.severity) + typeTag + '</div>' +
                '<div class="inc-card-meta">' + bits + '</div>' +
                '</div>' +
                '<div class="inc-card-actions">' +
                '<button class="inc-btn ghost sm" data-inc-view="' + esc(inc.id) + '">View</button>' +
                '<button class="inc-btn soft sm" data-inc-edit="' + esc(inc.id) + '">Edit</button>' +
                '<button class="inc-btn ghost sm" data-inc-print="' + esc(inc.id) + '">Print</button>' +
                (isStaff() ? '<button class="inc-btn danger sm" data-inc-del="' + esc(inc.id) + '">Delete</button>' : '') +
                '</div>' +
                '</article>';
        }).join('');
    }
    function overlay(id) {
        var ov = document.getElementById(id);
        if (!ov) { ov = document.createElement('div'); ov.id = id; ov.className = 'inc-ov'; document.body.appendChild(ov); }
        return ov;
    }
    function closeOverlay(id) { var ov = document.getElementById(id); if (ov) { ov.classList.remove('on'); ov.innerHTML = ''; } }
    function involvedRowHtml(p) {
        p = p || {};
        return '<div class="inc-inv-row">' +
            '<input class="inc-in inv-name" placeholder="Full name" value="' + esc(p.name || '') + '">' +
            '<input class="inc-in inv-grade" placeholder="Grade / Year" value="' + esc(p.grade || '') + '">' +
            '<input class="inc-in inv-section" placeholder="Section" value="' + esc(p.section || '') + '">' +
            '<select class="inc-in inv-role">' + ROLES.map(function (r) { return '<option' + (p.role === r ? ' selected' : '') + '>' + esc(r) + '</option>'; }).join('') + '</select>' +
            '<button type="button" class="inc-inv-del" title="Remove">&times;</button></div>';
    }
    function collectForm() {
        var involved = [];
        document.querySelectorAll('#incInvolved .inc-inv-row').forEach(function (row) {
            var name = row.querySelector('.inv-name').value.trim();
            var grade = row.querySelector('.inv-grade').value.trim();
            var section = row.querySelector('.inv-section').value.trim();
            var role = row.querySelector('.inv-role').value;
            if (name || grade || section) involved.push({ name: name, grade: grade, section: section, role: role });
        });
        return {
            id: document.getElementById('incId').value || '',
            title: document.getElementById('incTitle').value.trim(),
            type: document.getElementById('incType').value,
            severity: document.getElementById('incSeverity').value,
            status: document.getElementById('incStatus').value,
            dateOccurred: document.getElementById('incDate').value,
            location: document.getElementById('incLocation').value.trim(),
            description: document.getElementById('incDesc').value.trim(),
            actionsTaken: document.getElementById('incActions').value.trim(),
            involved: involved
        };
    }
    function openForm(id) {
        var inc = id ? find(id) : null;
        var arr = inc ? parseInvolved(inc) : [{}];
        if (!arr.length) arr = [{}];
        var ov = overlay('incFormOv'); ov.className = 'inc-ov on';
        ov.innerHTML = '<div class="inc-modal">' +
            '<div class="inc-modal-h"><strong>' + (inc ? 'Edit' : 'New') + ' Incident Report</strong><button class="inc-x" id="incClose">&times;</button></div>' +
            '<div class="inc-modal-b">' +
            '<input type="hidden" id="incId" value="' + esc(inc ? inc.id : '') + '">' +
            '<div class="inc-grid">' +
            '<label class="inc-f full"><span>Title *</span><input id="incTitle" value="' + esc(inc ? inc.title : '') + '" placeholder="Short incident title"></label>' +
            '<label class="inc-f"><span>Type</span><select id="incType">' + TYPES.map(function (t) { return '<option' + (inc && inc.type === t ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select></label>' +
            '<label class="inc-f"><span>Severity</span><select id="incSeverity">' + SEV.map(function (t) { return '<option' + ((inc ? inc.severity : 'Medium') === t ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select></label>' +
            '<label class="inc-f"><span>Status</span><select id="incStatus">' + STAT.map(function (t) { return '<option' + ((inc ? inc.status : 'Open') === t ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select></label>' +
            '<label class="inc-f"><span>Date &amp; time occurred</span><input type="datetime-local" id="incDate" value="' + esc(inc ? toLocalInput(inc.dateOccurred) : '') + '"></label>' +
            '<label class="inc-f full"><span>Location</span><input id="incLocation" value="' + esc(inc ? inc.location : '') + '" placeholder="Where it happened"></label>' +
            '</div>' +
            '<div class="inc-inv-head"><span>Individuals involved</span><button type="button" class="tbtn bp" id="incAddInv">+ Add person</button></div>' +
            '<div class="inc-inv-labels"><span>Name</span><span>Grade / Year</span><span>Section</span><span>Role</span><span></span></div>' +
            '<div id="incInvolved">' + arr.map(involvedRowHtml).join('') + '</div>' +
            '<label class="inc-f full"><span>Description of incident</span><textarea id="incDesc" rows="4" placeholder="What happened\u2026">' + esc(inc ? inc.description : '') + '</textarea></label>' +
            '<label class="inc-f full"><span>Actions taken</span><textarea id="incActions" rows="3" placeholder="Steps taken / resolution\u2026">' + esc(inc ? inc.actionsTaken : '') + '</textarea></label>' +
            '<div class="ferr" id="incFormErr" role="alert"></div>' +
            '</div>' +
            '<div class="inc-modal-f"><button class="tbtn" id="incCancel">Cancel</button><button class="tbtn bp" id="incSave">Save Report</button></div></div>';
        document.getElementById('incClose').addEventListener('click', function () { closeOverlay('incFormOv'); });
        document.getElementById('incCancel').addEventListener('click', function () { closeOverlay('incFormOv'); });
        document.getElementById('incAddInv').addEventListener('click', function () { var d = document.createElement('div'); d.innerHTML = involvedRowHtml({}); document.getElementById('incInvolved').appendChild(d.firstChild); });
        document.getElementById('incInvolved').addEventListener('click', function (e) { var x = e.target.closest('.inc-inv-del'); if (x) x.closest('.inc-inv-row').remove(); });
        document.getElementById('incSave').addEventListener('click', function () {
            var data = collectForm();
            if (!data.title) { ui.showErr(document.getElementById('incFormErr'), 'Please enter a title.'); return; }
            var btn = document.getElementById('incSave'); btn.disabled = true; btn.textContent = 'Saving\u2026';
            api.saveIncident(data).then(function () { closeOverlay('incFormOv'); ui.toast('Incident report saved.', 'ok'); load(); })
                .catch(function (e) { btn.disabled = false; btn.textContent = 'Save Report'; ui.showErr(document.getElementById('incFormErr'), e.message || 'Could not save.'); });
        });
        ov.addEventListener('click', function (e) { if (e.target === ov) closeOverlay('incFormOv'); });
    }
    function openView(id) {
        var inc = find(id); if (!inc) return;
        var arr = parseInvolved(inc);
        var invHtml = arr.length ? '<table class="inc-view-inv"><thead><tr><th>#</th><th>Name</th><th>Grade</th><th>Section</th><th>Role</th></tr></thead><tbody>' + arr.map(function (p, i) { return '<tr><td>' + (i + 1) + '</td><td>' + esc(p.name || '') + '</td><td>' + esc(p.grade || '') + '</td><td>' + esc(p.section || '') + '</td><td>' + esc(p.role || '') + '</td></tr>'; }).join('') + '</tbody></table>' : '<p class="inc-muted">No individuals recorded.</p>';
        var ov = overlay('incViewOv'); ov.className = 'inc-ov on';
        ov.innerHTML = '<div class="inc-modal">' +
            '<div class="inc-modal-h"><strong>Incident Report</strong><button class="inc-x" id="incVClose">&times;</button></div>' +
            '<div class="inc-modal-b">' +
            '<div class="inc-view-title">' + esc(inc.title || '(untitled)') + '</div>' +
            '<div class="inc-view-meta">' + sevPill(inc.severity) + statPill(inc.status) + '<span class="inc-tag">' + esc(inc.type || '\u2014') + '</span></div>' +
            '<dl class="inc-dl"><dt>Date &amp; time</dt><dd>' + esc(fmtWhen(inc.dateOccurred)) + '</dd>' +
            '<dt>Location</dt><dd>' + esc(inc.location || '\u2014') + '</dd>' +
            '<dt>Reported by</dt><dd>' + esc(inc.reportedBy || '\u2014') + ' <small>(' + esc(inc.reporterRole || '') + ')</small></dd>' +
            '<dt>Recorded</dt><dd>' + esc(inc.createdAt || '\u2014') + '</dd></dl>' +
            '<h4>Individuals involved</h4>' + invHtml +
            '<h4>Description</h4><div class="inc-view-txt">' + esc(inc.description || '\u2014').replace(/\n/g, '<br>') + '</div>' +
            '<h4>Actions taken</h4><div class="inc-view-txt">' + esc(inc.actionsTaken || '\u2014').replace(/\n/g, '<br>') + '</div>' +
            '</div>' +
            '<div class="inc-modal-f"><button class="tbtn" id="incVPrint">Print</button><button class="tbtn bp" id="incVEdit">Edit</button></div></div>';
        document.getElementById('incVClose').addEventListener('click', function () { closeOverlay('incViewOv'); });
        document.getElementById('incVPrint').addEventListener('click', function () { printOne(id); });
        document.getElementById('incVEdit').addEventListener('click', function () { closeOverlay('incViewOv'); openForm(id); });
        ov.addEventListener('click', function (e) { if (e.target === ov) closeOverlay('incViewOv'); });
    }
    function printOne(id) {
        var inc = find(id); if (!inc) return;
        var arr = parseInvolved(inc);
        var invRows = arr.length ? arr.map(function (p, i) { return '<tr><td>' + (i + 1) + '</td><td>' + esc(p.name || '') + '</td><td>' + esc(p.grade || '') + '</td><td>' + esc(p.section || '') + '</td><td>' + esc(p.role || '') + '</td></tr>'; }).join('') : '<tr><td colspan="5" style="text-align:center">No individuals recorded</td></tr>';
        var area = document.getElementById('incPrintArea');
        if (!area) { area = document.createElement('div'); area.id = 'incPrintArea'; document.body.appendChild(area); }
        area.innerHTML = '<div class="ipr">' +
            '<div class="ipr-head"><img src="assets/logo.jpg" onerror="this.style.display=&#39;none&#39;"><div class="ipr-ht"><h1>STELLA MARIS COLLEGE</h1><h2>Guidance Office</h2><div class="ipr-doc">OFFICIAL INCIDENT REPORT</div></div></div>' +
            '<div class="ipr-conf">CONFIDENTIAL &mdash; For authorized personnel only</div><table class="ipr-meta"><tr><td class="k">Report ID</td><td>' + esc(inc.id) + '</td><td class="k">Status</td><td>' + esc(inc.status || 'Open') + '</td></tr>' +
            '<tr><td class="k">Title</td><td>' + esc(inc.title || '') + '</td><td class="k">Type</td><td>' + esc(inc.type || '') + '</td></tr>' +
            '<tr><td class="k">Severity</td><td>' + esc(inc.severity || '') + '</td><td class="k">Date &amp; Time</td><td>' + esc(fmtWhen(inc.dateOccurred)) + '</td></tr>' +
            '<tr><td class="k">Location</td><td colspan="3">' + esc(inc.location || '') + '</td></tr></table>' +
            '<h3>Individuals Involved</h3>' +
            '<table class="ipr-inv"><thead><tr><th>#</th><th>Name</th><th>Grade / Year</th><th>Section</th><th>Role</th></tr></thead><tbody>' + invRows + '</tbody></table>' +
            '<h3>Description of Incident</h3><div class="ipr-txt">' + esc(inc.description || '').replace(/\n/g, '<br>') + '</div>' +
            '<h3>Actions Taken</h3><div class="ipr-txt">' + esc(inc.actionsTaken || '').replace(/\n/g, '<br>') + '</div>' +
            '<div class="ipr-foot">' +
            '<div class="ipr-sign"><div class="ipr-line"></div><span>Reported by</span><strong>' + esc(inc.reportedBy || '') + '</strong><small>' + esc(inc.reporterRole || '') + '</small></div>' +
            '<div class="ipr-sign"><div class="ipr-line"></div><span>Received / Reviewed by</span><strong>&nbsp;</strong><small>Guidance Office</small></div>' +
            '</div>' +
            '<div class="ipr-note">This is an official record of the Stella Maris College Guidance Office. Printed on ' + esc(new Date().toLocaleString('en-PH')) + '. Handle in accordance with data privacy policies.</div>' +
            '</div>';
        document.body.classList.add('printing-inc');
        var done = function () { document.body.classList.remove('printing-inc'); window.removeEventListener('afterprint', done); };
        window.addEventListener('afterprint', done);
        window.print();
    }
    function doDelete(id) {
        if (!confirm('Delete this incident report? This cannot be undone.')) return;
        api.deleteIncident(id).then(function () { ui.toast('Incident report deleted.', 'ok'); load(); }).catch(function (e) { ui.toast(e.message || 'Could not delete.', 'err'); });
    }
    return { render: render, load: load, setUser: setUser };
})();
