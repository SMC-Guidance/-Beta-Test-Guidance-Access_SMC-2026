"use strict";
/* PWA bootstrap: registers the service worker and offers an Install button.
   - Chrome / Edge / Android: uses the native beforeinstallprompt.
   - iPhone / iPad / Mac Safari: no native prompt exists, so we show an
     Install button that opens step-by-step "Add to Home Screen / Add to Dock"
     instructions. */
(function () {
    // ---- Service worker registration ----
    if ('serviceWorker' in navigator) {
        var refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', function () {
            if (refreshing) return;
            refreshing = true;
            window.location.reload();
        });
        window.addEventListener('load', function () {
            navigator.serviceWorker.register('sw.js').then(function (reg) {
                if (reg && reg.update) { try { reg.update(); } catch (e) { } }
            }).catch(function () { });
        });
    }

    // ---- Device / display detection ----
    var ua = navigator.userAgent || '';
    var isIOS = /iPhone|iPad|iPod/i.test(ua) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS 13+ masquerades as Mac
    var isIPad = /iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var isMac = /Macintosh|Mac OS X/i.test(ua) && !isIOS;
    var isSafari = /Safari/i.test(ua) && !/Chrome|CriOS|Chromium|Edg|EdgiOS|FxiOS|OPR|Opera|Android/i.test(ua);
    function isStandalone() {
        return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
            window.navigator.standalone === true;
    }

    var deferred = null;

    // ---- Floating install button ----
    function makeBtn() {
        var existing = document.getElementById('pwaInstallBtn');
        if (existing) return existing;
        var b = document.createElement('button');
        b.id = 'pwaInstallBtn';
        b.type = 'button';
        b.className = 'pwa-install';
        b.setAttribute('aria-label', 'Install app');
        b.innerHTML = '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg><span>Install app</span>';
        b.style.display = 'none';
        b.addEventListener('click', onInstallClick);
        document.body.appendChild(b);
        return b;
    }
    function show() { var b = makeBtn(); b.style.display = 'inline-flex'; }
    function hide() { var b = document.getElementById('pwaInstallBtn'); if (b) b.style.display = 'none'; }

    function onInstallClick() {
        if (deferred) {
            deferred.prompt();
            deferred.userChoice.then(function () { deferred = null; hide(); });
            return;
        }
        openGuide();
    }

    // ---- iOS / Mac "how to install" guide modal ----
    var shareIcon = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3"/><path d="M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
    var plusIcon = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>';

    function guideSteps() {
        if (isMac) {
            return {
                head: 'Add to your Mac Dock',
                note: 'Use <strong>Safari</strong> on macOS Sonoma or later. (In Chrome on Mac, use the install icon in the address bar instead.)',
                steps: [
                    { ic: shareIcon, t: 'Click the <strong>Share</strong> button in the Safari toolbar (or open the <strong>File</strong> menu).' },
                    { ic: plusIcon, t: 'Choose <strong>Add to Dock…</strong>' },
                    { ic: null, t: 'Click <strong>Add</strong>. The app now opens in its own window from your Dock.' }
                ]
            };
        }
        var where = isIPad ? 'top-right corner' : 'bottom bar';
        return {
            head: 'Add to your Home Screen',
            note: 'You must use <strong>Safari</strong> on your ' + (isIPad ? 'iPad' : 'iPhone') + ' (Chrome and other apps can\u2019t install it on iOS).',
            steps: [
                { ic: shareIcon, t: 'Tap the <strong>Share</strong> button in the ' + where + ' of Safari.' },
                { ic: plusIcon, t: 'Scroll down and tap <strong>Add to Home Screen</strong>.' },
                { ic: null, t: 'Tap <strong>Add</strong> in the top corner. The app appears on your Home Screen like any other app.' }
            ]
        };
    }

    function openGuide() {
        closeGuide();
        var g = guideSteps();
        var ov = document.createElement('div');
        ov.id = 'pwaGuideOv';
        ov.className = 'pwa-guide-ov';
        var stepsHtml = g.steps.map(function (s, i) {
            return '<li class="pwa-guide-step">' +
                '<span class="pwa-guide-num">' + (i + 1) + '</span>' +
                '<span class="pwa-guide-tx">' + s.t + '</span>' +
                (s.ic ? '<span class="pwa-guide-ic">' + s.ic + '</span>' : '') +
                '</li>';
        }).join('');
        ov.innerHTML = '<div class="pwa-guide" role="dialog" aria-modal="true" aria-label="Install app">' +
            '<button class="pwa-guide-x" id="pwaGuideX" aria-label="Close">&times;</button>' +
            '<div class="pwa-guide-h">' +
            '<div class="pwa-guide-logo"><img src="assets/icons/icon-192.png" alt="" onerror="this.style.display=\'none\'"></div>' +
            '<div><strong>' + g.head + '</strong><small>Install SMC Guidance for quick, full-screen access \u2014 works offline too.</small></div>' +
            '</div>' +
            '<ol class="pwa-guide-steps">' + stepsHtml + '</ol>' +
            '<p class="pwa-guide-note">' + g.note + '</p>' +
            '<button class="pwa-guide-done" id="pwaGuideDone">Got it</button>' +
            '</div>';
        document.body.appendChild(ov);
        requestAnimationFrame(function () { ov.classList.add('on'); });
        ov.addEventListener('click', function (e) { if (e.target === ov) closeGuide(); });
        var x = document.getElementById('pwaGuideX'); if (x) x.addEventListener('click', closeGuide);
        var d = document.getElementById('pwaGuideDone'); if (d) d.addEventListener('click', closeGuide);
        document.addEventListener('keydown', escClose);
    }
    function escClose(e) { if (e.key === 'Escape') closeGuide(); }
    function closeGuide() {
        document.removeEventListener('keydown', escClose);
        var ov = document.getElementById('pwaGuideOv');
        if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
    }

    // ---- Wiring ----
    window.addEventListener('beforeinstallprompt', function (e) {
        e.preventDefault();
        deferred = e;
        if (document.body) show();
        else window.addEventListener('DOMContentLoaded', show);
    });

    function maybeShowForApple() {
        if (isStandalone()) return;            // already installed / launched from home screen
        if (isIOS || (isMac && isSafari)) show(); // no native prompt on Apple; show manual button
    }
    if (document.readyState === 'complete' || document.readyState === 'interactive') maybeShowForApple();
    else window.addEventListener('DOMContentLoaded', maybeShowForApple);
    window.addEventListener('load', maybeShowForApple);

    // Optional in-app trigger (e.g. a menu/help button with this id).
    function bindManualTriggers() {
        ['authInstallBtn', 'installAppBtn', 'pmInstall'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el && !el.__pwaBound) { el.__pwaBound = true; el.addEventListener('click', onInstallClick); }
        });
    }
    if (document.readyState !== 'loading') bindManualTriggers();
    else window.addEventListener('DOMContentLoaded', bindManualTriggers);

    window.addEventListener('appinstalled', function () {
        deferred = null;
        hide();
        if (window.SMC && SMC.ui && SMC.ui.toast) SMC.ui.toast('App installed. Open it from your home screen or Dock.', 'ok');
    });

    // Expose so other UI can open the guide/prompt.
    window.SMC = window.SMC || {};
    window.SMC.pwaInstall = onInstallClick;
})();
