"use strict";
/* PWA bootstrap: registers the service worker and shows an Install button. */
(function () {
    // Register the service worker.
    if ('serviceWorker' in navigator) {
        // When a new service worker takes control, reload once so the page
        // immediately runs the newly cached HTML/CSS/JS (avoids the stale
        // "double reload" problem where updates don't appear).
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

    var deferred = null;

    function makeBtn() {
        if (document.getElementById('pwaInstallBtn')) return document.getElementById('pwaInstallBtn');
        var b = document.createElement('button');
        b.id = 'pwaInstallBtn';
        b.type = 'button';
        b.className = 'pwa-install';
        b.setAttribute('aria-label', 'Install app');
        b.innerHTML = '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg><span>Install app</span>';
        b.style.display = 'none';
        b.addEventListener('click', function () {
            if (!deferred) return;
            deferred.prompt();
            deferred.userChoice.then(function () { deferred = null; hide(); });
        });
        document.body.appendChild(b);
        return b;
    }
    function show() { var b = makeBtn(); b.style.display = 'inline-flex'; }
    function hide() { var b = document.getElementById('pwaInstallBtn'); if (b) b.style.display = 'none'; }

    window.addEventListener('beforeinstallprompt', function (e) {
        e.preventDefault();
        deferred = e;
        // Only offer once the DOM is ready.
        if (document.body) show();
        else window.addEventListener('DOMContentLoaded', show);
    });

    function pwaInstructions() {
        var ua = navigator.userAgent || '';
        var msg = /iPhone|iPad|iPod/i.test(ua)
            ? 'To install: tap the Share button in your browser, then "Add to Home Screen".'
            : 'To install: open your browser menu and choose "Install app" or "Add to Home screen".';
        if (window.SMC && SMC.ui && SMC.ui.toast) SMC.ui.toast(msg, 'ok'); else alert(msg);
    }
    function bindAuthInstall() {
        var b = document.getElementById('authInstallBtn');
        if (!b) return;
        b.addEventListener('click', function () {
            if (deferred) { deferred.prompt(); deferred.userChoice.then(function () { deferred = null; hide(); }); }
            else pwaInstructions();
        });
    }
    if (document.readyState !== 'loading') bindAuthInstall();
    else window.addEventListener('DOMContentLoaded', bindAuthInstall);

    window.addEventListener('appinstalled', function () {
        deferred = null;
        hide();
        if (window.SMC && SMC.ui && SMC.ui.toast) SMC.ui.toast('App installed. You can open it from your home screen.', 'ok');
    });
})();
