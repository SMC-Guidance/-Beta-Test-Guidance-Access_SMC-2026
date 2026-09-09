/**
 * EvalExport.gs  -  Teacher Evaluation Workbook Builder
 * Drop-in addition for the SMC Guidance backend. Nothing in Code.gs changes.
 *
 * The automation, end to end:
 *   1. Scans FORMS_FOLDER_ID. Each SUBFOLDER is one teacher batch (e.g. PASTOR).
 *   2. Reads every Form / Sheet / CSV inside it as response rows.
 *   3. Detects the grade level from the Grade and Section answers.
 *   4. Copies the matching template tab, untouched, and fills
 *      TEACHER / SUBJECT TAUGHT / SECTION.
 *   5. Pastes each student's responses down the S1, S2, S3 ... columns so the
 *      template's OWN formulas compute the averages.
 *   6. Adds a COMMENTS SUMMARY tab: duplicates collapsed, shortest to longest,
 *      repeats counted, e.g. very cool (2).
 *   7. One output file per grade-level template, one tab per section. Grade 7
 *      and Grade 9 share the Junior High file; a Grade 6 becomes its own file.
 *
 * SETUP (one time)
 *   Script Properties:
 *     FORMS_FOLDER_ID     already used by listForms - the Drive folder of forms
 *     EVAL_TEMPLATE_ID    master template, uploaded to Drive AS A GOOGLE SHEET
 *     EVAL_OUTPUT_FOLDER  optional; defaults to a Generated Evaluations subfolder
 *
 *   Add to the switch in doPost() in Code.gs:
 *     case 'buildEvalWorkbooks': return ok(handleBuildEvalWorkbooks(requireStaff(session), payload));
 *     case 'listEvalBatches':    return ok(handleListEvalBatches(requireStaff(session)));
 *
 *   Then re-deploy the Web App.
 */

// Template geometry, mirroring the master template exactly.
//   rows     : template rows that receive scores, in questionnaire order
//   firstCol : column of S1
//   lastCol  : last S slot before AVERAGES
var EVAL_TEMPLATES = {
    shs: {
        sheetName: 'SENIOR HIGH SCHOOL TEMPLATE',
        label: 'SENIOR HIGH SCHOOL',
        rows: [7, 8, 9, 10, 11, 12, 13, 14, 18, 19, 20, 21, 22, 23, 24, 25],
        firstCol: 2, lastCol: 19
    },
    jhs: {
        sheetName: 'JUNIOR HIGH SCHOOL TEMPLATE',
        label: 'JUNIOR HIGH SCHOOL',
        rows: [7, 8, 9, 10, 11, 12, 13, 14, 18, 19, 20, 21, 22, 23, 24, 25],
        firstCol: 2, lastCol: 39
    },
    g5g6: {
        sheetName: 'G5-G6 TEMPLATE',
        label: 'G5-G6',
        rows: [7, 8, 9, 10, 11, 12, 13, 14, 18, 19, 20, 21, 22, 23, 24, 25],
        firstCol: 2, lastCol: 20
    },
    g3g4: {
        sheetName: 'G3-G4 TEMPLATE',
        label: 'G3-G4',
        rows: [7, 10, 11, 12, 13, 16, 17, 18, 19, 20, 23, 24, 25, 26],
        firstCol: 2, lastCol: 45
    },
    kinderg2: {
        sheetName: 'KINDER - G2 TEMPLATE',
        label: 'KINDER-G2',
        rows: [7, 10, 11, 12, 13, 16, 17, 18, 19, 20, 23, 24, 25],
        firstCol: 2, lastCol: 45
    }
};

function evalTemplateKeyForGrade(grade) {
    if (grade === null || grade === undefined) return null;
    if (grade <= 2) return 'kinderg2';
    if (grade <= 4) return 'g3g4';
    if (grade <= 6) return 'g5g6';
    if (grade <= 10) return 'jhs';
    return 'shs';
}

var EVAL_TEACHER_KEYS = ['teacher', 'faculty', 'instructor', 'guro'];
var EVAL_SUBJECT_KEYS = ['subject', 'asignatura'];
var EVAL_SECTION_KEYS = ['grade and section', 'grade & section', 'grade level and section', 'section', 'grade'];
var EVAL_STUDENT_KEYS = ['your name', 'name of student', 'student name'];
var EVAL_ADVISER_KEYS = ['class adviser', 'adviser', 'advisor'];
var EVAL_TIME_KEYS = ['timestamp', 'time stamp'];

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** "4 ALWAYS" -> 4 ; "3 MOST OF THE TIME" -> 3 ; "" -> null */
function evalParseScore(value) {
    if (value === null || value === undefined) return null;
    var text = String(value).trim();
    if (!text) return null;
    var m = text.match(/^\s*(\d+(?:\.\d+)?)/);
    if (!m) return null;
    var n = Number(m[1]);
    return isNaN(n) ? null : n;
}

/** Detects the grade level from free-typed section answers. */
function evalDetectGrade(sectionText, fallbackText) {
    var low = (String(sectionText || '') + ' ' + String(fallbackText || '')).toLowerCase();
    if (/kinder|nursery|prep/.test(low)) return 0;
    if (/senior\s*high|\bshs\b/.test(low)) return 11;
    if (/junior\s*high|\bjhs\b/.test(low)) return 7;
    var m = low.match(/(?:grade|gr\.?|g)\s*(\d{1,2})/);
    if (m) {
        var g = parseInt(m[1], 10);
        if (g >= 0 && g <= 12) return g;
    }
    // Handles sections where the grade is glued to the letter, e.g. "4B Justice".
    m = low.match(/(?:^|[^a-z0-9])(\d{1,2})/);
    if (m) {
        var g2 = parseInt(m[1], 10);
        if (g2 >= 0 && g2 <= 12) return g2;
    }
    return null;
}

/** Is this column a rating column, versus a comment / name / timestamp? */
function evalLooksLikeScale(values) {
    var filled = 0, numeric = 0, inRange = true;
    for (var i = 0; i < values.length; i++) {
        var raw = values[i];
        if (raw === null || raw === undefined || String(raw).trim() === '') continue;
        filled++;
        var n = evalParseScore(raw);
        if (n === null) continue;
        numeric++;
        if (n < 0 || n > 10) inRange = false;
    }
    if (!filled) return false;
    return inRange && numeric >= Math.max(1, Math.floor(filled * 0.6));
}

/** Most common non-empty value in a column. */
function evalMajority(rows, index) {
    if (index < 0) return '';
    var counts = {}, best = '', bestN = 0;
    for (var i = 0; i < rows.length; i++) {
        var cell = rows[i][index];
        var v = String(cell === undefined || cell === null ? '' : cell).trim();
        if (!v) continue;
        counts[v] = (counts[v] || 0) + 1;
        if (counts[v] > bestN) { bestN = counts[v]; best = v; }
    }
    return best;
}

/** Header lookup by keyword. */
function evalFindColumn(headers, keys) {
    for (var i = 0; i < headers.length; i++) {
        var low = String(headers[i] || '').trim().toLowerCase().replace(/:\s*$/, '');
        for (var k = 0; k < keys.length; k++) {
            if (low.indexOf(keys[k]) !== -1) return i;
        }
    }
    return -1;
}

function evalNameKey(text) {
    return String(text || '').toLowerCase().replace(/[^a-z]/g, '')
        .replace(/^(mr|ms|mrs|sir|maam|madam|teacher)/, '');
}

/** "Ms. froya E. Artillaga" and "Froya E. Artillaga" -> one person, fullest spelling. */
function evalNormalizeTeacher(names) {
    var cleaned = [];
    for (var i = 0; i < names.length; i++) {
        var n = String(names[i] || '').replace(/\s+/g, ' ').trim();
        if (n) cleaned.push(n);
    }
    if (!cleaned.length) return '';

    var groups = {};
    for (var j = 0; j < cleaned.length; j++) {
        var key = evalNameKey(cleaned[j]);
        if (!groups[key]) groups[key] = [];
        groups[key].push(cleaned[j]);
    }

    var bestKey = null, bestLen = -1;
    for (var g in groups) {
        if (groups[g].length > bestLen) { bestLen = groups[g].length; bestKey = g; }
    }

    var variants = groups[bestKey], tally = {}, top = 0;
    for (var v = 0; v < variants.length; v++) {
        tally[variants[v]] = (tally[variants[v]] || 0) + 1;
        if (tally[variants[v]] > top) top = tally[variants[v]];
    }
    var winner = '';
    for (var t in tally) {
        if (tally[t] === top && t.length > winner.length) winner = t;
    }
    return winner;
}

/** Comment summary: unique, shortest to longest, duplicates collapsed with a count. */
function evalBuildCommentSummary(comments) {
    var SKIP = { 'n/a': 1, 'na': 1, 'none': 1, '-': 1, 'wala': 1, 'no comment': 1, 'nothing': 1 };
    var map = {}, order = [];
    for (var i = 0; i < comments.length; i++) {
        var cell = comments[i];
        var text = String(cell === null || cell === undefined ? '' : cell).replace(/\s+/g, ' ').trim();
        if (!text) continue;
        if (SKIP[text.toLowerCase()]) continue;
        var key = text.toLowerCase();
        if (map[key]) {
            map[key].count++;
        } else {
            map[key] = { text: text, count: 1 };
            order.push(key);
        }
    }
    var list = [];
    for (var o = 0; o < order.length; o++) list.push(map[order[o]]);
    list.sort(function (a, b) {
        if (a.text.length !== b.text.length) return a.text.length - b.text.length;
        return a.text.toLowerCase() < b.text.toLowerCase() ? -1 : 1;
    });
    var out = [];
    for (var l = 0; l < list.length; l++) {
        out.push(list[l].count > 1 ? list[l].text + ' (' + list[l].count + ')' : list[l].text);
    }
    return out;
}

/** Safe, unique Google Sheets tab name. */
function evalSafeTabName(name, used) {
    var clean = String(name || 'SECTION').replace(/[\[\]\*\/\\\?:]/g, '-').trim() || 'SECTION';
    if (clean.length > 90) clean = clean.substring(0, 90);
    var candidate = clean, n = 2;
    while (used[candidate.toLowerCase()]) {
        candidate = clean + ' (' + n + ')';
        n++;
    }
    used[candidate.toLowerCase()] = true;
    return candidate;
}

function evalSlug(text) {
    var s = String(text || '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase();
    return s || 'TEACHER';
}

// ---------------------------------------------------------------------------
// Turning one response table into a filled-in evaluation record
// ---------------------------------------------------------------------------

/** Optional Advisers sheet in the main spreadsheet: columns TEACHER | SECTION */
var __evalAdvisers = null;

function evalLoadAdvisers() {
    if (__evalAdvisers) return __evalAdvisers;
    __evalAdvisers = [];
    try {
        var ss = SpreadsheetApp.openById(prop('SHEET_ID'));
        var sh = ss.getSheetByName('Advisers') || ss.getSheetByName('Advisors');
        if (sh && sh.getLastRow() > 1) {
            var cols = Math.max(2, sh.getLastColumn());
            var vals = sh.getRange(1, 1, sh.getLastRow(), cols).getValues();
            for (var r = 1; r < vals.length; r++) {
                var tn = String(vals[r][0] || '').trim();
                var sn = String(vals[r][1] || '').trim();
                if (tn && sn) {
                    __evalAdvisers.push({
                        teacher: evalNameKey(tn),
                        section: sn.toLowerCase().replace(/[^a-z0-9]/g, '')
                    });
                }
            }
        }
    } catch (e) { /* no Advisers sheet is fine */ }
    return __evalAdvisers;
}

function evalIsAdviser(teacher, section) {
    var list = evalLoadAdvisers();
    if (!list.length) return false;
    var tk = evalNameKey(teacher);
    var sk = String(section || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!tk || !sk) return false;
    for (var i = 0; i < list.length; i++) {
        var namesMatch = tk.indexOf(list[i].teacher) !== -1 || list[i].teacher.indexOf(tk) !== -1;
        var secMatch = sk.indexOf(list[i].section) !== -1 || list[i].section.indexOf(sk) !== -1;
        if (namesMatch && secMatch) return true;
    }
    return false;
}

/**
 * @param {{name:string, headers:Array, rows:Array}} table
 * @param {boolean} skipAdviserLookup  true when running outside Apps Script
 * @return {{ok:boolean, note:string, record:Object}}
 */
function evalBuildRecord(table, skipAdviserLookup) {
    var headers = (table.headers || []).map(function (h) { return String(h || ''); });
    var rows = table.rows || [];
    if (!headers.length || !rows.length) {
        return { ok: false, note: table.name + ': no response rows found.' };
    }

    var width = headers.length;
    rows = rows.map(function (r) {
        var out = r.slice(0, width);
        while (out.length < width) out.push('');
        return out;
    });

    var iTeacher = evalFindColumn(headers, EVAL_TEACHER_KEYS);
    var iSubject = evalFindColumn(headers, EVAL_SUBJECT_KEYS);
    var iSection = evalFindColumn(headers, EVAL_SECTION_KEYS);
    var iStudent = evalFindColumn(headers, EVAL_STUDENT_KEYS);
    var iTime = evalFindColumn(headers, EVAL_TIME_KEYS);
    var iAdviser = evalFindColumn(headers, EVAL_ADVISER_KEYS);

    // The section keyword list includes "grade", which can also match an adviser
    // question. Keep them distinct.
    if (iAdviser >= 0 && iAdviser === iSection) iAdviser = -1;

    var meta = {};
    [iTeacher, iSubject, iSection, iStudent, iTime].forEach(function (i) {
        if (i >= 0) meta[i] = true;
    });

    // Split the remaining columns into ratings versus comments.
    var scoreIdx = [], commentIdx = [];
    for (var c = 0; c < width; c++) {
        if (meta[c] || c === iAdviser) continue;
        var column = rows.map(function (r) { return r[c]; });
        if (evalLooksLikeScale(column)) scoreIdx.push(c);
        else commentIdx.push(c);
    }

    var section = evalMajority(rows, iSection);
    var subject = evalMajority(rows, iSubject);

    var teacherNames = [];
    if (iTeacher >= 0) {
        for (var t = 0; t < rows.length; t++) teacherNames.push(rows[t][iTeacher]);
    }
    var teacher = evalNormalizeTeacher(teacherNames);

    var grade = evalDetectGrade(section, table.name + ' ' + subject);
    if (grade === null) {
        return { ok: false, note: table.name + ': could not detect a grade level from "' + section + '".' };
    }
    var key = evalTemplateKeyForGrade(grade);
    var spec = EVAL_TEMPLATES[key];

    var note = '';
    if (scoreIdx.length !== spec.rows.length) {
        note = table.name + ': found ' + scoreIdx.length + ' rating columns but the '
            + spec.label + ' template expects ' + spec.rows.length + '. Check the form questions.';
    }

    // Class adviser, either from a form question or the Advisers sheet.
    var adviserFlag = false;
    if (iAdviser >= 0) {
        var yes = 0, answered = 0;
        for (var a = 0; a < rows.length; a++) {
            var ans = String(rows[a][iAdviser] || '').trim().toLowerCase();
            if (!ans) continue;
            answered++;
            if (/^(y|yes|oo|opo|true|1)/.test(ans)) yes++;
        }
        adviserFlag = answered > 0 && yes >= answered / 2;
    }
    if (!adviserFlag && !skipAdviserLookup && evalIsAdviser(teacher, section)) adviserFlag = true;
    if (adviserFlag && section.toLowerCase().indexOf('class adviser') === -1) {
        section = 'CLASS ADVISER - ' + section;
    }

    var students = [];
    for (var r2 = 0; r2 < rows.length; r2++) {
        var scores = scoreIdx.map(function (i) { return evalParseScore(rows[r2][i]); });
        var any = false;
        for (var s = 0; s < scores.length; s++) {
            if (scores[s] !== null) { any = true; break; }
        }
        if (!any) continue;
        students.push({
            name: iStudent >= 0 ? String(rows[r2][iStudent] || '').trim() : '',
            scores: scores
        });
    }

    var commentGroups = [];
    for (var ci = 0; ci < commentIdx.length; ci++) {
        var idx = commentIdx[ci];
        var vals = rows.map(function (r) { return r[idx]; });
        var summary = evalBuildCommentSummary(vals);
        if (summary.length) {
            commentGroups.push({ question: String(headers[idx]).trim(), lines: summary });
        }
    }

    return {
        ok: true,
        note: note,
        record: {
            source: table.name,
            teacher: teacher,
            subject: subject,
            section: section,
            grade: grade,
            templateKey: key,
            students: students,
            commentGroups: commentGroups
        }
    };
}

// ---------------------------------------------------------------------------
// Drive plumbing
// ---------------------------------------------------------------------------

function evalTemplateFileId() {
    var id = prop('EVAL_TEMPLATE_ID', '');
    if (!id) {
        throw httpError('EVAL_TEMPLATE_ID is not set in Script Properties. Upload the master template to Drive as a GOOGLE SHEET and paste its id there.', 'CONFIG');
    }
    var m = String(id).match(/[-\w]{25,}/);
    return m ? m[0] : String(id);
}

function evalOutputFolder() {
    var id = prop('EVAL_OUTPUT_FOLDER', '');
    if (id) {
        try { return DriveApp.getFolderById(id); } catch (e) { /* fall through */ }
    }
    var root = formsFolder();
    var existing = root.getFoldersByName('Generated Evaluations');
    return existing.hasNext() ? existing.next() : root.createFolder('Generated Evaluations');
}

/** Reads any supported response file into { name, headers, rows }. */
function evalReadResponseFile(file) {
    var mime = file.getMimeType();
    if (mime === MimeType.GOOGLE_FORMS) {
        return formResponsesFromForm(file.getId(), file.getName());
    }
    if (mime === MimeType.GOOGLE_SHEETS) {
        return formResponsesFromSheet(SpreadsheetApp.openById(file.getId()), file.getName());
    }
    if (mime === 'text/csv') {
        var arr = Utilities.parseCsv(file.getBlob().getDataAsString());
        return {
            name: file.getName(),
            headers: (arr[0] || []).map(String),
            rows: arr.slice(1)
        };
    }
    return null;
}

/** Lists the teacher batches (subfolders) available to build. */
function handleListEvalBatches(session) {
    var root = formsFolder();
    var out = [];
    var subs = root.getFolders();
    while (subs.hasNext() && out.length < 300) {
        var f = subs.next();
        if (f.getName() === 'Generated Evaluations') continue;
        var count = 0;
        var files = f.getFiles();
        while (files.hasNext()) {
            var mt = files.next().getMimeType();
            if (mt === MimeType.GOOGLE_FORMS || mt === MimeType.GOOGLE_SHEETS || mt === 'text/csv') count++;
        }
        out.push({ id: f.getId(), name: f.getName(), files: count });
    }
    out.sort(function (a, b) { return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0); });

    var loose = 0, rootFiles = root.getFiles();
    while (rootFiles.hasNext()) {
        var rmt = rootFiles.next().getMimeType();
        if (rmt === MimeType.GOOGLE_FORMS || rmt === MimeType.GOOGLE_SHEETS || rmt === 'text/csv') loose++;
    }

    return { folderName: root.getName(), batches: out, looseFiles: loose };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------
/**
 * payload:
 *   folderId  optional - build just this teacher subfolder. Omit for all.
 *   dryRun    optional - report what WOULD be built without creating files.
 */
function handleBuildEvalWorkbooks(session, p) {
    p = p || {};
    var templateId = evalTemplateFileId();
    var root = formsFolder();

    var batches = [];
    if (p.folderId) {
        var one = DriveApp.getFolderById(String(p.folderId));
        batches.push({ name: one.getName(), folder: one });
    } else {
        var subs = root.getFolders();
        while (subs.hasNext()) {
            var sf = subs.next();
            if (sf.getName() === 'Generated Evaluations') continue;
            batches.push({ name: sf.getName(), folder: sf });
        }
        batches.push({ name: '', folder: root });   // loose files in the root
    }

    var outFolder = p.dryRun ? null : evalOutputFolder();
    var created = [], notes = [];

    for (var b = 0; b < batches.length; b++) {
        var batch = batches[b];
        var byTemplate = {};

        var files = batch.folder.getFiles();
        while (files.hasNext()) {
            var file = files.next();
            var table = null;
            try {
                table = evalReadResponseFile(file);
            } catch (e) {
                notes.push(file.getName() + ': ' + (e.message || e));
                continue;
            }
            if (!table) continue;

            var built = evalBuildRecord(table, false);
            if (built.note) notes.push(built.note);
            if (!built.ok) continue;

            var key = built.record.templateKey;
            if (!byTemplate[key]) byTemplate[key] = [];
            byTemplate[key].push(built.record);
        }

        for (var tk in byTemplate) {
            var records = byTemplate[tk];
            records.sort(function (x, y) {
                if (x.grade !== y.grade) return x.grade - y.grade;
                return x.section < y.section ? -1 : (x.section > y.section ? 1 : 0);
            });

            var teacherLabel = batch.name;
            if (!teacherLabel) {
                teacherLabel = evalNormalizeTeacher(records.map(function (r) { return r.teacher; }));
            }
            var fileName = evalSlug(teacherLabel) + '_' + evalSlug(EVAL_TEMPLATES[tk].label);

            if (p.dryRun) {
                created.push({
                    name: fileName,
                    template: EVAL_TEMPLATES[tk].label,
                    teacher: teacherLabel,
                    tabs: records.map(function (r) { return r.section; }),
                    responses: records.reduce(function (s, r) { return s + r.students.length; }, 0),
                    url: ''
                });
                continue;
            }

            var result = evalWriteWorkbook(templateId, tk, records, fileName, outFolder, notes);
            created.push({
                name: result.name,
                template: EVAL_TEMPLATES[tk].label,
                teacher: teacherLabel,
                tabs: result.tabs,
                responses: result.responses,
                url: result.url,
                id: result.id,
                xlsxUrl: result.xlsxUrl
            });
        }
    }

    return {
        generatedAt: nowStamp(),
        folderName: root.getName(),
        outputFolder: p.dryRun ? '' : outFolder.getName(),
        outputFolderUrl: p.dryRun ? '' : outFolder.getUrl(),
        files: created,
        notes: notes,
        dryRun: !!p.dryRun
    };
}

// ---------------------------------------------------------------------------
// Writing the output workbook
// ---------------------------------------------------------------------------

/** Copies the template and fills one tab per section. */
function evalWriteWorkbook(templateId, templateKey, records, fileName, outFolder, notes) {
    var spec = EVAL_TEMPLATES[templateKey];

    // Replace any previous build with the same name so re-runs stay clean.
    var dupes = outFolder.getFilesByName(fileName);
    while (dupes.hasNext()) dupes.next().setTrashed(true);

    var copy = DriveApp.getFileById(templateId).makeCopy(fileName, outFolder);
    var ss = SpreadsheetApp.openById(copy.getId());

    var master = ss.getSheetByName(spec.sheetName);
    if (!master) {
        throw httpError('The template workbook has no sheet named "' + spec.sheetName + '". Check EVAL_TEMPLATE_ID.', 'CONFIG');
    }

    var used = {}, tabs = [], responses = 0;
    var capacity = spec.lastCol - spec.firstCol + 1;

    for (var i = 0; i < records.length; i++) {
        var record = records[i];
        // copyTo preserves every formula, merge and format from the template.
        var sheet = (i === 0) ? master : master.copyTo(ss);
        var tabName = evalSafeTabName(record.section || record.subject || ('SECTION ' + (i + 1)), used);
        sheet.setName(tabName);
        evalFillSheet(sheet, spec, record, notes);
        tabs.push(tabName);
        responses += Math.min(record.students.length, capacity);
    }

    evalWriteCommentsTab(ss, records, used);

    // Drop the unused template tabs, keeping only what we filled in.
    var all = ss.getSheets();
    for (var s = 0; s < all.length; s++) {
        var nm = all[s].getName();
        var isTemplateTab = false;
        for (var t in EVAL_TEMPLATES) {
            if (EVAL_TEMPLATES[t].sheetName === nm) { isTemplateTab = true; break; }
        }
        if (isTemplateTab && ss.getSheets().length > 1) ss.deleteSheet(all[s]);
    }

    SpreadsheetApp.flush();

    return {
        name: fileName,
        id: copy.getId(),
        url: ss.getUrl(),
        xlsxUrl: 'https://docs.google.com/spreadsheets/d/' + copy.getId() + '/export?format=xlsx',
        tabs: tabs,
        responses: responses
    };
}

/** Writes the 3 header cells and the student score columns. Nothing else. */
function evalFillSheet(sheet, spec, record, notes) {
    sheet.getRange('B2').setValue(record.teacher);
    sheet.getRange('B3').setValue(record.subject);
    sheet.getRange('B4').setValue(record.section);

    var capacity = spec.lastCol - spec.firstCol + 1;
    var students = record.students;
    if (students.length > capacity) {
        notes.push(record.source + ': ' + students.length + ' responses exceed the '
            + spec.label + ' template capacity of ' + capacity + ' columns. Extra responses were left out.');
        students = students.slice(0, capacity);
    }
    if (!students.length) return;

    // One batched write per question row keeps this fast on big folders.
    for (var r = 0; r < spec.rows.length; r++) {
        var rowValues = [], hasValue = false;
        for (var s = 0; s < students.length; s++) {
            var score = students[s].scores[r];
            if (score === null || score === undefined) {
                rowValues.push('');
            } else {
                rowValues.push(score);
                hasValue = true;
            }
        }
        if (hasValue) {
            sheet.getRange(spec.rows[r], spec.firstCol, 1, rowValues.length).setValues([rowValues]);
        }
    }
}

/** COMMENTS SUMMARY tab, in the required arrangement. */
function evalWriteCommentsTab(ss, records, used) {
    var name = evalSafeTabName('COMMENTS SUMMARY', used);
    var sheet = ss.insertSheet(name);
    var out = [], bold = [];

    out.push(['COMMENTS SUMMARY']);
    bold.push(out.length);
    out.push(['']);

    for (var i = 0; i < records.length; i++) {
        var record = records[i];
        out.push([record.section + (record.subject ? '  -  ' + record.subject : '')]);
        bold.push(out.length);

        for (var g = 0; g < record.commentGroups.length; g++) {
            var group = record.commentGroups[g];
            out.push([group.question]);
            bold.push(out.length);
            for (var l = 0; l < group.lines.length; l++) out.push([group.lines[l]]);
            out.push(['']);
        }
        out.push(['']);
    }

    if (out.length) sheet.getRange(1, 1, out.length, 1).setValues(out);
    sheet.setColumnWidth(1, 700);
    sheet.getRange(1, 1).setFontSize(14).setFontWeight('bold');
    for (var b = 0; b < bold.length; b++) sheet.getRange(bold[b], 1).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return sheet;
}

// ---------------------------------------------------------------------------
// Run this once from the Apps Script editor to sanity-check the setup.
// ---------------------------------------------------------------------------
function testEvalExportSetup() {
    var lines = [];
    try {
        lines.push('OK    Forms folder: ' + formsFolder().getName());
    } catch (e) {
        lines.push('FAIL  ' + e.message);
    }
    try {
        var ss = SpreadsheetApp.openById(evalTemplateFileId());
        lines.push('OK    Template workbook: ' + ss.getName());
        var missing = [];
        for (var k in EVAL_TEMPLATES) {
            if (!ss.getSheetByName(EVAL_TEMPLATES[k].sheetName)) missing.push(EVAL_TEMPLATES[k].sheetName);
        }
        lines.push(missing.length
            ? 'WARN  Missing template tabs: ' + missing.join(', ')
            : 'OK    All 5 template tabs found.');
    } catch (e2) {
        lines.push('FAIL  ' + e2.message);
    }
    try {
        var batches = handleListEvalBatches(null);
        lines.push('OK    Teacher folders: ' + batches.batches.length
            + ' (loose files in root: ' + batches.looseFiles + ')');
    } catch (e3) {
        lines.push('FAIL  ' + e3.message);
    }
    Logger.log(lines.join('\n'));
    return lines.join('\n');
}
