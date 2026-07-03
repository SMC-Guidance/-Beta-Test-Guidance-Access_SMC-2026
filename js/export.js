"use strict";
window.SMC = window.SMC || {};
SMC.exporter = (function () {
    var ui = SMC.ui;
    function print(r) {
        var today = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
        function pf(label, val) {
            if (!val || !String(val).trim())
                return '';
            return '<div class="pr-field"><div class="pr-label">' + ui.esc(label) + '</div><div class="pr-value">' + ui.esc(val) + '</div></div>';
        }
        function pfl(label, val) {
            if (!val || !String(val).trim())
                return '';
            return '<div class="pr-long"><div class="pr-label">' + ui.esc(label) + '</div><div class="pr-value">' + ui.esc(val) + '</div></div>';
        }
        document.getElementById('printArea').innerHTML =
            '<div class="pr-header"><h1>Stella Maris College \u2014 Guidance Office</h1>' +
                '<p>Student Counseling Record \u2022 Printed ' + ui.esc(today) + '</p></div>' +
                '<div class="pr-section"><div class="pr-section-title">Student Information</div><div class="pr-grid">' +
                pf('Full Name', r.name) + pf('Grade & Section', r.grade) + pf('Age', r.age) +
                pf('Sex', r.sex) + pf('Date', ui.fmtDate(r.date)) + pf('Record No.', r.recordNo) +
                pf('Session No.', r.sessionNo) + pf('Modality', r.modality) + pf('Guidance Designate', r.designate) +
                pf('Referral Source', r.referralSource) + pf('Teacher Referral', r.teacherReferral) +
                '</div></div>' +
                '<div class="pr-section"><div class="pr-section-title">Presenting Concern</div><div class="pr-grid">' +
                pf('Issue Category', r.issueCategory) + pfl('Issue Description', r.issueDescription) + '</div></div>' +
                '<div class="pr-section"><div class="pr-section-title">Behavioral Observation Checklist</div><div class="pr-grid">' +
                pf('Grooming & Appearance', r.grooming) + pf('Eye Contact', r.eyeContact) + pf('Speech', r.speech) +
                pf('Verbal Comprehension', r.verbalComprehension) + pf('Gross Motor / Gait', r.grossMotor) + pf('Fine Motor Skills', r.fineMotor) +
                pf('Compliance', r.compliance) + pf('Emotional Tone', r.emotionalTone) + pf('Emotional Management', r.emotionalManagement) +
                pfl('Observation Remarks', r.observationRemarks) + '</div></div>' +
                '<div class="pr-section"><div class="pr-section-title">Guidance Designate Notes</div><div class="pr-grid">' +
                pfl('Student Report', r.studentReport) + pfl('Actions Taken', r.actionsTaken) + pfl('Progress Evaluation', r.progressEvaluation) +
                '</div></div>' +
                '<div class="pr-sig"><div class="pr-sig-block">Guidance Designate Signature</div><div class="pr-sig-block">Date</div></div>';
        document.getElementById('printArea').style.display = 'block';
        window.print();
        setTimeout(function () { document.getElementById('printArea').style.display = 'none'; }, 1500);
    }
    function pdf(r) {
        var JsPDF = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : (window.jsPDF || null);
        if (!JsPDF) {
            ui.toast('PDF library not loaded. Refresh and try again.', 'err');
            return;
        }
        var doc = new JsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        var PW = 210, PH = 297, ML = 15, MR = 15, MT = 15, MB = 18;
        var CW = PW - ML - MR, y = MT, LH = 5;
        function safeStr(v) { return (v == null) ? '' : String(v); }
        function checkPage(needed) { if (y + needed > PH - MB) {
            doc.addPage();
            y = MT;
            return true;
        } return false; }
        function setH(size, bold, rr, gg, bb) { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(rr || 0, gg || 0, bb || 0); }
        function sectionBar(title) {
            checkPage(12);
            doc.setFillColor(0, 43, 107);
            doc.rect(ML, y - 4, CW, 8, 'F');
            setH(8, true, 255, 255, 255);
            doc.text(title.toUpperCase(), ML + 3, y + 0.5);
            y += 9;
        }
        function addField(label, val, x, w) {
            var v = safeStr(val).trim();
            if (!v)
                return 0;
            checkPage(LH * 3);
            setH(6.5, true, 90, 90, 90);
            doc.text(label.toUpperCase(), x, y);
            setH(8.5, false, 20, 20, 20);
            var lines = doc.splitTextToSize(v, w - 2);
            if (y + LH + lines.length * LH > PH - MB) {
                doc.addPage();
                y = MT;
            }
            doc.text(lines, x, y + LH * 0.85);
            return LH + LH * lines.length;
        }
        function addLong(label, val) {
            var v = safeStr(val).trim();
            if (!v)
                return;
            var lines = doc.splitTextToSize(v, CW - 8);
            var boxH = LH * (lines.length + 1) + 6;
            checkPage(boxH + 8);
            setH(6.5, true, 90, 90, 90);
            doc.text(label.toUpperCase(), ML, y);
            y += LH * 0.85;
            doc.setFillColor(242, 244, 249);
            doc.setDrawColor(190, 200, 220);
            doc.setLineWidth(0.2);
            doc.rect(ML, y - 2, CW, LH * lines.length + 5, 'FD');
            setH(8.5, false, 20, 20, 20);
            doc.text(lines, ML + 3, y + LH * 0.7);
            y += LH * lines.length + 7;
        }
        function threeCol(fields) {
            var valid = fields.filter(function (f) { return safeStr(f[1]).trim(); });
            if (!valid.length)
                return;
            var cols = [[], [], []];
            valid.forEach(function (f, i) { cols[i % 3].push(f); });
            var maxR = Math.max(cols[0].length, cols[1].length, cols[2].length);
            var colW = (CW - 10) / 3;
            for (var ri = 0; ri < maxR; ri++) {
                checkPage(LH * 3.5);
                var rowH = LH * 2.2;
                for (var ci = 0; ci < 3; ci++) {
                    if (!cols[ci][ri])
                        continue;
                    var x = ML + (colW + 5) * ci;
                    rowH = Math.max(rowH, addField(cols[ci][ri][0], cols[ci][ri][1], x, colW));
                }
                y += rowH;
            }
            y += 2;
        }
        doc.setFillColor(0, 43, 107);
        doc.rect(0, 0, PW, 26, 'F');
        setH(13, true, 255, 255, 255);
        doc.text('Stella Maris College', ML, 11);
        setH(8.5, false, 191, 160, 80);
        doc.text('Guidance Office \u2014 Student Counseling Record', ML, 18);
        setH(7, false, 150, 170, 200);
        doc.text('Printed: ' + new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }), PW - MR, 18, { align: 'right' });
        y = 34;
        sectionBar('Student Information');
        threeCol([
            ['Full Name', r.name], ['Grade & Section', r.grade], ['Age', r.age],
            ['Sex', r.sex], ['Date', ui.fmtDate(r.date)], ['Record No.', r.recordNo],
            ['Session No.', r.sessionNo], ['Modality', r.modality], ['Guidance Designate', r.designate],
            ['Referral Source', r.referralSource], ['Teacher Referral', r.teacherReferral]
        ]);
        sectionBar('Presenting Concern');
        threeCol([['Issue Category', r.issueCategory]]);
        addLong('Issue Description', r.issueDescription);
        sectionBar('Behavioral Observation Checklist');
        threeCol([
            ['Grooming & Appearance', r.grooming], ['Eye Contact', r.eyeContact], ['Speech', r.speech],
            ['Verbal Comprehension', r.verbalComprehension], ['Gross Motor / Gait', r.grossMotor], ['Fine Motor Skills', r.fineMotor],
            ['Compliance', r.compliance], ['Emotional Tone', r.emotionalTone], ['Emotional Management', r.emotionalManagement]
        ]);
        addLong('Observation Remarks', r.observationRemarks);
        sectionBar('Guidance Designate Notes');
        addLong('Student Report', r.studentReport);
        addLong('Actions Taken', r.actionsTaken);
        addLong('Progress Evaluation', r.progressEvaluation);
        checkPage(28);
        y += 10;
        doc.setDrawColor(0, 43, 107);
        doc.setLineWidth(0.5);
        doc.line(ML, y, ML + 72, y);
        doc.line(PW - MR - 72, y, PW - MR, y);
        setH(7.5, false, 80, 80, 80);
        doc.text('Guidance Designate Signature', ML, y + 5);
        doc.text('Date', PW - MR - 72, y + 5);
        var fname = (safeStr(r.name).replace(/[^a-zA-Z0-9\s]/g, '').trim() || 'record') + '_' +
            safeStr(r.grade).replace(/[^a-zA-Z0-9]/g, '_') + '.pdf';
        doc.save(fname);
        ui.toast('PDF saved successfully.', 'ok');
    }
    return { print: print, pdf: pdf };
})();
