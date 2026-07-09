/* Schedule tab - browse teacher & class schedules SY 2026-2027 */
(function () {
	var SMC = window.SMC = window.SMC || {};
	var user = null;
	var state = { mode: "teacher", q: "", selId: null };
	var bound = false;

	function host() { return document.getElementById("scheduleView"); }
	function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
	function data() { return SMC.scheduleData || []; }
	function setUser(u) { user = u; }

	function list() {
		var q = state.q.trim().toLowerCase();
		return data().filter(function (r) {
			if (r.type !== state.mode) return false;
			if (!q) return true;
			return ((r.label || "") + " " + (r.full || "") + " " + (r.adviser || "") + " " + (r.section || "")).toLowerCase().indexOf(q) >= 0;
		});
	}
	function current() {
		var l = list();
		var sel = l.filter(function (r) { return r.id === state.selId; })[0];
		return sel || l[0] || null;
	}

	var BREAK_RE = /^(RECESS|LUNCH|LUNCH BREAK|BREAK|DISMISSAL|SNACK|FLAG|ASSEMBLY|ANGELUS)/i;
	function uniq(a) { var o = {}, r = []; a.forEach(function (x) { if (!o[x]) { o[x] = 1; r.push(x); } }); return r; }

	function gridHtml(rec) {
		var g = rec.grid || [];
		if (!g.length) return '<p class="sch-empty-msg">No schedule table found.</p>';
		var head = g[0] || [];
		var ncol = head.length;
		var ndays = ncol - 1;
		var h = '<div class="sch-grid-scroll"><table class="sch-grid"><thead><tr>';
		head.forEach(function (c, i) { h += '<th' + (i === 0 ? ' class="sch-time-h"' : '') + '>' + esc(c) + '</th>'; });
		h += '</tr></thead><tbody>';
		for (var r = 1; r < g.length; r++) {
			var row = g[r];
			var time = row[0] || "";
			var days = row.slice(1);
			var nonEmpty = days.filter(function (x) { return x && x.trim(); });
			var distinct = uniq(nonEmpty);
			if (distinct.length === 1 && BREAK_RE.test(distinct[0])) {
				h += '<tr class="sch-break"><td class="sch-time">' + esc(time) + '</td><td class="sch-band" colspan="' + ndays + '">' + esc(distinct[0]) + '</td></tr>';
				continue;
			}
			h += '<tr><td class="sch-time">' + esc(time) + '</td>';
			for (var d = 0; d < ndays; d++) {
				var v = days[d] || "";
				h += '<td' + (v.trim() ? '' : ' class="sch-empty"') + '>' + esc(v) + '</td>';
			}
			h += '</tr>';
		}
		h += '</tbody></table></div>';
		return h;
	}

	function subOf(rec) {
		if (!rec) return "";
		if (rec.type === "teacher") return rec.full || "";
		var bits = [];
		if (rec.adviser) bits.push("Adviser: " + rec.adviser);
		return bits.join(" \u00b7 ");
	}

	function drawList() {
		var box = document.getElementById("schList");
		if (!box) return;
		var l = list();
		var cur = current();
		if (!l.length) { box.innerHTML = '<p class="sch-none">No matches.</p>'; return; }
		box.innerHTML = l.map(function (r) {
			var active = cur && r.id === cur.id;
			var sub = r.type === "teacher" ? (r.full || "") : (r.adviser ? ("Adviser: " + r.adviser) : "");
			return '<button type="button" class="sch-item' + (active ? ' on' : '') + '" data-id="' + esc(r.id) + '">' +
				'<span class="sch-item-t">' + esc(r.label) + '</span>' +
				(sub ? '<span class="sch-item-s">' + esc(sub) + '</span>' : '') +
				'</button>';
		}).join("");
	}

	function drawDetail() {
		var box = document.getElementById("schDetail");
		if (!box) return;
		var rec = current();
		if (!rec) { box.innerHTML = '<div class="sch-detail-empty">Select a schedule to view it.</div>'; return; }
		var sub = subOf(rec);
		box.innerHTML =
			'<div class="sch-detail-head">' +
			'<div><h3 class="sch-detail-t">' + esc(rec.label) + '</h3>' + (sub ? '<p class="sch-detail-s">' + esc(sub) + '</p>' : '') + '</div>' +
			'<button type="button" class="sch-print" id="schPrint"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> Print</button>' +
			'</div>' +
			gridHtml(rec);
	}

	function printCurrent() {
		var rec = current();
		if (!rec) return;
		var sub = subOf(rec);
		var w = window.open("", "_blank");
		if (!w) return;
		var css = 'body{font-family:Arial,Helvetica,sans-serif;color:#0D1B2A;padding:24px;}h1{font-size:18px;margin:0 0 2px;}p.sub{margin:0 0 14px;color:#555;font-size:12px;}table{border-collapse:collapse;width:100%;font-size:11px;}th,td{border:1px solid #bbb;padding:5px 6px;text-align:center;vertical-align:middle;}th{background:#002B6B;color:#fff;}td.t{white-space:nowrap;font-weight:600;background:#f2f5fb;}td.band{background:#EEF2F9;font-weight:700;letter-spacing:.05em;}';
		w.document.write('<html><head><title>' + esc(rec.label) + '</title><style>' + css + '</style></head><body>' +
			'<h1>' + esc(rec.label) + '</h1>' + (sub ? '<p class="sub">' + esc(sub) + '</p>' : '') +
			gridHtml(rec).replace(/class="sch-time"/g, 'class="t"').replace(/class="sch-band"/g, 'class="band"') +
			'</body></html>');
		w.document.close();
		setTimeout(function () { w.focus(); w.print(); }, 300);
	}

	function refresh() { drawList(); drawDetail(); }

	function render() {
		var el = host();
		if (!el) return;
		var tCount = data().filter(function (r) { return r.type === "teacher"; }).length;
		var sCount = data().filter(function (r) { return r.type === "section"; }).length;
		el.innerHTML =
			'<div class="sch-wrap">' +
			'<header class="sch-head">' +
			'<span class="sch-head-ic"><svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/></svg></span>' +
			'<div><h2 class="sch-head-t">Schedules</h2><p class="sch-head-s">Browse weekly class schedules for every teacher and section \u2014 SY 2026-2027.</p></div>' +
			'</header>' +
			'<div class="sch-tabs">' +
			'<button type="button" class="sch-tab' + (state.mode === "teacher" ? " on" : "") + '" data-mode="teacher">Teachers <span class="sch-tab-n">' + tCount + '</span></button>' +
			'<button type="button" class="sch-tab' + (state.mode === "section" ? " on" : "") + '" data-mode="section">Classes <span class="sch-tab-n">' + sCount + '</span></button>' +
			'</div>' +
			'<div class="sch-body">' +
			'<aside class="sch-side">' +
			'<div class="sch-search-wrap"><svg class="sch-search-ic" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg><input type="text" id="schSearch" class="sch-search" placeholder="Search name or section"></div>' +
			'<div class="sch-list" id="schList"></div>' +
			'</aside>' +
			'<section class="sch-detail" id="schDetail"></section>' +
			'</div>' +
			'</div>';
		if (state.q) { var si = document.getElementById("schSearch"); if (si) si.value = state.q; }
		refresh();
		if (!bound) bind();
	}

	function bind() {
		var el = host();
		if (!el) return;
		bound = true;
		el.addEventListener("click", function (e) {
			var tab = e.target.closest(".sch-tab");
			if (tab) { state.mode = tab.getAttribute("data-mode"); state.selId = null; render(); return; }
			var item = e.target.closest(".sch-item");
			if (item) { state.selId = item.getAttribute("data-id"); refresh(); return; }
			if (e.target.closest("#schPrint")) { printCurrent(); return; }
		});
		el.addEventListener("input", function (e) {
			if (e.target && e.target.id === "schSearch") { state.q = e.target.value; state.selId = null; drawList(); drawDetail(); }
		});
	}

	SMC.schedule = { render: render, setUser: setUser, load: render };
})();
