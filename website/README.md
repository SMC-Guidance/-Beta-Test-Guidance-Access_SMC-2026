# Stella Maris College — Guidance Office Dashboard

A secure, multi-file rebuild of the guidance counseling dashboard.

The key change vs. the old single-file version: **the browser no longer
touches the spreadsheet directly, and no secrets live in the page.** A small
Google Apps Script backend holds the private Sheet, checks logins, and returns
only the rows a counselor is allowed to see.

## Project structure

```
smc-guidance/
├─ index.html            # markup only — no logic, no secrets
├─ css/
│  └─ styles.css         # all styling
├─ js/
│  ├─ config.js          # PUBLIC config: backend URL + display options only
│  ├─ ui.js              # escaping (fixed), toast, date, count-up helpers
│  ├─ api.js             # fetch client + session token storage
│  ├─ auth.js            # login / register / logout UI flow (no checks here)
│  ├─ charts.js          # doughnut + bar charts
│  ├─ records.js         # filters, table, pagination, record modal
│  ├─ export.js          # print + Save-PDF (jsPDF reference fixed)
│  └─ app.js             # bootstrap, views, session timers, admin panel
├─ backend/
│  └─ Code.gs            # SECURE server: auth, hashing, tokens, data gatekeeper
├─ assets/
│  └─ logo.jpg           # (add your school logo here; optional)
├─ README.md
└─ SECURITY.md           # what was wrong before and how it is fixed
```

## Setup

### 1. The private Google Sheet
Create one Google Sheet with two tabs:

- **Records** — your existing student counseling data. Row 1 = headers.
  Column order is mapped in `backend/Code.gs` (`FIELD_MAP`); adjust the
  indices there if your columns differ.
- **Users** — row 1 headers exactly: `username | name | role | salt | hash | designate`

**Do NOT use File → Share → Publish to web.** Keep the sheet private. Only the
script (running as you) reads it.

### 2. Deploy the backend
1. In the Sheet: **Extensions → Apps Script**.
2. Replace the default code with `backend/Code.gs`.
3. **Project Settings → Script properties** and add:
   | Property | Value |
   |---|---|
   | `SHEET_ID` | the id in your Sheet's URL (`/d/THIS_PART/edit`) |
   | `REG_CODE` | your registration code, e.g. `maryofthepassion2026` |
   | `SESSION_SECRET` | a long random string (sign-in tokens) |
   | `PEPPER` | a second long random string (password pepper) |
   | `SESSION_TTL_H` | `4` (optional, session length in hours) |
4. In the editor, type a strong password into `setupAdmin()`, **Run** it once,
   authorize, then **clear the password and re-save**. This seeds the `admin`
   account (only its salt+hash are stored).
5. **Deploy → New deployment → Web app**
   - *Execute as:* **Me**
   - *Who has access:* **Anyone**
   - Deploy and copy the `.../exec` URL.

### 3. Point the frontend at the backend
Open `js/config.js` and set:
```js
apiUrl: 'https://script.google.com/macros/s/XXXXX/exec'
```

### 4. Host the frontend
Upload the folder to any static host (GitHub Pages, Netlify, etc.). Because the
frontend contains no secrets, this is safe to publish publicly.

## Generating random secrets
Run this in any browser console for a strong value:
```js
crypto.getRandomValues(new Uint8Array(32)).reduce((s,b)=>s+b.toString(16).padStart(2,'0'),'')
```

## Rotating the registration code or a password
- **Reg code:** edit the `REG_CODE` script property. Nothing else to change.
- **Counselor password reset:** delete the user's row from the **Users** sheet
  and have them register again with the reg code, or re-run a seeding helper.

## What's new (Evaluations, Co-admin, Procedures, Favicon)

### Teacher Evaluation tracker
- New **Teacher Evaluations** tab for everyone who signs in.
- Each evaluation has: title, teacher being evaluated, period/term, **Status (Pending / Started / Done)**, **Assigned To** (who is tasked), **Checked By** (the cross-checker), due date, and notes.
- The **Checked By** field supports cross-checking of designates, e.g. *Ms. Tin checks Mr. Reyes' work, and Mr. Reyes checks Ms. Tin's work* — just create two evaluations with the assignee and checker swapped.
- Permissions:
  - **admin / co-admin** — create, edit, and delete any evaluation.
  - **counselor** — sees only evaluations where they are the assignee or the checker, and may update **Status + Notes** only.
- Storage: a sheet named **Evaluations** is created automatically in your spreadsheet the first time an evaluation is saved. No manual setup needed.

### Co-admin access level
- New **Staff & Access** tab (admin only) lets the admin promote a counselor to **co-admin** or revoke it.
- A **co-admin** can: manage the evaluation tracker for everyone, and view the staff roster.
- A **co-admin** cannot: remove accounts or change roles (those stay admin-only). The seeded `admin` account can never be demoted or removed.
- Roles: `admin` (full) · `co-admin` (staff) · `counselor` (default).

### Assessment Procedures tab
- New **Assessment Procedures** reference tab (visible to everyone signed in) with the full Student-Applicant and Teacher-Applicant procedures laid out as clean, collapsible sections. This is static reference content — nothing is stored or sent anywhere.

### Website icon (favicon)
- Drop your icon file at **`assets/favicon.ico`** and it will appear automatically (the page already links to it). No code changes needed. PNG also works if you name it `favicon.ico` or update the `<link rel="icon">` tags in `index.html`.
