"use strict";
window.SMC = window.SMC || {};
SMC.evaluations = (function () {
    var ui = SMC.ui, api = SMC.api;
    var items = [], user = null, editingId = null;
    var STATUSES = ['Pending', 'Started', 'Done'];
    function isStaff() { return user && (user.role === 'admin' || user.role === 'co-admin'); }
    function setUser(u) { user = u; }
    function statusBadge(s) {
        var cls = s === 'Done' ? 'evs-done' : s === 'Started' ? 'evs-started' : 'evs-pending';
        return '<span class="evs ' + cls + '">' + ui.esc(s || 'Pending') + '</span>';
    }
    function load() {
        var tb = document.getElementById('evalTbody');
        tb.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--mist);padding:22px">Loading\u2026</td></tr>';
        api.listEvaluations().then(function (rows) {
            items = rows || [];
            render();
            if (SMC.app && SMC.app.refreshEvalStats)
                SMC.app.refreshEvalStats();
        }).catch(function (e) {
            tb.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--red);padding:22px">' +
                ui.esc(e.message || 'Could not load evaluations.') + '</td></tr>';
            if (e.code === 'AUTH')
                setTimeout(function () { SMC.auth.doLogout(); }, 1200);
        });
    }
    function render() {
        var sf = document.getElementById('evalStatusFilter');
        var fv = sf ? sf.value : '';
        var se = document.getElementById('evalSearch');
        var q = se ? (se.value || '').trim().toLowerCase() : '';
        var rows = items.filter(function (o) {
            if (fv && (o.status || 'Pending') !== fv)
                return false;
            if (q && (((o.teacher || '') + ' ' + (o.title || '')).toLowerCase().indexOf(q) === -1))
                return false;
            return true;
        });
        var tb = document.getElementById('evalTbody');
        var staff = isStaff();
        if (!rows.length) {
            tb.innerHTML = '<tr><td colspan="7"><div class="empty">' +
                '<svg width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">' +
                '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>' +
                '<p>' + (items.length ? 'No evaluations match your search or filter.' : 'No evaluations yet.') + '</p></div></td></tr>';
            updateCount(rows.length);
            return;
        }
        var html = '';
        rows.forEach(function (o, i) {
            html += '<tr>' +
                '<td style="color:var(--mist);font-size:11px">' + (i + 1) + '</td>' +
                '<td style="font-weight:500">' + ui.esc(o.title || '\u2014') +
                (o.period ? '<div style="font-size:11px;color:var(--mist);margin-top:2px">' + ui.esc(o.period) + '</div>' : '') + '</td>' +
                '<td style="font-size:13px">' + ui.esc(o.teacher || '\u2014') + '</td>' +
                '<td>' + statusBadge(o.status) + '</td>' +
                '<td style="font-size:12px">' + ui.esc(o.assignedTo || '\u2014') + '</td>' +
                '<td style="font-size:12px">' + ui.esc(o.checkedBy || '\u2014') + '</td>' +
                '<td><div class="action-col" style="display:flex;gap:4px;flex-wrap:wrap">' +
                '<button class="tbtn bv" data-ev-edit="' + ui.esc(o.id) + '">' + (staff ? 'Edit' : 'Update') + '</button>' +
                (staff ? '<button class="tbtn bdel" data-ev-del="' + ui.esc(o.id) + '">Delete</button>' : '') +
                '</div></td></tr>';
        });
        tb.innerHTML = html;
        updateCount(rows.length);
    }
    function updateCount(n) {
        var el = document.getElementById('evalCount');
        if (el)
            el.textContent = n + ' evaluation' + (n !== 1 ? 's' : '');
    }
    function openModal(item) {
        var staff = isStaff();
        editingId = item ? item.id : null;
        document.getElementById('evalModalTitle').textContent =
            item ? (staff ? 'Edit Evaluation' : 'Update Evaluation') : 'New Evaluation';
        function set(id, val) { document.getElementById(id).value = val || ''; }
        set('evF_title', item && item.title);
        set('evF_teacher', item && item.teacher);
        set('evF_period', item && item.period);
        set('evF_status', (item && item.status) || 'Pending');
        set('evF_assigned', item && item.assignedTo);
        set('evF_checked', item && item.checkedBy);
        set('evF_due', item && item.dueDate);
        set('evF_notes', item && item.notes);
        var lockNonStatus = !staff;
        ['evF_title', 'evF_teacher', 'evF_period', 'evF_assigned', 'evF_checked', 'evF_due'].forEach(function (id) {
            document.getElementById(id).disabled = lockNonStatus;
        });
        document.getElementById('evDeleteBtn').style.display = (staff && item) ? '' : 'none';
        document.getElementById('evErr').classList.remove('on');
        document.getElementById('evalModal').classList.add('open');
        document.body.style.overflow = 'hidden';
    }
    function closeModal() {
        document.getElementById('evalModal').classList.remove('open');
        document.body.style.overflow = '';
        editingId = null;
    }
    function save() {
        var err = document.getElementById('evErr');
        err.classList.remove('on');
        var data = {
            title: document.getElementById('evF_title').value.trim(),
            teacher: document.getElementById('evF_teacher').value.trim(),
            period: document.getElementById('evF_period').value.trim(),
            status: document.getElementById('evF_status').value,
            assignedTo: document.getElementById('evF_assigned').value.trim(),
            checkedBy: document.getElementById('evF_checked').value.trim(),
            dueDate: document.getElementById('evF_due').value,
            notes: document.getElementById('evF_notes').value.trim()
        };
        if (editingId)
            data.id = editingId;
        if (!editingId && !data.title) {
            ui.showErr(err, 'Please enter an evaluation title.');
            return;
        }
        var btn = document.getElementById('evSaveBtn');
        btn.disabled = true;
        btn.textContent = 'Saving\u2026';
        api.saveEvaluation(data).then(function () {
            btn.disabled = false;
            btn.textContent = 'Save';
            ui.toast('Evaluation saved.', 'ok');
            closeModal();
            load();
        }).catch(function (e) {
            btn.disabled = false;
            btn.textContent = 'Save';
            ui.showErr(err, e.message || 'Could not save.');
        });
    }
    function remove() {
        if (!editingId)
            return;
        if (!confirm('Delete this evaluation? This cannot be undone.'))
            return;
        api.deleteEvaluation(editingId).then(function () {
            ui.toast('Evaluation deleted.', 'ok');
            closeModal();
            load();
        }).catch(function (e) { ui.toast(e.message || 'Could not delete.', 'err'); });
    }
    function bind() {
        var nb = document.getElementById('evalNewBtn');
        if (nb)
            nb.addEventListener('click', function () { openModal(null); });
        var sf = document.getElementById('evalStatusFilter');
        if (sf)
            sf.addEventListener('change', render);
        var es = document.getElementById('evalSearch');
        if (es)
            es.addEventListener('input', render);
        document.getElementById('evalTbody').addEventListener('click', function (e) {
            var ed = e.target.closest('button[data-ev-edit]');
            var dl = e.target.closest('button[data-ev-del]');
            if (ed) {
                var id = ed.getAttribute('data-ev-edit');
                var it = items.filter(function (o) { return o.id === id; })[0];
                if (it)
                    openModal(it);
            }
            else if (dl) {
                editingId = dl.getAttribute('data-ev-del');
                remove();
            }
        });
        document.getElementById('evSaveBtn').addEventListener('click', save);
        document.getElementById('evDeleteBtn').addEventListener('click', remove);
        document.getElementById('evCancelBtn').addEventListener('click', closeModal);
        document.getElementById('evCloseBtn').addEventListener('click', closeModal);
        document.getElementById('evalModal').addEventListener('click', function (e) { if (e.target === this)
            closeModal(); });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && document.getElementById('evalModal').classList.contains('open'))
                closeModal();
        });
    }
    function refreshChrome() {
        var nb = document.getElementById('evalNewBtn');
        if (nb)
            nb.style.display = isStaff() ? '' : 'none';
    }
    return { bind: bind, load: load, setUser: setUser, refreshChrome: refreshChrome };
})();
