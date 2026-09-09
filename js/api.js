"use strict";
window.SMC = window.SMC || {};
SMC.api = (function () {
    // Session token persists in localStorage so it survives closing the tab,
    // restarting the browser, or a phone backgrounding the installed app.
    // (It used to live in sessionStorage, which is wiped in those cases and
    // caused the random logouts.) The session still expires server-side via
    // SESSION_TTL_H, and renews automatically while the user is active.
    var TOKEN_KEY = 'smc_token';
    function getToken() { try {
        return localStorage.getItem(TOKEN_KEY) || null;
    }
    catch (e) {
        return null;
    } }
    function setToken(t) { try {
        t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);
    }
    catch (e) { } }
    function clearToken() { setToken(null); }
    function deviceId() {
        try {
            var d = localStorage.getItem('smc_device');
            if (!d) {
                d = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
                localStorage.setItem('smc_device', d);
            }
            return d;
        }
        catch (e) { return ''; }
    }
    function call(action, payload) {
        var url = (SMC.config && SMC.config.apiUrl) || '';
        if (!url || url.indexOf('PASTE_') === 0) {
            return Promise.reject(new Error('Backend not configured. Set SMC.config.apiUrl in js/config.js.'));
        }
        var body = JSON.stringify({
            action: action,
            token: getToken(),
            payload: payload || {}
        });
        return fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: body
        }).then(function (r) {
            return r.json().catch(function () { throw new Error('Bad server response.'); });
        }).then(function (res) {
            if (!res || res.ok !== true) {
                var msg = (res && res.error) || 'Request failed.';
                if (res && res.code === 'AUTH') {
                    clearToken();
                }
                // Force-block: the server refused because the whole site is in
                // maintenance. Show the maintenance screen to everyone at once.
                if (res && res.code === 'MAINTENANCE' && window.SMC && SMC.app && SMC.app.showSiteMaint) {
                    try { SMC.app.showSiteMaint(msg); } catch (e2) { }
                }
                var err = new Error(msg);
                err.code = res && res.code;
                throw err;
            }
            // Sliding session: the server returns a fresh token when the current
            // one is past half its life, so active users are never logged out.
            if (res.token) setToken(res.token);
            return res.data;
        });
    }
    return {
        getToken: getToken,
        setToken: setToken,
        clearToken: clearToken,
        login: function (username, password) {
            return call('login', { username: username, password: password, deviceId: deviceId() }).then(function (d) {
                if (d && d.token)
                    setToken(d.token);
                return d;
            });
        },
        verify2fa: function (username, password, code, remember) {
            return call('verify2fa', { username: username, password: password, code: code, deviceId: deviceId(), remember: !!remember }).then(function (d) {
                if (d && d.token)
                    setToken(d.token);
                return d;
            });
        },
        set2faEmail: function (username, password, email) {
            return call('set2faEmail', { username: username, password: password, email: email, deviceId: deviceId() });
        },
        resend2fa: function (username, password) {
            return call('resend2fa', { username: username, password: password, deviceId: deviceId() });
        },
        register: function (data) { return call('register', data); },
        me: function () { return call('me', {}); },
        records: function () { return call('records', {}); },
        publicStats: function () { return call('publicStats', {}); },
        listUsers: function () { return call('listUsers', {}); },
        deleteUser: function (username) { return call('deleteUser', { username: username }); },
        setRole: function (username, role) { return call('setRole', { username: username, role: role }); },
        listEvaluations: function () { return call('listEvaluations', {}); },
        saveEvaluation: function (data) { return call('saveEvaluation', data); },
        deleteEvaluation: function (id) { return call('deleteEvaluation', { id: id }); },
        evalTemplates: function () { return call('evalTemplates', {}); },
        evalSheetColumns: function (sheetId, tabName) { return call('evalSheetColumns', { sheetId: sheetId, tabName: tabName }); },
        listEvalConfigs: function () { return call('listEvalConfigs', {}); },
        saveEvalConfig: function (data) { return call('saveEvalConfig', data); },
        deleteEvalConfig: function (id) { return call('deleteEvalConfig', { id: id }); },
        processEval: function (id) { return call('processEval', { id: id }); },
        quickProcessEval: function (sheetId, tabName) { return call('quickProcessEval', { sheetId: sheetId, tabName: tabName }); },
        listForms: function () { return call('listForms', {}); },
        getFormResponses: function (fileId) { return call('getFormResponses', { fileId: fileId }); },
        getMaintenance: function () { return call('getMaintenance', {}); },
        setMaintenance: function (view, on) { return call('setMaintenance', { view: view, on: !!on }); },
        getProfile: function () { return call('getProfile', {}); },
        saveProfile: function (data) { return call('saveProfile', data); },
        saveReport: function (message) { return call('saveReport', { message: message }); },
        listReports: function () { return call('listReports', {}); },
        setReportStatus: function (id, status) { return call('setReportStatus', { id: id, status: status }); },
        listIncidents: function () { return call('listIncidents', {}); },
        saveIncident: function (data) { return call('saveIncident', data); },
        deleteIncident: function (id) { return call('deleteIncident', { id: id }); },
        listClassFlags: function () { return call('listClassFlags', {}); },
        saveClassFlag: function (data) { return call('saveClassFlag', data); },
        getClassColors: function () { return call('getClassColors', {}); },
        setClassColor: function (data) { return call('setClassColor', data); },
        listRoutine: function () { return call('listRoutine', {}); },
        saveRoutine: function (data) { return call('saveRoutine', data); },
        securityStatus: function () { return call('securityStatus', {}); },
        unlockSite: function (code) { return call('unlockSite', { code: code }); },
        getSecurity: function () { return call('getSecurity', {}); },
        setSecurity: function (data) { return call('setSecurity', data); },
        chatPoll: function () { return call('chatPoll', {}); },
        getThread: function (withUser) { return call('getThread', { withUser: withUser }); },
        sendMessage: function (to, text) { return call('sendMessage', { to: to, text: text }); },
        chatDirectory: function () { return call('chatDirectory', {}); },
        broadcast: function (text, to) { return call('chatBroadcast', { text: text, to: to || '' }); },
        deleteMessage: function (id) { return call('deleteMessage', { id: id }); },
        clearMessages: function () { return call('clearMessages', {}); },
        unsendMessage: function (id) { return call('unsendMessage', { id: id }); },
        setChatMute: function (username, muted) { return call('setChatMute', { username: username, muted: muted }); },
        setPresenceMode: function (mode) { return call('setPresenceMode', { mode: mode }); },
        getSiteMaint: function () { return call('getSiteMaint', {}); },
        setSiteMaint: function (on, message) { return call('setSiteMaint', { on: !!on, message: message || '' }); },
        maintOff: function (code) { return call('maintOff', { code: code }); },
        createShare: function (data) { return call('createShare', data || {}); },
        getShared: function (token) { return call('getShared', { token: token }); },
        listShares: function () { return call('listShares', {}); },
        revokeShare: function (token) { return call('revokeShare', { token: token }); }
    };
})();
