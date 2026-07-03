# Turn SMC Guidance Center into a phone app (APK)

Your website is now a **PWA (Progressive Web App)**. That means it can be installed
on Android and iPhone and it behaves like a normal app: its own home-screen icon,
a full-screen window with no browser bars, a splash screen, and faster loading.

There are 3 ways to get it onto phones, from easiest to most advanced.

---

## Option A — Install directly (no APK file needed, works today)

This is the fastest and needs **zero build tools**.

1. Upload the website folder to any HTTPS host (it must be **https**, not http).
   Free options that work great:
   - **GitHub Pages**, **Netlify**, **Cloudflare Pages**, or **Firebase Hosting**
   - Just drag-and-drop the whole `smc-guidance` folder into Netlify Drop
     (https://app.netlify.com/drop) and you instantly get an https link.
2. Open that https link in **Chrome on Android**.
3. Tap the **⋮ menu → "Install app"** (or the **Install app** button that appears
   at the bottom-right of the screen).
4. The app icon appears on the home screen and opens full-screen like a real app.

On **iPhone (Safari)**: tap **Share → Add to Home Screen**.

> The teal **Install app** button only appears on https and when the phone/browser
> supports installation. On desktop Chrome you'll see an install icon in the address bar.

---

## Option B — Generate a real signed .apk / .aab (recommended for Play Store)

Use **PWABuilder** (free, made by Microsoft). No coding, no Android Studio.

1. Host the site on https first (see Option A, step 1).
2. Go to **https://www.pwabuilder.com** and paste your https URL.
3. It checks the manifest + service worker (already included here) and gives a score.
4. Click **Package For Stores → Android**.
5. Download the generated **`.apk`** (for sideloading / direct install) and the
   **`.aab`** (for uploading to Google Play).
6. PWABuilder signs it for you and shows you the signing key info — **save that key**;
   you need the same key for every future update.

To install the `.apk` on a phone directly: copy it to the phone and open it
(you may need to allow "Install unknown apps" for your file manager).

This produces a true Android app (a Trusted Web Activity) that runs your site
full-screen with no browser UI.

---

## Option C — Build it yourself with Capacitor (full native wrapper)

For when you want native plugins (push notifications, camera, etc.). Requires
**Android Studio + JDK** installed on your computer.

```bash
# from inside the smc-guidance folder
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "SMC Guidance" "ph.edu.stellamaris.guidance" --web-dir=.
npx cap add android
npx cap copy
npx cap open android      # opens Android Studio
```

Then in Android Studio: **Build → Generate Signed Bundle / APK**, create a keystore,
and build the `.apk`/`.aab`.

Useful `capacitor.config.json` starting point:

```json
{
  "appId": "ph.edu.stellamaris.guidance",
  "appName": "SMC Guidance",
  "webDir": ".",
  "server": { "androidScheme": "https" }
}
```

> Tip: since the data lives in Google Apps Script, you can also point the app at
> your hosted URL using `server.url` in the Capacitor config so updates are instant
> without rebuilding the APK.

---

## What was added to make this a PWA

- `manifest.webmanifest` — app name, colors, icons, standalone display.
- `sw.js` — a service worker that caches the app shell for offline/faster loads
  (it never caches your Google Apps Script API calls, so data stays live).
- `js/pwa.js` — registers the service worker and shows the **Install app** button.
- `assets/icons/` — app icons (192, 512, maskable, Apple touch).
  - These are **placeholder "SMC" icons**. To brand them with your real logo,
    replace the 4 PNG files in `assets/icons/` with versions made from `logo.jpg`
    (keep the same filenames and sizes). PWABuilder can also generate icons for you.
- `index.html` — added the manifest link, theme-color, and Apple meta tags.

## Requirements / gotchas

- **HTTPS is mandatory** for install + service worker. `file://` and plain `http` won't work.
- After you change files, the service worker caches the old version. Bump
  `CACHE = 'smc-guidance-v1'` to `v2` in `sw.js` to force phones to update.
- Reminder (unchanged): redeploy the Google Apps Script web app so online saving
  (profiles, maintenance, reports) syncs for everyone — see `HOW-TO-FIX-ONLINE-SAVING.md`.
