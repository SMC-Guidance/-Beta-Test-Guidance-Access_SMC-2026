"use strict";
window.SMC = window.SMC || {};
SMC.charts = (function () {
    var ui = SMC.ui;
    var pieChart = null, barChart = null;
    function render(rows) {
        var palette = SMC.config.palette;
        var ic = {};
        rows.forEach(function (r) {
            var k = ((r.issueCategory || 'Other').split(',')[0] || 'Other').trim();
            ic[k] = (ic[k] || 0) + 1;
        });
        var pl = Object.keys(ic), pd = pl.map(function (k) { return ic[k]; });
        if (pieChart) {
            pieChart.data.labels = pl;
            pieChart.data.datasets[0].data = pd;
            pieChart.update();
        }
        else {
            pieChart = new Chart(document.getElementById('pieChart'), {
                type: 'doughnut',
                data: { labels: pl, datasets: [{ data: pd, backgroundColor: palette, borderWidth: 2, borderColor: '#fff' }] },
                options: { cutout: '62%', plugins: { legend: { display: false } }, animation: { duration: 500 } }
            });
        }
        document.getElementById('pieLeg').innerHTML = pl.map(function (l, i) {
            return '<div class="cli"><div class="cldot" style="background:' + palette[i % palette.length] + '"></div>' +
                '<span style="flex:1;font-size:11px">' + ui.esc(l) + '</span>' +
                '<strong style="font-size:11px;color:var(--navy)">' + pd[i] + '</strong></div>';
        }).join('');
        var gc = {};
        rows.forEach(function (r) { var g = r.grade || 'Other'; gc[g] = (gc[g] || 0) + 1; });
        var gl = Object.keys(gc).sort(), gd = gl.map(function (k) { return gc[k]; });
        if (barChart) {
            barChart.data.labels = gl;
            barChart.data.datasets[0].data = gd;
            barChart.update();
        }
        else {
            barChart = new Chart(document.getElementById('barChart'), {
                type: 'bar',
                data: { labels: gl, datasets: [{ data: gd, backgroundColor: 'rgba(0,43,107,.12)', borderColor: '#002B6B', borderWidth: 1.5, borderRadius: 5 }] },
                options: {
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,.05)' }, ticks: { font: { size: 10 }, stepSize: 1 } },
                        x: { grid: { display: false }, ticks: { font: { size: 9 } } }
                    }, animation: { duration: 400 }
                }
            });
        }
    }
    function destroy() {
        if (pieChart) {
            pieChart.destroy();
            pieChart = null;
        }
        if (barChart) {
            barChart.destroy();
            barChart = null;
        }
    }
    return { render: render, destroy: destroy };
})();
