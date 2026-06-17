"use strict";
window.SMC = window.SMC || {};
SMC.evalbuild = (function () {
    var ui = SMC.ui || { toast: function (m) { alert(m); }, esc: function (s) { return String(s == null ? '' : s); } };
    function esc(s) { return ui.esc ? ui.esc(s == null ? '' : s) : String(s == null ? '' : s); }
    var GRADES = [
        { key: 'shs', label: 'Senior High School', sheet: 'SENIOR HIGH SCHOOL TEMPLATE' },
        { key: 'jhs', label: 'Junior High School', sheet: 'JUNIOR HIGH SCHOOL TEMPLATE' },
        { key: 'g56', label: 'Grade 5 \u2013 6', sheet: 'G5-G6 TEMPLATE' },
        { key: 'g34', label: 'Grade 3 \u2013 4', sheet: 'G3-G4 TEMPLATE' },
        { key: 'kg2', label: 'Kinder \u2013 Grade 2', sheet: 'KINDER - G2 TEMPLATE' }
    ];
    function gradeByKey(k) { for (var i = 0; i < GRADES.length; i++) {
        if (GRADES[i].key === k)
            return GRADES[i];
    } return GRADES[0]; }
    var wbCache = null, tplCache = {}, built = [], uidc = 0;
    function uint8ArrayToBase64(arr) {
        var b = '';
        for (var i = 0; i < arr.length; i++)
            b += String.fromCharCode(arr[i]);
        return btoa(b);
    }
    function base64ToUint8(b64) {
        var bin = atob(b64), bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++)
            bytes[i] = bin.charCodeAt(i);
        return bytes;
    }
    function saveBuilt() {
        try {
            var data = built.map(function (r) {
                return {
                    uid: r.uid, key: r.key, teacher: r.teacher, subject: r.subject,
                    gradeLabel: r.gradeLabel, gradeKey: r.gradeKey, gradeTag: r.gradeTag,
                    comments: r.comments, commentsText: r.commentsText,
                    overall: r.overall, blockAverages: r.blockAverages, students: r.students,
                    matched: r.matched, totalCriteria: r.totalCriteria, fileName: r.fileName,
                    grouped: r.grouped, _xls64: r._xls64,
                    sections: r.sections.map(function (s) {
                        return { secLabel: s.secLabel, gradeNum: s.gradeNum, tab: s.tab,
                            students: s.students, overall: s.overall,
                            lines: s.lines, blockAverages: s.blockAverages,
                            comments: s.comments, matched: s.matched,
                            totalCriteria: s.totalCriteria, blocks: s.blocks };
                    })
                };
            });
            localStorage.setItem('smc-eb-built', JSON.stringify({ v: 1, uidc: uidc, items: data }));
        }
        catch (e) { }
    }
    function loadBuilt() {
        try {
            var raw = localStorage.getItem('smc-eb-built');
            if (!raw)
                return;
            var parsed = JSON.parse(raw);
            if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.items))
                return;
            if (parsed.uidc)
                uidc = Math.max(uidc, +parsed.uidc || 0);
            var restored = [];
            parsed.items.forEach(function (r) {
                if (!r._xls64)
                    return;
                var arr = base64ToUint8(r._xls64);
                r.blob = new Blob([arr], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                try {
                    if (window.XLSX) {
                        var wb = XLSX.read(arr, { type: 'array', cellStyles: true });
                        var sm = {};
                        wb.SheetNames.forEach(function (n) { sm[n] = wb.Sheets[n]; });
                        (r.sections || []).forEach(function (s) { s.ws = sm[s.tab] || null; });
                    }
                }
                catch (e) {
                    (r.sections || []).forEach(function (s) { s.ws = null; });
                }
                restored.push(r);
            });
            if (restored.length)
                built = restored;
        }
        catch (e) { }
    }
    function saveFolderScan(data) {
        try {
            localStorage.setItem('smc-eb-scan', JSON.stringify({ folderName: data.folderName, forms: data.forms, capped: data.capped, ts: Date.now() }));
        }
        catch (e) { }
    }
    function loadFolderScan() {
        try {
            var raw = localStorage.getItem('smc-eb-scan');
            if (!raw)
                return null;
            return JSON.parse(raw);
        }
        catch (e) {
            return null;
        }
    }
    function renderSavedScan(saved) { if (!saved || !saved.forms)
        return; scanData = saved; navPath = []; renderBrowser(); }
    function mount() {
        var host = document.getElementById('ebMount');
        if (!host)
            return;
        host.innerHTML =
            '<div class="drive-folder">' +
                '<div class="drive-topbar">' +
                '<div class="drive-crumb" id="ebCrumb"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg><span>Evaluation Results</span></div>' +
                '<div class="drive-actions">' +
                '<button class="drive-btn" id="ebLoadForms" title="Refresh from the connected folder"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>Refresh</button>' +
                '</div>' +
                '</div>' +
                '<div class="drive-info" id="ebInfo"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg><span>Browse the connected Drive folder below. Open a folder to find its files, then View or Download each one.</span></div>' +
                '<div class="drive-table-wrap">' +
                '<div class="drive-thead" id="ebThead" style="display:none"><span class="dr-th-name">Name</span><span class="dr-th-kind">Type</span><span class="dr-th-status">Status</span><span class="dr-th-actions"></span></div>' +
                '<div class="drive-list" id="ebFormsList"></div>' +
                '</div>' +
                '</div>' +
                '<div id="ebResults"></div>' +
                '<div id="ebBuiltWrap"></div>';
        var lf = document.getElementById('ebLoadForms');
        if (lf)
            lf.onclick = function () { loadForms({ force: true }); };
        loadBuilt();
        drawBuilt();
        autoLoad();
    }
    function showErr(msg) { var e = document.getElementById('ebErr'); if (e) {
        e.textContent = msg;
        e.style.display = 'block';
    } }
    function clearErr() { var e = document.getElementById('ebErr'); if (e) {
        e.style.display = 'none';
    } }
    function calcHtml() {
        return '<div class="eb-calc-tool">' +
            '<div class="eb-calc-head">Average calculator <small>paste or type scores to cross-check</small></div>' +
            '<textarea id="ebCalcIn" class="eb-calc-ta" rows="2" placeholder="e.g. 4, 3, 4, 2  (commas, spaces or new lines)"></textarea>' +
            '<div class="eb-calc-out" id="ebCalcOut"></div>' +
            '</div>';
    }
    function wireCalc() { var ta = document.getElementById('ebCalcIn'); if (ta) {
        ta.oninput = runCalc;
        runCalc();
    } }
    function runCalc() {
        var ta = document.getElementById('ebCalcIn'), out = document.getElementById('ebCalcOut');
        if (!ta || !out)
            return;
        var nums = (ta.value.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
        if (!nums.length) {
            out.textContent = 'Count 0  \u00b7  Sum 0  \u00b7  Average \u2014  \u00b7  Min \u2014  \u00b7  Max \u2014';
            return;
        }
        var sum = nums.reduce(function (a, b) { return a + b; }, 0), avg = sum / nums.length;
        out.textContent = 'Count ' + nums.length + '  \u00b7  Sum ' + round2(sum) + '  \u00b7  Average ' + avg.toFixed(2) + '  \u00b7  Min ' + Math.min.apply(null, nums) + '  \u00b7  Max ' + Math.max.apply(null, nums);
    }
    function loadCalc(scores) { var ta = document.getElementById('ebCalcIn'); if (ta) {
        ta.value = scores.join(', ');
        runCalc();
        ta.scrollIntoView({ behavior: 'smooth', block: 'center' });
        ta.focus();
    } }
    function round2(n) { return Math.round(n * 100) / 100; }
    function fileIcon(kind) {
        var k = (kind || '').toLowerCase();
        if (k.indexOf('sheet') >= 0 || k.indexOf('spreadsheet') >= 0)
            return '<svg width="20" height="20" fill="none" stroke="#0F9D58" stroke-width="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" fill="#E6F4EA"/><line x1="8" y1="8" x2="16" y2="8" stroke="#0F9D58" stroke-width="1.5"/><line x1="8" y1="12" x2="16" y2="12" stroke="#0F9D58" stroke-width="1.5"/><line x1="8" y1="16" x2="12" y2="16" stroke="#0F9D58" stroke-width="1.5"/></svg>';
        if (k.indexOf('form') >= 0)
            return '<svg width="20" height="20" fill="none" stroke="#7248B9" stroke-width="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" fill="#F3E8FD"/><rect x="8" y="8" width="8" height="3" rx="1" fill="#7248B9"/><line x1="8" y1="14" x2="16" y2="14" stroke="#7248B9" stroke-width="1.2"/><line x1="8" y1="17" x2="12" y2="17" stroke="#7248B9" stroke-width="1.2"/></svg>';
        if (k.indexOf('csv') >= 0 || k.indexOf('excel') >= 0 || k.indexOf('xls') >= 0)
            return '<svg width="20" height="20" fill="none" stroke="#0F9D58" stroke-width="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" fill="#E6F4EA"/><line x1="8" y1="8" x2="16" y2="8" stroke="#0F9D58" stroke-width="1.5"/><line x1="8" y1="12" x2="16" y2="12" stroke="#0F9D58" stroke-width="1.5"/><line x1="8" y1="16" x2="12" y2="16" stroke="#0F9D58" stroke-width="1.5"/></svg>';
        return '<svg width="20" height="20" fill="none" stroke="#5F6368" stroke-width="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" fill="#F1F3F4"/><polyline points="7 8 12 13 17 8" stroke="#5F6368" stroke-width="1.5"/><line x1="12" y1="13" x2="12" y2="16" stroke="#5F6368" stroke-width="1.5"/></svg>';
    }
    var FOLDER_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z" fill="#F2C94C" stroke="#E0B33A" stroke-width="1"/></svg>';
    var FOLDER_SVG_LG = '<svg width="44" height="44" viewBox="0 0 24 24" fill="none"><path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z" fill="#F2C94C" stroke="#E0B33A" stroke-width="1"/></svg>';
    var scanData = null;
    var navPath = [];
    var builtById = {};
    function buildTree(forms) {
        var root = { name: '', folders: {}, order: [], files: [] };
        (forms || []).forEach(function (f, i) {
            var segs = (f.path || '').split(' / ').map(function (x) { return x.trim(); }).filter(Boolean);
            var node = root;
            segs.forEach(function (seg) {
                if (!node.folders[seg]) {
                    node.folders[seg] = { name: seg, folders: {}, order: [], files: [] };
                    node.order.push(seg);
                }
                node = node.folders[seg];
            });
            node.files.push({ f: f, i: i });
        });
        return root;
    }
    function nodeAt(root, pathArr) {
        var node = root;
        for (var k = 0; k < pathArr.length; k++) {
            if (node.folders[pathArr[k]])
                node = node.folders[pathArr[k]];
            else
                return null;
        }
        return node;
    }
    function countFiles(node) { var n = node.files.length; node.order.forEach(function (k) { n += countFiles(node.folders[k]); }); return n; }
    function navTo(pathArr) { navPath = pathArr.slice(); renderBrowser(); }
    function renderBrowser() {
        var list = document.getElementById('ebFormsList');
        if (!list || !scanData)
            return;
        var root = buildTree(scanData.forms);
        var node = nodeAt(root, navPath);
        if (!node) {
            navPath = [];
            node = root;
        }
        var crumb = document.getElementById('ebCrumb');
        if (crumb) {
            var ch = '<span class="dr-crumb-link" data-crumb="-1">' + FOLDER_SVG + '<span>' + esc(scanData.folderName || 'Forms') + '</span></span>';
            navPath.forEach(function (seg, idx) { ch += '<span class="dr-crumb-sep">/</span><span class="dr-crumb-link" data-crumb="' + idx + '">' + esc(seg) + '</span>'; });
            ch += '<span class="drive-folder-count">' + countFiles(root) + ' files</span>';
            crumb.innerHTML = ch;
            crumb.querySelectorAll('.dr-crumb-link').forEach(function (el) { el.onclick = function () { var d = +el.getAttribute('data-crumb'); navTo(d < 0 ? [] : navPath.slice(0, d + 1)); }; });
        }
        var thead = document.getElementById('ebThead');
        if (thead)
            thead.style.display = 'none';
        var info = document.getElementById('ebInfo');
        if (info)
            info.style.display = 'none';
        var h = '';
        if (node.order.length) {
            h += '<div class="dr-grid">';
            node.order.slice().sort(function (a, b) { return a.localeCompare(b); }).forEach(function (k) {
                var sub = node.folders[k], cnt = countFiles(sub);
                h += '<button class="dr-card" data-folder="' + esc(k) + '">' +
                    '<span class="dr-card-ic">' + FOLDER_SVG_LG + '</span>' +
                    '<span class="dr-card-body"><span class="dr-card-name">' + esc(k) + '</span>' +
                    '<span class="dr-card-meta">' + cnt + ' file' + (cnt === 1 ? '' : 's') + '</span></span></button>';
            });
            h += '</div>';
        }
        if (node.files.length) {
            h += '<div class="dr-file-head">Files</div><div class="dr-file-list">';
            node.files.slice().sort(function (a, b) { return String(a.f.name).localeCompare(String(b.f.name)); }).forEach(function (it) {
                var f = it.f, icon = fileIcon(f.kind);
                h += '<div class="dr-row" data-fid="' + esc(f.id) + '">' +
                    '<div class="dr-cell dr-name"><div class="dr-name-icon">' + icon + '</div>' +
                    '<div class="dr-name-text"><span class="dr-fn">' + esc(f.name) + '</span></div></div>' +
                    '<div class="dr-cell dr-kind">' + esc(f.kind || 'Form') + '</div>' +
                    '<div class="dr-cell dr-acts">' +
                    '<button class="dr-act-btn dr-view" data-fid="' + esc(f.id) + '">View</button>' +
                    '<button class="dr-act-btn dr-act-dl dr-dl" data-fid="' + esc(f.id) + '">Download</button>' +
                    '</div></div>';
            });
            h += '</div>';
        }
        if (!node.order.length && !node.files.length)
            h += '<div class="eb-forms-empty">This folder is empty.</div>';
        list.innerHTML = h;
        list.querySelectorAll('.dr-card').forEach(function (cd) { cd.onclick = function () { navTo(navPath.concat([cd.getAttribute('data-folder')])); }; });
        list.querySelectorAll('.dr-dl').forEach(function (b) { b.onclick = function () { fileAction(b.getAttribute('data-fid'), 'download', b); }; });
        list.querySelectorAll('.dr-view').forEach(function (b) { b.onclick = function () { fileAction(b.getAttribute('data-fid'), 'view', b); }; });
    }
    function findForm(id) { var arr = (scanData && scanData.forms) || []; for (var i = 0; i < arr.length; i++)
        if (String(arr[i].id) === String(id))
            return arr[i]; return null; }
    function fileAction(id, mode, btn) {
        var f = findForm(id);
        if (!f)
            return;
        if (builtById[id]) {
            if (mode === 'view')
                viewResult(builtById[id]);
            else
                triggerDownload(builtById[id]);
            return;
        }
        if (!window.XLSX) {
            ui.toast('The spreadsheet engine is still loading \u2014 try again in a moment.', 'err');
            return;
        }
        var row = btn && btn.closest('.dr-row'), acts = row && row.querySelector('.dr-acts'), prev = acts ? acts.innerHTML : '';
        if (acts)
            acts.innerHTML = '<span class="dr-stat dr-stat-build"><span class="dr-spin"></span>Building\u2026</span>';
        buildFromForm(f.id, f.name, f.path).then(function (st) {
            if (st.ok) {
                builtById[id] = st.result;
                if (acts)
                    acts.innerHTML = prev;
                if (mode === 'view')
                    viewResult(st.result);
                else
                    triggerDownload(st.result);
            }
            else {
                if (acts)
                    acts.innerHTML = '<span class="dr-stat dr-stat-err" title="' + esc(st.error) + '">Failed</span>';
                ui.toast(st.error || 'Build failed.', 'err');
                setTimeout(function () { if (acts)
                    acts.innerHTML = prev; }, 2600);
            }
        });
    }
    function loadForms(opts) {
        opts = opts || {};
        var list = document.getElementById('ebFormsList');
        if (!list)
            return;
        if (!SMC.api || !SMC.api.getToken || !SMC.api.getToken()) {
            if (!scanData)
                list.innerHTML = '<div class="eb-forms-empty">Sign in as admin or co-admin to use the connected folder.</div>';
            return;
        }
        var lb = document.getElementById('ebLoadForms');
        if (lb)
            lb.disabled = true;
        if (!scanData || opts.force)
            list.innerHTML = '<div class="ep-loading"><div class="spin"></div><span>Loading the forms folder\u2026</span></div>';
        SMC.api.listForms().then(function (res) {
            if (lb)
                lb.disabled = false;
            if (!res || !res.forms || !res.forms.length) {
                if (!scanData)
                    list.innerHTML = '<div class="eb-forms-empty">No Google Forms or response Sheets found in \u201c' + esc(res && res.folderName || 'the folder') + '\u201d.</div>';
                return;
            }
            scanData = res;
            if (opts.force)
                navPath = [];
            saveFolderScan(res);
            renderBrowser();
        }).catch(function (e) { if (lb)
            lb.disabled = false; if (!scanData)
            list.innerHTML = '<div class="ferr" style="display:block">' + esc((e && e.message) || 'Could not load the folder. Set FORMS_FOLDER_ID in Script Properties and re-deploy the backend.') + '</div>'; });
    }
    function autoLoad() {
        var saved = loadFolderScan();
        if (saved && saved.forms && saved.forms.length) {
            scanData = saved;
            navPath = [];
            renderBrowser();
            if (SMC.api && SMC.api.getToken && SMC.api.getToken())
                loadForms({ silent: true });
        }
        else {
            loadForms({ force: true });
        }
    }
    function buildFromForm(id, name, path) {
        return SMC.api.getFormResponses(id).then(function (data) {
            var merged = { headers: (data.headers || []).map(function (h) { return String(h).trim(); }), rows: clean(data.rows || []) };
            if (!merged.rows.length)
                throw new Error('No responses (if this is a \u201cCopy of\u201d a Form, copied forms lose responses \u2014 use the original or its linked Sheet).');
            var grade = gradeByKey(guessGrade(merged, (path || '') + ' ' + (name || '')));
            var teacher = deriveTeacher(merged) || stripExt(name);
            var subject = deriveSubject(merged);
            var sec = buildSection(grade, teacher, subject, merged);
            var result = addSection(grade, teacher, subject, sec);
            drawBuilt();
            return { ok: true, result: result };
        }).catch(function (e) { return { ok: false, error: (e && e.message) || ('Build failed for ' + name + '.') }; });
    }
    function stripExt(s) { return String(s).replace(/\.(xlsx|csv|gform|gsheet)$/i, '').replace(/\s*\(responses\)\s*$/i, '').trim() || 'Teacher'; }
    function gradeKeyFromNum(n) { if (n >= 11)
        return 'shs'; if (n >= 7)
        return 'jhs'; if (n >= 5)
        return 'g56'; if (n >= 3)
        return 'g34'; if (n >= 1)
        return 'kg2'; return null; }
    function gradeKeyFromText(t) {
        t = String(t == null ? '' : t).toLowerCase();
        if (/senior high|\bshs\b|grade\s*1[12]\b|\bg\s*1[12]\b/.test(t))
            return 'shs';
        if (/junior high|\bjhs\b/.test(t))
            return 'jhs';
        if (/kinder|kindergarten|\bkg\b|nursery|\bprep\b/.test(t))
            return 'kg2';
        return null;
    }
    function guessGrade(merged, hint) {
        var cols = detectColumns(merged.headers, merged.rows), i, k;
        if (cols.section >= 0) {
            for (i = 0; i < merged.rows.length; i++) {
                k = gradeKeyFromText(merged.rows[i][cols.section]);
                if (k)
                    return k;
            }
        }
        var maxN = 0;
        if (cols.section >= 0)
            merged.rows.forEach(function (r) {
                var ms = String(r[cols.section] || '').match(/\b(1[0-2]|[1-9])\b/g);
                if (ms)
                    ms.forEach(function (x) { var n = +x; if (n <= 12 && n > maxN)
                        maxN = n; });
            });
        if (maxN)
            return gradeKeyFromNum(maxN);
        if (hint) {
            k = gradeKeyFromText(hint);
            if (k)
                return k;
            var hm = String(hint).match(/(1[0-2]|[1-9])/);
            if (hm) {
                var hn = +hm[1];
                if (hn <= 12)
                    return gradeKeyFromNum(hn);
            }
        }
        var sel = document.getElementById('ebGrade');
        return sel ? sel.value : 'shs';
    }
    function deriveTeacher(merged) {
        var cols = detectColumns(merged.headers, merged.rows);
        if (cols.teacher < 0)
            return '';
        var best = '';
        merged.rows.forEach(function (r) { var v = String(r[cols.teacher] == null ? '' : r[cols.teacher]).trim(); if (v.length > best.length)
            best = v; });
        return best;
    }
    function onBuild() {
        clearErr();
        if (!window.XLSX) {
            showErr('The spreadsheet engine is still loading (needs internet the first time). Try again in a moment.');
            return;
        }
        var grade = gradeByKey(document.getElementById('ebGrade').value);
        var teacher = document.getElementById('ebTeacher').value.trim();
        var subject = document.getElementById('ebSubject').value.trim();
        var input = document.getElementById('ebFiles');
        var files = input && input.files ? Array.prototype.slice.call(input.files) : [];
        if (!teacher) {
            showErr('Please type the teacher\u2019s name.');
            return;
        }
        if (!files.length) {
            showErr('Please choose at least one response file.');
            return;
        }
        var btn = document.getElementById('ebBuild');
        btn.disabled = true;
        btn.textContent = 'Building\u2026';
        var rHost = document.getElementById('ebResults');
        rHost.innerHTML = '<div class="ep-loading"><div class="spin"></div><span>Reading responses, matching questions & filling your template\u2026</span></div>';
        Promise.all(files.map(readFlatFile)).then(function (parsed) {
            var merged = mergeFiles(parsed);
            if (!merged.rows.length)
                throw new Error('No response rows were found in the file(s).');
            var sec = buildSection(grade, teacher, subject, merged);
            var result = addSection(grade, teacher, subject, sec);
            renderResult(result);
            drawBuilt();
            triggerDownload(result);
            btn.disabled = false;
            btn.textContent = 'Build & download';
        }).catch(function (err) {
            rHost.innerHTML = '';
            showErr(err.message || 'Could not build the file.');
            btn.disabled = false;
            btn.textContent = 'Build & download';
        });
    }
    function readFlatFile(file) {
        return new Promise(function (resolve, reject) {
            var nm = String(file.name || '').toLowerCase();
            var isExcel = /\.(xlsx|xlsm|xls)$/.test(nm);
            var r = new FileReader();
            r.onerror = function () { reject(new Error('Could not read ' + file.name + '.')); };
            r.onload = function () {
                try {
                    var rows;
                    if (isExcel) {
                        var wb = XLSX.read(new Uint8Array(r.result), { type: 'array' });
                        rows = pickFormSheet(wb);
                    }
                    else {
                        rows = parseCsv(String(r.result));
                    }
                    rows = clean(rows);
                    resolve({ name: file.name, rows: rows });
                }
                catch (e) {
                    reject(e);
                }
            };
            if (isExcel)
                r.readAsArrayBuffer(file);
            else
                r.readAsText(file);
        });
    }
    function pickFormSheet(wb) {
        var best = null, bestScore = -1;
        wb.SheetNames.forEach(function (n) {
            var rows = clean(XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '', blankrows: false }));
            if (rows.length < 2)
                return;
            var hdr = rows[0].map(function (h) { return String(h).toLowerCase(); });
            var score = rows.length;
            if (hdr.some(function (h) { return /teacher|faculty|guro/.test(h); }))
                score += 1000;
            if (score > bestScore) {
                bestScore = score;
                best = rows;
            }
        });
        return best || [];
    }
    function mergeFiles(parsed) {
        var base = null;
        parsed.forEach(function (p) { if (p.rows.length >= 2 && (!base || p.rows.length > base.rows.length))
            base = p; });
        if (!base)
            return { headers: [], rows: [] };
        var headers = base.rows[0].map(function (h) { return String(h).trim(); });
        var norm = headers.map(normKey);
        var rows = [];
        parsed.forEach(function (p) {
            if (p.rows.length < 2)
                return;
            var pn = p.rows[0].map(function (h) { return normKey(String(h).trim()); });
            var idxMap = norm.map(function (k) { return pn.indexOf(k); });
            for (var i = 1; i < p.rows.length; i++) {
                var src = p.rows[i], out = [];
                for (var c = 0; c < headers.length; c++) {
                    var j = idxMap[c];
                    out.push(j >= 0 ? src[j] : '');
                }
                rows.push(out);
            }
        });
        return { headers: headers, rows: rows };
    }
    var NAME_RE = /\b(name|pangalan|respondent|full ?name|student name|your name|nickname)\b/i;
    function detectColumns(headers, rows) {
        var teacher = -1, subject = -1, section = -1, comments = [], items = [];
        for (var i = 0; i < headers.length; i++) {
            var low = String(headers[i]).toLowerCase();
            if (teacher < 0 && /teacher|faculty|instructor|guro/.test(low))
                teacher = i;
            else if (subject < 0 && /subject|asignatura/.test(low))
                subject = i;
            else if (section < 0 && /section|grade|level|class/.test(low))
                section = i;
        }
        var sample = rows.slice(0, 40);
        for (var j = 0; j < headers.length; j++) {
            if (j === teacher || j === subject || j === section)
                continue;
            if (NAME_RE.test(String(headers[j])))
                continue;
            var numeric = 0, longTxt = 0, total = 0;
            sample.forEach(function (rv) {
                var v = rv[j];
                if (v === '' || v == null)
                    return;
                total++;
                if (scoreOf(v) != null)
                    numeric++;
                else if (String(v).trim().split(/\s+/).length >= 3)
                    longTxt++;
            });
            if (total > 0 && numeric / total >= 0.6)
                items.push({ index: j, header: String(headers[j]).trim() });
            else if (total > 0 && longTxt / total >= 0.4)
                comments.push(j);
            else if (/comment|thought|suggestion|remark|feedback|express/.test(String(headers[j]).toLowerCase()))
                comments.push(j);
        }
        return { teacher: teacher, subject: subject, section: section, comments: comments, items: items };
    }
    function getTemplateWb() {
        if (wbCache)
            return wbCache;
        if (!SMC.EVAL_TEMPLATE_B64)
            throw new Error('The template asset (evaltemplate.js) did not load.');
        wbCache = XLSX.read(SMC.EVAL_TEMPLATE_B64, { type: 'base64', cellStyles: true, sheetStubs: true });
        return wbCache;
    }
    function parseTemplate(grade) {
        if (tplCache[grade.sheet])
            return tplCache[grade.sheet];
        var wb = getTemplateWb();
        var ws = wb.Sheets[grade.sheet];
        if (!ws)
            throw new Error('Template sheet "' + grade.sheet + '" not found.');
        var range = XLSX.utils.decode_range(ws['!ref']);
        function cellAt(r, c) { return ws[XLSX.utils.encode_cell({ r: r, c: c })]; }
        function val(r, c) { var x = cellAt(r, c); return x && x.v != null ? x.v : ''; }
        function styleAt(r, c) { var x = cellAt(r, c); return x && x.s ? x.s : null; }
        function rowHasS(r) { for (var c = range.s.c; c <= range.e.c; c++) {
            if (/^s\s*\d+$/i.test(String(val(r, c)).trim()))
                return true;
        } return false; }
        function rowEmpty(r) { for (var c = range.s.c; c <= range.e.c; c++) {
            if (String(val(r, c)).trim() !== '')
                return false;
        } return true; }
        var firstHeaderRow = -1;
        for (var r = range.s.r; r <= range.e.r && firstHeaderRow < 0; r++) {
            if (rowHasS(r))
                firstHeaderRow = r;
        }
        if (firstHeaderRow < 0)
            throw new Error('Could not locate the S1, S2\u2026 header row in the ' + grade.label + ' template.');
        var c0 = -1, avgCol = -1;
        for (var c = range.s.c; c <= range.e.c; c++) {
            var t = String(val(firstHeaderRow, c)).trim();
            if (c0 < 0 && /^s\s*\d+$/i.test(t))
                c0 = c;
            if (/average/i.test(t))
                avgCol = c;
        }
        if (c0 < 0)
            throw new Error('Could not find the first student column in the template.');
        if (avgCol < 0)
            avgCol = range.e.c;
        var allCriteria = [], critBlock = {}, blocks = [], curBlock = '';
        function noteBlock(lbl) { if (lbl) {
            curBlock = lbl;
            if (blocks.indexOf(lbl) < 0)
                blocks.push(lbl);
        } }
        for (var rr = firstHeaderRow; rr <= range.e.r; rr++) {
            var A = String(val(rr, 0)).trim();
            if (rowHasS(rr)) {
                noteBlock(A);
                continue;
            }
            if (!A || rowEmpty(rr))
                continue;
            if (/^total score|^average score/i.test(A) || /cumm?ulative/i.test(A) || /^overall/i.test(A))
                continue;
            if (!/^[A-Za-z]\s*[\.\)\:]/.test(A)) {
                noteBlock(A);
                continue;
            }
            allCriteria.push(A);
            critBlock[A] = curBlock;
        }
        var res = {
            ws: ws, range: range, val: val, styleAt: styleAt, cellAt: cellAt,
            rowHasS: rowHasS, rowEmpty: rowEmpty,
            firstHeaderRow: firstHeaderRow, c0: c0, avgColTmpl: avgCol,
            capacity: avgCol - c0, merges: ws['!merges'] || [], cols: ws['!cols'] || [],
            rows: ws['!rows'] || [], allCriteria: allCriteria, label: grade.label,
            critBlock: critBlock, blocks: blocks
        };
        tplCache[grade.sheet] = res;
        return res;
    }
    function colLetter(n) { var s = ''; while (n > 0) {
        var m = (n - 1) % 26;
        s = String.fromCharCode(65 + m) + s;
        n = (n - m - 1) / 26;
    } return s; }
    function buildSectionSheet(tpl, teacher, subject, sectionLabel, students, itemMap) {
        var c0 = tpl.c0, N = students.length, cap = tpl.capacity, delta = N - cap;
        var avgOut = tpl.avgColTmpl + delta;
        var out = {};
        function sty(s) { return s ? JSON.parse(JSON.stringify(s)) : undefined; }
        function put(r, c, cell) { out[XLSX.utils.encode_cell({ r: r, c: c })] = cell; }
        function L(c0based) { return colLetter(c0based + 1); }
        function copyAt(rT, cT, rO, cO, override) {
            var a = tpl.cellAt(rT, cT), cell = {};
            if (override !== undefined) {
                cell.t = (typeof override === 'number') ? 'n' : 's';
                cell.v = override;
                if (a && a.s)
                    cell.s = sty(a.s);
            }
            else if (a) {
                cell.t = a.t || 's';
                if (a.v != null)
                    cell.v = a.v;
                if (a.f)
                    cell.f = a.f;
                if (a.s)
                    cell.s = sty(a.s);
                if (cell.v == null && !cell.f) {
                    cell.t = 's';
                    cell.v = '';
                }
            }
            else {
                cell.t = 's';
                cell.v = '';
            }
            put(rO, cO, cell);
        }
        var blockCrit = [], totalRows = [], cumRow = null;
        for (var r = tpl.range.s.r; r <= tpl.range.e.r; r++) {
            var A = String(tpl.val(r, 0)).trim(), Alow = A.toLowerCase();
            if (r < tpl.firstHeaderRow) {
                copyAt(r, 0, r, 0);
                var ov;
                if (/teacher\s*:?$/i.test(A) || (/teacher/i.test(Alow) && !/action/i.test(Alow)))
                    ov = teacher;
                else if (/subject/i.test(Alow))
                    ov = (subject || '');
                else if (/section/i.test(Alow))
                    ov = sectionLabel;
                copyAt(r, c0, r, c0, ov);
                continue;
            }
            if (tpl.rowHasS(r)) {
                blockCrit = [];
                copyAt(r, 0, r, 0);
                for (var j = 0; j < N; j++)
                    put(r, c0 + j, { t: 's', v: 'S' + (j + 1), s: sty(tpl.styleAt(r, c0)) });
                copyAt(r, tpl.avgColTmpl, r, avgOut);
                continue;
            }
            if (/^total score|^average score/i.test(Alow)) {
                copyAt(r, 0, r, 0);
                var fR = blockCrit.length ? blockCrit[0] : (r + 1), lR = blockCrit.length ? blockCrit[blockCrit.length - 1] : (r + 1);
                for (var j2 = 0; j2 < N; j2++) {
                    var Lc = L(c0 + j2);
                    put(r, c0 + j2, { t: 'n', f: 'IFERROR(AVERAGE(' + Lc + fR + ':' + Lc + lR + '),"")', s: sty(tpl.styleAt(r, c0)) });
                }
                put(r, avgOut, { t: 'n', f: 'IFERROR(AVERAGE(' + L(avgOut) + fR + ':' + L(avgOut) + lR + '),"")', s: sty(tpl.styleAt(r, tpl.avgColTmpl)) });
                totalRows.push(r + 1);
                blockCrit = [];
                continue;
            }
            if (/cumm?ulative/i.test(Alow)) {
                copyAt(r, 0, r, 0);
                for (var j3 = 0; j3 < N; j3++) {
                    var Lc3 = L(c0 + j3);
                    var refs = totalRows.map(function (tr) { return Lc3 + tr; }).join(',');
                    put(r, c0 + j3, { t: 'n', f: 'IFERROR(AVERAGE(' + (refs || '0') + '),"")', s: sty(tpl.styleAt(r, c0)) });
                }
                var arefs = totalRows.map(function (tr) { return L(avgOut) + tr; }).join(',');
                put(r, avgOut, { t: 'n', f: 'IFERROR(AVERAGE(' + (arefs || '0') + '),"")', s: sty(tpl.styleAt(r, tpl.avgColTmpl)) });
                cumRow = r + 1;
                continue;
            }
            if (/^overall/i.test(Alow)) {
                copyAt(r, 0, r, 0);
                var cr = cumRow || (r + 1);
                put(r, c0, { t: 'n', f: 'IFERROR(AVERAGE(' + L(c0) + cr + ':' + L(c0 + N - 1) + cr + '),"")', s: sty(tpl.styleAt(r, c0)) });
                for (var j4 = 1; j4 < N; j4++)
                    put(r, c0 + j4, { t: 's', v: '', s: sty(tpl.styleAt(r, c0)) });
                put(r, avgOut, { t: 's', v: '', s: sty(tpl.styleAt(r, tpl.avgColTmpl)) });
                continue;
            }
            if (tpl.rowEmpty(r)) {
                put(r, 0, { t: 's', v: '', s: sty(tpl.styleAt(r, 0)) });
                for (var j5 = 0; j5 < N; j5++)
                    put(r, c0 + j5, { t: 's', v: '', s: sty(tpl.styleAt(r, c0)) });
                put(r, avgOut, { t: 's', v: '', s: sty(tpl.styleAt(r, tpl.avgColTmpl)) });
                continue;
            }
            copyAt(r, 0, r, 0);
            var colIdx = itemMap.hasOwnProperty(A) ? itemMap[A] : -1;
            for (var j6 = 0; j6 < N; j6++) {
                var v = colIdx >= 0 ? scoreOf(students[j6][colIdx]) : null;
                put(r, c0 + j6, v == null ? { t: 's', v: '', s: sty(tpl.styleAt(r, c0)) } : { t: 'n', v: v, s: sty(tpl.styleAt(r, c0)) });
            }
            var R = r + 1;
            put(r, avgOut, { t: 'n', f: 'IFERROR(AVERAGE(' + L(c0) + R + ':' + L(c0 + N - 1) + R + '),"")', s: sty(tpl.styleAt(r, tpl.avgColTmpl)) });
            blockCrit.push(R);
        }
        function mapCol(c) { if (c < c0)
            return c; if (c < tpl.avgColTmpl) {
            var rel = c - c0;
            return c0 + Math.min(rel, N - 1);
        } if (c === tpl.avgColTmpl)
            return avgOut; return c + delta; }
        out['!merges'] = tpl.merges.map(function (m) { return { s: { r: m.s.r, c: mapCol(m.s.c) }, e: { r: m.e.r, c: mapCol(m.e.c) } }; });
        var cols = [];
        for (var c2 = 0; c2 < c0; c2++)
            cols.push(tpl.cols[c2] || {});
        var sw = tpl.cols[c0] || { wch: 5 };
        for (var j7 = 0; j7 < N; j7++)
            cols.push({ wch: sw.wch, width: sw.width });
        var aw = tpl.cols[tpl.avgColTmpl] || { wch: 10 };
        cols.push({ wch: aw.wch, width: aw.width });
        out['!cols'] = cols;
        if (tpl.rows && tpl.rows.length)
            out['!rows'] = JSON.parse(JSON.stringify(tpl.rows));
        out['!ref'] = XLSX.utils.encode_range({ s: { r: tpl.range.s.r, c: 0 }, e: { r: tpl.range.e.r, c: avgOut } });
        return out;
    }
    function normPhrase(s) { return String(s == null ? '' : s).replace(/^[A-Za-z]\.\:?\s*/, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim(); }
    function tokens(s) { return normPhrase(s).split(' ').filter(Boolean); }
    function similarity(a, b) {
        var ta = tokens(a), tb = tokens(b);
        if (!ta.length || !tb.length)
            return 0;
        var setb = {};
        tb.forEach(function (t) { setb[t] = 1; });
        var inter = 0;
        ta.forEach(function (t) { if (setb[t])
            inter++; });
        return inter / (ta.length + tb.length - inter);
    }
    function charSimilarity(a, b) {
        a = String(a || '').toLowerCase();
        b = String(b || '').toLowerCase();
        var la = a.length, lb = b.length;
        if (!la || !lb)
            return 0;
        if (a === b)
            return 1;
        var d = [], i, j;
        for (i = 0; i <= la; i++) {
            d[i] = [i];
        }
        for (j = 0; j <= lb; j++) {
            d[0][j] = j;
        }
        for (i = 1; i <= la; i++) {
            for (j = 1; j <= lb; j++) {
                d[i][j] = a[i - 1] === b[j - 1] ? d[i - 1][j - 1] : 1 + Math.min(d[i - 1][j], d[i][j - 1], d[i - 1][j - 1]);
            }
        }
        return 1 - d[la][lb] / Math.max(la, lb);
    }
    function matchCriteria(allCriteria, items) {
        var used = {}, map = {};
        allCriteria.forEach(function (crit) {
            var best = -1, bestS = 0.34;
            items.forEach(function (it, k) { if (used[k])
                return; var sc = similarity(crit, it.header); if (sc > bestS) {
                bestS = sc;
                best = k;
            } });
            if (best >= 0) {
                map[crit] = items[best].index;
                used[best] = 1;
            }
        });
        var k2 = 0;
        allCriteria.forEach(function (crit) {
            if (map.hasOwnProperty(crit))
                return;
            while (k2 < items.length && used[k2])
                k2++;
            if (k2 < items.length) {
                map[crit] = items[k2].index;
                used[k2] = 1;
                k2++;
            }
        });
        return map;
    }
    var SECTION_STOP = { grade: 1, stem: 1, class: 1, adviser: 1, section: 1, the: 1, of: 1, hs: 1, shs: 1, jhs: 1, level: 1 };
    function sectionInfo(raw) {
        var s = String(raw == null ? '' : raw).toLowerCase();
        var gradeNum = (s.match(/\b(1[0-2]|[1-9])\b/) || [])[1] || '';
        var toks = s.replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter(function (t) { return t && !/^\d+$/.test(t) && !SECTION_STOP[t]; });
        var disp = toks.map(function (t) { return t.charAt(0).toUpperCase() + t.slice(1); }).join(' ');
        return { key: toks.join(' ').trim() || '__unsorted__', display: disp || 'Unsorted', gradeNum: gradeNum };
    }
    var TYPO = { teh: 'the', recieve: 'receive', definately: 'definitely', alot: 'a lot', verry: 'very', goood: 'good', gud: 'good', nyc: 'nice', niceu: 'nice', tnx: 'thanks', ty: 'thank you', maam: 'ma\u2019am', mam: 'ma\u2019am' };
    function matchCase(orig, repl) { return /^[A-Z]/.test(orig) ? repl.charAt(0).toUpperCase() + repl.slice(1) : repl; }
    function spellFix(text) { return String(text).replace(/[A-Za-z\u2019']+/g, function (w) { var low = w.toLowerCase(); return TYPO[low] ? matchCase(w, TYPO[low]) : w; }); }
    function commentKey(text) { return spellFix(text).toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/(.)\1{2,}/g, '$1$1').replace(/\s+/g, ' ').trim(); }
    function groupComments(list) {
        var map = {};
        list.forEach(function (raw) {
            var fixed = spellFix(String(raw).trim());
            if (!fixed)
                return;
            var k = commentKey(fixed);
            if (!k)
                return;
            if (!map[k])
                map[k] = { display: fixed, count: 0 };
            map[k].count++;
            if (fixed.length < map[k].display.length)
                map[k].display = fixed;
        });
        var arr = Object.keys(map).map(function (k) { return map[k]; });
        var repeated = arr.filter(function (x) { return x.count >= 2; }).sort(function (a, b) { return b.count - a.count || a.display.length - b.display.length; });
        var singles = arr.filter(function (x) { return x.count < 2; }).sort(function (a, b) { return a.display.length - b.display.length; });
        return { repeated: repeated, singles: singles, total: list.length };
    }
    function commentsText(grouped) {
        var out = [];
        grouped.repeated.forEach(function (c) { out.push(c.display + ' (' + c.count + ')'); });
        if (grouped.repeated.length && grouped.singles.length)
            out.push('');
        grouped.singles.forEach(function (c) { out.push(c.display); });
        return out.join('\n');
    }
    function dominantSection(rows, sectionIdx) {
        if (sectionIdx < 0)
            return '';
        var counts = {}, best = '', bestN = 0;
        rows.forEach(function (r) {
            var v = String(r[sectionIdx] == null ? '' : r[sectionIdx]).trim();
            if (!v)
                return;
            counts[v] = (counts[v] || 0) + 1;
            if (counts[v] > bestN) {
                bestN = counts[v];
                best = v;
            }
        });
        return best;
    }
    function buildSection(grade, teacher, subject, merged) {
        var tpl = parseTemplate(grade);
        var cols = detectColumns(merged.headers, merged.rows);
        if (!cols.items.length)
            throw new Error('No 1–4 score questions were detected in the file. Make sure it is the Google-Form responses export.');
        var itemMap = matchCriteria(tpl.allCriteria, cols.items);
        var matched = Object.keys(itemMap).length;
        var students = merged.rows;
        var info = sectionInfo(dominantSection(merged.rows, cols.section));
        var secLabel = (info.gradeNum ? info.gradeNum + ' - ' : '') + info.display;
        var ws = buildSectionSheet(tpl, teacher, subject, secLabel, students, itemMap);
        var comments = [];
        cols.comments.forEach(function (ci) { students.forEach(function (r) { var v = String(r[ci] == null ? '' : r[ci]).trim(); if (v)
            comments.push(v); }); });
        var lines = [];
        tpl.allCriteria.forEach(function (crit) {
            var ci = itemMap.hasOwnProperty(crit) ? itemMap[crit] : -1, sc = [];
            if (ci >= 0)
                students.forEach(function (r) { var v = scoreOf(r[ci]); if (v != null)
                    sc.push(v); });
            lines.push({ crit: crit, block: (tpl.critBlock && tpl.critBlock[crit]) || '', scores: sc });
        });
        var perStudent = students.map(function (r) {
            var vals = [];
            tpl.allCriteria.forEach(function (crit) { var ci = itemMap[crit]; if (ci != null) {
                var v = scoreOf(r[ci]);
                if (v != null)
                    vals.push(v);
            } });
            return vals.length ? vals.reduce(function (a, b) { return a + b; }, 0) / vals.length : null;
        }).filter(function (x) { return x != null; });
        var overall = perStudent.length ? round2(perStudent.reduce(function (a, b) { return a + b; }, 0) / perStudent.length) : null;
        var blockAverages = blockAvgsFromLines(tpl.blocks || [], lines);
        return { secLabel: secLabel, gradeNum: info.gradeNum, ws: ws, students: students.length, overall: overall, lines: lines, blockAverages: blockAverages, comments: comments, matched: matched, totalCriteria: tpl.allCriteria.length, blocks: (tpl.blocks || []).slice() };
    }
    function gradeTagOf(grade) { return grade.label.replace('Senior High School', 'SHS').replace('Junior High School', 'JHS'); }
    function sectionLetter(i) { var s = '', n = i + 1; while (n > 0) {
        var m = (n - 1) % 26;
        s = String.fromCharCode(65 + m) + s;
        n = (n - m - 1) / 26;
    } return s; }
    function deriveSubject(merged) { var cols = detectColumns(merged.headers, merged.rows); if (cols.subject < 0)
        return ''; return dominantSection(merged.rows, cols.subject) || ''; }
    function normalizeTeacherName(name) {
        if (!name)
            return '';
        if (name.length > 60 && name.indexOf('http') >= 0) {
            var ci = name.indexOf(':text=');
            if (ci >= 0) {
                var raw = name.slice(ci + 6).split('&')[0].split('#')[0];
                try {
                    name = decodeURIComponent(raw.replace(/\+/g, ' '));
                }
                catch (e) {
                    name = '';
                }
            }
            else {
                name = '';
            }
        }
        if (!name.trim())
            return '(Unknown)';
        name = name.trim();
        while (name.indexOf('  ') >= 0)
            name = name.split('  ').join(' ');
        name = name.split(' ').map(function (w) { return w.length ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ''; }).join(' ');
        name = name.replace(/\b([a-z])\./g, function (m, c) { return c.toUpperCase() + '.'; });
        if (name.toLowerCase().indexOf('miss') === 0) {
            var rest = name.slice(4);
            while (rest.length && (rest.charAt(0) === '.' || rest.charAt(0) === ' '))
                rest = rest.slice(1);
            name = 'Ms. ' + rest;
        }
        if (/^Ms [A-Z]/.test(name))
            name = 'Ms. ' + name.slice(3);
        if (/^Mr [A-Z]/.test(name))
            name = 'Mr. ' + name.slice(3);
        if (/^Mrs [A-Z]/.test(name))
            name = 'Mrs. ' + name.slice(4);
        name = name.split(' ').map(function (p) {
            return (p.length > 4 && p.charAt(p.length - 1) === '.') ? p.slice(0, -1) : p;
        }).join(' ');
        return name.trim();
    }
    function addSection(grade, teacher, subject, sec) {
        teacher = normalizeTeacherName(teacher || '');
        for (var _i = 0; _i < built.length; _i++) {
            if (built[_i].teacher && Math.max(similarity(teacher, built[_i].teacher), charSimilarity(teacher, built[_i].teacher)) > 0.82) {
                teacher = built[_i].teacher;
                break;
            }
        }
        var key = (teacher || '') + '||' + (subject || '') + '||' + grade.key;
        var result = null, i;
        for (i = 0; i < built.length; i++) {
            if (built[i].key === key) {
                result = built[i];
                built.splice(i, 1);
                break;
            }
        }
        if (!result) {
            result = { uid: ++uidc, key: key, teacher: teacher, subject: subject, gradeLabel: grade.label, gradeKey: grade.key, gradeTag: gradeTagOf(grade), sections: [], comments: [], _used: {} };
        }
        sec.tab = uniqName(sec.secLabel, result._used);
        result.sections.push(sec);
        result.comments = result.comments.concat(sec.comments || []);
        finalizeGroup(result);
        built.unshift(result);
        saveBuilt();
        return result;
    }
    function finalizeGroup(result) {
        var wbOut = XLSX.utils.book_new();
        result.sections.forEach(function (s) { XLSX.utils.book_append_sheet(wbOut, s.ws, s.tab); });
        if (result.sections.length >= 2) {
            XLSX.utils.book_append_sheet(wbOut, buildSummarySheet(result), 'SUMMARY');
        }
        result.grouped = groupComments(result.comments);
        result.commentsText = commentsText(result.grouped);
        var agg = aggregateAcrossSections([result]);
        result.overall = agg.overall;
        result.blockAverages = agg.blockAverages;
        result.students = agg.students;
        result.matched = result.sections.reduce(function (m, s) { return Math.max(m, s.matched || 0); }, 0);
        result.totalCriteria = result.sections.length ? result.sections[0].totalCriteria : 0;
        result.fileName = safeName(result.teacher) + (result.subject ? ' - ' + safeName(result.subject) : '') + ' - ' + safeName(result.gradeTag) + '.xlsx';
        var outArr = XLSX.write(wbOut, { bookType: 'xlsx', type: 'array', cellStyles: true });
        result._xls64 = uint8ArrayToBase64(outArr);
        result.blob = new Blob([outArr], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }
    function buildSummarySheet(result) {
        var secs = result.sections;
        var labels = secs.map(function (s, i) { return ((result.gradeTag ? result.gradeTag + ' ' : '') + (s.gradeNum || '') + sectionLetter(i)).trim(); });
        function critAvg(s, crit) { for (var i = 0; i < s.lines.length; i++) {
            if (s.lines[i].crit === crit) {
                var sc = s.lines[i].scores;
                return sc.length ? (sc.reduce(function (a, b) { return a + b; }, 0) / sc.length) : null;
            }
        } return null; }
        function mean(arr) { var v = arr.filter(function (x) { return x != null; }); return v.length ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : null; }
        function r2(x) { return x == null ? '' : Math.round(x * 100) / 100; }
        var first = secs[0];
        var blockOrder = (first.blocks && first.blocks.length) ? first.blocks.slice() : [];
        var critByBlock = {};
        first.lines.forEach(function (ln) { var bl = ln.block || 'Criteria'; (critByBlock[bl] = critByBlock[bl] || []).push(ln.crit); if (blockOrder.indexOf(bl) < 0)
            blockOrder.push(bl); });
        var aoa = [];
        aoa.push(['SUMMARY  —  ' + result.teacher + (result.subject ? '  ·  ' + result.subject : '') + '  ·  ' + result.gradeLabel]);
        aoa.push([]);
        aoa.push(['LEGEND', '', 'Section']);
        secs.forEach(function (s, i) { aoa.push([labels[i], '=', s.secLabel + '  (' + s.students + ' student' + (s.students === 1 ? '' : 's') + ')']); });
        aoa.push([]);
        blockOrder.forEach(function (bl) {
            var crits = critByBlock[bl] || [];
            if (!crits.length)
                return;
            aoa.push([prettyBlock(bl)].concat(labels).concat(['AVE']));
            var perSec = secs.map(function () { return []; });
            crits.forEach(function (crit) {
                var row = [crit.length > 70 ? crit.slice(0, 70) + '…' : crit], rowVals = [];
                secs.forEach(function (s, si) { var av = critAvg(s, crit); perSec[si].push(av); rowVals.push(av); row.push(r2(av)); });
                row.push(r2(mean(rowVals)));
                aoa.push(row);
            });
            var bRow = ['Block average'], bAvgs = [];
            secs.forEach(function (s, si) { var av = mean(perSec[si]); bAvgs.push(av); bRow.push(r2(av)); });
            bRow.push(r2(mean(bAvgs)));
            aoa.push(bRow);
            aoa.push([]);
        });
        var ovRow = ['OVERALL AVERAGE'], ovs = [];
        secs.forEach(function (s) { ovs.push(s.overall); ovRow.push(r2(s.overall)); });
        ovRow.push(r2(mean(ovs)));
        aoa.push(ovRow);
        var ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!cols'] = [{ wch: 44 }].concat(labels.map(function () { return { wch: 13 }; })).concat([{ wch: 10 }]);
        return ws;
    }
    function uniqName(name, used) {
        var base = String(name).replace(/[\\\/\?\*\[\]:]/g, ' ').trim().slice(0, 28) || 'Section';
        var n = base, i = 2;
        while (used[n.toLowerCase()])
            n = base.slice(0, 24) + ' ' + (i++);
        used[n.toLowerCase()] = 1;
        return n;
    }
    function safeName(s) { return String(s || 'file').replace(/[^\w\- ]+/g, '').replace(/\s+/g, ' ').trim() || 'file'; }
    function triggerDownload(result) {
        var url = URL.createObjectURL(result.blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = result.fileName;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 150);
    }
    function renderResult(result) {
        var host = document.getElementById('ebResults');
        if (!host)
            return;
        var agg = aggregateAcrossSections([result]);
        var html = '<div class="eb-res">';
        html += '<div class="eb-res-h"><div><strong>' + esc(result.teacher) + '</strong> — ' + esc(result.gradeLabel) +
            (result.subject ? ' · ' + esc(result.subject) : '') +
            '<br><small>' + agg.students + ' respondent(s) · ' + result.sections.length + ' section(s) · ' + result.matched + '/' + result.totalCriteria + ' criteria matched</small></div>' +
            '<div class="eb-res-btns"><button class="mbtn mbtn-pr" data-dl="1">Download .xlsx</button><button class="mbtn mbtn-cl" data-view="1">Open</button></div></div>';
        html += blockAvgCardsHtml(agg.blockAverages, agg.overall);
        html += '<div class="eb-res-hint">Tap <strong>Open</strong> for the full segregated breakdown, comments and calculator.</div>';
        html += '</div>';
        host.innerHTML = html;
        host.querySelector('[data-dl]').onclick = function () { triggerDownload(result); };
        host.querySelector('[data-view]').onclick = function () { viewResult(result); };
    }
    var EVAL_ICON = '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="24" height="24"><path d="M3 3v18h18"/><rect x="7" y="10" width="3" height="7"/><rect x="12" y="6" width="3" height="11"/><rect x="17" y="13" width="3" height="4"/></svg>';
    function drawBuilt() {
        var wrap = document.getElementById('ebBuiltWrap');
        if (!wrap)
            return;
        if (!built.length) {
            wrap.innerHTML = '';
            return;
        }
        var order = [], byTeacher = {};
        built.forEach(function (r, i) { var t = r.teacher || 'Teacher'; if (!byTeacher[t]) {
            byTeacher[t] = [];
            order.push(t);
        } byTeacher[t].push(i); });
        var html = '<div class="eb-built-h">Teacher summaries <small>one button per teacher &mdash; open a file for the full view before downloading</small></div>';
        order.forEach(function (t) {
            var idxs = byTeacher[t];
            var files = idxs.length, students = 0, ovs = [];
            idxs.forEach(function (i) { var a = aggregateAcrossSections([built[i]]); students += a.students; if (a.overall != null)
                ovs.push(a.overall); });
            var ov = ovs.length ? (ovs.reduce(function (a, b) { return a + b; }, 0) / ovs.length) : null;
            html += '<details class="eb-teacher"><summary><span class="eb-teacher-name">' + esc(t) + '</span><span class="eb-teacher-meta">' + files + ' file(s) &middot; ' + students + ' respondent(s)' + (ov == null ? '' : ' &middot; overall ' + ov.toFixed(2)) + '</span></summary><div class="eb-teacher-body">';
            var catOrder = [], byCat = {};
            idxs.forEach(function (i) { var c = built[i].gradeTag || built[i].gradeLabel || 'Other'; if (!byCat[c]) {
                byCat[c] = [];
                catOrder.push(c);
            } byCat[c].push(i); });
            catOrder.forEach(function (c) {
                html += '<div class="eb-grade-group"><div class="eb-grade-h">' + esc(c) + '</div>';
                byCat[c].forEach(function (i) {
                    var r = built[i], a = aggregateAcrossSections([r]);
                    html += '<button class="eb-file-row" data-open="' + i + '"><span class="eb-file-ic">' + EVAL_ICON + '</span><span class="eb-file-main"><span class="eb-file-name">' + esc(r.subject || r.gradeLabel) + '</span><span class="eb-file-sub">' + r.sections.length + ' section(s) &middot; ' + a.students + ' respondent(s)' + (a.overall == null ? '' : ' &middot; overall ' + a.overall.toFixed(2)) + '</span></span><span class="eb-file-go">Open &rsaquo;</span></button>';
                });
                html += '</div>';
            });
            html += '</div></details>';
        });
        wrap.innerHTML = html;
        wrap.querySelectorAll('[data-open]').forEach(function (b) { b.onclick = function () { viewResult(built[+b.getAttribute('data-open')]); }; });
    }
    function pooledSummaryHtml(result) {
        var secs = result.sections;
        if (!secs || secs.length < 2)
            return '';
        var labels = secs.map(function (s, i) { return ((result.gradeTag ? result.gradeTag + ' ' : '') + (s.gradeNum || '') + sectionLetter(i)).trim(); });
        function critAvg(s, crit) { for (var k = 0; k < s.lines.length; k++) {
            if (s.lines[k].crit === crit) {
                var sc = s.lines[k].scores;
                return sc.length ? (sc.reduce(function (a, b) { return a + b; }, 0) / sc.length) : null;
            }
        } return null; }
        function mean(arr) { var v = arr.filter(function (x) { return x != null; }); return v.length ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : null; }
        function f2(x) { return x == null ? '&mdash;' : (Math.round(x * 100) / 100).toFixed(2); }
        var first = secs[0];
        var blockOrder = (first.blocks && first.blocks.length) ? first.blocks.slice() : [];
        var critByBlock = {};
        first.lines.forEach(function (ln) { var bl = ln.block || 'Criteria'; (critByBlock[bl] = critByBlock[bl] || []).push(ln.crit); if (blockOrder.indexOf(bl) < 0)
            blockOrder.push(bl); });
        var h = '<div class="eb-pool"><div class="eb-pool-legend">';
        secs.forEach(function (s, i) { h += '<span class="eb-pool-leg"><span class="eb-seclet">' + esc(labels[i]) + '</span> ' + esc(s.secLabel) + ' (' + s.students + ')</span>'; });
        h += '</div><div class="tw"><table><thead><tr><th>Criteria</th>';
        labels.forEach(function (l) { h += '<th>' + esc(l) + '</th>'; });
        h += '<th>AVE</th></tr></thead><tbody>';
        blockOrder.forEach(function (bl) {
            var crits = critByBlock[bl] || [];
            if (!crits.length)
                return;
            h += '<tr class="eb-pool-block"><td colspan="' + (labels.length + 2) + '">' + esc(prettyBlock(bl)) + '</td></tr>';
            var perSec = secs.map(function () { return []; });
            crits.forEach(function (crit) {
                h += '<tr><td>' + esc(crit) + '</td>';
                var rowVals = [];
                secs.forEach(function (s, si) { var av = critAvg(s, crit); perSec[si].push(av); rowVals.push(av); h += '<td>' + f2(av) + '</td>'; });
                h += '<td>' + f2(mean(rowVals)) + '</td></tr>';
            });
            h += '<tr class="eb-pool-avg"><td>Block average</td>';
            var bAvgs = [];
            secs.forEach(function (s, si) { var av = mean(perSec[si]); bAvgs.push(av); h += '<td>' + f2(av) + '</td>'; });
            h += '<td>' + f2(mean(bAvgs)) + '</td></tr>';
        });
        h += '<tr class="eb-pool-overall"><td>OVERALL AVERAGE</td>';
        var ovs = [];
        secs.forEach(function (s) { ovs.push(s.overall); h += '<td>' + f2(s.overall) + '</td>'; });
        h += '<td>' + f2(mean(ovs)) + '</td></tr></tbody></table></div></div>';
        return h;
    }
    function wsToHtmlTable(ws) {
        if (!ws || !ws['!ref'])
            return '<p style="padding:16px;color:#888">No worksheet data.</p>';
        var rng = XLSX.utils.decode_range(ws['!ref']);
        var merges = ws['!merges'] || [];
        var wcols = ws['!cols'] || [];
        var wrows = ws['!rows'] || [];
        var mmap = {};
        merges.forEach(function (m) {
            for (var mr = m.s.r; mr <= m.e.r; mr++) {
                for (var mc2 = m.s.c; mc2 <= m.e.c; mc2++) {
                    var mk = mr + ':' + mc2;
                    mmap[mk] = (mr === m.s.r && mc2 === m.s.c) ? { cs: m.e.c - m.s.c + 1, rs: m.e.r - m.s.r + 1 } : { skip: true };
                }
            }
        });
        function computeVal(cell) {
            if (!cell)
                return '';
            if (cell.v != null)
                return cell.v;
            if (!cell.f)
                return '';
            var m = cell.f.match(/AVERAGE\(([^)]+)\)/i);
            if (!m)
                return '';
            var vals = [];
            m[1].split(',').forEach(function (ref) {
                ref = ref.trim();
                if (ref.indexOf(':') >= 0) {
                    var r2 = XLSX.utils.decode_range(ref);
                    for (var ri2 = r2.s.r; ri2 <= r2.e.r; ri2++) {
                        for (var ci2 = r2.s.c; ci2 <= r2.e.c; ci2++) {
                            var cx = ws[XLSX.utils.encode_cell({ r: ri2, c: ci2 })];
                            if (cx && typeof cx.v === 'number')
                                vals.push(cx.v);
                        }
                    }
                }
                else if (/^[A-Z]+[0-9]+$/.test(ref)) {
                    var cx2 = ws[ref];
                    if (cx2 && typeof cx2.v === 'number')
                        vals.push(cx2.v);
                }
            });
            if (!vals.length)
                return '';
            return Math.round(vals.reduce(function (a, b) { return a + b; }, 0) / vals.length * 100) / 100;
        }
        function hexRgb(rgb) {
            if (!rgb || rgb === 'auto')
                return null;
            var r = String(rgb).toUpperCase();
            if (r === '00000000' || r === '' || r === 'FFFFFF' || r === 'FFFFFFFF')
                return null;
            return '#' + (r.length === 8 ? r.slice(2) : r);
        }
        function bdrCss(b, side) {
            if (!b || !b[side] || !b[side].style)
                return '';
            var w = b[side].style === 'thin' ? '1px' : b[side].style === 'medium' ? '2px' : '1px';
            var col = '#ccc';
            if (b[side].color && b[side].color.rgb) {
                var cr = b[side].color.rgb;
                col = '#' + (cr.length === 8 ? cr.slice(2) : cr);
            }
            return 'border-' + side + ':' + w + ' solid ' + col + ';';
        }
        var html = '<table class="ws-tbl" cellspacing="0"><colgroup>';
        for (var ci0 = rng.s.c; ci0 <= rng.e.c; ci0++) {
            var cw = wcols[ci0];
            var wpx = cw ? (cw.wpx || (cw.wch ? Math.round(cw.wch * 7.5) : 72)) : 72;
            html += '<col style="width:' + wpx + 'px">';
        }
        html += '</colgroup><tbody>';
        for (var ri0 = rng.s.r; ri0 <= rng.e.r; ri0++) {
            var rh = wrows[ri0];
            var rhpx = rh ? (rh.hpx || (rh.hpt ? Math.round(rh.hpt * 1.33) : 18)) : 18;
            html += '<tr style="height:' + rhpx + 'px">';
            for (var ci1 = rng.s.c; ci1 <= rng.e.c; ci1++) {
                var mmk = ri0 + ':' + ci1;
                if (mmap[mmk] && mmap[mmk].skip)
                    continue;
                var addr = XLSX.utils.encode_cell({ r: ri0, c: ci1 });
                var cell = ws[addr];
                var s = cell && cell.s;
                var val = computeVal(cell);
                var disp = val === '' ? '' : (typeof val === 'number' ? (val === Math.floor(val) ? String(val) : val.toFixed(2)) : esc(String(val)));
                var st = 'overflow:hidden;white-space:nowrap;padding:2px 4px;font-size:11px;font-family:Calibri,Arial,sans-serif;vertical-align:middle;';
                if (s) {
                    var bg = (s.fill && s.fill.fgColor) ? hexRgb(s.fill.fgColor.rgb) : null;
                    if (bg)
                        st += 'background:' + bg + ';';
                    if (s.font) {
                        if (s.font.bold)
                            st += 'font-weight:bold;';
                        var fc = s.font.color ? hexRgb(s.font.color.rgb) : null;
                        if (fc)
                            st += 'color:' + fc + ';';
                        if (s.font.sz)
                            st += 'font-size:' + Math.max(9, Math.round(s.font.sz)) + 'px;';
                    }
                    if (s.alignment) {
                        if (s.alignment.horizontal)
                            st += 'text-align:' + s.alignment.horizontal + ';';
                        if (s.alignment.vertical === 'center')
                            st += 'vertical-align:middle;';
                        if (s.alignment.wrapText)
                            st += 'white-space:pre-wrap;word-break:break-word;';
                    }
                    if (s.border) {
                        st += bdrCss(s.border, 'top');
                        st += bdrCss(s.border, 'right');
                        st += bdrCss(s.border, 'bottom');
                        st += bdrCss(s.border, 'left');
                    }
                    else {
                        st += 'border:1px solid #ddd;';
                    }
                }
                else {
                    st += 'border:1px solid #ddd;';
                }
                var tdA = ' style="' + st + '"';
                var mme = mmap[mmk];
                if (mme) {
                    if (mme.cs > 1)
                        tdA += ' colspan="' + mme.cs + '"';
                    if (mme.rs > 1)
                        tdA += ' rowspan="' + mme.rs + '"';
                }
                html += '<td' + tdA + '>' + disp + '</td>';
            }
            html += '</tr>';
        }
        html += '</tbody></table>';
        return html;
    }
    function viewResult(result) {
        var prev = document.getElementById('ebPageView');
        if (prev && prev.parentNode)
            prev.parentNode.removeChild(prev);
        var pv = document.createElement('div');
        pv.className = 'eb-page';
        pv.id = 'ebPageView';
        var sheets = result.sections.map(function (s) { return { label: s.tab, ws: s.ws }; });
        if (result.sections.length >= 2)
            sheets.push({ label: 'SUMMARY', ws: buildSummarySheet(result) });
        var h = '<div class="eb-page-bar">';
        h += '<button class="eb-page-back" data-x="1">&lsaquo; Back</button>';
        h += '<span class="eb-page-ic">' + EVAL_ICON + '</span>';
        h += '<div class="eb-page-ttl"><div class="eb-page-h">' + esc(result.teacher) + '</div>';
        h += '<div class="eb-page-sub">' + esc(result.gradeLabel) + (result.subject ? ' &middot; ' + esc(result.subject) : '') + ' &middot; ' + esc(result.fileName) + '</div></div>';
        h += '<div class="eb-page-acts"><button class="mbtn mbtn-pr" data-dl="1">Download .xlsx</button><button class="mbtn mbtn-cl" data-tr="1">Send to tracker</button></div>';
        h += '</div>';
        h += '<div class="eb-sheet-tabs">';
        sheets.forEach(function (sh, i) { h += '<button class="eb-tab' + (i === 0 ? ' eb-tab-a' : '') + '" data-tab="' + i + '">' + esc(sh.label) + '</button>'; });
        h += '</div>';
        h += '<div class="eb-page-body">';
        sheets.forEach(function (sh, i) {
            h += '<div class="eb-sheet-panel" id="ebPanel__' + i + '" style="' + (i === 0 ? '' : 'display:none') + '"><div class="eb-sheet-scroll">' + wsToHtmlTable(sh.ws) + '</div></div>';
        });
        h += '<div class="eb-view-sec" style="margin-top:16px"><div class="eb-view-sec-h">Comments <small>' + (result.comments ? result.comments.length : 0) + ' collected</small></div>';
        h += '<div class="eb-cm"><div class="eb-cm-bar"><span>Sorted: repeats first, then shortest. No timestamps.</span><button class="tbtn" data-cmcopy="1">Copy</button></div>';
        h += '<textarea class="eb-cm-ta" id="ebVCm" readonly rows="7">' + esc(result.commentsText || '') + '</textarea></div></div>';
        h += '<div class="eb-view-sec"><div class="eb-view-sec-h">Quick calculator <small>paste any numbers to cross-check averages</small></div>';
        h += '<div class="eb-calc-tool"><textarea id="ebVCalc" class="eb-calc-ta" rows="2" placeholder="e.g. 4, 3, 4, 2"></textarea><div class="eb-calc-out" id="ebVCalcOut"></div></div></div>';
        h += '<div class="eb-page-ft"><button class="mbtn mbtn-pr" data-dl="1">Download .xlsx</button><button class="mbtn mbtn-cl" data-x="1">Close</button></div>';
        h += '</div>';
        pv.innerHTML = h;
        document.body.appendChild(pv);
        document.body.style.overflow = 'hidden';
        function closePv() { if (pv.parentNode)
            pv.parentNode.removeChild(pv); document.body.style.overflow = ''; }
        pv.querySelectorAll('[data-x]').forEach(function (b) { b.onclick = closePv; });
        pv.querySelectorAll('[data-dl]').forEach(function (b) { b.onclick = function () { triggerDownload(result); }; });
        var trbtn = pv.querySelector('[data-tr]');
        if (trbtn)
            trbtn.onclick = function () { sendToTracker(result); };
        pv.querySelectorAll('[data-tab]').forEach(function (b) {
            b.onclick = function () {
                var ti = +b.getAttribute('data-tab');
                pv.querySelectorAll('.eb-tab').forEach(function (t) { t.className = t.className.replace(/ eb-tab-a/g, ''); });
                b.className += ' eb-tab-a';
                for (var pi = 0; pi < sheets.length; pi++) {
                    var panel = document.getElementById('ebPanel__' + pi);
                    if (panel)
                        panel.style.display = pi === ti ? '' : 'none';
                }
            };
        });
        var cb = pv.querySelector('[data-cmcopy]');
        if (cb)
            cb.onclick = function () {
                var ta = document.getElementById('ebVCm');
                if (ta) {
                    ta.select();
                    try {
                        document.execCommand('copy');
                    }
                    catch (e) { }
                }
                if (navigator.clipboard) {
                    try {
                        navigator.clipboard.writeText(result.commentsText || '');
                    }
                    catch (e) { }
                }
                if (ui.toast)
                    ui.toast('Comments copied.', 'ok');
            };
        var ci = document.getElementById('ebVCalc'), co = document.getElementById('ebVCalcOut');
        function vcalc() {
            var nums = (ci.value.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
            if (!nums.length) {
                co.textContent = 'Count 0  -  Average -';
                return;
            }
            var sum = nums.reduce(function (a, b) { return a + b; }, 0);
            co.textContent = 'Count ' + nums.length + '  -  Sum ' + round2(sum) + '  -  Average ' + (sum / nums.length).toFixed(2);
        }
        if (ci) {
            ci.oninput = vcalc;
            vcalc();
        }
    }
    function prettyBlock(s) { s = String(s || '').trim(); if (!s)
        return 'Overall'; return s.toLowerCase().replace(/(^|\s)([a-z])/g, function (m, p, c) { return p + c.toUpperCase(); }); }
    function blockAvgsFromLines(blocks, lines) {
        var map = {};
        (lines || []).forEach(function (ln) { if (!ln.block)
            return; (map[ln.block] = map[ln.block] || []).push.apply(map[ln.block], ln.scores); });
        var order = (blocks && blocks.length) ? blocks.slice() : Object.keys(map);
        return order.map(function (b) { var a = map[b] || []; return { label: b, avg: a.length ? round2(a.reduce(function (x, y) { return x + y; }, 0) / a.length) : null, responses: a.length }; });
    }
    function blockAvgCardsHtml(blockAverages, overall) {
        var h = '<div class="eb-avg-row">';
        (blockAverages || []).forEach(function (b) { h += '<div class="eb-avg-card"><div class="eb-avg-lbl">' + esc(prettyBlock(b.label)) + '</div><div class="eb-avg-val">' + (b.avg == null ? '—' : b.avg.toFixed(2)) + '</div><div class="eb-avg-sub">avg of ' + b.responses + ' response(s)</div></div>'; });
        h += '<div class="eb-avg-card eb-avg-overall"><div class="eb-avg-lbl">Overall</div><div class="eb-avg-val">' + (overall == null ? '—' : overall.toFixed(2)) + '</div><div class="eb-avg-sub">avg of student averages</div></div>';
        return h + '</div>';
    }
    function aggregateAcrossSections(results) {
        var allLines = [], blocks = [], ovs = [], students = 0;
        (results || []).forEach(function (res) { (res.sections || []).forEach(function (s) { (s.lines || []).forEach(function (ln) { allLines.push(ln); }); if (s.overall != null)
            ovs.push(s.overall); students += (s.students || 0); (s.blockAverages || []).forEach(function (b) { if (blocks.indexOf(b.label) < 0)
            blocks.push(b.label); }); }); });
        var overall = ovs.length ? round2(ovs.reduce(function (a, b) { return a + b; }, 0) / ovs.length) : null;
        return { blockAverages: blockAvgsFromLines(blocks, allLines), overall: overall, students: students };
    }
    function sendToTracker(result) {
        if (!SMC.api || !SMC.api.saveEvaluation) {
            if (ui.toast)
                ui.toast('Tracker is unavailable.', 'err');
            return;
        }
        var s0 = { blockAverages: result.blockAverages, overall: result.overall, students: result.students, label: (result.sections[0] || {}).label };
        var parts = (s0.blockAverages || []).map(function (b) { return prettyBlock(b.label) + ': ' + (b.avg == null ? '—' : b.avg.toFixed(2)); });
        var note = 'Overall ' + (s0.overall == null ? '—' : s0.overall.toFixed(2)) + (parts.length ? ' · ' + parts.join(' · ') : '') + ' · ' + (s0.students || 0) + ' respondent(s)';
        var title = result.teacher + (result.subject ? ' — ' + result.subject : '') + ' (' + result.gradeLabel + ')';
        SMC.api.saveEvaluation({ title: title, teacher: result.teacher, period: result.subject || s0.label || '', status: 'Done', notes: note }).then(function () { if (ui.toast)
            ui.toast('Sent to the evaluation tracker.', 'ok'); if (SMC.app && SMC.app.refreshEvalStats)
            SMC.app.refreshEvalStats(); if (SMC.evaluations && SMC.evaluations.load)
            SMC.evaluations.load(); }).catch(function (e) { if (ui.toast)
            ui.toast((e && e.message) || 'Could not send to tracker.', 'err'); });
    }
    function clean(rows) { return (rows || []).filter(function (r) { return r && r.some(function (c) { return String(c == null ? '' : c).trim() !== ''; }); }); }
    function normKey(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim(); }
    function scoreOf(v) {
        if (v == null)
            return null;
        var s = String(v).trim();
        if (!s)
            return null;
        var num = s.replace(',', '.');
        if (/^[1-5](\.\d+)?$/.test(num)) {
            var nn = Number(num);
            return (nn >= 1 && nn <= 5) ? nn : null;
        }
        var lead = s.match(/^\s*([1-5])\b/);
        if (lead)
            return Number(lead[1]);
        var low = s.toLowerCase();
        if (/enhancement/.test(low))
            return 4;
        if (/consistently/.test(low))
            return 3;
        if (/needs improvement|but needs|needs work/.test(low))
            return 2;
        if (/not done|plan to accomplish|has the plan|has a plan/.test(low))
            return 1;
        return null;
    }
    function sniffDelim(text) {
        var nl = text.indexOf('\n');
        var first = nl >= 0 ? text.slice(0, nl) : text;
        var counts = { ',': 0, ';': 0, '\t': 0 }, inQ = false;
        for (var i = 0; i < first.length; i++) {
            var ch = first.charAt(i);
            if (ch === '"')
                inQ = !inQ;
            else if (!inQ && counts.hasOwnProperty(ch))
                counts[ch]++;
        }
        var best = ',', bn = counts[','];
        if (counts[';'] > bn) {
            best = ';';
            bn = counts[';'];
        }
        if (counts['\t'] > bn)
            best = '\t';
        return best;
    }
    function parseCsv(text) {
        var rows = [], row = [], field = '', i = 0, inQ = false, c;
        text = String(text).replace(/^\uFEFF/, '');
        var delim = sniffDelim(text);
        while (i < text.length) {
            c = text.charAt(i);
            if (inQ) {
                if (c === '"') {
                    if (text.charAt(i + 1) === '"') {
                        field += '"';
                        i += 2;
                        continue;
                    }
                    inQ = false;
                    i++;
                    continue;
                }
                field += c;
                i++;
                continue;
            }
            if (c === '"') {
                inQ = true;
                i++;
                continue;
            }
            if (c === delim) {
                row.push(field);
                field = '';
                i++;
                continue;
            }
            if (c === '\r') {
                i++;
                continue;
            }
            if (c === '\n') {
                row.push(field);
                rows.push(row);
                row = [];
                field = '';
                i++;
                continue;
            }
            field += c;
            i++;
        }
        if (field !== '' || row.length) {
            row.push(field);
            rows.push(row);
        }
        return rows;
    }
    return { mount: mount, drawBuilt: drawBuilt, getBuilt: function () { return built; }, openView: viewResult, download: triggerDownload };
})();
