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
