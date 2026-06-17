"use strict";
window.SMC = window.SMC || {};
SMC.auth = (function () {
    var ui = SMC.ui, api = SMC.api;
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
            SMC.app.boot(d.user);
        }).catch(function (e) {
            btn.disabled = false;
            btn.textContent = 'Sign In';
            document.getElementById('liPass').value = '';
            ui.showErr(err, e.message || 'Incorrect username or password.');
        });
    }
    function doRegister() {
        var name = document.getElementById('regName').value.trim();
        var u = document.getElementById('regUser').value.trim();
        var p = document.getElementById('regPass').value;
        var code = document.getElementById('regCode').value;
        var err = document.getElementById('regErr');
        var btn = document.getElementById('doRegBtn');
        err.classList.remove('on');
        if (!name || !u || !p || !code) {
            ui.showErr(err, 'Please fill in all fields.');
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
        api.register({ name: name, username: u, password: p, code: code }).then(function () {
            btn.disabled = false;
            btn.textContent = 'Create Account';
            ui.toast('Account created \u2014 you can now sign in.', 'ok');
            ['regName', 'regUser', 'regPass', 'regCode'].forEach(function (id) { document.getElementById(id).value = ''; });
            switchTab('login');
            if (SMC.app && SMC.app.showTutorial)
                SMC.app.showTutorial();
        }).catch(function (e) {
            btn.disabled = false;
            btn.textContent = 'Create Account';
            ui.showErr(err, e.message || 'Registration failed.');
        });
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
        var goTut = document.getElementById('goTut');
        if (goTut)
            goTut.addEventListener('click', function () { if (SMC.app && SMC.app.showTutorial) SMC.app.showTutorial(); });
    }
    return { bind: bind, switchTab: switchTab, doLogout: doLogout };
})();
