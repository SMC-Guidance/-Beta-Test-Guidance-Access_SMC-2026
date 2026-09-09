"use strict";
window.SMC = window.SMC || {};
SMC.records = (function () {
    var ui = SMC.ui;
    var all = [], filtered = [], page = 1, activeRow = null;
    function setData(rows) {
        all = rows || [];
        page = 1;
        populateFilters();
        applyFilters();
    }
    function uniqueVals(rows, key) {
        var seen = {}, out = [];
        rows.forEach(function (r) { var v = r[key]; if (v && !seen[v]) {
            seen[v] = 1;
            out.push(v);
        } });
        return out.sort();
    }
    function uniqueCount(rows, key) {
        var s = {};
        rows.forEach(function (r) { if (r[key])
            s[r[key]] = 1; });
        return Object.keys(s).length;
    }
    function populateFilters() {
        var gf = document.getElementById('gradeFilter'), df = document.getElementById('designateFilter');
        gf.innerHTML = '<option value="">All</option>';
        df.innerHTML = '<option value="">All</option>';
        uniqueVals(all, 'grade').forEach(function (g) { gf.innerHTML += '<option value="' + ui.esc(g) + '">' + ui.esc(g) + '</option>'; });
        uniqueVals(all, 'designate').forEach(function (d) { df.innerHTML += '<option value="' + ui.esc(d) + '">' + ui.esc(d) + '</option>'; });
        var isel = document.getElementById('issueFilter'), known = ['', 'Anxiety', 'Depression'];
        uniqueVals(all, 'issueCategory').forEach(function (v) {
            var k = (v.split(',')[0] || '').trim();
            if (k && known.indexOf(k) === -1) {
                isel.innerHTML += '<option value="' + ui.esc(k) + '">' + ui.esc(k) + '</option>';
                known.push(k);
            }
        });
    }
    function sortRows(rows) {
        var byEl = document.getElementById("sortBy");
        var dirEl = document.getElementById("sortDir");
        var by = (byEl && byEl.value) || "date";
        var dir = (dirEl && dirEl.value) || "desc";
        var mul = dir === "asc" ? 1 : -1;
        var copy = rows.slice();
        copy.sort(function (a, b) {
            if (by === "date") {
                var at = new Date(a.date).getTime(); if (isNaN(at)) at = 0;
                var bt = new Date(b.date).getTime(); if (isNaN(bt)) bt = 0;
                return (at - bt) * mul;
            }
            var av = String(a[by] || ""), bv = String(b[by] || "");
            return av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" }) * mul;
        });
        return copy;
    }
    function applyFilters() {
        var gv = document.getElementById('gradeFilter').value;
        var dv = document.getElementById('designateFilter').value;
        var iv = document.getElementById('issueFilter').value;
        var sv = document.getElementById('searchInput').value.trim().toLowerCase();
        var dfrom = document.getElementById('dateFrom').value;
        var dto = document.getElementById('dateTo').value;
        filtered = all.filter(function (r) {
            if (gv && r.grade !== gv)
                return false;
            if (dv && r.designate !== dv)
                return false;
            if (iv && (r.issueCategory || '').indexOf(iv) === -1)
                return false;
            if (sv && (r.name || '').toLowerCase().indexOf(sv) === -1)
                return false;
            if (dfrom || dto) {
                var rd = new Date(r.date);
                if (isNaN(rd.getTime()))
                    return !(dfrom || dto);
                if (dfrom && rd < new Date(dfrom))
                    return false;
                if (dto && rd > new Date(dto + 'T23:59:59'))
                    return false;
            }
            return true;
        });
        filtered = sortRows(filtered);
        renderStats(filtered);
        renderTable();
        SMC.charts.render(filtered);
    }
    function renderStats(rows) {
        var anx = 0, dep = 0;
        rows.forEach(function (r) {
            if ((r.issueCategory || '').indexOf('Anxiety') !== -1)
                anx++;
            if ((r.issueCategory || '').indexOf('Depression') !== -1)
                dep++;
        });
        ui.animCount('stS', uniqueCount(rows, 'name'));
        ui.animCount('stSe', rows.length);
        ui.animCount('stA', anx);
        ui.animCount('stD', dep);
    }
    function renderTable() {
        var perPage = SMC.config.perPage;
        var s = (page - 1) * perPage, slice = filtered.slice(s, s + perPage);
        var tb = document.getElementById('tbody');
        if (!slice.length) {
            tb.innerHTML = '<tr><td colspan="7"><div class="empty">' +
                '<svg width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">' +
                '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
                '<p>No records match the current filters.</p></div></td></tr>';
        }
        else {
            var html = '';
            for (var i = 0; i < slice.length; i++) {
                var r = slice[i], idx = s + i;
                var issue = r.issueCategory || '';
                var ib = issue.indexOf('Anxiety') !== -1 ? '<span class="badge bg">Anxiety</span>'
                    : issue.indexOf('Depression') !== -1 ? '<span class="badge br">Depression</span>'
                        : issue ? '<span class="badge bn">' + ui.esc(issue.substring(0, 18)) + '</span>' : '\u2014';
                html += '<tr>' +
                    '<td style="color:var(--mist);font-size:11px">' + (idx + 1) + '</td>' +
                    '<td style="font-weight:500">' + ui.esc(r.name || '\u2014') + '</td>' +
                    '<td><span class="badge bn">' + ui.esc(r.grade || '\u2014') + '</span></td>' +
                    '<td style="color:var(--mist);font-size:12px">' + ui.fmtDate(r.date) + '</td>' +
                    '<td style="font-size:12px">' + ui.esc(r.designate || '\u2014') + '</td>' +
                    '<td>' + ib + '</td>' +
                    '<td><div class="action-col" style="display:flex;gap:4px;flex-wrap:wrap">' +
                    '<button class="tbtn bv" data-action="view" data-idx="' + idx + '">View</button>' +
                    '<button class="tbtn bp" data-action="print" data-idx="' + idx + '">Print</button>' +
                    '<button class="tbtn bd" data-action="pdf" data-idx="' + idx + '">PDF</button>' +
                    '</div></td></tr>';
            }
            tb.innerHTML = html;
        }
        document.getElementById('recCount').textContent = filtered.length + ' record' + (filtered.length !== 1 ? 's' : '');
        renderPager();
    }
    function renderPager() {
        var perPage = SMC.config.perPage;
        var total = filtered.length;
        var pages = Math.ceil(total / perPage) || 1;
        var s = (page - 1) * perPage;
        document.getElementById('pagerInfo').textContent =
            total ? (s + 1) + '\u2013' + Math.min(page * perPage, total) + ' of ' + total : '';
        var pb = document.getElementById('pbtns');
        pb.innerHTML = '';
        function addBtn(label, tp, disabled) {
            var b = document.createElement('button');
            b.className = 'pbtn' + (tp === page ? ' on' : '');
            b.innerHTML = label;
            b.disabled = !!disabled;
            b.addEventListener('click', function () { page = tp; renderTable(); });
            pb.appendChild(b);
        }
        addBtn('\u2039', page - 1, page === 1);
        var st = Math.max(1, page - 2), en = Math.min(pages, page + 2);
        for (var p = st; p <= en; p++)
            addBtn(p, p, false);
        addBtn('\u203a', page + 1, page >= pages);
    }
    function msec(t, b) { return '<div class="msec"><div class="mst">' + ui.esc(t) + '</div>' + b + '</div>'; }
    function mgrid(items) { return '<div class="mgrid">' + items.join('') + '</div>'; }
    function mf(l, v) { if (!v)
        return ''; return '<div><div class="mfl">' + ui.esc(l) + '</div><div class="mfv">' + ui.esc(v) + '</div></div>'; }
    function mfl(l, v) { if (!v)
        return ''; return '<div style="grid-column:1/-1"><div class="mfl">' + ui.esc(l) + '</div><div class="mflong">' + ui.esc(v) + '</div></div>'; }
    function openModal(r) {
        activeRow = r;
        document.getElementById('mName').textContent = r.name || '\u2014';
        document.getElementById('mTags').innerHTML = [
            r.grade && '<span class="mtag">' + ui.esc(r.grade) + '</span>',
            r.sex && '<span class="mtag">' + ui.esc(r.sex) + '</span>',
            r.age && '<span class="mtag">Age ' + ui.esc(r.age) + '</span>',
            r.date && '<span class="mtag">' + ui.fmtDate(r.date) + '</span>',
            r.designate && '<span class="mtag">' + ui.esc(r.designate) + '</span>'
        ].filter(Boolean).join('');
        document.getElementById('mBody').innerHTML =
            msec('Session Details', mgrid([
                mf('Record No.', r.recordNo), mf('Session No.', r.sessionNo), mf('Modality', r.modality),
                mf('Referral Source', r.referralSource), mf('Teacher Referral', r.teacherReferral), mf('Guidance Designate', r.designate)
            ])) +
                msec('Presenting Concern', mgrid([mf('Issue Category', r.issueCategory), mfl('Issue Description', r.issueDescription)])) +
                msec('Behavioral Observation', mgrid([
                    mf('Grooming & Appearance', r.grooming), mf('Eye Contact', r.eyeContact), mf('Speech', r.speech),
                    mf('Verbal Comprehension', r.verbalComprehension), mf('Gross Motor / Gait', r.grossMotor), mf('Fine Motor Skills', r.fineMotor),
                    mf('Compliance', r.compliance), mf('Emotional Tone', r.emotionalTone), mf('Emotional Management', r.emotionalManagement),
                    mfl('Observation Remarks', r.observationRemarks)
                ])) +
                msec('Guidance Designate Notes', mgrid([mfl('Student Report', r.studentReport), mfl('Actions Taken', r.actionsTaken), mfl('Progress Evaluation', r.progressEvaluation)]));
        document.getElementById('viewModal').classList.add('open');
        document.getElementById('mCloseBtn').focus();
        document.body.style.overflow = 'hidden';
    }
    function closeModal() {
        document.getElementById('viewModal').classList.remove('open');
        document.body.style.overflow = '';
    }
    function bind() {
        ['gradeFilter', 'designateFilter', 'issueFilter', 'dateFrom', 'dateTo', 'sortBy', 'sortDir'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el)
                el.addEventListener('change', function () { page = 1; applyFilters(); });
        });
        document.getElementById('searchInput').addEventListener('input', function () { page = 1; applyFilters(); });
        document.getElementById('searchInputMob').addEventListener('input', function () {
            document.getElementById('searchInput').value = this.value;
            page = 1;
            applyFilters();
        });
        document.getElementById('tbody').addEventListener('click', function (e) {
            var btn = e.target.closest('button[data-action]');
            if (!btn)
                return;
            var idx = parseInt(btn.getAttribute('data-idx'), 10);
            var row = filtered[idx];
            if (!row)
                return;
            var action = btn.getAttribute('data-action');
            if (action === 'view')
                openModal(row);
            if (action === 'print')
                SMC.exporter.print(row);
            if (action === 'pdf')
                SMC.exporter.pdf(row);
        });
        document.getElementById('mCloseBtn').addEventListener('click', closeModal);
        document.getElementById('mCancelBtn').addEventListener('click', closeModal);
        document.getElementById('viewModal').addEventListener('click', function (e) { if (e.target === this)
            closeModal(); });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && document.getElementById('viewModal').classList.contains('open'))
                closeModal();
        });
        document.getElementById('mPrintBtn').addEventListener('click', function () { if (activeRow)
            SMC.exporter.print(activeRow); });
        document.getElementById('mPdfBtn').addEventListener('click', function () { if (activeRow)
            SMC.exporter.pdf(activeRow); });
        var mShareBtn = document.getElementById('mShareBtn');
        if (mShareBtn) mShareBtn.addEventListener('click', function () { if (activeRow && SMC.share) SMC.share.open('record', 'Counseling Record - ' + (activeRow.name || ''), SMC.exporter.buildHtml(activeRow), {}); });
    }
    return { setData: setData, bind: bind };
})();
