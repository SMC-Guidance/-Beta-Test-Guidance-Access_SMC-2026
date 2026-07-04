"use strict";
window.SMC = window.SMC || {};
SMC.crypto = (function () {
    var PRIV_LS = 'smc-e2e-priv-v1';
    var PUB_LS = 'smc-e2e-pub-v1';
    var myPriv = null, myPub = null, ready = null;
    var secrets = {};

    function supported() { return !!(window.crypto && window.crypto.subtle && window.TextEncoder && window.btoa); }

    function ab2b64(buf) {
        var bytes = new Uint8Array(buf), s = '';
        for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
        return btoa(s);
    }
    function b642u8(str) {
        var s = atob(str), u = new Uint8Array(s.length);
        for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
        return u;
    }

    function ensureKeys() {
        if (ready) return ready;
        ready = (function () {
            if (!supported()) return Promise.reject(new Error('Secure messaging is not supported on this browser.'));
            try {
                var sp = localStorage.getItem(PRIV_LS), spub = localStorage.getItem(PUB_LS);
                if (sp && spub) {
                    return crypto.subtle.importKey('jwk', JSON.parse(sp), { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey']).then(function (k) {
                        myPriv = k; myPub = spub; return myPub;
                    });
                }
            } catch (e) { }
            return crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']).then(function (kp) {
                myPriv = kp.privateKey;
                return crypto.subtle.exportKey('raw', kp.publicKey).then(function (raw) {
                    myPub = ab2b64(raw);
                    return crypto.subtle.exportKey('jwk', kp.privateKey).then(function (jwk) {
                        try { localStorage.setItem(PRIV_LS, JSON.stringify(jwk)); localStorage.setItem(PUB_LS, myPub); } catch (e) { }
                        return myPub;
                    });
                });
            });
        })();
        return ready;
    }

    function derive(peerB64) {
        if (secrets[peerB64]) return secrets[peerB64];
        secrets[peerB64] = ensureKeys().then(function () {
            return crypto.subtle.importKey('raw', b642u8(peerB64), { name: 'ECDH', namedCurve: 'P-256' }, false, []).then(function (peerKey) {
                return crypto.subtle.deriveKey({ name: 'ECDH', public: peerKey }, myPriv, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
            });
        }).catch(function (e) { delete secrets[peerB64]; throw e; });
        return secrets[peerB64];
    }

    function encrypt(peerB64, text) {
        return derive(peerB64).then(function (aes) {
            var iv = crypto.getRandomValues(new Uint8Array(12));
            return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, aes, new TextEncoder().encode(String(text))).then(function (ct) {
                return JSON.stringify({ v: 1, iv: ab2b64(iv), ct: ab2b64(ct) });
            });
        });
    }

    function decrypt(peerB64, payload) {
        var obj;
        try { obj = JSON.parse(payload); } catch (e) { return Promise.resolve(null); }
        if (!obj || obj.v !== 1 || !obj.iv || !obj.ct) return Promise.resolve(null);
        return derive(peerB64).then(function (aes) {
            return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b642u8(obj.iv) }, aes, b642u8(obj.ct)).then(function (pt) {
                return new TextDecoder().decode(pt);
            });
        }).catch(function () { return null; });
    }

    function isEnvelope(str) {
        if (!str || typeof str !== 'string' || str.charAt(0) !== '{') return false;
        try { var o = JSON.parse(str); return !!(o && o.v === 1 && o.iv && o.ct); } catch (e) { return false; }
    }

    return { ensureKeys: ensureKeys, encrypt: encrypt, decrypt: decrypt, isEnvelope: isEnvelope, supported: supported, myPub: function () { return myPub; } };
})();
