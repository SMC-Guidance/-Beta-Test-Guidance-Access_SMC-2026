# Security model

## What was wrong in the original single-file version

1. **The registration code was in the source.** Even though comments claimed
   only the hash was stored, the line `hashPassword('')`
   put the plaintext code directly in the file. Same for the seeded admin
   password ``.
2. **All student data was publicly downloadable.** The page fetched a
   "Publish to web" Google Sheets CSV. Anyone who viewed the source got that
   URL and could download every record — names, grades, counseling notes,
   anxiety/depression flags — without logging in. The login screen ran only
   *after* the full sheet was already in the visitor's browser.
3. **Auth was 100% client-side.** Accounts lived in `localStorage`; a visitor
   could bypass login entirely from DevTools.
4. **Unsalted SHA-256** for passwords (fast, rainbow-table friendly).
5. **Broken `esc()`** that didn't actually escape HTML → stored-XSS risk.

## How this version fixes it

| Threat | Fix |
|---|---|
| Secrets in public source | `REG_CODE`, `PEPPER`, `SESSION_SECRET`, and the admin password live only in **server-side Script Properties** / the private Users sheet. The frontend ships zero secrets. |
| Raw data exposure | The Sheet is **never published**. Records are returned only by the backend, only after a valid session token, and **non-admins receive only their own assigned rows**. |
| Client-side auth bypass | Authentication happens **server-side**. The browser receives only a short-lived **HMAC-signed token** it cannot forge. |
| Weak password storage | Passwords are stored as **per-user salt + peppered, 12k-iteration HMAC-SHA256** hashes; verification uses constant-time comparison. |
| XSS | `ui.esc()` now emits proper HTML entities (`&amp; &lt; &gt; &quot; &#39; &#96;`) and is used on all rendered values. |
| Username enumeration / timing | Login always computes a hash and uses constant-time comparison. |
| Session lifetime | Tokens carry a server-set expiry (`SESSION_TTL_H`, default 4h) and are re-verified on every request. |

## Honest limits / good next steps

- **HTTPS only.** Host the frontend over HTTPS so the token isn't sent in the
  clear (GitHub Pages / Netlify do this automatically).
- **No rate limiting** on login is built in. Apps Script has quotas, but for a
  public deployment consider adding a simple per-username attempt counter in a
  sheet or `CacheService`.
- **Tokens live in `sessionStorage`** (cleared when the tab closes) rather than
  `localStorage`. They cannot be revoked early before expiry; keep TTL modest.
- **Iterated HMAC is not bcrypt/argon2.** It's a reasonable choice given Apps
  Script's API; if you move to a Node/Cloud backend later, switch to bcrypt or
  argon2id.
- This handles **minors' mental-health records** — confirm your deployment
  meets your institution's data-protection obligations (access logging,
  retention, who can read the Sheet, etc.).
