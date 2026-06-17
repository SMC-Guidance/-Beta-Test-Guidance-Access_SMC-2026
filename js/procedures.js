"use strict";
window.SMC = window.SMC || {};
SMC.procedures = (function () {
    var rendered = false;
    function card(title, openTop, bodyHtml) {
        return '<details class="proc-card"' + (openTop ? ' open' : '') + '>' +
            '<summary>' + title + '</summary>' +
            '<div class="proc-body">' + bodyHtml + '</div></details>';
    }
    function ul(items) { return '<ul class="proc-list">' + items.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ul>'; }
    function note(html) { return '<div class="proc-note"><span class="proc-note-ic">\uD83D\uDCA1</span><div>' + html + '</div></div>'; }
    function h(t) { return '<h4 class="proc-h">' + t + '</h4>'; }
    function tbl(rows, headers) {
        var th = headers ? '<thead><tr>' + headers.map(function (x) { return '<th>' + x + '</th>'; }).join('') + '</tr></thead>' : '';
        var tr = rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('');
        return '<table class="proc-table">' + th + '<tbody>' + tr + '</tbody></table>';
    }
    function studentSection() {
        var arrival = ul([
            'Confirm the designated testing area (the Testing Area if unattended, or a classroom on the 1st or 3rd Floor). Coordinate with the assigned maintenance staff.',
            'Once the parent &amp; student-applicant arrive, have the parent fill out the respective logbook.',
            'Request the student-applicant\u2019s test permit, confirming their testing/interview schedule is today.',
            'Retrieve and organize their documents. Retrieve the appropriate <strong>tests and answer sheets</strong> and a <strong>timer</strong>.',
            'For <strong>Kinder to Grade 4</strong>, retrieve the appropriate <strong>Interview Guides</strong> for the Grade level being applied for.'
        ]) + note('<strong>DLP tests:</strong>' + ul([
            '<strong>Kinder to Grade 5</strong> = no DLP tests',
            '<strong>Grade 6 to Grade 11</strong> = give DLP tests <strong>one grade lower</strong> than what they are applying for (e.g., a Grade 7 applicant \u2192 Grade 6 DLP tests).'
        ]));
        var matrix = h('Test &amp; Materials by Grade Level') + tbl([
            ['Kinder', 'Kinder Activity Sheet', 'Pencil &amp; crayons'],
            ['Grade 1', 'Grade 1 Activity Sheet', 'Pencil &amp; crayons'],
            ['Grade 2', 'Grade 2 Activity Sheet', 'Pencil &amp; crayons'],
            ['Grade 3', 'Grade 3 Activity Sheet', 'Pencil &amp; crayons'],
            ['Grade 4', 'Grade 4 Activity Sheet', 'Pencil &amp; crayons'],
            ['Grade 5', 'Grade 5 Activity Sheet', 'Pencil &amp; pen'],
            ['Grade 6', 'OLSAT Level F, Form 5, Grade 5 DLP LAS (Math &amp; English)', 'Pencil &amp; pen'],
            ['Grade 7', 'OLSAT Level F, Form 5, Grade 6 DLP LAS (Math &amp; English)', 'Pencil &amp; pen'],
            ['Grade 8', 'OLSAT Level F, Form 5, Grade 7 DLP LAS (Math &amp; English)', 'Pencil &amp; pen'],
            ['Grade 9', 'OLSAT Level G, Form 5, Grade 8 DLP LAS (Math &amp; English)', 'Pencil &amp; pen'],
            ['Grade 10', 'OLSAT Level G, Form 5, Grade 9 DLP LAS (Math &amp; English)', 'Pencil &amp; pen'],
            ['Grade 11', 'OLSAT Level G, Form 5, Grade 10 DLP LAS (Math &amp; English)', 'Pencil &amp; pen']
        ], ['Level', 'Tests', 'Materials']) +
            h('Before Testing') + ul([
            'Assign who will conduct the test.',
            'The examiner introduces themselves to the parent/s, explains the tests and how long they take, and advises whether parents should stay or return at a set time.',
            '<strong>Kinder to Grade 4</strong> \u2014 1 hour to 1 hour 30 minutes; tests checked after, then the applicant and parent are interviewed the same day (same-day admission process).',
            '<strong>Grade 5 to Grade 11</strong> \u2014 2 hours: OLSAT (Scholastic Aptitude Test) and the DLP Test. Ask parents if they are familiar with the CVIF-DLP and briefly explain it. Results &amp; interview scheduling take 2\u20133 working days.',
            'Ensure both parent and student-applicant are ready. Have the applicant gather testing materials and assist them to the testing room, then conduct the tests.'
        ]) +
            note('<strong>CVIF-DLP</strong> is a learning program at Stella Maris College where students study more independently. Section A writes a 1-page Learning Activity Sheet (LAS) \u2014 a brief lesson, examples, and a short activity flashed on the classroom TV \u2014 within 30 minutes with a Facilitator present. The Expert Teacher then discusses the lesson for the remaining 30 minutes while the Facilitator moves to Section B and repeats the process. This helps students recall lessons in short, effective chunks, and lets teachers handle two sections in one period.');
        var k4 = h('Testing Guide \u2014 Kinder to Grade 4') + ul([
            '<strong>Kinder &amp; Grade 1</strong> \u2014 Ask the applicant about themselves using the Interview Guide while they complete their Activity Sheets. Check their Report Card and documents. Determine language fluency (Filipino or English) and offer assistance. Ensure all Interview Guides and Activity Sheets are filled out.',
            '<strong>Grade 2 to Grade 4</strong> \u2014 Provide the appropriate exam for the Grade level, administered for <strong>1 hour</strong>. Check in on whether they need assistance. Ensure all Activity Sheets are filled out.'
        ]) + h('Scoring (Kinder to Grade 4)') + ul(['Use the provided Answer Keys.']) +
            h('Interviews (Kinder to Grade 4)') +
            '<p class="proc-sub">Student Interview</p>' + ul([
            'Kinder to Grade 1 \u2014 may be done before or during the test using the Interview Guide.',
            'Grade 2 to Grade 4 \u2014 may be done before or after the test using the Interview Guide.'
        ]);
        var parentReq = h('Parent Interview \u2014 Requirements Check') +
            '<p class="proc-sub">Check whether requirements are complete:</p>' + ul([
            '<strong>Student Personal Inventory (SPI)</strong> \u2014 filled out completely; with parents\u2019 contact details and address.',
            '<strong>1x1 ID Picture</strong> \u2014 glued on the applicant\u2019s SPI.',
            '<strong>Report Card</strong> (Gr. 1\u20134 only) \u2014 photocopy or Certified True Copy; matching the Grade level from the previous school year.',
            '<strong>Birth Certificate</strong> \u2014 photocopy with correct name.',
            '<strong>Baptismal/Dedication Certificate</strong> \u2014 photocopy with correct name.',
            '<strong>Good Moral Certificate</strong> (Gr. 1\u20134 only) \u2014 original from previous school; signed and with school seal.',
            '<strong>Recommendation Letter</strong> (Gr. 1\u20134 only) \u2014 original on the SMC template; filled out and signed by the teacher/Guidance representative from the former school.'
        ]) + ul([
            'If <strong>complete</strong>: provide the form with an <strong>Acknowledgment Slip</strong>. Correct the S.Y. on the slip if needed.',
            'If <strong>incomplete</strong>: present a <strong>Provisional Admission Letter</strong> and <strong>Promissory Note</strong>. List the missing requirements, have the parent sign both, and keep the Promissory Note in the SPI. Only provide these if missing: Good Moral Certificate (but Report Card &amp; Recommendation Letter provided), Birth Certificate, 1x1 ID Picture, or Baptismal/Dedication Certificate.'
        ]) + note('<strong>DO NOT RELEASE RESULTS IF:</strong>' + ul([
            'Grade 1 \u2014 has no Report Card.',
            'Grade 2 to 4 \u2014 has no Report Card, Good Moral, and Recommendation Letter.'
        ]));
        var parentOutcome = h('Parent Interview \u2014 Relaying Results') + ul([
            '<strong>If the applicant meets standards</strong> (passed, good grades, required skills observed): present the <strong>Memorandum of Understanding</strong> and <strong>Guidance Center Internal Policy</strong> forms, explaining the contents (a summarized version if preferred).',
            'Memorandum of Understanding \u2014 explain P.E.A.C.E. and LEBRIS; emphasize that parents are highly encouraged to attend seminars and conferences for their child\u2019s holistic development.',
            'Guidance Center Internal Policy \u2014 explain the referral process and how a child would be referred to their pediatrician (and the consequent steps).',
            'If the applicant is <strong>Non-Catholic</strong>, provide a <strong>Parental Terms Agreement with SMC \u2014 Re: Students with Non-Catholic Family Background</strong> if not yet accomplished.',
            'Answer any relevant questions.',
            '<strong>If the applicant did not meet standards</strong>: offer <strong>Reassessment</strong> at least <strong>2 weeks</strong> after the first exam (free of charge for Grade 1\u20132 applicants). Do not provide any forms during this time. After 2 reassessments with no improvement, <strong>FAIL</strong> the applicant and inform the parent carefully.'
        ]);
        var g511 = h('Testing Guide \u2014 Grade 5 to Grade 11') + ul([
            '<strong>Grade 5</strong> \u2014 Grade 5 Activity Sheet, administered for <strong>1 hour</strong>. No DLP testing.',
            '<strong>Grade 6 to Grade 10</strong> \u2014 OLSAT plus assigned LAS. Two tests (OLSAT and DLP) with a <strong>20-minute break</strong> in between. OLSAT measures cognitive ability and logical reasoning. Explain the DLP briefly.',
            '<strong>Grade 11</strong> \u2014 OLSAT plus assigned LAS. Check the Report Card and references (esp. <strong>IQ Test score, NCAE results for STEM applicants, Achievement Test score</strong>). Two tests (OLSAT then DLP) with a 20-minute break.'
        ]) + '<p class="proc-sub">OLSAT</p>' + ul([
            'Write using a <strong>pencil</strong>.',
            'Start reading the instructions from page <strong>15</strong>.',
            'Birthday format \u2014 Name of Month DD, YYYY.',
            'Check details for correctness and accuracy.',
            '40 minutes for the actual exam.'
        ]) + '<p class="proc-sub">20-minute break</p>' + '<p class="proc-sub">DLP</p>' + ul([
            'Write using a <strong>ballpen</strong>.',
            'Explain how the DLP works (writing concept notes and accomplishing the LAS for 30 minutes, then the expert teacher discusses the lesson). Scoring uses the 3 Cs: Completeness, Cleanliness, Correctness.',
            'Provide 2 LAS (Math and English) and 2 blank LAS sheets. Give the Math LAS and answer sheet first.',
            'Start with <strong>Math</strong> in print; set a 30-minute timer.',
            'Then collect it and give the <strong>English</strong> LAS in cursive; set a 30-minute timer.'
        ]) + ul([
            'For <strong>Grade 5 to SHS</strong>, results are sent via email and text (parents\u2019 contacts) within 3 working days. For <strong>Kinder to Grade 4</strong>, admission results are done the same day.',
            'Log the applicant\u2019s details in the <strong>Student-Applicants Spreadsheet</strong>.'
        ]);
        var scoring511 = h('Scoring (Grade 5 to Grade 11)') +
            '<p class="proc-sub">Grade 5 Test</p>' + ul(['Use the Answer Key.']) +
            '<p class="proc-sub">OLSAT Scoring</p>' + ul([
            'Use the OLSAT Calculator Excel sheet for easy reference; check using the manual.',
            'Stanine \u2014 should be at least <strong>4 (total score)</strong> to be considered <strong>passed</strong> (with DLP results and Report Card grades). A score of <strong>3</strong> places an applicant under <strong>Academic Probation</strong> if they have acceptable grades and provided their Good Moral and Recommendation Form.'
        ]) +
            '<p class="proc-sub">Checking of DLP LAS</p>' + ul([
            'Provide <strong>Sir Rain Rubio</strong> (Academic Chairperson for High School) the DLP tests; he checks them.',
            'Sticky-note format for DLP tests: <em>Student Applicants \u2014 [Date of Test] \u2014 [no. of applicants] \u2014 Grade level of applicant/s</em>. Note on the DLP test if the student is an SMCEA applicant.',
            'Checked DLP tests are returned by Sir Rain or through Miss Thessa.'
        ]);
        var sched = h('Scheduling Interviews (Grade 5 to Grade 11)') + ul([
            'After scoring the OLSAT and receiving DLP results from Sir Rain, schedule interviews per the Guidance Staff\u2019s calendar availability (e.g., 2 applicants 8:30\u20139:30 AM, 2 applicants 10:00\u201311:00 AM).'
        ]) + '<p class="proc-sub">Complete Requirements</p>' + ul([
            '<strong>Complete, passed, good grades</strong> \u2014 inform parents (email/text) that the child has <strong>PASSED</strong> and will proceed to interview. Provide date and schedule.',
            '<strong>Complete, did not pass, good grades</strong> \u2014 inform parents the child is <strong>SCHEDULED</strong> for interview; placed under <strong>Academic Probation</strong> with Agreement Forms (1 parent, 1 Guidance Center). Guidance OIC must sign forms before interviews.',
            '<strong>Complete, passed, low grades</strong> \u2014 inform parents the child is <strong>SCHEDULED</strong> for interview; placed under <strong>Academic Probation</strong> with Agreement Forms (OIC must sign first).',
            '<strong>Complete, did not pass, low grades</strong> \u2014 inform parents the child <strong>DID NOT PASS</strong> (relay carefully). If reconsideration is requested, deliberate on the OLSAT result (a score of 1 cannot be considered unless grades are good) and Report Card grades. There must be an aspect sufficient to place the applicant under Academic Probation.'
        ]) + '<p class="proc-sub">Incomplete Requirements</p>' + ul([
            '<strong>Incomplete, passed</strong> \u2014 inform parents the child is <strong>SCHEDULED</strong> for interview and the requirements to comply by the interview date. On compliance: low grades \u2192 Academic Probation; good grades \u2192 Passed. On non-compliance: the Guidance Center <strong>cannot release</strong> results until requirements are met in person.',
            '<strong>Incomplete, did not pass</strong> \u2014 inform parents the Guidance Center <strong>cannot release</strong> results due to lacking requirements. On compliance: low grades \u2192 Did Not Pass; good grades \u2192 Academic Probation.'
        ]);
        var interview511 = h('Interview Process (Grade 5 to Grade 11)') +
            '<p class="proc-sub">Student Interview</p>' + ul([
            'Ask how they\u2019re doing and feeling (e.g., eaten, slept, well-being).',
            'Conduct in 3 parts: Basic information; Family; School, friends, etc.',
            'Have the applicant introduce themselves (guided by the SPI and Interview Guide) and ask how they want to be called.',
            'Have them describe their personality, family, and school life; inquire about relationships \u2014 closeness with parents, parents\u2019 work, siblings; who they came with (and the relationship if a guardian).',
            'Refer to the Application Form for clubs, activities, etc. Discuss study habits, why they want to study at SMC, and favorite/least favorite subjects.',
            'Discuss experience with the DLP and cursive writing (DLP \u2014 no books; learning is via LAS and Concept Notes, then the expert teacher discusses the lesson).',
            'Determine whether they have experienced/are experiencing any problems per the Interview Guide, and their interest in studying at SMC.'
        ]) + '<p class="proc-sub">Parent Interview</p>' + ul([
            'Check requirements (SPI, 1x1 ID Picture, Report Card, Birth Certificate, Baptismal/Dedication Certificate, Good Moral Certificate, Recommendation Letter).',
            '<strong>Passed, good grades</strong> \u2014 provide the form with an <strong>Admission Slip</strong> (correct the S.Y. if needed).',
            '<strong>Passed, not good grades</strong> \u2014 provide an <strong>Agreement Form</strong> (2 copies) plus the form with an Admission Slip.',
            '<strong>Did not pass, good grades</strong> \u2014 provide an <strong>Agreement Form</strong> (2 copies) plus the form with an Admission Slip.',
            'If passed but missing only Good Moral (with Report Card &amp; Recommendation Letter), 1x1 ID Picture, Birth Certificate, or Baptismal/Dedication Certificate \u2014 present a Provisional Admission Letter and Promissory Note; list missing items, have the parent sign both, keep the Promissory Note in the SPI.',
            'If Report Card, Recommendation Letter &amp; Good Moral are not provided \u2014 <strong>DO NOT RELEASE RESULTS</strong>.',
            'If Non-Catholic, provide the Parental Terms Agreement if not already given by the Registrar. Present the Memorandum of Understanding and Guidance Center Internal Policy forms; explain P.E.A.C.E., LEBRIS, and the referral process. Answer any relevant questions.'
        ]);
        var faqs = h('FAQs by Parents of Student-Applicants') + tbl([
            ['Are classrooms airconditioned?', 'Yes, including electric fans.'],
            ['How much is the Tuition Fee &amp; what is included?', 'Please inquire at the Treasurer\u2019s Office for the next semester\u2019s tuition and the breakdown of fees.'],
            ['Are uniforms/books included in tuition?', 'No. Please refer to the breakdown of fees at the Treasurer\u2019s Office.'],
            ['How many students per section?', 'Based on the number admitted per Grade level, typically divided into 2\u20133 sections of roughly 30 students each.'],
            ['Are there clubs for students?', 'Yes, starting in Grade 4. All students must join clubs as part of the curriculum; participation is graded by the club moderator.'],
            ['Are school bus services offered?', 'Yes, with designated routes; students are dropped off on school grounds. Younger students (Kinder\u2013Grade 2) are assisted by their Adviser at dismissal. ID letter codes: B = School Bus Rider, C = Commute, F = Fetch.'],
            ['Are there school activities to know of?', 'Yes \u2014 besides parent seminars/conferences, there are Family Days, SMC Fest, Paglalayag, and Guidance Center programs. Some are noted in the Student\u2019s Handbook upon admission.'],
            ['How do teachers teach Filipino?', 'Depends on the teacher; Filipino and Araling Panlipunan are typically taught in Filipino. SMC emphasizes equal grasp of both languages. Encourage age-appropriate Filipino media and speaking Filipino at home.'],
            ['Is cursive writing necessary?', 'Yes \u2014 students are required to write in cursive for certain subjects (e.g., English), so practice is encouraged.'],
            ['Are smartphones not allowed?', 'Use is discouraged in class but allowed after classes for communication, or in class when required for schoolwork.'],
            ['Is there accommodation for children with special needs?', 'No. If diagnosed with a psychological disorder, parents/guardians must submit a medical certificate from a Developmental Pediatrician, Psychologist, or Psychiatrist stating the student is allowed/recommended for a regular class setup.'],
            ['What are the schedules of students?', 'Depends on the year level.']
        ], ['Question', 'Answer']);
        return '<div class="proc-group">' +
            '<div class="proc-group-head"><span class="proc-tag">Student-Applicants</span><h3>Assessment Procedures for Student-Applicants</h3></div>' +
            card('Arrival &amp; Preparation', true, arrival) +
            card('Test &amp; Materials Matrix + Before Testing', false, matrix) +
            card('Testing Guide \u2014 Kinder to Grade 4', false, k4) +
            card('Parent Interview \u2014 Kinder to Grade 4', false, parentReq + parentOutcome) +
            card('Testing Guide \u2014 Grade 5 to Grade 11', false, g511) +
            card('Scoring \u2014 Grade 5 to Grade 11', false, scoring511) +
            card('Scheduling Interviews \u2014 Grade 5 to Grade 11', false, sched) +
            card('Interview Process \u2014 Grade 5 to Grade 11', false, interview511) +
            card('FAQs by Parents', false, faqs) +
            '</div>';
    }
    function teacherSection() {
        var prep = ul([
            'Confirm the designated testing area (Testing Area if unattended, or a classroom on the 1st or 3rd Floor of the GS Bldg). Coordinate with the assigned maintenance staff.',
            'Confirm the teacher-applicant\u2019s testing schedule and assign who will conduct the test.',
            'Retrieve pertinent documents (Teacher Application Form, Essay Form, SATA test book, response book with complete pages, NEO-FFI response sheet) and prepare SATA &amp; NEO-FFI recording forms.',
            'The examiner introduces themselves and ensures the applicant is ready, then assists them to the testing area.',
            'Have the applicant provide their resume.'
        ]);
        var parts = h('Examination \u2014 4 Parts') + ul([
            '<strong>1. Teacher Application Form</strong> \u2014 no time limit; use a pen. The applicant may use their phone for References, Seminars Attended, etc. Have them indicate the <strong>Subject</strong> they are applying for. Retrieve the form afterwards.',
            '<strong>2. Written Essay</strong> \u2014 35 minutes, written in cursive with a pencil. Set a timer and update the applicant on remaining time. Retrieve afterwards.',
            '<strong>3. Standardized Test (SATA)</strong> \u2014 covers Reading, Math, and Logical Reasoning. Provide a Test book and a Response book; use a pencil. Have them write their name in the response book and remind them not to crumple or write on the test book. Instructions are read aloud by the examiner.',
            '<strong>4. Personality Test (NEO-FFI)</strong> \u2014 provide the <strong>NEO-FFI Item Booklet Form S</strong>; read the instructions; use a pencil; no time limit.'
        ]);
        var sata = h('SATA Subtests (Timed)') + tbl([
            ['I. Verbal Reasoning', '10 minutes'],
            ['II. Nonverbal Reasoning', '10 minutes'],
            ['III. Quantitative Reasoning', '15 minutes'],
            ['IV. Reading Vocabulary', '10 minutes'],
            ['V. Reading Comprehension', '15 minutes'],
            ['VI. Math Calculation', '10 minutes'],
            ['VII. Math Application', '15 minutes'],
            ['VIII. Writing Mechanics', 'Dictation \u2014 clearly dictate each word, repeat twice, give ample time'],
            ['IX. Writing Composition', '15 minutes (provide paper if requested; written in English)'],
            ['<strong>Total</strong>', '<strong>~2 hours</strong>']
        ], ['Subtest', 'Timing']) + ul([
            'For each timed subtest: read the instructions, wait for the sample question to be answered, indicate when to start, then set the timer.',
            'Retrieve the <strong>Test Book and Response Book</strong> afterwards.'
        ]);
        var after = h('After Testing') + ul([
            'Let the applicant know results will be given within <strong>2\u20133 working days via email</strong> by HR. Assist them out of the testing area if necessary.',
            'Once the SATA test is scored, give the accomplished report to <strong>Sir A (OSA) / Sr. Tess</strong>.'
        ]);
        var scoring = h('Scoring \u2014 SATA') + ul(['Follow the guidelines in the manual.']) +
            '<p class="proc-sub">Subtest IX. Writing Composition</p>' + ul([
            '<strong>Vocabulary Criteria</strong> \u2014 minimum 7-letter words = 1 pt. each; no repeated words. Follow the manual; encircle/underline the words.',
            '<strong>Content Maturity</strong> \u2014 write the following on the applicant\u2019s answer sheet as a guide and check next to the words when applicable: Objects, Sequence, Personal Names, Humor, Setting, Theme, Paragraphs, Dialogue, 50 Words.'
        ]) +
            '<p class="proc-sub">SATA Composite Score Calculator</p>' +
            '<p><a class="proc-link" target="_blank" rel="noopener" href="https://docs.google.com/spreadsheets/d/129SpjzOGlNmx-2USpRPL7wDFuIa6a-RA/edit?gid=494631153#gid=494631153">Open the SATA Composite Score Calculator \u2197</a></p>';
        var neo = h('NEO-FFI 3 Interpretation Guide') + ul([
            'Score according to the answer key and use the scaling guide to get the standard scores.',
            'Use present tense and refer to the applicant with appropriate pronouns (Ms./Mr., she/he, etc.).',
            'Make the wording more \u201Cpersonable\u201D rather than an indifferent analysis/diagnosis.'
        ]) + '<p class="proc-sub">Summary of Descriptions</p>' +
            '<p><a class="proc-link" target="_blank" rel="noopener" href="https://docs.google.com/document/d/10exaQB2W4nlzFGppj9LFfPjcocPC1GHgmddGBDo25sc/edit?tab=t.0#heading=h.jiqo757q66j5">Open the NEO-FFI Summary of Descriptions \u2197</a></p>';
        return '<div class="proc-group">' +
            '<div class="proc-group-head"><span class="proc-tag alt">Teacher-Applicants</span><h3>Assessment Procedures for Teacher-Applicants</h3></div>' +
            card('Preparation', false, prep) +
            card('Examination \u2014 4 Parts', false, parts) +
            card('SATA Subtests &amp; Timing', false, sata) +
            card('After Testing', false, after) +
            card('Scoring &amp; SATA Calculator', false, scoring) +
            card('NEO-FFI Interpretation', false, neo) +
            '</div>';
    }
    function render() {
        if (rendered)
            return;
        var host = document.getElementById('proceduresBody');
        if (!host)
            return;
        host.innerHTML = studentSection() + teacherSection();
        rendered = true;
    }
    return { render: render };
})();
