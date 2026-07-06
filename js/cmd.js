"use strict";
window.SMC = window.SMC || {};
SMC.cmd = (function () {
    var api = SMC.api;
    var isOpen = false, typed = '';
    var pend2fa = null;
    function cfg() { return (SMC.config && SMC.config.commandCenter) || {}; }
    function pass() { return String(cfg().passphrase || 'command').toLowerCase(); }
    function combo() { return cfg().combo || { ctrl: true, alt: true, key: 'k' }; }
    function curUser() { return window.__smcUser || null; }
    function line(text, cls) {
        var out = document.getElementById('cmdOut'); if (!out) return;
        var d = document.createElement('div'); d.className = 'cmd-row' + (cls ? ' ' + cls : ''); d.textContent = text; out.appendChild(d); out.scrollTop = out.scrollHeight;
    }
    function ensure() {
        var ov = document.getElementById('cmdOv');
        if (ov) return ov;
        ov = document.createElement('div'); ov.id = 'cmdOv'; ov.className = 'cmd-ov';
        ov.innerHTML = '<div class="cmd-box">' +
            '<div class="cmd-top"><span class="cmd-dot r"></span><span class="cmd-dot y"></span><span class="cmd-dot g"></span>' +
            '<span class="cmd-title">SMC Command Center</span><button class="cmd-x" id="cmdX">&times;</button></div>' +
            '<div class="cmd-out" id="cmdOut"></div>' +
            '<div class="cmd-line"><span class="cmd-ps">&gt;</span><input id="cmdIn" autocomplete="off" spellcheck="false" placeholder="type a command \u2014 try: help"></div></div>';
        document.body.appendChild(ov);
        document.getElementById('cmdX').addEventListener('click', close);
        ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
        var inp = document.getElementById('cmdIn');
        inp.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { var v = inp.value; inp.value = ''; run(v); }
            else if (e.key === 'Escape') { close(); }
        });
        line('SMC Command Center ready. Type help for commands.', 'sys');
        return ov;
    }
    function open() { ensure().classList.add('on'); isOpen = true; setTimeout(function () { var i = document.getElementById('cmdIn'); if (i) i.focus(); }, 30); }
    function close() { var ov = document.getElementById('cmdOv'); if (ov) ov.classList.remove('on'); isOpen = false; }
    function toggle() { isOpen ? close() : open(); }
    function run(raw) {
        var v = String(raw || '').trim(); if (!v) return;
        line('> ' + v, 'echo');
        var parts = v.split(/\s+/); var cmd = parts[0].toLowerCase(); var args = parts.slice(1);
        switch (cmd) {
            case 'help': return help();
            case 'clear': var o = document.getElementById('cmdOut'); if (o) o.innerHTML = ''; return;
            case 'status': return doStatus();
            case 'whoami': var u = curUser(); return line(u ? (u.name + ' (' + u.role + ')') : 'Not signed in.', 'sys');
            case 'login': return doCmdLogin(args);
            case 'code': return doCmd2fa(args);
            case 'setemail': return doCmdSetEmail(args);
            case 'unlock': return doUnlock(args);
            case 'lock': return doLock();
            case 'maintenance': case 'maint': return doMaint(args);
            case 'clearmessages': case 'clearchat': return doClearMessages();
            case 'admin': return goAdmin();
            case 'incidents': return goView('incidents');
            case 'setmax': return doSetMax(args);
            case 'setcode': return doSetCode(args);
            case 'resetattempts': return doReset();
            case 'logout': if (SMC.auth && SMC.auth.doLogout) { SMC.auth.doLogout(); line('Signed out.', 'sys'); } return;
            case 'exit': case 'close': return close();
            default: return line('Unknown command: ' + cmd + '  (type help)', 'err');
        }
    }
    function help() {
        ['Available commands:',
            '  help                 show this help',
            '  status               show site lock + security status',
            '  whoami               show the signed-in account',
            '  login <user> <pass>  sign in from the command center',
            '  unlock <code>        lift a site lock with the admin unlock code',
            '  lock                 (admin) lock the whole website',
            '  maintenance <msg>    (admin) lock the WHOLE site (everyone, incl. admins) with a message',
            '  maintenance off <code>  lift maintenance using the secret passcode (no login needed)',
            '  clearmessages        (admin) delete ALL chat messages for everyone',
            '  admin                (admin) open Staff & Access',
            '  incidents            open the Incident Reports section',
            '  setmax <n>           (admin) set max failed-login attempts',
            '  setcode <code>       (admin) set the site unlock code',
            '  resetattempts        (admin) reset the failed-login counter',
            '  logout               sign out',
            '  clear                clear the console',
            '  exit                 close the command center'
        ].forEach(function (t) { line(t, 'sys'); });
    }
    function doStatus() {
        api.securityStatus().then(function (s) {
            line('Site locked: ' + (s.locked ? 'YES' : 'no'), s.locked ? 'err' : 'ok');
            var u = curUser();
            if (u && u.role === 'admin') {
                api.getSecurity().then(function (d) {
                    line('Failed attempts: ' + d.attempts + ' / ' + d.maxAttempts, 'sys');
                    line('Custom unlock code set: ' + (d.hasUnlockCode ? 'yes' : 'no (falls back to registration code)'), 'sys');
                }).catch(function () { });
            }
        }).catch(function (e) { line(e.message || 'Could not read status.', 'err'); });
    }
    function doCmdLogin(args) {
        if (args.length < 2) return line('Usage: login <username> <password>', 'err');
        var u = args[0], p = args.slice(1).join(' ');
        line('Signing in...', 'sys');
        api.login(u, p).then(function (d) {
            if (d && d.token) { line('Welcome, ' + d.user.name + '.', 'ok'); close(); SMC.app.boot(d.user); return; }
            if (d && d.twofa === 'code_sent') {
                pend2fa = { u: u, p: p };
                line('A verification code was emailed to ' + (d.emailMasked || 'your email') + '.', 'sys');
                line('Enter it with:  code <the 6-digit code>', 'sys');
                return;
            }
            if (d && d.twofa === 'email_required') {
                pend2fa = { u: u, p: p };
                line('No email is on file for this account.', 'sys');
                line('Add one with:  setemail <your email>', 'sys');
                return;
            }
            line('Sign-in failed.', 'err');
        }).catch(function (e) { line(e.message || 'Login failed.', 'err'); });
    }
    function doCmd2fa(args) {
        if (!pend2fa) return line('Run login first.', 'err');
        if (args.length < 1) return line('Usage: code <the 6-digit code>', 'err');
        line('Verifying...', 'sys');
        api.verify2fa(pend2fa.u, pend2fa.p, args[0], true).then(function (d) {
            pend2fa = null; line('Welcome, ' + d.user.name + '.', 'ok'); close(); SMC.app.boot(d.user);
        }).catch(function (e) { line(e.message || 'Verification failed.', 'err'); });
    }
    function doCmdSetEmail(args) {
        if (!pend2fa) return line('Run login first.', 'err');
        if (args.length < 1) return line('Usage: setemail <your email>', 'err');
        line('Sending code...', 'sys');
        api.set2faEmail(pend2fa.u, pend2fa.p, args[0]).then(function (d) {
            line('A verification code was emailed to ' + (d.emailMasked || args[0]) + '.', 'sys');
            line('Enter it with:  code <the 6-digit code>', 'sys');
        }).catch(function (e) { line(e.message || 'Could not send code.', 'err'); });
    }
    function doUnlock(args) {
        if (!args.length) return line('Usage: unlock <code>', 'err');
        api.unlockSite(args.join(' ')).then(function () { line('Website unlocked.', 'ok'); if (SMC.app && SMC.app.hideLock) SMC.app.hideLock(); }).catch(function (e) { line(e.message || 'Unlock failed.', 'err'); });
    }
    function doLock() {
        api.setSecurity({ lock: true }).then(function () { line('Website locked. Others are blocked until you unlock.', 'ok'); }).catch(function (e) { line(e.message || 'Only admins can lock the site.', 'err'); });
    }
    function doMaint(args) {
        if (!args.length) return line('Usage: maintenance <message>   |   maintenance off <code>', 'err');
        if (args[0].toLowerCase() === 'off') {
            // Escape hatch: works WITHOUT being signed in (force-block logs
            // everyone out), so it always requires the secret passcode.
            var code = args.slice(1).join(' ');
            if (!code) return line('Usage: maintenance off <code>  (the secret maintenance passcode)', 'err');
            api.maintOff(code).then(function () {
                line('Maintenance mode OFF. The site is back online for everyone.', 'ok');
                if (SMC.app && SMC.app.hideSiteMaint) SMC.app.hideSiteMaint();
            }).catch(function (e) { line(e.message || 'Failed.', 'err'); });
            return;
        }
        // Turning maintenance ON still requires an admin session.
        var u = curUser();
        if (!(u && u.role === 'admin')) return line('Admin sign-in required to turn maintenance on.', 'err');
        var msg = args.join(' ');
        api.setSiteMaint(true, msg).then(function () {
            line('Maintenance mode ON. EVERYONE (including admins) is now locked out.', 'ok');
            line('To get back in: maintenance off <code>', 'sys');
        }).catch(function (e) { line(e.message || 'Failed.', 'err'); });
    }
    function doClearMessages() {
        var u = curUser();
        if (!(u && u.role === 'admin')) return line('Admin sign-in required to clear messages.', 'err');
        if (!window.confirm('Delete ALL chat messages for everyone? This cannot be undone.')) return line('Cancelled.', 'sys');
        api.clearMessages().then(function () { line('All chat messages have been deleted.', 'ok'); }).catch(function (e) { line(e.message || 'Failed.', 'err'); });
    }
    function goAdmin() {
        var u = curUser();
        if (!(u && u.role === 'admin')) return line('Admin sign-in required. Use: login <user> <pass>', 'err');
        close(); if (SMC.app && SMC.app.go) SMC.app.go('counselors');
    }
    function goView(v) { close(); if (SMC.app && SMC.app.go) SMC.app.go(v); }
    function doSetMax(args) {
        var n = parseInt(args[0], 10); if (isNaN(n)) return line('Usage: setmax <number>', 'err');
        api.setSecurity({ maxAttempts: n }).then(function (d) { line('Max attempts set to ' + d.maxAttempts + '.', 'ok'); }).catch(function (e) { line(e.message || 'Failed.', 'err'); });
    }
    function doSetCode(args) {
        if (!args.length) return line('Usage: setcode <newcode>', 'err');
        api.setSecurity({ unlockCode: args.join(' ') }).then(function () { line('Unlock code updated.', 'ok'); }).catch(function (e) { line(e.message || 'Failed.', 'err'); });
    }
    function doReset() {
        api.setSecurity({ resetAttempts: true }).then(function () { line('Failed-login counter reset.', 'ok'); }).catch(function (e) { line(e.message || 'Failed.', 'err'); });
    }
    function onKey(e) {
        var c = combo();
        if ((!!c.ctrl === !!(e.ctrlKey || e.metaKey)) && (!!c.alt === !!e.altKey) && (!!c.shift === !!e.shiftKey) && e.key && e.key.toLowerCase() === String(c.key).toLowerCase()) {
            e.preventDefault(); toggle(); return;
        }
        var t = e.target; var tag = t && t.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
        if (/^[a-z]$/i.test(e.key)) {
            typed = (typed + e.key.toLowerCase()).slice(-24);
            if (typed.indexOf(pass()) !== -1) { typed = ''; open(); }
        }
    }
    function init() { document.addEventListener('keydown', onKey); }
    return { init: init, open: open, close: close, toggle: toggle };
})();
