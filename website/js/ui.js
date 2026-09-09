"use strict";
window.SMC = window.SMC || {};
SMC.ui = (function () {
    var ENT = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };
    function esc(s) {
        if (s == null)
            return '';
        return String(s).replace(/[&<>"'`]/g, function (c) { return ENT[c]; });
    }
    function fmtDate(d) {
        if (!d)
            return '\u2014';
        var dt = new Date(d);
        return isNaN(dt.getTime())
            ? esc(d)
            : dt.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
    }
    var _toastTimer;
    function toast(msg, type) {
        var t = document.getElementById('toast');
        if (!t)
            return;
        t.textContent = msg;
        t.className = 'toast on' + (type ? ' ' + type : '');
        clearTimeout(_toastTimer);
        _toastTimer = setTimeout(function () { t.className = 'toast'; }, 3800);
    }
    function animCount(id, target) {
        var el = document.getElementById(id);
        if (!el)
            return;
        var start = parseInt(el.textContent, 10);
        if (isNaN(start))
            start = 0;
        var diff = target - start;
        if (!diff) {
            el.textContent = target;
            return;
        }
        var n = 0, steps = 20, t = setInterval(function () {
            n++;
            el.textContent = Math.round(start + diff / steps * n);
            if (n >= steps) {
                el.textContent = target;
                clearInterval(t);
            }
        }, 16);
    }
    function showErr(el, msg) { if (el) {
        el.textContent = msg;
        el.classList.add('on');
    } }
    return { esc: esc, fmtDate: fmtDate, toast: toast, animCount: animCount, showErr: showErr };
})();
