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
            '<button id="exDiag" class="ex-btn ex-btn-ghost" type="button">Diagnose</button>' +
            '<button id="exPreview" class="ex-btn ex-btn-ghost" type="button">Preview</button>' +
            '<button id="exBuild" class="ex-btn" type="button">Build workbooks</button>' +
            '</div>' +
            '<div id="exStatus" class="ex-status"></div>' +
            '<div id="exResults" class="ex-results"></div>' +
            '<div class="ex-saved-head">' +
            '<h4 class="ex-saved-title">Generated Evaluations</h4>' +
            '<button id="exSavedRefresh" class="ex-btn ex-btn-ghost" type="button">Refresh</button>' +
            '</div>' +
            '<div id="exSaved" class="ex-saved"><span class="ex-muted">Loading saved workbooks...</span></div>' +
            '</div>';
    }

    function renderSaved(res) {
        var el = document.getElementById('exSaved');
        if (!el) return;
        if (!res || !res.totalFiles) {
            el.innerHTML = '<span class="ex-muted">Nothing built yet. Use Build workbooks above and the results will be listed here.</span>';
            return;
        }

        var groups = (res.teachers || []).slice();
        if (res.looseFiles && res.looseFiles.length) {
            groups.push({ teacher: 'Older builds (not in a teacher folder)', url: res.outputFolderUrl, files: res.looseFiles });
        }

        var html = '<p class="ex-muted ex-saved-sub">' + res.totalFiles + ' workbook(s) in ' +
            '<a class="ex-link" target="_blank" rel="noopener" href="' + esc(res.outputFolderUrl) + '">' +
            esc(res.outputFolder) + '</a> on Google Drive.</p>';

        groups.forEach(function (g) {
            html += '<details class="ex-saved-group">' +
                '<summary><span class="ex-saved-teacher">' + esc(g.teacher) + '</span>' +
                '<span class="ex-saved-count">' + (g.files || []).length + ' file(s)</span></summary>';
            html += '<table class="ex-table"><tbody>';
            (g.files || []).forEach(function (f) {
                html += '<tr>' +
                    '<td><a class="ex-link" target="_blank" rel="noopener" href="' + esc(f.url) + '">' + esc(f.name) + '</a></td>' +
                    '<td class="ex-muted">' + esc(f.updated) + '</td>' +
                    '<td><a class="ex-link" href="' + esc(f.xlsxUrl) + '">Excel</a></td>' +
                    '</tr>';
            });
            html += '</tbody></table></details>';
        });

        el.innerHTML = html;
    }

    function loadSaved() {
        var el = document.getElementById('exSaved');
        if (!el) return;
        if (!window.SMC || !SMC.api || !SMC.api.listGeneratedEvals) {
            el.innerHTML = '<span class="ex-muted">Update js/api.js to see saved workbooks here.</span>';
            return;
        }
        el.innerHTML = '<span class="ex-muted">Loading saved workbooks...</span>';
        SMC.api.listGeneratedEvals().then(function (res) {
            renderSaved(res);
        }).catch(function (err) {
            el.innerHTML = '<span class="ex-err">Could not load saved workbooks: ' +
                esc((err && err.message) || err) + '</span>';
        });
    }

    function setBusy(on, label) {
        busy = on;
        var build = document.getElementById('exBuild');
        var prev = document.getElementById('exPreview');
        var diag = document.getElementById('exDiag');
        if (build) { build.disabled = on; build.textContent = on ? (label || 'Working...') : 'Build workbooks'; }
        if (prev) prev.disabled = on;
        if (diag) diag.disabled = on;
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
                // files === -1 means the backend deliberately skipped counting
                // (counting meant walking every subfolder, which took ~57s).
                var count = (typeof b.files === 'number' && b.files >= 0)
                    ? ' (' + b.files + ' file' + (b.files === 1 ? '' : 's') + ')'
                    : '';
                html += '<option value="' + esc(b.id) + '">' + esc(b.name) + count + '</option>';
            });
            sel.innerHTML = html;
            var total = (res.totalFiles === undefined || res.totalFiles === null ||
                res.totalFiles < 0 || res.countsSkipped) ? null : res.totalFiles;
            var extra = res.looseFiles ? ' &middot; ' + res.looseFiles + ' loose in the root' : '';
            if (total === 0) {
                status('Source folder <b>' + esc(res.folderName) + '</b> has no readable files. ' +
                    'Press <b>Diagnose</b> to see what is in there.', 'err');
            } else {
                status('Source folder: <b>' + esc(res.folderName) + '</b> &middot; ' +
                    batches.length + ' teacher folder(s)' +
                    (total === null ? '' : ' &middot; ' + total + ' readable file(s)') + extra +
                    (batches.length > 20
                        ? '. <b>Pick one teacher at a time</b> - this folder is too big to build in one go.'
                        : ''));
            }
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
            var left = (res && res.remaining) || [];
            status((dryRun
                ? 'Preview only. ' + n + ' file(s) would be created.'
                : n + ' workbook(s) created.') +
                (left.length ? ' <b>' + left.length + ' teacher folder(s) still to do</b> - ' +
                    'pick them one at a time from the dropdown.' : ''),
                left.length ? 'err' : 'ok');
            renderResults(res);
            loadSaved();
            if (!dryRun) toast(n + ' evaluation workbook(s) built.', 'success');
        }).catch(function (err) {
            setBusy(false);
            var msg = err && err.message ? err.message : String(err);
            status('Failed: ' + esc(msg), 'err');
            toast(msg, 'error');
        });
    }

    // Shows every file the backend can see, and why anything was skipped.
    function diagnose() {
        if (busy) return;
        if (!window.SMC || !SMC.api || !SMC.api.diagnoseEvalFolder) {
            toast('The backend is missing the diagnoseEvalFolder action. Update EvalExport.gs and re-deploy.', 'error');
            return;
        }
        setBusy(true, 'Scanning...');
        status('Scanning the Drive folder, including subfolders and shortcuts...');

        SMC.api.diagnoseEvalFolder().then(function (res) {
            setBusy(false);
            var c = res.counts || {};
            var secs = res.elapsedMs ? ' in ' + (res.elapsedMs / 1000).toFixed(1) + 's' : '';
            status('Folder <b>' + esc(res.folderName) + '</b>: ' +
                (c.usable || 0) + ' readable, ' + (c.skipped || 0) + ' skipped, ' +
                (c.folders || 0) + ' subfolder(s)' +
                (c.shortcutFolders ? ', ' + c.shortcutFolders + ' folder shortcut(s)' : '') +
                (c.loops ? ', ' + c.loops + ' shortcut loop(s) skipped' : '') + secs,
                (c.usable ? 'ok' : 'err'));

            var rows = res.entries || [];
            var el = document.getElementById('exResults');
            if (!el) return;
            if (!rows.length) {
                el.innerHTML = '<p class="ex-empty">The folder is empty, or the Google account running ' +
                    'the script cannot see inside it. Check FORMS_FOLDER_ID and that the folder is ' +
                    'shared with that account.</p>';
                return;
            }
            var html = '<table class="ex-table"><thead><tr>' +
                '<th>Folder</th><th>File</th><th>Type Google reports</th><th>Used?</th>' +
                '</tr></thead><tbody>';
            rows.forEach(function (r) {
                html += '<tr>' +
                    '<td>' + esc(r.path || '(root)') + '</td>' +
                    '<td>' + esc(r.name) + '</td>' +
                    '<td><code>' + esc(r.mime) + '</code></td>' +
                    '<td>' + (r.usable ? 'yes' : '<span class="ex-muted">no - ' + esc(r.note) + '</span>') + '</td>' +
                    '</tr>';
            });
            html += '</tbody></table>';
            if (res.stopped) {
                html = '<div class="ex-notes"><b>The scan was cut short.</b> ' + esc(res.stopped) +
                    ' This usually means the folder tree is very large, or a shortcut points at a ' +
                    'parent folder or at your whole Drive. Check the Folder column below for any ' +
                    'path that looks unrelated to evaluations.</div>' + html;
            }
            if (res.capped && !res.stopped) html += '<p class="ex-foot">Only the first 400 entries are shown.</p>';
            if (res.folderUrl) {
                html += '<p class="ex-foot">Scanned <a class="ex-link" target="_blank" rel="noopener" href="' +
                    esc(res.folderUrl) + '">' + esc(res.folderName) + '</a>.</p>';
            }
            el.innerHTML = html;
        }).catch(function (err) {
            setBusy(false);
            var msg = err && err.message ? err.message : String(err);
            status('Diagnose failed: ' + esc(msg), 'err');
            toast(msg, 'error');
        });
    }

    function wire() {
        var build = document.getElementById('exBuild');
        var prev = document.getElementById('exPreview');
        var diag = document.getElementById('exDiag');
        if (build) build.addEventListener('click', function () { run(false); });
        if (prev) prev.addEventListener('click', function () { run(true); });
        if (diag) diag.addEventListener('click', diagnose);
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
        loadSaved();
        var sr = document.getElementById('exSavedRefresh');
        if (sr) sr.addEventListener('click', loadSaved);
        return true;
    }

    // The Evaluations view renders lazily - #ebMount does not exist until the
    // user actually opens that tab, which can be many minutes after load.
    // So we watch the DOM permanently and also hook evalproc.render().
    function autoMount() {
        mount();

        // 1. Re-mount whenever the evaluations panel is (re)drawn.
        if (window.MutationObserver && document.body) {
            var observer = new MutationObserver(function () {
                if (!document.getElementById('exCard')) mount();
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }

        // 2. Belt and braces: wrap the renderer that builds the host element.
        var hook = setInterval(function () {
            if (!window.SMC || !SMC.evalproc || typeof SMC.evalproc.render !== 'function') return;
            clearInterval(hook);
            if (SMC.evalproc.__exWrapped) return;
            var original = SMC.evalproc.render;
            SMC.evalproc.render = function () {
                var out = original.apply(this, arguments);
                try { setTimeout(mount, 0); } catch (e) { }
                return out;
            };
            SMC.evalproc.__exWrapped = true;
        }, 200);

        // 3. Also try on any nav click, for older browsers without MutationObserver.
        document.addEventListener('click', function () {
            setTimeout(function () {
                if (!document.getElementById('exCard')) mount();
            }, 250);
        }, true);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoMount);
    } else {
        autoMount();
    }

    return { mount: mount, refresh: loadBatches, build: run, diagnose: diagnose, saved: loadSaved };
})();
