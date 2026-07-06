"use strict";
window.SMC = window.SMC || {};
SMC.auth = (function () {
    var ui = SMC.ui, api = SMC.api;
    var pend = null;
    function switchTab(t) {
        var toL = t === 'login';
        document.getElementById('tabLogin').classList.toggle('on', toL);
        document.getElementById('tabReg').classList.toggle('on', !toL);
        document.getElementById('loginForm').classList.toggle('on', toL);
        document.getElementById('registerForm').classList.toggle('on', !toL);
        document.getElementById('liErr').classList.remove('on');
        document.getElementById('regErr').classList.remove('on');
    }
    function doLogin() {
        var u = document.getElementById('liUser').value.trim();
        var p = document.getElementById('liPass').value;
        var err = document.getElementById('liErr');
        var btn = document.getElementById('doLoginBtn');
        err.classList.remove('on');
        if (!u || !p) {
            ui.showErr(err, 'Please fill in all fields.');
            return;
        }
        btn.disabled = true;
        btn.textContent = 'Signing in\u2026';
        api.login(u, p).then(function (d) {
            btn.disabled = false;
            btn.textContent = 'Sign In';
            document.getElementById('liPass').value = '';
            if (d && d.twofa) {
                pend = { u: u, p: p };
                tfaOpen(d.twofa, d.emailMasked);
                return;
            }
            if (d.user && d.user.role === 'admin') {
                api.clearToken();
                ui.showErr(err, 'Administrator sign-in is disabled here. Please use the Command Center to access the admin section.');
                return;
            }
            SMC.app.boot(d.user);
        }).catch(function (e) {
            btn.disabled = false;
            btn.textContent = 'Sign In';
            document.getElementById('liPass').value = '';
            if (e.code === 'LOCKED' && SMC.app && SMC.app.showLock) SMC.app.showLock();
            ui.showErr(err, e.message || 'Incorrect username or password.');
        });
    }
    function doRegister() {
        var name = document.getElementById('regName').value.trim();
        var u = document.getElementById('regUser').value.trim();
        var p = document.getElementById('regPass').value;
        var email = document.getElementById('regEmail').value.trim();
        var code = document.getElementById('regCode').value;
        var err = document.getElementById('regErr');
        var btn = document.getElementById('doRegBtn');
        err.classList.remove('on');
        if (!name || !u || !p || !email || !code) {
            ui.showErr(err, 'Please fill in all fields.');
            return;
        }
        if (email.indexOf('@') < 1 || email.indexOf('.') === -1) {
            ui.showErr(err, 'Please enter a valid email address.');
            return;
        }
        if (!/^[a-zA-Z0-9_]{3,30}$/.test(u)) {
            ui.showErr(err, 'Username: 3\u201330 chars, letters/numbers/underscores only.');
            return;
        }
        if (p.length < 8 || !/[A-Z]/.test(p) || !/[0-9]/.test(p)) {
            ui.showErr(err, 'Password needs 8+ characters, 1 uppercase letter, and 1 number.');
            return;
        }
        btn.disabled = true;
        btn.textContent = 'Creating\u2026';
        api.register({ name: name, username: u, password: p, email: email, code: code }).then(function () {
            btn.disabled = false;
            btn.textContent = 'Create Account';
            ui.toast('Account created \u2014 you can now sign in.', 'ok');
            ['regName', 'regUser', 'regPass', 'regEmail', 'regCode'].forEach(function (id) { document.getElementById(id).value = ''; });
            switchTab('login');
            if (SMC.app && SMC.app.showTutorial)
                SMC.app.showTutorial();
        }).catch(function (e) {
            btn.disabled = false;
            btn.textContent = 'Create Account';
            ui.showErr(err, e.message || 'Registration failed.');
        });
    }
    function tfaOpen(mode, masked) {
        var ov = document.getElementById('tfaOverlay');
        if (!ov) return;
        ov.classList.add('on');
        ov.setAttribute('aria-hidden', 'false');
        var emailWrap = document.getElementById('tfaEmailWrap');
        var codeInput = document.getElementById('tfaCode');
        var rememberRow = document.getElementById('tfaRemember').parentNode;
        document.getElementById('tfaErr').classList.remove('on');
        var vbtn = document.getElementById('tfaVerifyBtn');
        if (mode === 'email_required') {
            document.getElementById('tfaTitle').textContent = 'Add your email';
            document.getElementById('tfaMsg').textContent = 'For two-step sign-in, add an email address. We will send a verification code to it.';
            emailWrap.style.display = '';
            codeInput.style.display = 'none';
            rememberRow.style.display = 'none';
            document.getElementById('tfaResend').style.display = 'none';
            vbtn.textContent = 'Send code';
            setTimeout(function () { document.getElementById('tfaEmail').focus(); }, 30);
        } else {
            document.getElementById('tfaTitle').textContent = 'Verify your identity';
            document.getElementById('tfaMsg').textContent = 'Enter the 6-digit code we emailed to ' + (masked || 'your email') + '.';
            emailWrap.style.display = 'none';
            codeInput.style.display = '';
            codeInput.value = '';
            rememberRow.style.display = '';
            document.getElementById('tfaResend').style.display = '';
            vbtn.textContent = 'Verify & continue';
            setTimeout(function () { codeInput.focus(); }, 30);
        }
    }
    function tfaClose() {
        var ov = document.getElementById('tfaOverlay');
        if (ov) { ov.classList.remove('on'); ov.setAttribute('aria-hidden', 'true'); }
        pend = null;
    }
    function tfaSubmit() {
        if (!pend) return;
        var err = document.getElementById('tfaErr');
        var btn = document.getElementById('tfaVerifyBtn');
        err.classList.remove('on');
        if (document.getElementById('tfaEmailWrap').style.display !== 'none') {
            var email = document.getElementById('tfaEmail').value.trim();
            if (!email || email.indexOf('@') < 1 || email.indexOf('.') === -1) { ui.showErr(err, 'Please enter a valid email address.'); return; }
            btn.disabled = true; btn.textContent = 'Sending...';
            api.set2faEmail(pend.u, pend.p, email).then(function (d) {
                btn.disabled = false;
                tfaOpen('code_sent', d && d.emailMasked);
            }).catch(function (e) { btn.disabled = false; btn.textContent = 'Send code'; ui.showErr(err, e.message || 'Could not send code.'); });
            return;
        }
        var code = document.getElementById('tfaCode').value.trim();
        if (!code) { ui.showErr(err, 'Enter the code from your email.'); return; }
        var remember = document.getElementById('tfaRemember').checked;
        btn.disabled = true; btn.textContent = 'Verifying...';
        api.verify2fa(pend.u, pend.p, code, remember).then(function (d) {
            btn.disabled = false; btn.textContent = 'Verify & continue';
            var user = d.user; pend = null; tfaClose();
            if (user && user.role === 'admin') {
                api.clearToken();
                ui.toast('Administrator sign-in is disabled here. Use the Command Center.', 'err');
                return;
            }
            SMC.app.boot(user);
        }).catch(function (e) { btn.disabled = false; btn.textContent = 'Verify & continue'; ui.showErr(err, e.message || 'Incorrect code.'); });
    }
    function tfaResend() {
        if (!pend) return;
        var err = document.getElementById('tfaErr');
        api.resend2fa(pend.u, pend.p).then(function (d) {
            ui.toast('A new code was sent.', 'ok');
            document.getElementById('tfaMsg').textContent = 'Enter the 6-digit code we emailed to ' + ((d && d.emailMasked) || 'your email') + '.';
        }).catch(function (e) { ui.showErr(err, e.message || 'Could not resend.'); });
    }
    function doLogout() {
        api.clearToken();
        SMC.app.reset();
        SMC.app.showScreen('authScreen');
    }
    function bind() {
        document.getElementById('tabLogin').addEventListener('click', function () { switchTab('login'); });
        document.getElementById('tabReg').addEventListener('click', function () { switchTab('register'); });
        document.getElementById('goReg').addEventListener('click', function () { switchTab('register'); });
        document.getElementById('goLogin').addEventListener('click', function () { switchTab('login'); });
        document.getElementById('doLoginBtn').addEventListener('click', doLogin);
        document.getElementById('liPass').addEventListener('keydown', function (e) { if (e.key === 'Enter')
            doLogin(); });
        document.getElementById('doRegBtn').addEventListener('click', doRegister);
        var tv = document.getElementById('tfaVerifyBtn');
        if (tv) tv.addEventListener('click', tfaSubmit);
        var tr = document.getElementById('tfaResend');
        if (tr) tr.addEventListener('click', tfaResend);
        var tc = document.getElementById('tfaCancel');
        if (tc) tc.addEventListener('click', tfaClose);
        var tcode = document.getElementById('tfaCode');
        if (tcode) tcode.addEventListener('keydown', function (e) { if (e.key === 'Enter') tfaSubmit(); });
        var temail = document.getElementById('tfaEmail');
        if (temail) temail.addEventListener('keydown', function (e) { if (e.key === 'Enter') tfaSubmit(); });
        var goTut = document.getElementById('goTut');
        if (goTut)
            goTut.addEventListener('click', function () { if (SMC.app && SMC.app.showTutorial) SMC.app.showTutorial(); });
    }
    return { bind: bind, switchTab: switchTab, doLogout: doLogout };
})();
