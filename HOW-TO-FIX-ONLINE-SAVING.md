# Fixing “not saving online” (Maintenance & Profile)

## Why this happens
Maintenance mode and your Profile are saved on **your device immediately**, but to save them
**online for everyone** the website talks to your Google Apps Script backend.

The website code is correct and already sends these requests. The reason they are not saving
online is that the **live Apps Script web app is running an OLD version** that does not yet
include the newest backend actions (`setMaintenance`, `getMaintenance`, `saveProfile`,
`getProfile`). When the old version receives them it replies “Unknown action”, so the website
quietly falls back to saving only on your device.

**You must redeploy the backend once.** This is a Google requirement — Apps Script does not use
your newest code until you publish a new version.

---

## One-time fix – redeploy the backend (about 2 minutes)

1. Open your Apps Script project at **https://script.google.com** and open the SMC project.
2. Open the file **`Code.gs`** in Apps Script and make sure its contents exactly match the
   `backend/Code.gs` file included in this download. (Copy/paste the whole file if unsure, then
   click the **Save** 💾 icon.)
3. Click **Deploy → Manage deployments** (top-right).
4. On your existing **Web app** deployment, click the **pencil / Edit** icon.
5. Under **Version**, choose **New version**.
6. Make sure the settings are:
   - **Execute as:** *Me*
   - **Who has access:** *Anyone*
7. Click **Deploy**, then **Done**.

That’s it. Refresh the website and try toggling Maintenance and saving your Profile — they will
now save online for everyone.

> Tip: every time the backend (`Code.gs`) is updated in the future, repeat steps 3–7 (New
> version → Deploy). The website front-end updates instantly, but the backend only updates when
> you redeploy.

---

## How to confirm it worked
- Toggle **Maintenance** on a tab as admin → you should NOT see the yellow
  “Saved on this device. Redeploy the backend…” message.
- Save your **Profile**, then sign in from another device/browser → your photo, role and notes
  should appear.

If you still see the “saved on this device” message, the deployment is still pointing at an old
version — repeat the steps above and confirm you picked **New version** before clicking Deploy.
