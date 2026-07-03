"use strict";
var FIELD_MAP = {
    name: 1, grade: 2, age: 3, sex: 4, referralSource: 5, teacherReferral: 6,
    modality: 7, date: 8, recordNo: 9, sessionNo: 10, issueCategory: 11,
    issueDescription: 12, grooming: 13, eyeContact: 14, speech: 15,
    verbalComprehension: 16, grossMotor: 17, fineMotor: 18, compliance: 19,
    emotionalTone: 20, emotionalManagement: 21, observationRemarks: 22,
    studentReport: 23, actionsTaken: 24, progressEvaluation: 25, designate: 26
};
function doPost(e) {
    try {
        var req = JSON.parse(e.postData.contents || '{}');
        var action = req.action;
        var payload = req.payload || {};
        var session = verifyToken(req.token);
        switch (action) {
            case 'login': return ok(handleLogin(payload));
            case 'register': return ok(handleRegister(payload));
            case 'publicStats': return ok(handlePublicStats());
            case 'me': return ok(requireAuth(session));
            case 'records': return ok(handleRecords(requireAuth(session)));
            case 'listUsers': return ok(handleListUsers(requireStaff(session)));
            case 'deleteUser': return ok(handleDeleteUser(requireAdmin(session), payload));
            case 'setRole': return ok(handleSetRole(requireAdmin(session), payload));
            case 'listEvaluations': return ok(handleListEvaluations(requireAuth(session)));
            case 'saveEvaluation': return ok(handleSaveEvaluation(requireAuth(session), payload));
            case 'deleteEvaluation': return ok(handleDeleteEvaluation(requireStaff(session), payload));
            case 'evalTemplates': return ok(handleEvalTemplates());
            case 'evalSheetColumns': return ok(handleEvalSheetColumns(requireStaff(session), payload));
            case 'listEvalConfigs': return ok(handleListEvalConfigs(requireStaff(session)));
            case 'saveEvalConfig': return ok(handleSaveEvalConfig(requireStaff(session), payload));
            case 'deleteEvalConfig': return ok(handleDeleteEvalConfig(requireStaff(session), payload));
            case 'processEval': return ok(handleProcessEval(requireStaff(session), payload));
            case 'quickProcessEval': return ok(handleQuickProcess(requireStaff(session), payload));
            case 'listForms': return ok(handleListForms(requireAuth(session)));
            case 'getFormResponses': return ok(handleGetFormResponses(requireAuth(session), payload));
            case 'getMaintenance': return ok(handleGetMaintenance(session));
            case 'setMaintenance': return ok(handleSetMaintenance(requireAdmin(session), payload));
            case 'getProfile': return ok(handleGetProfile(requireAuth(session)));
            case 'saveProfile': return ok(handleSaveProfile(requireAuth(session), payload));
            case 'saveReport': return ok(handleSaveReport(requireAuth(session), payload));
            case 'listReports': return ok(handleListReports(requireAdmin(session)));
            case 'setReportStatus': return ok(handleSetReportStatus(requireAdmin(session), payload));
            case 'listIncidents': return ok(handleListIncidents(requireAuth(session)));
            case 'saveIncident': return ok(handleSaveIncident(requireAuth(session), payload));
            case 'deleteIncident': return ok(handleDeleteIncident(requireStaff(session), payload));
            case 'securityStatus': return ok(handleSecurityStatus());
            case 'unlockSite': return ok(handleUnlockSite(payload));
            case 'getSecurity': return ok(handleGetSecurity(requireAdmin(session)));
            case 'setSecurity': return ok(handleSetSecurity(requireAdmin(session), payload));
            case 'getClassColors': return ok(handleGetClassColors(session));
            case 'setClassColor': return ok(handleSetClassColor(requireAuth(session), payload));
            case 'chatPoll': return ok(handleChatPoll(requireAuth(session)));
            case 'getThread': return ok(handleGetThread(requireAuth(session), payload));
            case 'sendMessage': return ok(handleSendMessage(requireAuth(session), payload));
            case 'chatDirectory': return ok(handleChatDirectory(requireAuth(session)));
            default: return fail('Unknown action.', 'BAD_REQUEST');
        }
    }
    catch (err) {
        return fail(err.message || 'Server error.', err.code || 'ERROR');
    }
}
function handleGetMaintenance(session) {
    var raw = prop('MAINTENANCE', '{}');
    var map;
    try {
        map = JSON.parse(raw) || {};
    }
    catch (e) {
        map = {};
    }
    return { maintenance: map };
}
function handleSetMaintenance(session, p) {
    var view = String(p && p.view || '').trim();
    if (!view)
        throw httpError('A view key is required.', 'BAD_REQUEST');
    var raw = prop('MAINTENANCE', '{}');
    var map;
    try {
        map = JSON.parse(raw) || {};
    }
    catch (e) {
        map = {};
    }
    if (p.on)
        map[view] = true;
    else
        delete map[view];
    props().setProperty('MAINTENANCE', JSON.stringify(map));
    return { maintenance: map };
}
var PROFILE_HEADERS = ['username', 'name', 'role', 'notes', 'photo', 'updatedAt'];
function profileSheet() { return sheetOrCreate('Profiles', PROFILE_HEADERS); }
function profileCols(values) {
    var head = values[0].map(function (h) { return String(h).trim().toLowerCase(); });
    return {
        username: head.indexOf('username'), name: head.indexOf('name'), role: head.indexOf('role'),
        notes: head.indexOf('notes'), photo: head.indexOf('photo'), updatedAt: head.indexOf('updatedat')
    };
}
function handleGetProfile(session) {
    var sh = profileSheet();
    var values = sh.getDataRange().getValues();
    var c = profileCols(values);
    var uname = String(session.username).trim().toLowerCase();
    for (var r = 1; r < values.length; r++) {
        if (String(values[r][c.username]).trim().toLowerCase() === uname) {
            return { profile: {
                    name: String(values[r][c.name] || ''), role: String(values[r][c.role] || ''),
                    notes: String(values[r][c.notes] || ''), photo: String(values[r][c.photo] || ''),
                    updatedAt: String(values[r][c.updatedAt] || '')
                } };
        }
    }
    return { profile: { name: '', role: '', notes: '', photo: '', updatedAt: '' } };
}
function handleSaveProfile(session, p) {
    var name = String(p && p.name || '').slice(0, 120);
    var role = String(p && p.role || '').slice(0, 120);
    var notes = String(p && p.notes || '').slice(0, 4000);
    var photo = String(p && p.photo || '');
    if (photo.length > 48000)
        throw httpError('Photo is too large even after compression. Please pick a smaller image.', 'BAD_REQUEST');
    var sh = profileSheet();
    var values = sh.getDataRange().getValues();
    var c = profileCols(values);
    var uname = String(session.username).trim().toLowerCase();
    var now = new Date().toISOString();
    for (var r = 1; r < values.length; r++) {
        if (String(values[r][c.username]).trim().toLowerCase() === uname) {
            sh.getRange(r + 1, c.name + 1).setValue(name);
            sh.getRange(r + 1, c.role + 1).setValue(role);
            sh.getRange(r + 1, c.notes + 1).setValue(notes);
            sh.getRange(r + 1, c.photo + 1).setValue(photo);
            sh.getRange(r + 1, c.updatedAt + 1).setValue(now);
            return { profile: { name: name, role: role, notes: notes, photo: photo, updatedAt: now } };
        }
    }
    sh.appendRow([session.username, name, role, notes, photo, now]);
    return { profile: { name: name, role: role, notes: notes, photo: photo, updatedAt: now } };
}
var REPORT_HEADERS = ['id', 'username', 'name', 'role', 'message', 'status', 'createdAt'];
function reportSheet() { return sheetOrCreate('Reports', REPORT_HEADERS); }
function reportCols(values) {
    var head = values[0].map(function (h) { return String(h).trim().toLowerCase(); });
    return {
        id: head.indexOf('id'), username: head.indexOf('username'), name: head.indexOf('name'),
        role: head.indexOf('role'), message: head.indexOf('message'),
        status: head.indexOf('status'), createdAt: head.indexOf('createdat')
    };
}
function handleSaveReport(session, p) {
    var message = String(p && p.message || '').trim().slice(0, 4000);
    if (!message)
        throw httpError('Report message is required.', 'BAD_REQUEST');
    var sh = reportSheet();
    var id = 'r' + Date.now() + Math.floor(Math.random() * 1000);
    var now = new Date().toISOString();
    sh.appendRow([id, session.username, session.name || '', session.role || '', message, 'Open', now]);
    return { id: id, message: message, status: 'Open', createdAt: now };
}
function handleListReports(session) {
    var sh = reportSheet();
    var values = sh.getDataRange().getValues();
    var c = reportCols(values);
    var out = [];
    for (var r = 1; r < values.length; r++) {
        if (!values[r][c.id] && !values[r][c.message]) continue;
        out.push({
            id: String(values[r][c.id] || ''), username: String(values[r][c.username] || ''),
            name: String(values[r][c.name] || ''), role: String(values[r][c.role] || ''),
            message: String(values[r][c.message] || ''), status: String(values[r][c.status] || 'Open'),
            createdAt: String(values[r][c.createdAt] || '')
        });
    }
    out.sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
    return out;
}
function handleSetReportStatus(session, p) {
    var id = String(p && p.id || '');
    var status = String(p && p.status || '').slice(0, 40) || 'Open';
    if (!id)
        throw httpError('Report id is required.', 'BAD_REQUEST');
    var sh = reportSheet();
    var values = sh.getDataRange().getValues();
    var c = reportCols(values);
    for (var r = 1; r < values.length; r++) {
        if (String(values[r][c.id]) === id) {
            sh.getRange(r + 1, c.status + 1).setValue(status);
            return { updated: true };
        }
    }
    throw httpError('Report not found.', 'NOT_FOUND');
}
var CLASSCOLOR_HEADERS = ['key', 'color', 'updatedBy', 'updatedAt'];
function classColorSheet() { return sheetOrCreate('ClassColors', CLASSCOLOR_HEADERS); }
function handleGetClassColors(session) {
    var sh = classColorSheet();
    var values = sh.getDataRange().getValues();
    var map = {};
    for (var r = 1; r < values.length; r++) {
        var key = String(values[r][0] || '').trim();
        var color = String(values[r][1] || '').trim();
        if (key && color) map[key] = color;
    }
    return { colors: map };
}
function handleSetClassColor(session, p) {
    var key = String(p && p.key || '').trim().slice(0, 120);
    var color = String(p && p.color || '').trim().slice(0, 9);
    if (!key)
        throw httpError('A colour key is required.', 'BAD_REQUEST');
    if (color && !/^#[0-9a-fA-F]{6}$/.test(color))
        throw httpError('Invalid colour.', 'BAD_REQUEST');
    var sh = classColorSheet();
    var values = sh.getDataRange().getValues();
    var now = new Date().toISOString();
    for (var r = 1; r < values.length; r++) {
        if (String(values[r][0] || '').trim() === key) {
            if (color) {
                sh.getRange(r + 1, 2).setValue(color);
                sh.getRange(r + 1, 3).setValue(session.username || '');
                sh.getRange(r + 1, 4).setValue(now);
            } else {
                sh.deleteRow(r + 1);
            }
            return { key: key, color: color };
        }
    }
    if (color)
        sh.appendRow([key, color, session.username || '', now]);
    return { key: key, color: color };
}
var PRESENCE_HEADERS = ['username', 'lastSeen'];
var MESSAGE_HEADERS = ['id', 'from', 'to', 'text', 'ts', 'readAt'];
function presenceSheet() { return sheetOrCreate('Presence', PRESENCE_HEADERS); }
function messageSheet() { return sheetOrCreate('Messages', MESSAGE_HEADERS); }
function isStaffRoleName(role) { return role === 'admin' || role === 'co-admin'; }
function presenceMillis(v) {
    if (v instanceof Date) return v.getTime();
    if (v === 0 || v) {
        var s = String(v).trim();
        if (!s) return 0;
        if (/^\d+$/.test(s)) return Number(s);
        var t = new Date(s).getTime();
        return isNaN(t) ? 0 : t;
    }
    return 0;
}
function touchPresence(username) {
    var sh = presenceSheet();
    var vals = sh.getDataRange().getValues();
    var now = Date.now();
    for (var r = 1; r < vals.length; r++) {
        if (String(vals[r][0] || '').toLowerCase() === String(username).toLowerCase()) {
            sh.getRange(r + 1, 2).setValue(now);
            return;
        }
    }
    sh.appendRow([username, now]);
}
function readPresence() {
    var sh = presenceSheet();
    var vals = sh.getDataRange().getValues();
    var map = {};
    for (var r = 1; r < vals.length; r++) {
        var u = String(vals[r][0] || '').trim();
        if (u) map[u.toLowerCase()] = presenceMillis(vals[r][1]);
    }
    return map;
}
function handleChatPoll(session) {
    var me = session.username;
    touchPresence(me);
    var users = readUsers();
    var pres = readPresence();
    var msgs = messageSheet().getDataRange().getValues();
    var now = Date.now();
    var contacts = [];
    var totalUnread = 0;
    for (var i = 0; i < users.length; i++) {
        var u = users[i];
        if (String(u.username).toLowerCase() === String(me).toLowerCase()) continue;
        var unread = 0, lastTs = '', lastText = '';
        for (var r = 1; r < msgs.length; r++) {
            var f = String(msgs[r][1] || ''), t = String(msgs[r][2] || '');
            var involves = (f === me && t === u.username) || (f === u.username && t === me);
            if (!involves) continue;
            var ts = String(msgs[r][4] || '');
            if (ts > lastTs) { lastTs = ts; lastText = String(msgs[r][3] || ''); }
            if (f === u.username && t === me && !String(msgs[r][5] || '').trim()) unread++;
        }
        totalUnread += unread;
        var ms = pres[String(u.username).toLowerCase()] || 0;
        var online = ms ? (now - ms < 120000) : false;
        var lastSeenIso = ms ? new Date(ms).toISOString() : '';
        contacts.push({ username: u.username, name: u.name, role: u.role, online: !!online, lastSeen: lastSeenIso, unread: unread, lastTs: lastTs, lastText: lastText });
    }
    contacts.sort(function (a, b) { return String(b.lastTs || '').localeCompare(String(a.lastTs || '')); });
    return { me: me, contacts: contacts, totalUnread: totalUnread };
}
function handleGetThread(session, p) {
    var me = session.username;
    touchPresence(me);
    var withUser = String(p && p.withUser || '').trim();
    if (!withUser) throw httpError('A conversation partner is required.', 'BAD_REQUEST');
    var sh = messageSheet();
    var vals = sh.getDataRange().getValues();
    var out = [];
    var toMark = [];
    var now = new Date().toISOString();
    for (var r = 1; r < vals.length; r++) {
        var f = String(vals[r][1] || ''), t = String(vals[r][2] || '');
        var involves = (f === me && t === withUser) || (f === withUser && t === me);
        if (!involves) continue;
        out.push({ id: String(vals[r][0] || ''), from: f, to: t, text: String(vals[r][3] || ''), ts: String(vals[r][4] || ''), mine: f === me });
        if (f === withUser && t === me && !String(vals[r][5] || '').trim()) toMark.push(r + 1);
    }
    for (var k = 0; k < toMark.length; k++) { sh.getRange(toMark[k], 6).setValue(now); }
    out.sort(function (a, b) { return String(a.ts || '').localeCompare(String(b.ts || '')); });
    return { withUser: withUser, messages: out };
}
function handleSendMessage(session, p) {
    var me = session.username;
    touchPresence(me);
    var to = String(p && p.to || '').trim();
    var text = String(p && p.text || '').trim();
    if (!to) throw httpError('Recipient required.', 'BAD_REQUEST');
    if (!text) throw httpError('Message cannot be empty.', 'BAD_REQUEST');
    if (text.length > 2000) text = text.slice(0, 2000);
    var target = findUser(to);
    if (!target) throw httpError('That person could not be found.', 'NOT_FOUND');
    if (String(target.username).toLowerCase() === String(me).toLowerCase()) throw httpError('You cannot message yourself.', 'BAD_REQUEST');
    var sh = messageSheet();
    var id = 'm' + Date.now() + Math.floor(Math.random() * 1000);
    var ts = new Date().toISOString();
    sh.appendRow([id, me, target.username, text, ts, '']);
    return { id: id, from: me, to: target.username, text: text, ts: ts, mine: true };
}
function readProfilePhotos() {
    var sh = profileSheet();
    var vals = sh.getDataRange().getValues();
    if (vals.length < 2) return {};
    var c = profileCols(vals);
    var map = {};
    for (var r = 1; r < vals.length; r++) {
        var u = String(vals[r][c.username] || '').trim();
        if (u) map[u.toLowerCase()] = String(vals[r][c.photo] || '');
    }
    return map;
}
function handleChatDirectory(session) {
    var me = session.username;
    var photos = readProfilePhotos();
    var users = readUsers();
    var out = [];
    for (var i = 0; i < users.length; i++) {
        var u = users[i];
        if (String(u.username).toLowerCase() === String(me).toLowerCase()) continue;
        out.push({ username: u.username, name: u.name, role: u.role, photo: photos[String(u.username).toLowerCase()] || '' });
    }
    return { users: out, mePhoto: photos[String(me).toLowerCase()] || '' };
}
function doGet() {
    return ContentService.createTextOutput('SMC Guidance API is running.')
        .setMimeType(ContentService.MimeType.TEXT);
}
function ok(data) { return json({ ok: true, data: data }); }
function fail(msg, code) { return json({ ok: false, error: msg, code: code || 'ERROR' }); }
function json(obj) {
    return ContentService.createTextOutput(JSON.stringify(obj))
        .setMimeType(ContentService.MimeType.JSON);
}
function httpError(msg, code) { var e = new Error(msg); e.code = code; return e; }
function props() { return PropertiesService.getScriptProperties(); }
function prop(k, d) { var v = props().getProperty(k); return v == null ? d : v; }
function sheet(name) {
    var id = prop('SHEET_ID');
    if (!id)
        throw httpError('SHEET_ID not configured.', 'CONFIG');
    var sh = SpreadsheetApp.openById(id).getSheetByName(name);
    if (!sh)
        throw httpError('Sheet "' + name + '" not found.', 'CONFIG');
    return sh;
}
function toHex(bytes) {
    return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}
function hmacHex(message, key) {
    return toHex(Utilities.computeHmacSha256Signature(message, key));
}
function randomToken(len) {
    var bytes = [];
    for (var i = 0; i < (len || 24); i++)
        bytes.push(Math.floor(Math.random() * 256));
    return hmacHex(Utilities.getUuid() + ':' + bytes.join(','), prop('SESSION_SECRET', 'x')).slice(0, (len || 24) * 2);
}
function hashPassword(password, salt) {
    var pepper = prop('PEPPER', '');
    var data = salt + ':' + password + ':' + pepper;
    var h = data;
    for (var i = 0; i < 12000; i++) {
        h = hmacHex(h, pepper + salt);
    }
    return h;
}
function constantTimeEquals(a, b) {
    a = String(a);
    b = String(b);
    if (a.length !== b.length)
        return false;
    var diff = 0;
    for (var i = 0; i < a.length; i++)
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}
function makeToken(user) {
    var ttlH = parseInt(prop('SESSION_TTL_H', '4'), 10) || 4;
    var payload = {
        u: user.username, n: user.name, r: user.role,
        exp: Date.now() + ttlH * 3600 * 1000
    };
    var body = Utilities.base64EncodeWebSafe(JSON.stringify(payload));
    var sig = hmacHex(body, prop('SESSION_SECRET', 'x'));
    return body + '.' + sig;
}
function verifyToken(token) {
    if (!token || token.indexOf('.') === -1)
        return null;
    var parts = token.split('.');
    var body = parts[0], sig = parts[1];
    var expected = hmacHex(body, prop('SESSION_SECRET', 'x'));
    if (!constantTimeEquals(sig, expected))
        return null;
    var payload;
    try {
        payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(body)).getDataAsString());
    }
    catch (e) {
        return null;
    }
    if (!payload || !payload.exp || Date.now() > payload.exp)
        return null;
    return { username: payload.u, name: payload.n, role: payload.r, expiresAt: payload.exp };
}
function requireAuth(session) {
    if (!session)
        throw httpError('Please sign in again.', 'AUTH');
    return session;
}
function requireAdmin(session) {
    requireAuth(session);
    if (session.role !== 'admin')
        throw httpError('Administrator access required.', 'FORBIDDEN');
    return session;
}
function requireStaff(session) {
    requireAuth(session);
    if (session.role !== 'admin' && session.role !== 'co-admin')
        throw httpError('Staff access required.', 'FORBIDDEN');
    return session;
}
function isStaffRole(role) { return role === 'admin' || role === 'co-admin'; }
function readUsers() {
    var sh = sheet('Users');
    var values = sh.getDataRange().getValues();
    if (values.length < 2)
        return [];
    var head = values[0].map(function (h) { return String(h).trim().toLowerCase(); });
    var col = function (name) { return head.indexOf(name); };
    var iU = col('username'), iN = col('name'), iR = col('role'), iS = col('salt'), iH = col('hash'), iD = col('designate');
    var out = [];
    for (var r = 1; r < values.length; r++) {
        var row = values[r];
        if (!row[iU])
            continue;
        out.push({
            rowIndex: r + 1,
            username: String(row[iU]).trim(),
            name: iN >= 0 ? String(row[iN]).trim() : '',
            role: iR >= 0 ? String(row[iR]).trim() : 'counselor',
            salt: iS >= 0 ? String(row[iS]) : '',
            hash: iH >= 0 ? String(row[iH]) : '',
            designate: iD >= 0 ? String(row[iD]).trim() : ''
        });
    }
    return out;
}
function findUser(username) {
    username = String(username || '').trim().toLowerCase();
    var users = readUsers();
    for (var i = 0; i < users.length; i++) {
        if (users[i].username.toLowerCase() === username)
            return users[i];
    }
    return null;
}
function handleLogin(p) {
    if (secIsLocked())
        throw httpError('The website is locked due to suspicious activity. An administrator must unlock it with the unlock code.', 'LOCKED');
    var u = findUser(p.username);
    var candidate = hashPassword(String(p.password || ''), u ? u.salt : 'nosalt');
    if (!u || !constantTimeEquals(candidate, u.hash)) {
        var fails = secFails() + 1;
        props().setProperty('LOGIN_FAILS', String(fails));
        if (fails >= secMaxAttempts()) {
            props().setProperty('SITE_LOCKED', '1');
            throw httpError('Too many failed attempts. The website is now locked. An administrator must unlock it with the unlock code.', 'LOCKED');
        }
        var left = secMaxAttempts() - fails;
        throw httpError('Incorrect username or password. ' + left + ' attempt' + (left === 1 ? '' : 's') + ' left before the site locks.', 'AUTH');
    }
    props().setProperty('LOGIN_FAILS', '0');
    var safe = { username: u.username, name: u.name, role: u.role };
    var token = makeToken(safe);
    safe.expiresAt = verifyToken(token).expiresAt;
    return { token: token, user: safe };
}
function handleRegister(p) {
    var name = String(p.name || '').trim();
    var username = String(p.username || '').trim();
    var password = String(p.password || '');
    var code = String(p.code || '');
    if (!name || !username || !password || !code)
        throw httpError('Please fill in all fields.', 'BAD_REQUEST');
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username))
        throw httpError('Invalid username format.', 'BAD_REQUEST');
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password))
        throw httpError('Password needs 8+ characters, 1 uppercase letter, and 1 number.', 'BAD_REQUEST');
    var expected = prop('REG_CODE', '');
    if (!expected || !constantTimeEquals(code, expected))
        throw httpError('Invalid registration code.', 'AUTH');
    if (findUser(username))
        throw httpError('That username is already taken.', 'CONFLICT');
    var salt = randomToken(16);
    var hash = hashPassword(password, salt);
    var sh = sheet('Users');
    sh.appendRow([username, name, 'counselor', salt, hash, '']);
    return { created: true };
}
function handleRecords(session) {
    var sh = sheet('Records');
    var values = sh.getDataRange().getValues();
    if (values.length < 2)
        return [];
    var rows = [];
    for (var r = 1; r < values.length; r++) {
        var raw = values[r];
        if (!raw || raw.join('').trim() === '')
            continue;
        var obj = {};
        Object.keys(FIELD_MAP).forEach(function (k) {
            var v = raw[FIELD_MAP[k]];
            obj[k] = (v == null) ? '' : (v instanceof Date ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(v));
        });
        rows.push(obj);
    }
    if (session.role !== 'admin') {
        var me = findUser(session.username) || {};
        var keys = [String(session.name || '').toLowerCase(), String(session.username || '').toLowerCase()];
        if (me.designate)
            keys.push(me.designate.toLowerCase());
        rows = rows.filter(function (o) {
            var d = String(o.designate || '').toLowerCase();
            return keys.some(function (k) { return k && d.indexOf(k) !== -1; });
        });
    }
    return rows;
}
function handlePublicStats() {
    var sh = sheet('Records');
    var values = sh.getDataRange().getValues();
    var total = 0, names = {};
    for (var r = 1; r < values.length; r++) {
        var raw = values[r];
        if (!raw || raw.join('').trim() === '')
            continue;
        total++;
        var nm = raw[FIELD_MAP.name];
        if (nm)
            names[String(nm)] = 1;
    }
    return { totalSessions: total, totalStudents: Object.keys(names).length };
}
function handleListUsers() {
    return readUsers().map(function (u) {
        return { username: u.username, name: u.name, role: u.role, designate: u.designate };
    });
}
function handleSetRole(session, p) {
    var username = String(p.username || '').trim();
    var role = String(p.role || '').trim();
    if (!username)
        throw httpError('Username required.', 'BAD_REQUEST');
    if (role !== 'counselor' && role !== 'co-admin')
        throw httpError('Role must be "counselor" or "co-admin".', 'BAD_REQUEST');
    var target = findUser(username);
    if (!target)
        throw httpError('Account not found.', 'NOT_FOUND');
    if (target.role === 'admin')
        throw httpError('The administrator role cannot be changed here.', 'FORBIDDEN');
    var sh = sheet('Users');
    var head = sh.getDataRange().getValues()[0].map(function (h) { return String(h).trim().toLowerCase(); });
    var iR = head.indexOf('role');
    if (iR < 0)
        throw httpError('Users sheet is missing a "role" column.', 'CONFIG');
    sh.getRange(target.rowIndex, iR + 1).setValue(role);
    return { username: target.username, role: role };
}
function handleDeleteUser(session, p) {
    var username = String(p.username || '').trim();
    if (!username)
        throw httpError('Username required.', 'BAD_REQUEST');
    if (username.toLowerCase() === session.username.toLowerCase())
        throw httpError('You cannot remove your own account.', 'FORBIDDEN');
    var target = findUser(username);
    if (!target)
        throw httpError('Account not found.', 'NOT_FOUND');
    if (target.role === 'admin')
        throw httpError('Administrator accounts cannot be removed here.', 'FORBIDDEN');
    sheet('Users').deleteRow(target.rowIndex);
    return { removed: true };
}
var EVAL_HEADERS = ['id', 'title', 'teacher', 'period', 'status', 'assignedTo', 'checkedBy', 'dueDate', 'notes', 'createdBy', 'createdAt', 'updatedAt'];
function sheetOrCreate(name, headers) {
    var id = prop('SHEET_ID');
    if (!id)
        throw httpError('SHEET_ID not configured.', 'CONFIG');
    var ss = SpreadsheetApp.openById(id);
    var sh = ss.getSheetByName(name);
    if (!sh) {
        sh = ss.insertSheet(name);
        sh.appendRow(headers);
    }
    else if (sh.getLastRow() === 0) {
        sh.appendRow(headers);
    }
    return sh;
}
function evalCols(values) {
    var head = values[0].map(function (h) { return String(h).trim().toLowerCase(); });
    return {
        id: head.indexOf('id'), title: head.indexOf('title'), teacher: head.indexOf('teacher'),
        period: head.indexOf('period'), status: head.indexOf('status'),
        assignedTo: head.indexOf('assignedto'), checkedBy: head.indexOf('checkedby'),
        dueDate: head.indexOf('duedate'), notes: head.indexOf('notes'),
        createdBy: head.indexOf('createdby'), createdAt: head.indexOf('createdat'), updatedAt: head.indexOf('updatedat')
    };
}
function evalCell(row, idx) {
    var v = idx >= 0 ? row[idx] : '';
    if (v == null)
        return '';
    return (v instanceof Date) ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(v);
}
function involvesMe(session, assignedTo, checkedBy) {
    var me = [String(session.name || '').toLowerCase(), String(session.username || '').toLowerCase()];
    var aT = String(assignedTo || '').toLowerCase(), cB = String(checkedBy || '').toLowerCase();
    return me.some(function (k) { return k && (aT.indexOf(k) !== -1 || cB.indexOf(k) !== -1); });
}
function handleListEvaluations(session) {
    var sh = sheetOrCreate('Evaluations', EVAL_HEADERS);
    var values = sh.getDataRange().getValues();
    if (values.length < 2)
        return [];
    var c = evalCols(values);
    var out = [];
    for (var r = 1; r < values.length; r++) {
        var row = values[r];
        if (c.id >= 0 && !String(row[c.id]).trim())
            continue;
        out.push({
            id: evalCell(row, c.id), title: evalCell(row, c.title), teacher: evalCell(row, c.teacher),
            period: evalCell(row, c.period), status: evalCell(row, c.status) || 'Pending',
            assignedTo: evalCell(row, c.assignedTo), checkedBy: evalCell(row, c.checkedBy),
            dueDate: evalCell(row, c.dueDate), notes: evalCell(row, c.notes),
            createdBy: evalCell(row, c.createdBy), createdAt: evalCell(row, c.createdAt), updatedAt: evalCell(row, c.updatedAt)
        });
    }
    if (!isStaffRole(session.role)) {
        out = out.filter(function (o) { return involvesMe(session, o.assignedTo, o.checkedBy); });
    }
    return out;
}
function handleSaveEvaluation(session, p) {
    var sh = sheetOrCreate('Evaluations', EVAL_HEADERS);
    var values = sh.getDataRange().getValues();
    var c = evalCols(values);
    var width = values[0].length;
    var staff = isStaffRole(session.role);
    var now = new Date();
    var nowStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
    var id = String(p.id || '').trim();
    if (!id) {
        if (!staff)
            throw httpError('Only admins or co-admins can create evaluations.', 'FORBIDDEN');
        if (!String(p.title || '').trim())
            throw httpError('An evaluation title is required.', 'BAD_REQUEST');
        var newId = 'EV' + now.getTime();
        var row = [];
        for (var i = 0; i < width; i++)
            row[i] = '';
        function setNew(idx, val) { if (idx >= 0)
            row[idx] = val == null ? '' : val; }
        setNew(c.id, newId);
        setNew(c.title, p.title);
        setNew(c.teacher, p.teacher);
        setNew(c.period, p.period);
        setNew(c.status, p.status || 'Pending');
        setNew(c.assignedTo, p.assignedTo);
        setNew(c.checkedBy, p.checkedBy);
        setNew(c.dueDate, p.dueDate);
        setNew(c.notes, p.notes);
        setNew(c.createdBy, session.name || session.username);
        setNew(c.createdAt, nowStr);
        setNew(c.updatedAt, nowStr);
        sh.appendRow(row);
        return { id: newId };
    }
    var target = -1;
    for (var rr = 1; rr < values.length; rr++) {
        if (String(values[rr][c.id]).trim() === id) {
            target = rr + 1;
            break;
        }
    }
    if (target < 0)
        throw httpError('Evaluation not found.', 'NOT_FOUND');
    if (!staff) {
        var existing = values[target - 1];
        if (!involvesMe(session, existing[c.assignedTo], existing[c.checkedBy]))
            throw httpError('You can only update evaluations assigned to or checked by you.', 'FORBIDDEN');
        if (p.status != null && c.status >= 0)
            sh.getRange(target, c.status + 1).setValue(p.status);
        if (p.notes != null && c.notes >= 0)
            sh.getRange(target, c.notes + 1).setValue(p.notes);
        if (c.updatedAt >= 0)
            sh.getRange(target, c.updatedAt + 1).setValue(nowStr);
        return { id: id };
    }
    function upd(idx, key) { if (idx >= 0 && p[key] != null)
        sh.getRange(target, idx + 1).setValue(p[key]); }
    upd(c.title, 'title');
    upd(c.teacher, 'teacher');
    upd(c.period, 'period');
    upd(c.status, 'status');
    upd(c.assignedTo, 'assignedTo');
    upd(c.checkedBy, 'checkedBy');
    upd(c.dueDate, 'dueDate');
    upd(c.notes, 'notes');
    if (c.updatedAt >= 0)
        sh.getRange(target, c.updatedAt + 1).setValue(nowStr);
    return { id: id };
}
function handleDeleteEvaluation(session, p) {
    var id = String(p.id || '').trim();
    if (!id)
        throw httpError('Evaluation id required.', 'BAD_REQUEST');
    var sh = sheetOrCreate('Evaluations', EVAL_HEADERS);
    var values = sh.getDataRange().getValues();
    var c = evalCols(values);
    for (var r = 1; r < values.length; r++) {
        if (String(values[r][c.id]).trim() === id) {
            sh.deleteRow(r + 1);
            return { removed: true };
        }
    }
    throw httpError('Evaluation not found.', 'NOT_FOUND');
}
function setupAdmin() {
    var ADMIN_USERNAME = 'admin';
    var ADMIN_NAME = 'Administrator';
    var ADMIN_PASSWORD = '';
    if (!ADMIN_PASSWORD)
        throw new Error('Set ADMIN_PASSWORD, run once, then clear it.');
    if (findUser(ADMIN_USERNAME)) {
        Logger.log('Admin already exists; nothing to do.');
        return;
    }
    var salt = randomToken(16);
    var hash = hashPassword(ADMIN_PASSWORD, salt);
    sheet('Users').appendRow([ADMIN_USERNAME, ADMIN_NAME, 'admin', salt, hash, '']);
    Logger.log('Admin seeded. Now clear ADMIN_PASSWORD and re-save.');
}
function resetAdmin() {
    var ADMIN_USERNAME = 'admin';
    var ADMIN_NAME = 'Administrator';
    var ADMIN_PASSWORD = '';
    if (!ADMIN_PASSWORD)
        throw new Error('Set ADMIN_PASSWORD, run once, then clear it.');
    var existing = findUser(ADMIN_USERNAME);
    if (existing)
        sheet('Users').deleteRow(existing.rowIndex);
    var salt = randomToken(16);
    var hash = hashPassword(ADMIN_PASSWORD, salt);
    sheet('Users').appendRow([ADMIN_USERNAME, ADMIN_NAME, 'admin', salt, hash, '']);
    Logger.log('Admin reset OK. Sign in with username "admin" and the password you typed. Now clear ADMIN_PASSWORD and re-save.');
}
function debugCheck() {
    Logger.log('SHEET_ID set?       ' + (prop('SHEET_ID') != null));
    Logger.log('REG_CODE set?       ' + (prop('REG_CODE') != null));
    Logger.log('SESSION_SECRET set? ' + (prop('SESSION_SECRET') != null));
    Logger.log('PEPPER set?         ' + (prop('PEPPER') != null));
    try {
        var users = readUsers();
        Logger.log('Users rows found:   ' + users.length);
        var a = findUser('admin');
        if (!a) {
            Logger.log('>> No "admin" row in the Users sheet. Run resetAdmin().');
            return;
        }
        Logger.log('admin row index:    ' + a.rowIndex);
        Logger.log('admin role:         ' + a.role + '  (should be "admin")');
        Logger.log('admin salt length:  ' + (a.salt || '').length + '  (should be 32)');
        Logger.log('admin hash length:  ' + (a.hash || '').length + '  (should be 64)');
        if ((a.salt || '').length !== 32 || (a.hash || '').length !== 64)
            Logger.log('>> Salt/hash look wrong (maybe the sheet mangled them). Run resetAdmin().');
    }
    catch (e) {
        Logger.log('>> ERROR reading Users sheet: ' + e.message);
    }
}
function testPassword() {
    var PASSWORD = '';
    if (!PASSWORD)
        throw new Error('Type the password you want to test, then Run.');
    var a = findUser('admin');
    if (!a) {
        Logger.log('No "admin" row. Run resetAdmin() first.');
        return;
    }
    var candidate = hashPassword(PASSWORD, a.salt);
    if (candidate === a.hash)
        Logger.log('MATCH \u2713  This password is correct.');
    else
        Logger.log('NO MATCH \u2717  Wrong password, OR the PEPPER property changed since the admin was seeded. Fix: run resetAdmin() with the password you want.');
}
var EVAL_CONFIG_HEADERS = ['id', 'gradeLevel', 'templateType', 'sheetId', 'tabName', 'mapping', 'updatedAt'];
var EVAL_SUMMARY_HEADERS = ['gradeLevel', 'teacher', 'subject', 'docType', 'responses', 'sectionAverages', 'overall', 'updatedAt'];
function nowStamp() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'); }
function round2(n) { return Math.round(n * 100) / 100; }
function handleEvalTemplates() {
    return {
        scale: { min: 1, max: 4 },
        templates: [
            { key: 'shs', name: 'Senior High School', family: 'score-grid', sections: ['Teacher\u2019s Actions', 'Student\u2019s Actions'] },
            { key: 'jhs', name: 'Junior High School', family: 'score-grid', sections: ['Teacher\u2019s Actions', 'Student\u2019s Actions'] },
            { key: 'g5g6', name: 'Grade 5 \u2013 Grade 6', family: 'score-grid', sections: ['Teacher\u2019s Actions', 'Student\u2019s Actions'] },
            { key: 'g3g4', name: 'Grade 3 \u2013 Grade 4', family: 'category', sections: ['Classroom Cleanliness', 'Life-Enhancing Classroom Discipline', 'Mastery of the Subject Matter', 'Teaching Personality'] },
            { key: 'kinderg2', name: 'Kinder \u2013 Grade 2', family: 'category', sections: ['Classroom Cleanliness', 'Life-Enhancing Classroom Discipline', 'Mastery of the Subject Matter', 'Teaching Personality'] }
        ]
    };
}
function evalConfigSheet() { return sheetOrCreate('EvalConfig', EVAL_CONFIG_HEADERS); }
function authorizeOnce() {
    DriveApp.getRootFolder().getName();
    try {
        formsFolder().getName();
    }
    catch (e) { }
    try {
        FormApp.getActiveForm();
    }
    catch (e) { }
    try {
        SpreadsheetApp.openById(prop('SHEET_ID')).getName();
    }
    catch (e) { }
    Logger.log('Authorization complete: Drive, Forms and Sheets are now allowed.');
    return 'OK';
}
function formsFolder() {
    var id = prop('FORMS_FOLDER_ID', '');
    if (!id)
        throw httpError('FORMS_FOLDER_ID is not set in Script Properties. Add it (the Drive folder id) and re-deploy.', 'CONFIG');
    return DriveApp.getFolderById(id);
}
function handleListForms(session) {
    var root = formsFolder();
    var out = [], seen = {}, MAX = 800;
    function add(f, kind, path) {
        if (out.length >= MAX)
            return;
        var id = f.getId();
        if (seen[id])
            return;
        seen[id] = true;
        out.push({ id: id, name: f.getName(), path: path, kind: kind });
    }
    function scan(folder, path, depth) {
        if (depth > 10 || out.length >= MAX)
            return;
        var files = folder.getFiles();
        while (files.hasNext() && out.length < MAX) {
            var f = files.next(), mt = f.getMimeType(), kind = null;
            if (mt === MimeType.GOOGLE_FORMS)
                kind = 'form';
            else if (mt === MimeType.GOOGLE_SHEETS)
                kind = 'sheet';
            else if (mt === 'text/csv')
                kind = 'csv';
            if (kind)
                add(f, kind, path);
        }
        var subs = folder.getFolders();
        while (subs.hasNext()) {
            var sf = subs.next();
            scan(sf, path ? path + ' / ' + sf.getName() : sf.getName(), depth + 1);
        }
    }
    scan(root, '', 0);
    out.sort(function (a, b) {
        var an = (a.path || '') + '/' + a.name, bn = (b.path || '') + '/' + b.name;
        return an < bn ? -1 : (an > bn ? 1 : 0);
    });
    return { folderName: root.getName(), forms: out, capped: out.length >= MAX };
}
function handleGetFormResponses(session, p) {
    var fileId = String(p && p.fileId || '').trim();
    if (!fileId)
        throw httpError('Missing file id.', 'BAD_REQUEST');
    var file = DriveApp.getFileById(fileId);
    var mime = file.getMimeType();
    if (mime === MimeType.GOOGLE_FORMS)
        return formResponsesFromForm(fileId, file.getName());
    if (mime === MimeType.GOOGLE_SHEETS)
        return formResponsesFromSheet(SpreadsheetApp.openById(fileId), file.getName());
    if (mime === 'text/csv') {
        var arr = Utilities.parseCsv(file.getBlob().getDataAsString());
        return { name: file.getName(), headers: (arr[0] || []).map(String), rows: arr.slice(1) };
    }
    throw httpError('Unsupported file type (' + mime + '). Link the Form to a Google Sheet, or keep responses as a Form / CSV.', 'BAD_REQUEST');
}
function formResponsesFromForm(formId, name) {
    var form = FormApp.openById(formId);
    var responses = form.getResponses();
    if (!responses.length)
        throw httpError('\u201c' + name + '\u201d is a Google Form with no responses. Note: making a COPY of a Form does not copy its responses \u2014 open the ORIGINAL form, or use its linked response Sheet (or a CSV export) instead.', 'NO_RESPONSES');
    var items = form.getItems();
    var headers = items.map(function (it) { return it.getTitle(); });
    var rows = responses.map(function (resp) {
        var byId = {};
        resp.getItemResponses().forEach(function (ir) { byId[ir.getItem().getId()] = ir.getResponse(); });
        return items.map(function (it) { var v = byId[it.getId()]; if (v == null)
            return ''; return (v instanceof Array) ? v.join(', ') : String(v); });
    });
    return { name: name, headers: headers, rows: rows };
}
function sheetDataRowCount(values) {
    var n = 0;
    for (var r = 1; r < values.length; r++) {
        var row = values[r];
        for (var c = 0; c < row.length; c++) {
            if (String(row[c] == null ? '' : row[c]).trim() !== '') {
                n++;
                break;
            }
        }
    }
    return n;
}
function formResponsesFromSheet(ss, name) {
    var sheets = ss.getSheets(), best = null, bestScore = -1;
    for (var i = 0; i < sheets.length; i++) {
        var values = sheets[i].getDataRange().getValues();
        var dataRows = sheetDataRowCount(values);
        if (dataRows <= 0)
            continue;
        var score = dataRows + (/form responses/i.test(sheets[i].getName()) ? 1000000 : 0);
        if (score > bestScore) {
            bestScore = score;
            best = values;
        }
    }
    if (!best)
        return { name: name, headers: [], rows: [] };
    var headers = best[0].map(function (h) { return String(h); });
    var rows = [];
    for (var k = 1; k < best.length; k++) {
        var r = best[k], keep = false;
        for (var c = 0; c < r.length; c++) {
            if (String(r[c] == null ? '' : r[c]).trim() !== '') {
                keep = true;
                break;
            }
        }
        if (keep)
            rows.push(r.map(function (c) { return c == null ? '' : (c instanceof Date ? c.toISOString() : String(c)); }));
    }
    return { name: name, headers: headers, rows: rows };
}
function openResponseSheet(sheetId, tabName) {
    var id = String(sheetId || '').trim();
    if (!id)
        id = prop('SHEET_ID');
    if (!id)
        throw httpError('No response spreadsheet configured.', 'CONFIG');
    var m = id.match(/[-\w]{25,}/);
    if (m)
        id = m[0];
    var ss;
    try {
        ss = SpreadsheetApp.openById(id);
    }
    catch (e) {
        throw httpError('Could not open that spreadsheet. Check the ID/link and that this script has access to it.', 'CONFIG');
    }
    var sh = tabName ? ss.getSheetByName(tabName) : ss.getSheets()[0];
    if (!sh)
        throw httpError('Tab "' + tabName + '" was not found in the response sheet.', 'CONFIG');
    return { ss: ss, sh: sh };
}
function handleEvalSheetColumns(session, p) {
    var r = openResponseSheet(p.sheetId, p.tabName);
    var ss = r.ss, sh = r.sh;
    var lastCol = sh.getLastColumn();
    var headers = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); }) : [];
    var lastRow = Math.min(sh.getLastRow(), 40);
    var sample = lastRow > 1 ? sh.getRange(2, 1, lastRow - 1, lastCol).getValues() : [];
    var guess = headers.map(function (h, i) {
        var numeric = 0, textLong = 0, total = 0;
        sample.forEach(function (row) {
            var v = row[i];
            if (v === '' || v == null)
                return;
            total++;
            var n = Number(v);
            if (!isNaN(n) && n >= 1 && n <= 5)
                numeric++;
            else if (String(v).trim().split(/\s+/).length >= 3)
                textLong++;
        });
        var kind = 'other';
        if (total > 0 && numeric / total >= 0.6)
            kind = 'item';
        else if (total > 0 && textLong / total >= 0.4)
            kind = 'comment';
        return { col: h, index: i, kind: kind };
    });
    return {
        tabs: ss.getSheets().map(function (s) { return s.getName(); }),
        tab: sh.getName(),
        headers: headers,
        guess: guess,
        rowCount: Math.max(0, sh.getLastRow() - 1)
    };
}
function handleListEvalConfigs(session) {
    var sh = evalConfigSheet();
    var values = sh.getDataRange().getValues();
    if (values.length < 2)
        return [];
    var out = [];
    for (var r = 1; r < values.length; r++) {
        var row = values[r];
        if (!String(row[0]).trim())
            continue;
        var mapping = {};
        try {
            mapping = JSON.parse(row[5] || '{}');
        }
        catch (e) {
            mapping = {};
        }
        out.push({
            id: String(row[0]), gradeLevel: String(row[1] || ''), templateType: String(row[2] || ''),
            sheetId: String(row[3] || ''), tabName: String(row[4] || ''), mapping: mapping, updatedAt: String(row[6] || '')
        });
    }
    return out;
}
function handleSaveEvalConfig(session, p) {
    var sh = evalConfigSheet();
    var values = sh.getDataRange().getValues();
    if (!String(p.gradeLevel || '').trim())
        throw httpError('A grade level / label is required.', 'BAD_REQUEST');
    var mapping = p.mapping || {};
    if (!mapping.teacher)
        throw httpError('Please map the column that holds the teacher name.', 'BAD_REQUEST');
    var now = nowStamp();
    var mapJson = JSON.stringify(mapping);
    var rowVals = [null, p.gradeLevel, p.templateType || '', p.sheetId || '', p.tabName || '', mapJson, now];
    var id = String(p.id || '').trim();
    if (id) {
        for (var r = 1; r < values.length; r++) {
            if (String(values[r][0]).trim() === id) {
                rowVals[0] = id;
                sh.getRange(r + 1, 1, 1, EVAL_CONFIG_HEADERS.length).setValues([rowVals]);
                return { id: id };
            }
        }
    }
    id = 'EC' + new Date().getTime();
    rowVals[0] = id;
    sh.appendRow(rowVals);
    return { id: id };
}
function handleDeleteEvalConfig(session, p) {
    var id = String(p.id || '').trim();
    if (!id)
        throw httpError('Config id required.', 'BAD_REQUEST');
    var sh = evalConfigSheet();
    var values = sh.getDataRange().getValues();
    for (var r = 1; r < values.length; r++) {
        if (String(values[r][0]).trim() === id) {
            sh.deleteRow(r + 1);
            return { removed: true };
        }
    }
    throw httpError('Config not found.', 'NOT_FOUND');
}
function handleProcessEval(session, p) {
    var configs = handleListEvalConfigs(session);
    var cfg = null;
    for (var i = 0; i < configs.length; i++) {
        if (configs[i].id === String(p.id || '').trim()) {
            cfg = configs[i];
            break;
        }
    }
    if (!cfg)
        throw httpError('Evaluation source not found. Save it first.', 'NOT_FOUND');
    if (!cfg.mapping || !cfg.mapping.teacher)
        throw httpError('This source has no teacher column mapped.', 'BAD_REQUEST');
    var r = openResponseSheet(cfg.sheetId, cfg.tabName);
    var sh = r.sh;
    var lastCol = sh.getLastColumn(), lastRow = sh.getLastRow();
    if (lastRow < 2)
        return { gradeLevel: cfg.gradeLevel, templateType: cfg.templateType, teachers: [], generatedAt: nowStamp(), responses: 0 };
    var values = sh.getRange(1, 1, lastRow, lastCol).getValues();
    var headers = values[0].map(function (h) { return String(h).trim(); });
    var result = computeEvalResult(cfg, values, headers);
    writeEvalSummary(cfg, result.teachers);
    return result;
}
function guessKinds(headers, values) {
    var sample = values.slice(1, 41);
    return headers.map(function (h, i) {
        var numeric = 0, textLong = 0, total = 0;
        sample.forEach(function (row) {
            var v = row[i];
            if (v === '' || v == null)
                return;
            total++;
            var n = Number(v);
            if (!isNaN(n) && n >= 1 && n <= 5)
                numeric++;
            else if (String(v).trim().split(/\s+/).length >= 3)
                textLong++;
        });
        var kind = 'other';
        if (total > 0 && numeric / total >= 0.6)
            kind = 'item';
        else if (total > 0 && textLong / total >= 0.4)
            kind = 'comment';
        return { col: h, index: i, kind: kind };
    });
}
function autoDetectMapping(headers, guess) {
    function kindAt(i) { return guess[i] ? guess[i].kind : 'other'; }
    var teacher = -1, subject = -1, section = -1, docType = -1, comments = [], items = [];
    for (var i = 0; i < headers.length; i++) {
        var low = String(headers[i]).toLowerCase();
        if (teacher < 0 && /teacher|faculty|instructor|guro/.test(low))
            teacher = i;
        else if (subject < 0 && /subject|asignatura/.test(low))
            subject = i;
        else if (section < 0 && /section|grade|level|class/.test(low))
            section = i;
        else if (docType < 0 && /document|doc type|type of/.test(low))
            docType = i;
    }
    for (var j = 0; j < headers.length; j++) {
        if (j === teacher || j === subject || j === section || j === docType)
            continue;
        var k = kindAt(j);
        if (k === 'item')
            items.push({ col: headers[j], section: 'Evaluation' });
        else if (k === 'comment')
            comments.push(headers[j]);
    }
    if (teacher < 0) {
        for (var t = 0; t < headers.length; t++) {
            if (t === subject || t === section || t === docType)
                continue;
            if (kindAt(t) === 'other') {
                teacher = t;
                break;
            }
        }
    }
    return {
        teacher: teacher >= 0 ? headers[teacher] : '',
        subject: subject >= 0 ? headers[subject] : '',
        section: section >= 0 ? headers[section] : '',
        docType: docType >= 0 ? headers[docType] : '',
        comments: comments, items: items
    };
}
function handleQuickProcess(session, p) {
    var r = openResponseSheet(p.sheetId, p.tabName);
    var sh = r.sh, ss = r.ss;
    var lastCol = sh.getLastColumn(), lastRow = sh.getLastRow();
    var gradeName = ss.getName();
    if (lastRow < 2 || lastCol < 1)
        return { gradeLevel: gradeName, teachers: [], generatedAt: nowStamp(), responses: 0, autoMapped: true };
    var values = sh.getRange(1, 1, lastRow, lastCol).getValues();
    var headers = values[0].map(function (h) { return String(h).trim(); });
    var guess = guessKinds(headers, values);
    var mapping = autoDetectMapping(headers, guess);
    if (!mapping.teacher)
        throw httpError('Could not auto-detect a teacher column in that sheet. Use \u201c+ Add Form Source\u201d to map the columns manually.', 'CONFIG');
    if (!mapping.items.length)
        throw httpError('Could not auto-detect any 1\u20134 score questions in that sheet. Use \u201c+ Add Form Source\u201d to map manually.', 'CONFIG');
    var cfg = { gradeLevel: gradeName, templateType: '', sheetId: p.sheetId || '', tabName: sh.getName(), mapping: mapping };
    var result = computeEvalResult(cfg, values, headers);
    writeEvalSummary(cfg, result.teachers);
    result.autoMapped = true;
    result.detected = { teacher: mapping.teacher, subject: mapping.subject, items: mapping.items.length, comments: mapping.comments.length };
    return result;
}
function computeEvalResult(cfg, values, headers) {
    var mapping = cfg.mapping || {};
    function colIndex(name) { return headers.indexOf(String(name || '').trim()); }
    var teacherIdx = colIndex(mapping.teacher);
    if (teacherIdx < 0)
        throw httpError('The mapped teacher column is no longer in the sheet. Re-map the columns.', 'CONFIG');
    var subjectIdx = mapping.subject ? colIndex(mapping.subject) : -1;
    var sectionIdx = mapping.section ? colIndex(mapping.section) : -1;
    var docTypeIdx = mapping.docType ? colIndex(mapping.docType) : -1;
    var commentIdxs = (mapping.comments || []).map(colIndex).filter(function (x) { return x >= 0; });
    var items = (mapping.items || []).map(function (it) {
        return { col: it.col, section: it.section || 'Evaluation', index: colIndex(it.col) };
    }).filter(function (it) { return it.index >= 0; });
    var groups = {};
    for (var rr = 1; rr < values.length; rr++) {
        var row = values[rr];
        var teacher = String(row[teacherIdx] == null ? '' : row[teacherIdx]).trim();
        if (!teacher)
            continue;
        var subject = subjectIdx >= 0 ? String(row[subjectIdx] || '').trim() : '';
        var key = teacher + ' || ' + subject;
        if (!groups[key])
            groups[key] = { teacher: teacher, subject: subject, sections: {}, rows: 0, comments: [], docType: '', classSection: '' };
        var g = groups[key];
        g.rows++;
        if (docTypeIdx >= 0 && !g.docType)
            g.docType = String(row[docTypeIdx] || '').trim();
        if (sectionIdx >= 0 && !g.classSection)
            g.classSection = String(row[sectionIdx] || '').trim();
        items.forEach(function (it) {
            var v = Number(row[it.index]);
            if (isNaN(v) || v <= 0)
                return;
            if (!g.sections[it.section])
                g.sections[it.section] = {};
            if (!g.sections[it.section][it.col])
                g.sections[it.section][it.col] = { sum: 0, n: 0 };
            g.sections[it.section][it.col].sum += v;
            g.sections[it.section][it.col].n++;
        });
        commentIdxs.forEach(function (ci) {
            var c = String(row[ci] == null ? '' : row[ci]).trim();
            if (c)
                g.comments.push(c);
        });
    }
    var teachers = Object.keys(groups).map(function (key) {
        var g = groups[key];
        var sectionList = Object.keys(g.sections).map(function (secName) {
            var itemsObj = g.sections[secName];
            var itemList = Object.keys(itemsObj).map(function (col) {
                var cell = itemsObj[col];
                return { item: col, average: cell.n ? round2(cell.sum / cell.n) : null, responses: cell.n };
            });
            var valid = itemList.filter(function (x) { return x.average != null; });
            var secAvg = valid.length ? round2(valid.reduce(function (s, x) { return s + x.average; }, 0) / valid.length) : null;
            return { section: secName, items: itemList, average: secAvg };
        });
        var secAvgs = sectionList.map(function (s) { return s.average; }).filter(function (x) { return x != null; });
        var overall = secAvgs.length ? round2(secAvgs.reduce(function (s, x) { return s + x; }, 0) / secAvgs.length) : null;
        return {
            teacher: g.teacher, subject: g.subject, classSection: g.classSection, docType: g.docType,
            responses: g.rows, sections: sectionList, overall: overall,
            comments: g.comments, wordCounts: tallyWords(g.comments), commentCounts: tallyComments(g.comments)
        };
    });
    teachers.sort(function (a, b) { return (b.overall || 0) - (a.overall || 0); });
    return {
        gradeLevel: cfg.gradeLevel, templateType: cfg.templateType, teachers: teachers,
        generatedAt: nowStamp(), responses: teachers.reduce(function (s, t) { return s + t.responses; }, 0)
    };
}
function tallyWords(comments) {
    var map = {};
    comments.forEach(function (c) {
        String(c).split(/\s+/).forEach(function (raw) {
            var w = raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
            if (!w)
                return;
            var key = w.toLowerCase();
            if (!map[key])
                map[key] = { word: w, count: 0 };
            map[key].count++;
        });
    });
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return b.count - a.count; });
}
function tallyComments(comments) {
    var map = {};
    comments.forEach(function (c) {
        var key = String(c).trim();
        if (!key)
            return;
        map[key] = (map[key] || 0) + 1;
    });
    return Object.keys(map).map(function (k) { return { comment: k, count: map[k] }; }).sort(function (a, b) { return b.count - a.count; });
}
function writeEvalSummary(cfg, teachers) {
    var sh = sheetOrCreate('EvalSummary', EVAL_SUMMARY_HEADERS);
    var values = sh.getDataRange().getValues();
    for (var r = values.length - 1; r >= 1; r--) {
        if (String(values[r][0]).trim() === String(cfg.gradeLevel).trim())
            sh.deleteRow(r + 1);
    }
    var now = nowStamp();
    teachers.forEach(function (t) {
        var secStr = t.sections.map(function (s) { return s.section + ': ' + (s.average == null ? 'n/a' : s.average); }).join(' | ');
        sh.appendRow([cfg.gradeLevel, t.teacher, t.subject, t.docType, t.responses, secStr, t.overall == null ? '' : t.overall, now]);
    });
}

// ==== Security / site lock (Turn 71) ====
function secMaxAttempts() { return parseInt(prop('MAX_ATTEMPTS', '10'), 10) || 10; }
function secFails() { return parseInt(prop('LOGIN_FAILS', '0'), 10) || 0; }
function secIsLocked() { return prop('SITE_LOCKED', '') === '1'; }
function secUnlockCode() { var c = prop('UNLOCK_CODE', ''); if (!c) c = prop('REG_CODE', ''); return c; }
function handleSecurityStatus() { return { locked: secIsLocked() }; }
function handleUnlockSite(p) {
    var code = String(p && p.code || '');
    var expected = secUnlockCode();
    if (!expected)
        throw httpError('No unlock code is configured. An administrator must set UNLOCK_CODE (or REG_CODE) in Script Properties.', 'CONFIG');
    if (!constantTimeEquals(code, expected))
        throw httpError('Incorrect unlock code.', 'AUTH');
    props().setProperty('SITE_LOCKED', '');
    props().setProperty('LOGIN_FAILS', '0');
    return { unlocked: true };
}
function handleGetSecurity(session) {
    return { locked: secIsLocked(), attempts: secFails(), maxAttempts: secMaxAttempts(), hasUnlockCode: !!prop('UNLOCK_CODE', '') };
}
function handleSetSecurity(session, p) {
    if (p.maxAttempts != null) {
        var m = parseInt(p.maxAttempts, 10);
        if (isNaN(m) || m < 1 || m > 1000) throw httpError('Max attempts must be between 1 and 1000.', 'BAD_REQUEST');
        props().setProperty('MAX_ATTEMPTS', String(m));
    }
    if (p.unlockCode != null) {
        var uc = String(p.unlockCode);
        if (uc.length < 4) throw httpError('Unlock code must be at least 4 characters.', 'BAD_REQUEST');
        props().setProperty('UNLOCK_CODE', uc);
    }
    if (p.resetAttempts) props().setProperty('LOGIN_FAILS', '0');
    if (p.lock === true) props().setProperty('SITE_LOCKED', '1');
    if (p.lock === false) { props().setProperty('SITE_LOCKED', ''); props().setProperty('LOGIN_FAILS', '0'); }
    return handleGetSecurity(session);
}
// ==== Incident reports (Turn 71) ====
var INCIDENT_HEADERS = ['id', 'title', 'type', 'severity', 'status', 'dateOccurred', 'location', 'involved', 'description', 'actionsTaken', 'reportedBy', 'reporterRole', 'createdAt', 'updatedAt'];
function incidentSheet() { return sheetOrCreate('Incidents', INCIDENT_HEADERS); }
function incidentCols(values) {
    var head = values[0].map(function (h) { return String(h).trim().toLowerCase(); });
    return {
        id: head.indexOf('id'), title: head.indexOf('title'), type: head.indexOf('type'),
        severity: head.indexOf('severity'), status: head.indexOf('status'), dateOccurred: head.indexOf('dateoccurred'),
        location: head.indexOf('location'), involved: head.indexOf('involved'), description: head.indexOf('description'),
        actionsTaken: head.indexOf('actionstaken'), reportedBy: head.indexOf('reportedby'), reporterRole: head.indexOf('reporterrole'),
        createdAt: head.indexOf('createdat'), updatedAt: head.indexOf('updatedat')
    };
}
function incCell(row, idx) { var v = idx >= 0 ? row[idx] : ''; if (v == null) return ''; return (v instanceof Date) ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') : String(v); }
function normInvolved(raw) {
    var arr = raw;
    if (typeof arr === 'string') { try { arr = JSON.parse(arr || '[]'); } catch (e) { arr = []; } }
    if (!Array.isArray(arr)) arr = [];
    return arr.map(function (p) { p = p || {}; return { name: String(p.name || '').slice(0, 120), grade: String(p.grade || '').slice(0, 40), section: String(p.section || '').slice(0, 40), role: String(p.role || '').slice(0, 40) }; })
        .filter(function (p) { return p.name || p.grade || p.section; });
}
function incToObj(row, c) {
    var involved = [];
    try { involved = JSON.parse(incCell(row, c.involved) || '[]'); } catch (e) { involved = []; }
    return {
        id: incCell(row, c.id), title: incCell(row, c.title), type: incCell(row, c.type), severity: incCell(row, c.severity),
        status: incCell(row, c.status) || 'Open', dateOccurred: incCell(row, c.dateOccurred), location: incCell(row, c.location),
        involved: involved, description: incCell(row, c.description), actionsTaken: incCell(row, c.actionsTaken),
        reportedBy: incCell(row, c.reportedBy), reporterRole: incCell(row, c.reporterRole),
        createdAt: incCell(row, c.createdAt), updatedAt: incCell(row, c.updatedAt)
    };
}
function incMine(session, reportedBy) {
    var rb = String(reportedBy || '').toLowerCase();
    var keys = [String(session.name || '').toLowerCase(), String(session.username || '').toLowerCase()];
    return keys.some(function (k) { return k && rb.indexOf(k) !== -1; });
}
function handleListIncidents(session) {
    var sh = incidentSheet();
    var values = sh.getDataRange().getValues();
    if (values.length < 2) return [];
    var c = incidentCols(values); var out = [];
    for (var r = 1; r < values.length; r++) {
        var row = values[r];
        if (c.id >= 0 && !String(row[c.id]).trim()) continue;
        out.push(incToObj(row, c));
    }
    if (!isStaffRole(session.role)) out = out.filter(function (o) { return incMine(session, o.reportedBy); });
    out.sort(function (a, b) { return (a.createdAt < b.createdAt) ? 1 : -1; });
    return out;
}
function handleSaveIncident(session, p) {
    var sh = incidentSheet();
    var values = sh.getDataRange().getValues();
    var c = incidentCols(values); var width = values[0].length;
    var now = new Date();
    var nowStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
    if (!String(p.title || '').trim()) throw httpError('An incident title is required.', 'BAD_REQUEST');
    var involvedJson = JSON.stringify(normInvolved(p.involved));
    var id = String(p.id || '').trim();
    if (!id) {
        var newId = 'IN' + now.getTime();
        var row = [];
        for (var i = 0; i < width; i++) row[i] = '';
        var setNew = function (idx, val) { if (idx >= 0) row[idx] = val == null ? '' : val; };
        setNew(c.id, newId); setNew(c.title, String(p.title).slice(0, 200)); setNew(c.type, String(p.type || '').slice(0, 80));
        setNew(c.severity, String(p.severity || '').slice(0, 40)); setNew(c.status, String(p.status || 'Open').slice(0, 40));
        setNew(c.dateOccurred, String(p.dateOccurred || '').slice(0, 40)); setNew(c.location, String(p.location || '').slice(0, 200));
        setNew(c.involved, involvedJson); setNew(c.description, String(p.description || '').slice(0, 8000));
        setNew(c.actionsTaken, String(p.actionsTaken || '').slice(0, 8000)); setNew(c.reportedBy, session.name || session.username);
        setNew(c.reporterRole, session.role || ''); setNew(c.createdAt, nowStr); setNew(c.updatedAt, nowStr);
        sh.appendRow(row);
        return { id: newId };
    }
    var target = -1;
    for (var rr = 1; rr < values.length; rr++) { if (String(values[rr][c.id]).trim() === id) { target = rr + 1; break; } }
    if (target < 0) throw httpError('Incident not found.', 'NOT_FOUND');
    if (!isStaffRole(session.role) && !incMine(session, values[target - 1][c.reportedBy]))
        throw httpError('You can only edit incident reports you created.', 'FORBIDDEN');
    var upd = function (idx, val) { if (idx >= 0) sh.getRange(target, idx + 1).setValue(val == null ? '' : val); };
    upd(c.title, String(p.title).slice(0, 200)); upd(c.type, String(p.type || '').slice(0, 80)); upd(c.severity, String(p.severity || '').slice(0, 40));
    upd(c.status, String(p.status || 'Open').slice(0, 40)); upd(c.dateOccurred, String(p.dateOccurred || '').slice(0, 40));
    upd(c.location, String(p.location || '').slice(0, 200)); upd(c.involved, involvedJson); upd(c.description, String(p.description || '').slice(0, 8000));
    upd(c.actionsTaken, String(p.actionsTaken || '').slice(0, 8000)); upd(c.updatedAt, nowStr);
    return { id: id };
}
function handleDeleteIncident(session, p) {
    var id = String(p.id || '').trim();
    if (!id) throw httpError('Incident id required.', 'BAD_REQUEST');
    var sh = incidentSheet();
    var values = sh.getDataRange().getValues();
    var c = incidentCols(values);
    for (var r = 1; r < values.length; r++) { if (String(values[r][c.id]).trim() === id) { sh.deleteRow(r + 1); return { removed: true }; } }
    throw httpError('Incident not found.', 'NOT_FOUND');
}
