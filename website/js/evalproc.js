"use strict";
window.SMC = window.SMC || {};
SMC.evalproc = (function () {
    var api = SMC.api, ui = SMC.ui;
    var templates = null;
    var configs = [];
    var editor = null;
    var lastResult = null;
    function saveConfigs() { try {
        localStorage.setItem('smc-ep-configs', JSON.stringify(configs));
    }
    catch (e) { } }
    function loadConfigs() { try {
        var raw = localStorage.getItem('smc-ep-configs');
        if (raw)
            configs = JSON.parse(raw);
    }
    catch (e) {
        configs = [];
    } }
    function saveLastResult() { try {
        if (lastResult)
            localStorage.setItem('smc-ep-last', JSON.stringify(lastResult));
    }
    catch (e) { } }
    function loadLastResult() { try {
        var raw = localStorage.getItem('smc-ep-last');
        if (raw)
            lastResult = JSON.parse(raw);
    }
    catch (e) {
        lastResult = null;
    } }
    loadConfigs();
    loadLastResult();
    function body() { return document.getElementById('evalProcBody'); }
    function esc(s) { return ui.esc(s == null ? '' : s); }
    function render() {
        var host = body();
        if (!host)
            return;
        var existing = document.getElementById('epTabs');
        if (existing) {
            refreshAllTabs();
            return;
        }
        loadConfigs();
        loadLastResult();
        host.innerHTML =
            '<div class="ep-tab-bar" id="epTabs">' +
                '<button class="ep-tab on" data-ep-tab="folder"><svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg><span>Folder</span></button>' +
                '<button class="ep-tab" data-ep-tab="quick"><svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg><span>Quick</span></button>' +
                '<button class="ep-tab" data-ep-tab="saved"><svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg><span>Sources</span></button>' +
                '<button class="ep-tab" data-ep-tab="built"><svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg><span>Built</span>' +
                (function () { try {
                    var b = (window.SMC && SMC.evalbuild && SMC.evalbuild.getBuilt) ? SMC.evalbuild.getBuilt() : [];
                    return b.length ? ' <span class="ep-tab-cnt">' + b.length + '</span>' : '';
                }
                catch (e) {
                    return '';
                } })() + '</button>' +
                '</div>' +
                '<div class="ep-tab-panels">' +
                '<div class="ep-tab-panel on" id="epPanel-folder"><div id="ebMount"></div></div>' +
                '<div class="ep-tab-panel" id="epPanel-quick"><div id="epQuickBox"></div><div id="epQuickResults"></div></div>' +
                '<div class="ep-tab-panel" id="epPanel-saved"><div id="epSavedWrap"></div><div id="epEditWrap"></div></div>' +
                '<div class="ep-tab-panel" id="epPanel-built"></div>' +
                '</div>';
        wireTabs();
        if (window.SMC && SMC.evalbuild && SMC.evalbuild.mount) {
            try {
                SMC.evalbuild.mount();
            }
            catch (e) { }
        }
        var resEl = document.getElementById('ebResults');
        var wrapEl = document.getElementById('ebBuiltWrap');
        var builtEl = document.getElementById('epPanel-built');
        if (resEl && builtEl)
            builtEl.appendChild(resEl);
        if (wrapEl && builtEl)
            builtEl.appendChild(wrapEl);
        document.getElementById('epQuickBox').innerHTML = quickBoxHtml();
        wireQuick();
        drawSaved();
    }
    function wireTabs() {
        document.querySelectorAll('.ep-tab').forEach(function (t) {
            t.onclick = function () {
                var panel = t.getAttribute('data-ep-tab');
                document.querySelectorAll('.ep-tab').forEach(function (b) { b.classList.remove('on'); });
                t.classList.add('on');
                document.querySelectorAll('.ep-tab-panel').forEach(function (p) { p.classList.remove('on'); });
                var pEl = document.getElementById('epPanel-' + panel);
                if (pEl)
                    pEl.classList.add('on');
            };
        });
    }
    function wireQuick() {
        var qb = document.getElementById('epQuickBtn');
        if (qb)
            qb.onclick = quickCompute;
        var fb = document.getElementById('epQuickFileBtn');
        if (fb)
            fb.onclick = quickComputeCsv;
    }
    function refreshAllTabs() {
        if (window.SMC && SMC.evalbuild && SMC.evalbuild.drawBuilt) {
            try {
                SMC.evalbuild.drawBuilt();
            }
            catch (e) { }
        }
        drawSaved();
        var cnt = document.querySelector('.ep-tab-cnt');
        if (cnt) {
            try {
                var b = (window.SMC && SMC.evalbuild && SMC.evalbuild.getBuilt) ? SMC.evalbuild.getBuilt() : [];
                cnt.textContent = b.length;
                cnt.style.display = b.length ? '' : 'none';
            }
            catch (e) {
                cnt.style.display = 'none';
            }
        }
    }
    function quickBoxHtml() {
        return '<div class="ep-quick">' +
            '<label for="epQuickLink">Quick compute \u2014 paste a Google Sheet link, or upload your evaluation file</label>' +
            '<div class="ep-quick-row">' +
            '<input type="text" id="epQuickLink" placeholder="https://docs.google.com/spreadsheets/d/\u2026/edit">' +
            '<button class="mbtn mbtn-pr" id="epQuickBtn">Compute</button>' +
            '</div>' +
            '<div class="ep-quick-or"><span>or</span></div>' +
            '<div class="ep-quick-row">' +
            '<input type="file" id="epQuickFile" accept=".xlsx,.xlsm,.xls,.csv,text/csv" class="ep-quick-file">' +
            '<button class="mbtn mbtn-cl" id="epQuickFileBtn">Compute file</button>' +
            '</div>' +
            '<div class="ep-quick-hint">Upload your filled evaluation <strong>Excel file</strong> (one sheet per teacher, students in columns) or a CSV. It reads every teacher sheet, averages each section and the overall on the 1\u20134 scale, and runs entirely in your browser \u2014 no Google access needed. A Google Form responses sheet (students in rows) also works. Export the results to Excel or a printable report.</div>' +
            '</div>';
    }
    function drawSaved() {
        var wrap = document.getElementById('epSavedWrap');
        if (!wrap)
            return;
        var listHtml = '';
        if (!configs.length) {
            listHtml = '<div class="empty"><svg width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M3 3v18h18"/><rect x="7" y="10" width="3" height="7"/><rect x="12" y="6" width="3" height="11"/></svg><p>No saved sources yet. Use Quick compute above, or click <strong>+ Add Form Source</strong> for full template mapping.</p></div>';
        }
        else {
            listHtml = '<div class="ep-saved-h">Saved sources</div><div class="ep-cards">';
            configs.forEach(function (c) {
                var tName = templateName(c.templateType);
                var itemCount = (c.mapping && c.mapping.items ? c.mapping.items.length : 0);
                listHtml += '<div class="ep-card">' +
                    '<div class="ep-card-h"><strong>' + esc(c.gradeLevel) + '</strong>' +
                    '<span class="badge bt">' + esc(tName) + '</span></div>' +
                    '<div class="ep-card-meta">' + itemCount + ' question(s) mapped' +
                    (c.mapping && c.mapping.teacher ? ' \u00b7 teacher: ' + esc(c.mapping.teacher) : '') + '</div>' +
                    '<div class="ep-card-act">' +
                    '<button class="tbtn bv" data-ep-process="' + esc(c.id) + '">Compute results</button>' +
                    '<button class="tbtn bp" data-ep-edit="' + esc(c.id) + '">Edit</button>' +
                    '<button class="tbtn bdel" data-ep-del="' + esc(c.id) + '">Delete</button>' +
                    '</div></div>';
            });
            listHtml += '</div>';
        }
        wrap.innerHTML = listHtml;
        wrap.querySelectorAll('[data-ep-process]').forEach(function (b) {
            b.onclick = function () { process(b.getAttribute('data-ep-process')); };
        });
        wrap.querySelectorAll('[data-ep-edit]').forEach(function (b) {
            b.onclick = function () { openEditor(findCfg(b.getAttribute('data-ep-edit'))); };
        });
        wrap.querySelectorAll('[data-ep-del]').forEach(function (b) {
            b.onclick = function () { delConfig(b.getAttribute('data-ep-del')); };
        });
    }
    function quickCompute() {
        var link = document.getElementById('epQuickLink').value.trim();
        if (!link) {
            ui.toast('Paste a Google Sheet link first.', 'err');
            return;
        }
        var btn = document.getElementById('epQuickBtn');
        var rHost = document.getElementById('epQuickResults') || document.getElementById('ebResults') || body();
        btn.disabled = true;
        btn.textContent = 'Computing\u2026';
        rHost.innerHTML = '<div class="ep-loading"><div class="spin"></div><span>Reading & computing\u2026</span></div>';
        api.quickProcessEval(link, '').then(function (d) {
            lastResult = d;
            saveLastResult();
            renderResults(d);
            btn.disabled = false;
            btn.textContent = 'Compute';
        }).catch(function (e) {
            btn.disabled = false;
            btn.textContent = 'Compute';
            rHost.innerHTML = '<div class="ferr" style="display:block">' + esc(e.message || 'Could not process that sheet.') + '</div>';
        });
    }
    function quickComputeCsv() {
        var input = document.getElementById('epQuickFile');
        var file = input && input.files && input.files[0];
        if (!file) {
            ui.toast('Choose a file first.', 'err');
            return;
        }
        var btn = document.getElementById('epQuickFileBtn');
        var rHost = document.getElementById('epQuickResults') || document.getElementById('ebResults') || body();
        btn.disabled = true;
        btn.textContent = 'Computing\u2026';
        rHost.innerHTML = '<div class="ep-loading"><div class="spin"></div><span>Reading & computing\u2026</span></div>';
        var nm = String(file.name || '').toLowerCase();
        var isExcel = /\.(xlsx|xlsm|xls)$/.test(nm);
        var label = String(file.name || 'Results').replace(/\.[^.]+$/, '');
        var reader = new FileReader();
        reader.onload = function () {
            try {
                var sheets = isExcel
                    ? readExcelSheets(reader.result)
                    : [{ name: label, rows: cleanRows(parseCsv(reader.result)) }];
                var d = computeFromSheets(sheets, label);
                lastResult = d;
                saveLastResult();
                renderResults(d);
            }
            catch (err) {
                rHost.innerHTML = '<div class="ferr" style="display:block">' + esc(err.message || 'Could not read that file.') + '</div>';
            }
            btn.disabled = false;
            btn.textContent = 'Compute file';
        };
        reader.onerror = function () {
            rHost.innerHTML = '<div class="ferr" style="display:block">Could not read that file.</div>';
            btn.disabled = false;
            btn.textContent = 'Compute file';
        };
        if (isExcel)
            reader.readAsArrayBuffer(file);
        else
            reader.readAsText(file);
    }
    function readExcelSheets(buf) {
        if (!window.XLSX)
            throw new Error('The spreadsheet reader did not load (no internet?). Try again online, or upload a CSV instead.');
        var wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
        return wb.SheetNames.map(function (name) {
            return { name: name, rows: cleanRows(XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', blankrows: false })) };
        });
    }
    function cleanRows(rows) {
        return (rows || []).filter(function (r) { return r && r.some(function (c) { return String(c == null ? '' : c).trim() !== ''; }); });
    }
    function computeFromSheets(sheets, label) {
        var teachers = [];
        sheets.forEach(function (s) {
            var rows = cleanRows(s.rows);
            if (rows.length < 2)
                return;
            if (looksLikeTemplate(rows)) {
                var t = parseTemplateSheet(rows, s.name);
                if (t)
                    teachers.push(t);
            }
            else {
                var headers = rows[0].map(function (h) { return String(h).trim(); });
                var mapping = csvAutoDetect(headers, csvGuessKinds(headers, rows));
                if (mapping.teacher && mapping.items.length) {
                    csvCompute({ gradeLevel: label, templateType: '', mapping: mapping }, rows, headers).teachers.forEach(function (tt) { teachers.push(tt); });
                }
            }
        });
        if (!teachers.length)
            throw new Error('Could not find any 1\u20134 scores to compute. Upload the filled evaluation sheet (students in columns, criteria in rows) or a Google Form responses CSV.');
        teachers.sort(function (a, b) { return (b.overall || 0) - (a.overall || 0); });
        return { gradeLevel: label, templateType: '', teachers: teachers, generatedAt: csvNowStamp(), responses: teachers.reduce(function (s, t) { return s + (t.responses || 0); }, 0) };
    }
    function looksLikeTemplate(rows) {
        var hasStudents = false, hasLabel = false;
        rows.forEach(function (r) {
            var sc = 0;
            r.forEach(function (c) { if (/^s\s*\d+$/i.test(String(c).trim()))
                sc++; });
            if (sc >= 2)
                hasStudents = true;
            if (/teacher\s*:|teacher's evaluation|students'? responses/i.test(r.join(' ')))
                hasLabel = true;
        });
        return hasStudents && hasLabel;
    }
    function parseTemplateSheet(rows, sheetName) {
        var studentCols = [];
        rows.forEach(function (r) {
            var cols = [];
            r.forEach(function (c, ci) { if (/^s\s*\d+$/i.test(String(c).trim()))
                cols.push(ci); });
            if (cols.length > studentCols.length)
                studentCols = cols;
        });
        if (!studentCols.length)
            return null;
        function labelVal(re) {
            for (var i = 0; i < rows.length; i++) {
                var r = rows[i];
                for (var c = 0; c < r.length; c++) {
                    if (re.test(String(r[c]).trim())) {
                        for (var k = c + 1; k < r.length; k++) {
                            var v = String(r[k] == null ? '' : r[k]).trim();
                            if (v)
                                return v;
                        }
                    }
                }
            }
            return '';
        }
        var parts = String(sheetName || '').split('|');
        var rawTeacher = labelVal(/teacher\s*:/i);
        if (/<insert/i.test(rawTeacher) && /template/i.test(sheetName))
            return null;
        var teacher = (!rawTeacher || /<insert/i.test(rawTeacher)) ? String(parts[0] || '').trim() : rawTeacher;
        if (!teacher)
            return null;
        var rawSubject = labelVal(/subject/i);
        var subject = /<insert/i.test(rawSubject) ? '' : rawSubject;
        var rawSection = labelVal(/^section/i);
        var section = (/<insert/i.test(rawSection) || !rawSection) ? String(parts[1] || '').trim() : rawSection;
        var blocks = [], cur = null;
        rows.forEach(function (r) {
            var cols = [];
            r.forEach(function (c, ci) { if (/^s\s*\d+$/i.test(String(c).trim()))
                cols.push(ci); });
            if (cols.length >= 2) {
                cur = { cols: cols, rows: [r] };
                blocks.push(cur);
                return;
            }
            if (cur)
                cur.rows.push(r);
        });
        if (!blocks.length)
            return null;
        var sec = {}, order = [], studentAvgs = [];
        blocks.forEach(function (b) {
            var current = 'Evaluation', sSum = {}, sCnt = {};
            b.rows.forEach(function (r) {
                var label = String(r[0] == null ? '' : r[0]).trim();
                var nums = [], perCol = {};
                b.cols.forEach(function (ci) { var n = scoreOf(r[ci]); if (n != null && n > 0) {
                    nums.push(n);
                    perCol[ci] = n;
                } });
                if (/^(teacher\s*:|teacher's evaluation|subject\b|section\b|students'? responses)/i.test(label))
                    return;
                if (/^(total|cumm?ulative|overall|grand|weighted|average)/i.test(label))
                    return;
                if (!nums.length) {
                    if (label && !/^s\s*\d+$/i.test(label))
                        current = label;
                    return;
                }
                var key = current + '||' + label;
                if (!sec[key]) {
                    sec[key] = { section: current, item: label, sum: 0, n: 0 };
                    order.push(key);
                }
                sec[key].sum += nums.reduce(function (s, x) { return s + x; }, 0);
                sec[key].n += nums.length;
                b.cols.forEach(function (ci) { if (perCol[ci] != null) {
                    sSum[ci] = (sSum[ci] || 0) + perCol[ci];
                    sCnt[ci] = (sCnt[ci] || 0) + 1;
                } });
            });
            b.cols.forEach(function (ci) { if (sCnt[ci])
                studentAvgs.push(sSum[ci] / sCnt[ci]); });
        });
        var secMap = {}, secOrder = [];
        order.forEach(function (k) {
            var e = sec[k];
            if (!secMap[e.section]) {
                secMap[e.section] = [];
                secOrder.push(e.section);
            }
            secMap[e.section].push({ item: e.item || ('Item ' + (secMap[e.section].length + 1)), average: round2(e.sum / e.n), responses: e.n });
        });
        var sectionList = secOrder.map(function (nm) {
            var items = secMap[nm];
            var valid = items.filter(function (x) { return x.average != null; });
            return { section: nm, items: items, average: valid.length ? round2(valid.reduce(function (s, x) { return s + x.average; }, 0) / valid.length) : null };
        });
        if (!sectionList.length)
            return null;
        var overall = studentAvgs.length ? round2(studentAvgs.reduce(function (s, x) { return s + x; }, 0) / studentAvgs.length) : null;
        return { teacher: teacher, subject: subject, classSection: section, docType: '', responses: studentAvgs.length || studentCols.length, sections: sectionList, overall: overall, comments: [], wordCounts: [], commentCounts: [] };
    }
    function sniffDelim(text) {
        var nl = text.indexOf('\n');
        var first = nl >= 0 ? text.slice(0, nl) : text;
        var counts = { ',': 0, ';': 0, '\t': 0 }, inQ = false;
        for (var i = 0; i < first.length; i++) {
            var ch = first.charAt(i);
            if (ch === '"')
                inQ = !inQ;
            else if (!inQ && (ch === ',' || ch === ';' || ch === '\t'))
                counts[ch]++;
        }
        var best = ',', bestN = counts[','];
        if (counts[';'] > bestN) {
            best = ';';
            bestN = counts[';'];
        }
        if (counts['\t'] > bestN) {
            best = '\t';
            bestN = counts['\t'];
        }
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
    function round2(n) { return Math.round(n * 100) / 100; }
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
    function csvNowStamp() {
        var d = new Date();
        function p(n) { return (n < 10 ? '0' : '') + n; }
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    }
    function csvGuessKinds(headers, values) {
        var sample = values.slice(1, 41);
        return headers.map(function (h, i) {
            var numeric = 0, textLong = 0, total = 0;
            sample.forEach(function (rowv) {
                var v = rowv[i];
                if (v === '' || v == null)
                    return;
                total++;
                if (scoreOf(v) != null)
                    numeric++;
                else if (String(v).trim().split(/\s+/).length >= 3)
                    textLong++;
            });
            var kind = 'other';
            if (total > 0 && numeric / total >= 0.6)
                kind = 'item';
            else if (total > 0 && textLong / total >= 0.4)
                kind = 'comment';
            return { col: h, index: i, kind: kind };
        });
    }
    function csvAutoDetect(headers, guess) {
        function kindAt(i) { return guess[i] ? guess[i].kind : 'other'; }
        var teacher = -1, subject = -1, section = -1, docType = -1, comments = [], items = [];
        for (var i = 0; i < headers.length; i++) {
            var low = String(headers[i]).toLowerCase();
            if (teacher < 0 && /teacher|faculty|instructor|guro/.test(low))
                teacher = i;
            else if (subject < 0 && /subject|asignatura/.test(low))
                subject = i;
            else if (section < 0 && /section|grade|level|class/.test(low))
                section = i;
            else if (docType < 0 && /document|doc type|type of/.test(low))
                docType = i;
        }
        for (var j = 0; j < headers.length; j++) {
            if (j === teacher || j === subject || j === section || j === docType)
                continue;
            var k = kindAt(j);
            if (k === 'item')
                items.push({ col: headers[j], section: 'Evaluation' });
            else if (k === 'comment')
                comments.push(headers[j]);
        }
        if (teacher < 0) {
            for (var t = 0; t < headers.length; t++) {
                if (t === subject || t === section || t === docType)
                    continue;
                if (kindAt(t) === 'other') {
                    teacher = t;
                    break;
                }
            }
        }
        return {
            teacher: teacher >= 0 ? headers[teacher] : '',
            subject: subject >= 0 ? headers[subject] : '',
            section: section >= 0 ? headers[section] : '',
            docType: docType >= 0 ? headers[docType] : '',
            comments: comments, items: items
        };
    }
    function csvTallyWords(comments) {
        var map = {};
        comments.forEach(function (c) {
            String(c).split(/\s+/).forEach(function (raw) {
                var w = raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
                if (!w)
                    return;
                var key = w.toLowerCase();
                if (!map[key])
                    map[key] = { word: w, count: 0 };
                map[key].count++;
            });
        });
        return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return b.count - a.count; });
    }
    function csvTallyComments(comments) {
        var map = {};
        comments.forEach(function (c) {
            var key = String(c).trim();
            if (!key)
                return;
            map[key] = (map[key] || 0) + 1;
        });
        return Object.keys(map).map(function (k) { return { comment: k, count: map[k] }; }).sort(function (a, b) { return b.count - a.count; });
    }
    function csvCompute(cfg, values, headers) {
        var mapping = cfg.mapping || {};
        function colIndex(name) { return headers.indexOf(String(name || '').trim()); }
        var teacherIdx = colIndex(mapping.teacher);
        if (teacherIdx < 0)
            throw new Error('The detected teacher column is missing.');
        var subjectIdx = mapping.subject ? colIndex(mapping.subject) : -1;
        var sectionIdx = mapping.section ? colIndex(mapping.section) : -1;
        var docTypeIdx = mapping.docType ? colIndex(mapping.docType) : -1;
        var commentIdxs = (mapping.comments || []).map(colIndex).filter(function (x) { return x >= 0; });
        var items = (mapping.items || []).map(function (it) {
            return { col: it.col, section: it.section || 'Evaluation', index: colIndex(it.col) };
        }).filter(function (it) { return it.index >= 0; });
        var groups = {};
        for (var rr = 1; rr < values.length; rr++) {
            var rowv = values[rr];
            var teacher = String(rowv[teacherIdx] == null ? '' : rowv[teacherIdx]).trim();
            if (!teacher)
                continue;
            var subject = subjectIdx >= 0 ? String(rowv[subjectIdx] || '').trim() : '';
            var key = teacher + ' || ' + subject;
            if (!groups[key])
                groups[key] = { teacher: teacher, subject: subject, sections: {}, rows: 0, comments: [], docType: '', classSection: '' };
            var g = groups[key];
            g.rows++;
            if (docTypeIdx >= 0 && !g.docType)
                g.docType = String(rowv[docTypeIdx] || '').trim();
            if (sectionIdx >= 0 && !g.classSection)
                g.classSection = String(rowv[sectionIdx] || '').trim();
            items.forEach(function (it) {
                var v = scoreOf(rowv[it.index]);
                if (v == null || v <= 0)
                    return;
                if (!g.sections[it.section])
                    g.sections[it.section] = {};
                if (!g.sections[it.section][it.col])
                    g.sections[it.section][it.col] = { sum: 0, n: 0 };
                g.sections[it.section][it.col].sum += v;
                g.sections[it.section][it.col].n++;
            });
            commentIdxs.forEach(function (ci) {
                var cc = String(rowv[ci] == null ? '' : rowv[ci]).trim();
                if (cc)
                    g.comments.push(cc);
            });
        }
        var teachers = Object.keys(groups).map(function (key) {
            var g = groups[key];
            var sectionList = Object.keys(g.sections).map(function (secName) {
                var itemsObj = g.sections[secName];
                var itemList = Object.keys(itemsObj).map(function (col) {
                    var cell = itemsObj[col];
                    return { item: col, average: cell.n ? round2(cell.sum / cell.n) : null, responses: cell.n };
                });
                var valid = itemList.filter(function (x) { return x.average != null; });
                var secAvg = valid.length ? round2(valid.reduce(function (s, x) { return s + x.average; }, 0) / valid.length) : null;
                return { section: secName, items: itemList, average: secAvg };
            });
            var secAvgs = sectionList.map(function (s) { return s.average; }).filter(function (x) { return x != null; });
            var overall = secAvgs.length ? round2(secAvgs.reduce(function (s, x) { return s + x; }, 0) / secAvgs.length) : null;
            return {
                teacher: g.teacher, subject: g.subject, classSection: g.classSection, docType: g.docType,
                responses: g.rows, sections: sectionList, overall: overall,
                comments: g.comments, wordCounts: csvTallyWords(g.comments), commentCounts: csvTallyComments(g.comments)
            };
        });
        teachers.sort(function (a, b) { return (b.overall || 0) - (a.overall || 0); });
        return {
            gradeLevel: cfg.gradeLevel, templateType: cfg.templateType, teachers: teachers,
            generatedAt: csvNowStamp(), responses: teachers.reduce(function (s, t) { return s + t.responses; }, 0)
        };
    }
    function findCfg(id) { for (var i = 0; i < configs.length; i++)
        if (configs[i].id === id)
            return configs[i]; return null; }
    function templateName(key) {
        if (!templates)
            return key || 'Template';
        var t = (templates.templates || []).filter(function (x) { return x.key === key; })[0];
        return t ? t.name : (key || 'Template');
    }
    function templateByKey(key) {
        if (!templates)
            return null;
        return (templates.templates || []).filter(function (x) { return x.key === key; })[0] || null;
    }
    function delConfig(id) {
        var c = findCfg(id);
        if (!c || !confirm('Delete the source "' + c.gradeLevel + '"? Computed data already saved in the spreadsheet is kept.'))
            return;
        api.deleteEvalConfig(id).then(function () { saveConfigs(); ui.toast('Source removed.', 'ok'); render(); })
            .catch(function (e) { ui.toast(e.message || 'Could not delete.', 'err'); });
    }
    function openEditor(cfg) {
        editor = { cfg: cfg, headers: [], guess: [], tabs: [] };
        if (cfg && cfg.mapping) { }
        var tplOpts = '<option value="">\u2014 choose template \u2014</option>';
        (templates && templates.templates || []).forEach(function (t) {
            tplOpts += '<option value="' + esc(t.key) + '"' + (cfg && cfg.templateType === t.key ? ' selected' : '') + '>' + esc(t.name) + '</option>';
        });
        var host = body();
        host.innerHTML =
            '<div class="ep-editor">' +
                '<div class="ep-ed-h">' + (cfg ? 'Edit form source' : 'Add form source') + '</div>' +
                '<div class="fg2">' +
                '<div class="fg"><label>Grade level / label</label><input type="text" id="epGrade" placeholder="e.g. Senior High School" value="' + esc(cfg ? cfg.gradeLevel : '') + '"></div>' +
                '<div class="fg"><label>Template</label><select id="epTpl">' + tplOpts + '</select></div>' +
                '</div>' +
                '<div class="fg2">' +
                '<div class="fg"><label>Google Sheet ID or URL <small>(the form\u2019s response sheet)</small></label><input type="text" id="epSheet" placeholder="Paste the response spreadsheet link or ID" value="' + esc(cfg ? cfg.sheetId : '') + '"></div>' +
                '<div class="fg"><label>Tab name <small>(optional)</small></label><input type="text" id="epTab" placeholder="Form Responses 1" value="' + esc(cfg ? cfg.tabName : '') + '"></div>' +
                '</div>' +
                '<div class="ep-ed-act"><button class="mbtn mbtn-pr" id="epLoadCols">Load columns from sheet</button>' +
                '<button class="mbtn mbtn-cl" id="epCancel">Cancel</button></div>' +
                '<div class="ep-hint">Leave the Sheet ID blank to use the main system spreadsheet. The script account must have access to the response sheet.</div>' +
                '<div id="epMap"></div>' +
                '</div>';
        document.getElementById('epLoadCols').onclick = loadColumns;
        document.getElementById('epCancel').onclick = render;
    }
    function loadColumns() {
        var sheetId = document.getElementById('epSheet').value.trim();
        var tab = document.getElementById('epTab').value.trim();
        var map = document.getElementById('epMap');
        map.innerHTML = '<div class="ep-loading"><div class="spin"></div></div>';
        api.evalSheetColumns(sheetId, tab).then(function (d) {
            editor.headers = d.headers || [];
            editor.guess = d.guess || [];
            editor.tabs = d.tabs || [];
            if (d.tab)
                document.getElementById('epTab').value = d.tab;
            drawMapping(d.rowCount || 0);
        }).catch(function (e) {
            map.innerHTML = '<div class="ferr" style="display:block">' + esc(e.message || 'Could not read the sheet.') + '</div>';
        });
    }
    function kindOf(col) {
        for (var i = 0; i < editor.guess.length; i++)
            if (editor.guess[i].col === col)
                return editor.guess[i].kind;
        return 'other';
    }
    function headerSelect(id, includeBlank, selected) {
        var h = includeBlank ? '<option value="">\u2014 none \u2014</option>' : '';
        editor.headers.forEach(function (col) {
            h += '<option value="' + esc(col) + '"' + (col === selected ? ' selected' : '') + '>' + esc(col) + '</option>';
        });
        return '<select id="' + id + '">' + h + '</select>';
    }
    function drawMapping(rowCount) {
        var cfg = editor.cfg, m = (cfg && cfg.mapping) || {};
        var tplKey = document.getElementById('epTpl').value;
        var tpl = templateByKey(tplKey);
        var sectionOpts = (tpl && tpl.sections || []).map(function (s) { return '<option value="' + esc(s) + '">'; }).join('');
        var savedItems = {};
        (m.items || []).forEach(function (it) { savedItems[it.col] = it.section; });
        var savedComments = {};
        (m.comments || []).forEach(function (c) { savedComments[c] = true; });
        var html = '<div class="ep-map">';
        html += '<div class="ep-map-note">' + rowCount + ' response row(s) found. Map the columns below, then save.</div>';
        html += '<div class="fg2">' +
            '<div class="fg"><label>Teacher column <small>(required)</small></label>' + headerSelect('epTeacher', true, m.teacher) + '</div>' +
            '<div class="fg"><label>Subject column</label>' + headerSelect('epSubject', true, m.subject) + '</div>' +
            '</div>';
        html += '<div class="fg2">' +
            '<div class="fg"><label>Class section column</label>' + headerSelect('epSection', true, m.section) + '</div>' +
            '<div class="fg"><label>Document type column</label>' + headerSelect('epDoc', true, m.docType) + '</div>' +
            '</div>';
        html += '<datalist id="epSecList">' + sectionOpts + '</datalist>';
        html += '<div class="ep-cols"><div class="ep-cols-h"><span>Column</span><span>Score item?</span><span>Section / category</span><span>Comment?</span></div>';
        editor.headers.forEach(function (col, i) {
            var k = kindOf(col);
            var isItem = savedItems.hasOwnProperty(col) ? true : (k === 'item');
            var isComment = savedComments[col] || (!savedItems.hasOwnProperty(col) && k === 'comment');
            var sec = savedItems[col] || (tpl && tpl.sections && tpl.sections[0]) || '';
            html += '<div class="ep-col-row">' +
                '<span class="ep-col-name" title="' + esc(col) + '">' + esc(col) + '</span>' +
                '<span><input type="checkbox" class="ep-item-ck" data-col="' + esc(col) + '"' + (isItem ? ' checked' : '') + '></span>' +
                '<span><input type="text" class="ep-item-sec" data-col="' + esc(col) + '" list="epSecList" value="' + esc(sec) + '" placeholder="Section"></span>' +
                '<span><input type="checkbox" class="ep-cmt-ck" data-col="' + esc(col) + '"' + (isComment ? ' checked' : '') + '></span>' +
                '</div>';
        });
        html += '</div>';
        html += '<div class="ferr" id="epMapErr" role="alert"></div>';
        html += '<div class="ep-ed-act"><button class="mbtn mbtn-pr" id="epSave">Save source</button></div>';
        html += '</div>';
        document.getElementById('epMap').innerHTML = html;
        document.getElementById('epSave').onclick = saveConfig;
    }
    function saveConfig() {
        var errEl = document.getElementById('epMapErr');
        errEl.style.display = 'none';
        var grade = document.getElementById('epGrade').value.trim();
        if (!grade) {
            errEl.textContent = 'Please enter a grade level / label.';
            errEl.style.display = 'block';
            return;
        }
        var teacher = document.getElementById('epTeacher').value;
        if (!teacher) {
            errEl.textContent = 'Please choose the teacher column.';
            errEl.style.display = 'block';
            return;
        }
        var items = [];
        document.querySelectorAll('.ep-item-ck').forEach(function (ck) {
            if (!ck.checked)
                return;
            var col = ck.getAttribute('data-col');
            var secInp = document.querySelector('.ep-item-sec[data-col="' + cssEsc(col) + '"]');
            items.push({ col: col, section: (secInp && secInp.value.trim()) || 'Evaluation' });
        });
        if (!items.length) {
            errEl.textContent = 'Select at least one score item column.';
            errEl.style.display = 'block';
            return;
        }
        var comments = [];
        document.querySelectorAll('.ep-cmt-ck').forEach(function (ck) { if (ck.checked)
            comments.push(ck.getAttribute('data-col')); });
        var mapping = {
            teacher: teacher,
            subject: document.getElementById('epSubject').value || '',
            section: document.getElementById('epSection').value || '',
            docType: document.getElementById('epDoc').value || '',
            comments: comments,
            items: items
        };
        var payload = {
            id: editor.cfg ? editor.cfg.id : '',
            gradeLevel: grade,
            templateType: document.getElementById('epTpl').value || '',
            sheetId: document.getElementById('epSheet').value.trim(),
            tabName: document.getElementById('epTab').value.trim(),
            mapping: mapping
        };
        var btn = document.getElementById('epSave');
        btn.disabled = true;
        btn.textContent = 'Saving\u2026';
        api.saveEvalConfig(payload).then(function () { saveConfigs(); ui.toast('Source saved.', 'ok'); render(); })
            .catch(function (e) { btn.disabled = false; btn.textContent = 'Save source'; errEl.textContent = e.message || 'Could not save.'; errEl.style.display = 'block'; });
    }
    function cssEsc(s) { return String(s).replace(/"/g, '\\"'); }
    function process(id) {
        var rHost = document.getElementById('ebResults') || body();
        rHost.innerHTML = '<div class="ep-loading"><div class="spin"></div><span>Reading responses & computing\u2026</span></div>';
        api.processEval(id).then(function (d) {
            lastResult = d;
            saveLastResult();
            renderResults(d);
            if (window.SMC && SMC.evalbuild && SMC.evalbuild.drawBuilt) {
                try {
                    SMC.evalbuild.drawBuilt();
                }
                catch (e) { }
            }
        }).catch(function (e) {
            rHost.innerHTML = '<div class="ferr" style="display:block">' + esc(e.message || 'Could not process responses.') + '</div>';
        });
    }
    function renderResults(d) {
        var rHost = document.getElementById('epQuickResults') || document.getElementById('ebResults') || body();
        if (!d.teachers || !d.teachers.length) {
            rHost.innerHTML = '<div class="empty"><p>No responses found for this source yet.</p></div>';
            return;
        }
        var secNames = distinctSections(d.teachers);
        var html = '<div class="ep-res">';
        html += '<div class="ep-res-h"><div><strong>' + esc(d.gradeLevel) + '</strong> \u00b7 ' + d.teachers.length + ' teacher(s) \u00b7 ' + (d.responses || 0) + ' response(s)<br><small>Generated ' + esc(d.generatedAt) + '</small></div>' +
            '<div class="ep-res-btns"><button class="mbtn mbtn-pr" id="epXlsx">Download Excel</button><button class="mbtn mbtn-pr" id="epReport">Summary report</button></div></div>';
        if (d.autoMapped && d.detected)
            html += '<div class="ep-map-note">Auto-detected \u2014 teacher column: <strong>' + esc(d.detected.teacher) + '</strong> \u00b7 ' + d.detected.items + ' score question(s) \u00b7 ' + d.detected.comments + ' comment column(s). For exact template sections, add a saved source.</div>';
        html += '<div class="tw"><table><thead><tr><th>#</th><th>Teacher</th><th>Subject</th><th>Responses</th>';
        secNames.forEach(function (s) { html += '<th>' + esc(s) + '</th>'; });
        html += '<th>Overall</th></tr></thead><tbody>';
        d.teachers.forEach(function (t, i) {
            html += '<tr><td>' + (i + 1) + '</td><td style="font-weight:500">' + esc(t.teacher) + '</td><td>' + esc(t.subject) + '</td><td>' + t.responses + '</td>';
            secNames.forEach(function (sn) { html += '<td>' + fmt(secVal(t, sn)) + '</td>'; });
            html += '<td><strong>' + fmt(t.overall) + '</strong></td></tr>';
        });
        html += '</tbody></table></div>';
        d.teachers.forEach(function (t, i) {
            html += '<details class="ep-teacher"' + (i === 0 ? ' open' : '') + '><summary>' + esc(t.teacher) + (t.subject ? ' \u2014 ' + esc(t.subject) : '') + ' <span class="ep-ov">overall ' + fmt(t.overall) + '</span></summary>';
            t.sections.forEach(function (s) {
                html += '<div class="ep-sec"><div class="ep-sec-h">' + esc(s.section) + ' <span>avg ' + fmt(s.average) + '</span></div>';
                s.items.forEach(function (it) {
                    html += '<div class="ep-item"><span>' + esc(it.item) + '</span><span>' + fmt(it.average) + '</span></div>';
                });
                html += '</div>';
            });
            if (t.wordCounts && t.wordCounts.length) {
                html += '<div class="ep-words-h">Most repeated words in comments <small>(verbatim, unchanged)</small></div><div class="ep-words">';
                t.wordCounts.slice(0, 40).forEach(function (w) {
                    if (w.count < 2)
                        return;
                    html += '<span class="ep-word">' + esc(w.word) + ' <b>' + w.count + '</b></span>';
                });
                html += '</div>';
            }
            if (t.comments && t.comments.length) {
                html += '<details class="ep-cmts"><summary>' + t.comments.length + ' comment(s) \u2014 view verbatim</summary><ul>';
                t.comments.forEach(function (c) { html += '<li>' + esc(c) + '</li>'; });
                html += '</ul></details>';
            }
            html += '</details>';
        });
        html += '</div>';
        rHost.innerHTML = html;
        document.getElementById('epXlsx').onclick = exportExcel;
        document.getElementById('epReport').onclick = exportReport;
    }
    function distinctSections(teachers) {
        var seen = {}, out = [];
        teachers.forEach(function (t) { t.sections.forEach(function (s) { if (!seen[s.section]) {
            seen[s.section] = 1;
            out.push(s.section);
        } }); });
        return out;
    }
    function secVal(t, name) { var v = null; t.sections.forEach(function (s) { if (s.section === name)
        v = s.average; }); return v; }
    function fmt(n) { return (n == null || isNaN(n)) ? '\u2014' : Number(n).toFixed(2); }
    function exportExcel() {
        if (!lastResult) {
            ui.toast('Compute a source first.', 'err');
            return;
        }
        if (!window.XLSX) {
            ui.toast('Excel library still loading \u2014 try again in a moment.', 'err');
            return;
        }
        var d = lastResult, wb = XLSX.utils.book_new();
        var secNames = distinctSections(d.teachers);
        var head = ['Rank', 'Teacher', 'Subject', 'Document Type', 'Responses'].concat(secNames).concat(['Overall']);
        var rows = [['TEACHER EVALUATION SUMMARY \u2014 ' + d.gradeLevel], ['Generated', d.generatedAt], [], head];
        d.teachers.forEach(function (t, i) {
            var row = [i + 1, t.teacher, t.subject, t.docType, t.responses];
            secNames.forEach(function (sn) { var v = secVal(t, sn); row.push(v == null ? '' : v); });
            row.push(t.overall == null ? '' : t.overall);
            rows.push(row);
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'SUMMARY');
        var used = {};
        d.teachers.forEach(function (t) {
            var a = [];
            a.push(['TEACHER', t.teacher]);
            a.push(['SUBJECT TAUGHT', t.subject]);
            a.push(['SECTION', t.classSection || '']);
            a.push(['DOCUMENT TYPE', t.docType || '']);
            a.push(['RESPONSES', t.responses]);
            a.push([]);
            t.sections.forEach(function (s) {
                a.push([s.section]);
                s.items.forEach(function (it) { a.push([it.item, it.average == null ? '' : it.average]); });
                a.push(['SECTION AVERAGE', s.average == null ? '' : s.average]);
                a.push([]);
            });
            a.push(['OVERALL AVERAGE', t.overall == null ? '' : t.overall]);
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a), uniqSheet(t.teacher, used));
        });
        var c = [['Teacher', 'Word / Comment', 'Count']];
        d.teachers.forEach(function (t) {
            c.push([t.teacher, '\u2014 WORD COUNT \u2014', '']);
            (t.wordCounts || []).forEach(function (w) { c.push(['', w.word, w.count]); });
            c.push([t.teacher, '\u2014 COMMENTS (verbatim) \u2014', '']);
            (t.commentCounts || []).forEach(function (cc) { c.push(['', cc.comment, cc.count]); });
            c.push([]);
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(c), 'COMMENTS');
        XLSX.writeFile(wb, 'Teacher-Evaluations-' + safeName(d.gradeLevel) + '.xlsx');
    }
    function uniqSheet(name, used) {
        var base = String(name).replace(/[\\\/\?\*\[\]:]/g, ' ').trim().slice(0, 28) || 'Teacher';
        var n = base, i = 2;
        while (used[n.toLowerCase()]) {
            n = base.slice(0, 25) + ' ' + (i++);
        }
        used[n.toLowerCase()] = 1;
        return n;
    }
    function safeName(s) { return String(s || 'results').replace(/[^\w\-]+/g, '-').replace(/^-+|-+$/g, '') || 'results'; }
    function exportReport() {
        if (!lastResult) {
            ui.toast('Compute a source first.', 'err');
            return;
        }
        var d = lastResult, secNames = distinctSections(d.teachers);
        var w = window.open('', '_blank');
        if (!w) {
            ui.toast('Allow pop-ups to open the report.', 'err');
            return;
        }
        var h = '<!doctype html><html><head><meta charset="utf-8"><title>Teacher Evaluation Summary \u2014 ' + esc(d.gradeLevel) + '</title>' +
            '<style>body{font-family:Georgia,serif;color:#16243a;margin:40px}h1{font-size:22px;margin:0 0 2px}h2{font-size:15px;margin:26px 0 8px;border-bottom:2px solid #BFA050;padding-bottom:4px}' +
            '.sub{color:#667;margin-bottom:18px;font-size:12px}table{border-collapse:collapse;width:100%;font-size:12px;margin-bottom:10px}th,td{border:1px solid #c9d2e3;padding:6px 8px;text-align:left}th{background:#002B6B;color:#fff}' +
            '.ov{font-weight:bold}.words span{display:inline-block;background:#f0f3fa;border:1px solid #dde4f0;border-radius:10px;padding:2px 8px;margin:2px;font-size:11px}' +
            '.cmt{font-size:11px;color:#333;margin:3px 0;padding-left:10px;border-left:2px solid #BFA050}@media print{body{margin:14mm}}</style></head><body>';
        h += '<h1>Teacher Evaluation Summary</h1><div class="sub">' + esc(d.gradeLevel) + ' \u00b7 Stella Maris College Guidance Center \u00b7 Generated ' + esc(d.generatedAt) + '</div>';
        h += '<h2>Overall ranking</h2><table><tr><th>#</th><th>Teacher</th><th>Subject</th><th>Responses</th>';
        secNames.forEach(function (s) { h += '<th>' + esc(s) + '</th>'; });
        h += '<th>Overall</th></tr>';
        d.teachers.forEach(function (t, i) {
            h += '<tr><td>' + (i + 1) + '</td><td>' + esc(t.teacher) + '</td><td>' + esc(t.subject) + '</td><td>' + t.responses + '</td>';
            secNames.forEach(function (sn) { var v = secVal(t, sn); h += '<td>' + (v == null ? '\u2014' : v.toFixed(2)) + '</td>'; });
            h += '<td class="ov">' + (t.overall == null ? '\u2014' : t.overall.toFixed(2)) + '</td></tr>';
        });
        h += '</table>';
        d.teachers.forEach(function (t) {
            h += '<h2>' + esc(t.teacher) + (t.subject ? ' \u2014 ' + esc(t.subject) : '') + '</h2>';
            h += '<table><tr><th>Item</th><th>Average</th></tr>';
            t.sections.forEach(function (s) {
                h += '<tr><th colspan="2">' + esc(s.section) + ' (avg ' + (s.average == null ? '\u2014' : s.average.toFixed(2)) + ')</th></tr>';
                s.items.forEach(function (it) { h += '<tr><td>' + esc(it.item) + '</td><td>' + (it.average == null ? '\u2014' : it.average.toFixed(2)) + '</td></tr>'; });
            });
            h += '<tr><td class="ov">OVERALL</td><td class="ov">' + (t.overall == null ? '\u2014' : t.overall.toFixed(2)) + '</td></tr></table>';
            if (t.wordCounts && t.wordCounts.length) {
                h += '<div class="words"><b>Repeated words:</b> ';
                t.wordCounts.forEach(function (wd) { if (wd.count >= 2)
                    h += '<span>' + esc(wd.word) + ' \u00d7' + wd.count + '</span>'; });
                h += '</div>';
            }
            if (t.comments && t.comments.length) {
                h += '<div style="margin-top:6px"><b style="font-size:12px">Comments (verbatim):</b>';
                t.comments.forEach(function (cm) { h += '<div class="cmt">' + esc(cm) + '</div>'; });
                h += '</div>';
            }
        });
        h += '<script>window.onload=function(){setTimeout(function(){window.print();},250);};<\/script></body></html>';
        w.document.write(h);
        w.document.close();
    }
    return { render: render, refresh: refreshAllTabs, setUser: function () { } };
})();
