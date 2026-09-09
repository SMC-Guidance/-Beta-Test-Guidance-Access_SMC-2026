# Install the Evaluation Workbook Builder

This adds one new feature to your existing site: a **Build Evaluation Workbooks**
button that reads the Drive folder of forms and produces finished, computed
evaluation workbooks from your own template.

Nothing in `Code.gs` is rewritten. You paste two lines into it.

---

## 1. Upload the template to Drive as a Google Sheet

1. Open Google Drive.
2. Upload `TEACHERS' EVAL SPREADSHEET-edited May 2026.xlsx`.
3. Right-click it, **Open with > Google Sheets**, then **File > Save as Google Sheets**.
4. Open the Google Sheets version and copy its file id from the address bar:
   `https://docs.google.com/spreadsheets/d/`**`THIS_LONG_ID`**`/edit`

The five tabs must keep their exact names:

- `SENIOR HIGH SCHOOL TEMPLATE`
- `JUNIOR HIGH SCHOOL TEMPLATE`
- `G5-G6 TEMPLATE`
- `G3-G4 TEMPLATE`
- `KINDER - G2 TEMPLATE`

**Do not change any formula or move any row.** The builder only writes into
B2, B3, B4 and the student response columns. Your template does all the math.

---

## 2. Add the script file

1. Open your Apps Script project (the one behind `SMC.config.apiUrl`).
2. **Files > + > Script**, name it `EvalExport`.
3. Delete the placeholder contents and paste in all of `backend/EvalExport.gs`.
4. Save.

---

## 3. Add the two router lines to `Code.gs`

In `Code.gs`, find this block around **line 134**:

```js
            case 'listForms': return ok(handleListForms(requireStaff(session)));
```

Paste these two lines directly underneath it:

```js
            case 'listEvalBatches':    return ok(handleListEvalBatches(requireStaff(session)));
            case 'buildEvalWorkbooks': return ok(handleBuildEvalWorkbooks(requireStaff(session), payload));
```

Save.

---

## 4. Set the script properties

**Project Settings > Script properties**:

| Property | Value |
| --- | --- |
| `EVAL_TEMPLATE_ID` | the id you copied in step 1 |
| `FORMS_FOLDER_ID` | already set - the Drive folder holding the teacher folders |
| `EVAL_OUTPUT_FOLDER` | optional. Leave blank to auto-create a `Generated Evaluations` subfolder |

---

## 5. Authorise and self-test

1. In the editor, choose the function `testEvalExportSetup` and press **Run**.
2. Approve the permission prompt (Drive, Sheets, Forms).
3. Check the log. You want:

```
OK    Forms folder: <your folder name>
OK    Template workbook: <your template name>
OK    All 5 template tabs found.
OK    Teacher folders: 12 (loose files in root: 0)
```

If a tab is reported missing, its name does not match the list in step 1.

---

## 6. Re-deploy the web app

**Deploy > Manage deployments >** pencil icon **> Version: New version > Deploy.**

This step is required. Without it the site still calls the old code and you will
see `Unknown action`.

---

## 7. Upload the three frontend files

These are already patched in the copy of your site included in this package:

| File | Change |
| --- | --- |
| `js/evalexport.js` | new - the panel itself |
| `css/eval-export.css` | new - its styling |
| `js/api.js` | added `listEvalBatches` and `buildEvalWorkbooks` |
| `index.html` | added the stylesheet link and the `evalexport.js` script tag |
| `sw.js` | added the two new files to the offline cache list |

Upload them wherever you host the site, then hard-refresh (Ctrl+Shift+R) so the
service worker picks up the new cache list.

---

## How to organise the Drive folder

```
FORMS_FOLDER_ID/
  PASTOR/
    PASTOR-ICT-7-LORENZO      (Form, Sheet or CSV)
    PASTOR-ICT-9-PIO
    PASTOR-ICT-6-AQUINAS
  ARTILLAGA/
    ARTILLAGA-CLE4-JUSTICE
  Generated Evaluations/       (created automatically - output lands here)
```

One subfolder per teacher. One file per section. The file can be a Google Form,
its linked response Sheet, or a plain CSV export - all three work.

### What comes out

From the folder above you get **three** files:

| File | Tabs |
| --- | --- |
| `PASTOR_JUNIOR_HIGH_SCHOOL` | `7 - LORENZO`, `9 - PIO`, `COMMENTS SUMMARY` |
| `PASTOR_G5_G6` | `Grade 6 - AQUINAS`, `COMMENTS SUMMARY` |
| `ARTILLAGA_G3_G4` | `4B Justice`, `COMMENTS SUMMARY` |

Grade 7 and Grade 9 share one file because both are Junior High. The Grade 6
splits off into its own file because it needs a different template. That is
rules 7 and 7.5 of your spec.

---

## Class advisers

To make a section read `CLASS ADVISER - 9 - PIO`, either:

- add a question to the form containing the word *adviser* (a yes/no), **or**
- add a tab named `Advisers` to your main spreadsheet:

| TEACHER | SECTION |
| --- | --- |
| Francis Nico Pastor | 9 - PIO |

---

## Using it

Open **Evaluations > Folder**. The new card sits at the top.

- **Preview** - reports what would be built, creates nothing. Use this first.
- **Build workbooks** - creates the files and links them.
- The dropdown limits the run to one teacher folder.

Re-running replaces the previous file of the same name, so it is safe to run
again after late responses arrive.

---

## Notes and warnings

The **Notes** box reports anything that needs a human:

- *found 14 rating columns but the JUNIOR HIGH SCHOOL template expects 16* -
  the form's question count does not match the template. Fix the form.
- *could not detect a grade level* - the *Grade and Section* answer had no
  recognisable grade. Fix the form answers.
- *responses exceed the template capacity* - more students answered than the
  template has response columns (18 for SHS, 38 for JHS, 19 for G5-G6, 44 for
  the lower grades). Extra responses are left out rather than overwriting the
  averages column.

### About your existing processor

The older **Quick** tab still uses `computeEvalResult` / `tallyComments` in
`Code.gs`. Those work differently from your spec:

- `tallyComments` sorts comments by how often they appear, not shortest to longest.
- `guessKinds` uses `Number(value)`, which returns `NaN` for `"4 ALWAYS"`, so it
  can miss rating columns in your real forms.

The new builder does not use either of them, so it is unaffected. Say the word
if you want the old Quick tab corrected to match too.

---

## Form links

If your folder holds LINKS to forms rather than the forms themselves, read
`backend/LINKS-EXPLAINED.md`. It covers shortcuts, .url files, link docs, and the
one link type Google does not allow reading (`/viewform`).

To diagnose a link that will not resolve, run the function `testEvalLinkDetection`
in the Apps Script editor. It prints one line per file saying exactly what it saw.


---

## Update: "0 files" fix (folder scanning)

If the dropdown showed **0 files** even though the folder clearly has form links in it,
it was caused by two limits in the first version:

1. **Folder shortcuts were invisible.** Google's `getFolders()` does not return
   shortcuts to folders. If your teacher folders are shortcuts (added with
   *Add shortcut to Drive*), the script saw an empty folder. Shortcut folders
   are now resolved and followed.
2. **Only one level deep was scanned.** Files nested like
   `Forms / Junior High / PASTOR / Grade 7 / <form link>` were never reached.
   The scan now goes up to **10 levels deep**, matching the site's existing
   Folder tool.

### One extra line in `Code.gs`

Add this next to the other two eval cases inside `doPost`:

```js
case 'diagnoseEvalFolder': return ok(handleDiagnoseEvalFolder(requireStaff(session)));
```

So all three lines together look like:

```js
case 'listEvalBatches':    return ok(handleListEvalBatches(requireStaff(session)));
case 'buildEvalWorkbooks': return ok(handleBuildEvalWorkbooks(requireStaff(session), payload));
case 'diagnoseEvalFolder': return ok(handleDiagnoseEvalFolder(requireStaff(session)));
```

Then **Deploy -> Manage deployments -> pencil -> New version -> Deploy**.

### The Diagnose button

The Evaluations screen now has a **Diagnose** button next to Preview and Build.
It lists **every single file** the script can see, the folder it sits in, the
exact type Google reports for it, and whether it will be used. Nothing is
hidden, so if a file is being ignored you can see precisely why.

Typical readings:

| What you see | What it means |
|---|---|
| `shortcut -> folder` | A folder shortcut, now followed correctly |
| `application/vnd.google-apps.form` | A real form, will be read |
| `shortcut -> ...form` | A shortcut to a form, will be read |
| `application/vnd.google-apps.document` | A doc; links inside it are extracted |
| `image/jpeg`, `application/pdf` | Skipped, not response data |
| **No rows at all** | The folder is empty *to the script's account* - see below |

### If Diagnose shows nothing at all

That means the script account cannot see inside the folder. Check:

- **`FORMS_FOLDER_ID`** in Project Settings > Script Properties points at the
  right folder. Open the folder in Drive and copy the id from the address bar:
  `https://drive.google.com/drive/folders/`**`THIS_PART`**
- The folder is **shared with the Google account that deployed the script**
  (the account in *Deploy > Manage deployments > Execute as*). A folder owned by
  a different account, or a school account with restricted sharing, is invisible
  otherwise.
- If the folder lives in a **Shared drive**, that account must be a member of it.
