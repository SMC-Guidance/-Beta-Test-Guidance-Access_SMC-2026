// evalexport.js  -  "Build Evaluation Workbooks" panel
// Calls the new backend action added by backend/EvalExport.gs.
// Self-mounting: it drops a card into the Evaluations > Folder panel.
window.SMC = window.SMC || {};
SMC.evalexport = (function () {
    'use strict';

    var busy = false;

    function esc(s) {
        return String(s === null || s === undefined ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function toast(msg, kind) {
        if (window.SMC && SMC.ui && SMC.ui.toast) { SMC.ui.toast(msg, kind); return; }
        if (kind === 'error') console.error(msg); else console.log(msg);
    }

    function template() {
        return '' +
            '<div class="ex-card" id="exCard">' +
            '<div class="ex-head">' +
            '<div>' +
            '<h3 class="ex-title">Build Evaluation Workbooks</h3>' +
            '<p class="ex-sub">Reads every teacher folder, fills the matching grade-level template, ' +
            'lets the template compute the averages, and adds a comments summary.</p>' +
            '</div>' +
            '</div>' +
            '<div class="ex-row">' +
            '<select id="exBatch" class="ex-select"><option value="">All teacher folders</option></select>' +
            '<button id="exPreview" class="ex-btn ex-btn-ghost" type="button">Preview</button>' +
            '<button id="exBuild" class="ex-btn" type="button">Build workbooks</button>' +
            '</div>' +
            '<div id="exStatus" class="ex-status"></div>' +
            '<div id="exResults" class="ex-results"></div>' +
            '</div>';
    }

    function setBusy(on, label) {
        busy = on;
        var build = document.getElementById('exBuild');
        var prev = document.getElementById('exPreview');
        if (build) { build.disabled = on; build.textContent = on ? (label || 'Working...') : 'Build workbooks'; }
        if (prev) prev.disabled = on;
    }

    function status(html, kind) {
        var el = document.getElementById('exStatus');
        if (!el) return;
        el.className = 'ex-status' + (kind ? ' ex-' + kind : '');
        el.innerHTML = html || '';
    }

    function loadBatches() {
        if (!window.SMC || !SMC.api || !SMC.api.listEvalBatches) return;
        SMC.api.listEvalBatches().then(function (res) {
            var sel = document.getElementById('exBatch');
            if (!sel || !res) return;
            var batches = res.batches || [];
            var html = '<option value="">All teacher folders (' + batches.length + ')</option>';
            batches.forEach(function (b) {
                html += '<option value="' + esc(b.id) + '">' + esc(b.name) + ' (' + (b.files || 0) + ' file' + (b.files === 1 ? '' : 's') + ')</option>';
            });
            sel.innerHTML = html;
            var extra = res.looseFiles ? ' &middot; ' + res.looseFiles + ' file(s) loose in the root' : '';
            status('Source folder: <b>' + esc(res.folderName) + '</b>' + extra);
        }).catch(function (err) {
            status('Could not list the Drive folder: ' + esc(err && err.message ? err.message : err), 'err');
        });
    }

    function renderResults(res) {
        var el = document.getElementById('exResults');
        if (!el) return;
        var files = (res && res.files) || [];
        var notes = (res && res.notes) || [];

        if (!files.length) {
            el.innerHTML = '<p class="ex-empty">Nothing to build. Check that the teacher folders contain forms, sheets or CSV files.</p>';
        } else {
            var html = '<table class="ex-table"><thead><tr>' +
                '<th>File</th><th>Template</th><th>Tabs (sections)</th><th>Responses</th><th></th>' +
                '</tr></thead><tbody>';
            files.forEach(function (f) {
                html += '<tr>' +
                    '<td><b>' + esc(f.name) + '</b></td>' +
                    '<td>' + esc(f.template) + '</td>' +
                    '<td>' + esc((f.tabs || []).join(', ')) + '</td>' +
                    '<td class="ex-num">' + (f.responses || 0) + '</td>' +
                    '<td>' + (f.url
                        ? '<a class="ex-link" target="_blank" rel="noopener" href="' + esc(f.url) + '">Open</a>' +
                          ' &middot; <a class="ex-link" href="' + esc(f.xlsxUrl) + '">Excel</a>'
                        : '<span class="ex-muted">preview</span>') + '</td>' +
                    '</tr>';
            });
            html += '</tbody></table>';

            if (res.outputFolderUrl) {
                html += '<p class="ex-foot">Saved to <a class="ex-link" target="_blank" rel="noopener" href="' +
                    esc(res.outputFolderUrl) + '">' + esc(res.outputFolder) + '</a> at ' + esc(res.generatedAt) + '.</p>';
            }
            el.innerHTML = html;
        }

        if (notes.length) {
            var warn = '<div class="ex-notes"><b>Notes</b><ul>';
            notes.forEach(function (n) { warn += '<li>' + esc(n) + '</li>'; });
            warn += '</ul></div>';
            el.innerHTML += warn;
        }
    }

    function run(dryRun) {
        if (busy) return;
        if (!window.SMC || !SMC.api || !SMC.api.buildEvalWorkbooks) {
            toast('The backend is missing the buildEvalWorkbooks action. See backend/INSTALL-EvalExport.md.', 'error');
            return;
        }
        var sel = document.getElementById('exBatch');
        var payload = { dryRun: !!dryRun };
        if (sel && sel.value) payload.folderId = sel.value;

        setBusy(true, dryRun ? 'Checking...' : 'Building...');
        status(dryRun
            ? 'Reading the folder and matching templates...'
            : 'Copying templates and pasting responses. Large folders can take a minute.');

        SMC.api.buildEvalWorkbooks(payload).then(function (res) {
            setBusy(false);
            var n = (res.files || []).length;
            status(dryRun
                ? 'Preview only. ' + n + ' file(s) would be created.'
                : n + ' workbook(s) created.', 'ok');
            renderResults(res);
            if (!dryRun) toast(n + ' evaluation workbook(s) built.', 'success');
        }).catch(function (err) {
            setBusy(false);
            var msg = err && err.message ? err.message : String(err);
            status('Failed: ' + esc(msg), 'err');
            toast(msg, 'error');
        });
    }

    function wire() {
        var build = document.getElementById('exBuild');
        var prev = document.getElementById('exPreview');
        if (build) build.addEventListener('click', function () { run(false); });
        if (prev) prev.addEventListener('click', function () { run(true); });
    }

    // Mounts into the Evaluations > Folder panel, above the existing tools.
    function mount() {
        var host = document.getElementById('ebMount') ||
            document.getElementById('epPanel-folder') ||
            document.getElementById('evalProcMount');
        if (!host) return false;
        if (document.getElementById('exCard')) return true;

        var wrap = document.createElement('div');
        wrap.innerHTML = template();
        host.insertBefore(wrap.firstChild, host.firstChild);
        wire();
        loadBatches();
        return true;
    }

    // The evaluations view renders lazily, so retry briefly until its host exists.
    function autoMount() {
        var tries = 0;
        var timer = setInterval(function () {
            tries++;
            if (mount() || tries > 60) clearInterval(timer);
        }, 500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoMount);
    } else {
        autoMount();
    }

    return { mount: mount, refresh: loadBatches, build: run };
})();
