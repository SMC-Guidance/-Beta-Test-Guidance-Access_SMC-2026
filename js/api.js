"use strict";
window.SMC = window.SMC || {};
SMC.api = (function () {
    var TOKEN_KEY = 'smc_token';
    function getToken() { try {
        return sessionStorage.getItem(TOKEN_KEY) || null;
    }
    catch (e) {
        return null;
    } }
    function setToken(t) { try {
        t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY);
    }
    catch (e) { } }
    function clearToken() { setToken(null); }
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
                var err = new Error(msg);
                err.code = res && res.code;
                throw err;
            }
            return res.data;
        });
    }
    return {
        getToken: getToken,
        setToken: setToken,
        clearToken: clearToken,
        login: function (username, password) {
            return call('login', { username: username, password: password }).then(function (d) {
                if (d && d.token)
                    setToken(d.token);
                return d;
            });
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
        setReportStatus: function (id, status) { return call('setReportStatus', { id: id, status: status }); }
    };
})();
