# SMC Guidance Dashboard — Administrator Handover Guide

> For the **non-technical administrator** taking over the Guidance Center
> website. You do **not** need to be a programmer. Almost everything is done
> from the website itself. Keep this file.

---

## 1. What this system is

A private, password-protected website for the Guidance Office. Counselors sign
in to see the student records assigned to them, track teacher evaluations, log
incidents, and chat. Admins manage accounts and settings. Student data is
**never** shown to the public — it lives in a private Google Sheet that only
the backend can read.

## 2. The three pieces (and where they live)

| Piece | What it is | Where |
|---|---|---|
| **The website (frontend)** | What people open in a browser. Just display — holds no secrets. | A static host (e.g. GitHub Pages / Netlify). |
| **The backend (`Code.gs`)** | A Google Apps Script that checks logins and guards the data. | script.google.com, attached to the Sheet. |
| **The private Google Sheet** | The actual data (students, users, evaluations, chat, etc.). | Google Drive. Keep it PRIVATE — never "Publish to web". |

The website talks to the backend. The backend talks to the Sheet. Visitors
never touch the Sheet directly.

## 3. Accounts & roles

- **admin** — full control. The seeded `admin` account can never be deleted or demoted.
- **co-admin** — can manage evaluations and view the staff roster, but cannot change roles or delete accounts.
- **counselor** — the default. Sees only their own assigned records, evaluations, and incidents.

## 4. Everyday tasks — all from the WEBSITE (no code)

- **Add a counselor:** Give them the **registration code**; they register
  themselves on the sign-in screen. New accounts start as `counselor`.
- **Promote to co-admin / demote:** Sign in as admin → **Staff & Access** tab.
- **Remove an account:** **Staff & Access** tab (admin only).
- **Lock / unlock the site, set max attempts, set the unlock code, reset the
  failed-login counter:** admin **Security** controls, or the **Command Center**.
- **Maintenance mode** (takes the whole site down with a message): admin
  controls or Command Center. Lift it again with the maintenance passcode.
- **Share links:** created from a record/incident/etc. Admins/co-admins can
  **list and revoke** them. Links auto-expire (default 7 days).
- **Clear all chat messages:** admin, via Command Center (`clearmessages`).

### The Command Center (power-user shortcut)
Press **Ctrl + Alt + K**, type the passphrase, then type `help` to see commands
(`status`, `unlock <code>`, `lock`, `maintenance`, `setmax`, `setcode`, etc.).
This is just a shortcut — every command still checks your admin login on the
server, so it is not a security hole, but do change the passphrase in
`js/config.js` if you want.

## 5. The rare CODE tasks (click-by-click)

Open the Sheet → **Extensions → Apps Script**.

- **First-time setup on a NEW Google account:**
  1. Run **`oneClickSetup()`** (top of `Code.gs`) — it creates the secret keys
     for you. Open **View → Logs** to read what it did.
  2. In **Project Settings → Script properties**, make sure `SHEET_ID` and
     `REG_CODE` are set (the log tells you if they are missing).
  3. Type a strong password into **`resetAdmin()`**, **Run** it once, then
     **delete the password and Save**. This seeds the `admin` login.
  4. **Deploy** (see below).
- **Check everything is healthy:** run **`healthCheck()`** → View → Logs.
- **Reset a lost admin password:** put a new password in **`resetAdmin()`**,
  Run once, clear it, Save.
- **Change the registration code:** edit `REG_CODE` in Script Properties.

### ⚠️ ALWAYS redeploy after editing `Code.gs`
Google keeps running the OLD code until you publish a new version:
**Deploy → Manage deployments → (pencil/Edit) → Version: New version →
Execute as: Me · Who has access: Anyone → Deploy → Done.**

## 6. Endorsement checklist — handing the whole thing to the school

When the current admin leaves, transfer ownership so nothing is tied to a
personal account:

1. **Google Sheet:** transfer ownership to the school's Google account
   (Share → make them owner).
2. **Apps Script project:** it moves with the Sheet, but re-open it on the
   school account and **Deploy → New version** so it runs as the school.
3. **Secrets:** rotate `REG_CODE`, set a fresh `UNLOCK_CODE`, and reset the
   `admin` password (`resetAdmin()`). Do **not** change `PEPPER` or
   `SESSION_SECRET` unless you re-seed all passwords — changing them logs
   everyone out and breaks existing logins.
4. **Email identity:** update `MAIL_FROM` / `MAIL_FROM_NAME` if 2FA emails
   should come from a school address.
5. **Frontend:** update `js/config.js` → `apiUrl` if you redeployed to a new
   URL, then re-upload the website to your host.
6. Confirm with **`healthCheck()`**.

## 7. What changed in this patched build (behavior notes)

- **You may need to sign in again after fully closing the browser.** The login
  token now clears on close (safer on shared computers). "Remember this device"
  still skips the emailed 2FA code.
- **Record/evaluation/incident visibility is now matched EXACTLY**, not by
  loose text. Fill the **`designate`** column in the Records sheet (and the
  Assigned To / Checked By fields) with the counselor's **exact name or
  username**. For several people, separate them with commas. If a counselor
  suddenly sees no records, check that this column matches their name exactly.
- **Evaluation form browsing is now staff-only** (admin / co-admin).
- **Public share links are sanitized** on the server before display.

## 8. Emergency / troubleshooting

- **Locked out of a locked site:** use `unlock <code>` (unlock code, or
  `REG_CODE`) from the sign-in/Command Center. For maintenance mode use
  `maintenance off <code>`.
- **"Saved on this device" warning won't go away:** the backend needs a
  **New version** redeploy (Section 5).
- **No 2FA emails:** run `authorizeNow()` once in Apps Script to authorize
  email sending.
- **Something looks broken after editing `Code.gs`:** you almost certainly
  forgot to redeploy a New version.

## 9. Security reminders

This system holds **minors' counseling and mental-health information**. Keep
the Sheet private, limit who has edit access to it, and follow the school's
data-protection and retention rules. Never paste `PEPPER` or `SESSION_SECRET`
anywhere public.
