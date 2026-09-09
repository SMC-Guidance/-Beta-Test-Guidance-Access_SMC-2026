"use strict";
window.SMC = window.SMC || {};
SMC.evalDash = (function () {
    function esc(s) {
        var v = String(s == null ? '' : s);
        return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function render() {
        var host = document.getElementById('evalDashView');
        if (!host)
            return;
        var built = (SMC.evalbuild && SMC.evalbuild.getBuilt) ? SMC.evalbuild.getBuilt() : [];
        if (!built.length) {
            host.innerHTML = '<div class="panel" style="padding:40px;text-align:center"><p style="font-size:18px;font-weight:600">No results yet.</p><p>Go to <strong>Evaluation Results</strong>, load your forms, and build the files first. The results will appear here.</p></div>';
            return;
        }
        var order = [], byTeacher = {};
        built.forEach(function (r) {
            var t = r.teacher || '(Unknown)';
            if (!byTeacher[t]) {
                byTeacher[t] = [];
                order.push(t);
            }
            byTeacher[t].push(r);
        });
        var totalSec = 0, totalStu = 0;
        built.forEach(function (r) { totalSec += r.sections.length; totalStu += (r.students || 0); });
        var h = '<div class="ed-header">';
        h += '<div class="ed-stat"><span class="ed-sn">' + order.length + '</span><span class="ed-sl">Teachers</span></div>';
        h += '<div class="ed-stat"><span class="ed-sn">' + built.length + '</span><span class="ed-sl">Subject Files</span></div>';
        h += '<div class="ed-stat"><span class="ed-sn">' + totalSec + '</span><span class="ed-sl">Sections</span></div>';
        h += '<div class="ed-stat"><span class="ed-sn">' + totalStu + '</span><span class="ed-sl">Respondents</span></div>';
        h += '</div><div class="ed-list">';
        order.forEach(function (t) {
            var results = byTeacher[t];
            var ov = results.filter(function (r) { return r.overall != null; });
            var avg = ov.length ? (ov.reduce(function (a, r) { return a + r.overall; }, 0) / ov.length).toFixed(2) : '&mdash;';
            h += '<div class="panel ed-card">';
            h += '<div class="ed-card-h"><span class="ed-name">' + esc(t) + '</span><span class="ed-avg">Overall avg: ' + avg + '</span></div>';
            h += '<div class="ed-files">';
            results.forEach(function (r) {
                h += '<div class="ed-row">';
                h += '<span class="ed-rlabel">' + esc(r.subject || r.gradeLabel) + ' &middot; ' + esc(r.gradeTag || r.gradeLabel) + '</span>';
                h += '<span class="ed-rmeta">' + r.sections.length + ' section(s) &middot; ' + (r.students || 0) + ' respondent(s)' + (r.overall != null ? ' &middot; avg ' + r.overall.toFixed(2) : '') + '</span>';
                h += '<div class="ed-racts">';
                h += '<button class="tbtn" data-view="' + r.uid + '">View</button>';
                h += '<button class="tbtn" data-dl="' + r.uid + '">Download</button>';
                h += '</div></div>';
            });
            h += '</div></div>';
        });
        h += '</div>';
        host.innerHTML = h;
        host.querySelectorAll('[data-view]').forEach(function (b) {
            b.onclick = function () {
                var uid = +b.getAttribute('data-view');
                var r = built.filter(function (x) { return x.uid === uid; })[0];
                if (r && SMC.evalbuild && SMC.evalbuild.openView)
                    SMC.evalbuild.openView(r);
            };
        });
        host.querySelectorAll('[data-dl]').forEach(function (b) {
            b.onclick = function () {
                var uid = +b.getAttribute('data-dl');
                var r = built.filter(function (x) { return x.uid === uid; })[0];
                if (r && SMC.evalbuild && SMC.evalbuild.download)
                    SMC.evalbuild.download(r);
            };
        });
    }
    return { render: render };
})();
