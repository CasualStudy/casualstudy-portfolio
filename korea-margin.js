document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('data/korea_margin_loan_history.csv');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();

        // Parse CSV: Date,Total_Margin_Balance_krw_millions,KOSPI_Margin_Balance_krw_millions,KOSDAQ_Margin_Balance_krw_millions
        // Note: file may use Windows line endings (\r\n); trim each header/cell.
        const lines = text.trim().split(/\r?\n/);
        const header = lines[0].split(',').map(h => h.trim());
        const idxDate = header.indexOf('Date');
        const idxTotal = header.indexOf('Total_Margin_Balance_krw_millions');
        const idxKospi = header.indexOf('KOSPI_Margin_Balance_krw_millions');
        const idxKosdaq = header.indexOf('KOSDAQ_Margin_Balance_krw_millions');

        const rows = [];
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map(c => c.trim());
            if (cols.length < 4) continue;
            const d = cols[idxDate];
            const total = Number(cols[idxTotal]);
            const kospi = Number(cols[idxKospi]);
            const kosdaq = Number(cols[idxKosdaq]);
            if (!d || isNaN(total) || isNaN(kospi) || isNaN(kosdaq)) continue;
            rows.push({ dateRaw: d, total, kospi, kosdaq });
        }

        // CSV is newest-first; reverse to chronological order
        rows.reverse();

        // Convert date "YYYYMMDD" -> "YYYY-MM-DD"
        const dates = rows.map(r => `${r.dateRaw.slice(0,4)}-${r.dateRaw.slice(4,6)}-${r.dateRaw.slice(6,8)}`);
        // Convert millions KRW -> trillions KRW
        const totalT = rows.map(r => +(r.total / 1e6).toFixed(2));
        const kospiT = rows.map(r => +(r.kospi / 1e6).toFixed(2));
        const kosdaqT = rows.map(r => +(r.kosdaq / 1e6).toFixed(2));

        const latest = rows[rows.length - 1];
        const prev = rows[rows.length - 2] || latest;

        // Helpers
        const fmtDate = (raw) => `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`;
        const fmtT = (v) => v == null ? '--' : (v >= 1000 ? v.toFixed(1) : v.toFixed(2)) + 'T';
        const pctChange = (curr, prev) => {
            if (prev == null || prev === 0 || curr == null) return null;
            const d = (curr - prev) / prev * 100;
            const dir = d > 0.05 ? 'up' : (d < -0.05 ? 'down' : 'flat');
            return { delta: d, dir };
        };
        const setDeltaEl = (elId, change) => {
            const el = document.getElementById(elId);
            if (!el) return;
            if (!change || change.dir === 'flat') { el.innerHTML = '&nbsp;'; return; }
            const sign = change.delta > 0 ? '+' : '';
            const arrow = change.dir === 'up' ? '&#9650;' : '&#9660;';
            el.innerHTML = `<span class="stat-delta ${change.dir}">${arrow} ${sign}${change.delta.toFixed(2)}%</span>`;
        };

        // Stat cards
        document.getElementById('stat-date').textContent = fmtDate(latest.dateRaw);
        const dateChange = pctChange(latest.total, prev.total);
        setDeltaEl('stat-date-sub', dateChange);

        document.getElementById('stat-total').textContent = fmtT(latest.total / 1e6);
        setDeltaEl('stat-total-sub', pctChange(latest.total, prev.total));

        document.getElementById('stat-kospi').textContent = fmtT(latest.kospi / 1e6);
        setDeltaEl('stat-kospi-sub', pctChange(latest.kospi, prev.kospi));

        document.getElementById('stat-kosdaq').textContent = fmtT(latest.kosdaq / 1e6);
        setDeltaEl('stat-kosdaq-sub', pctChange(latest.kosdaq, prev.kosdaq));

        // Build chart
        const chartDom = document.getElementById('chart');
        const myChart = echarts.init(chartDom);

        const getIsDark = () => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        let isDarkMode = getIsDark();

        function buildOption(isDark) {
            const textColor = isDark ? '#e2e8f0' : '#1e293b';
            const subColor = isDark ? '#94a3b8' : '#64748b';
            const axisColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
            const tooltipBg = isDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.98)';
            const tooltipBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)';

            return {
                backgroundColor: 'transparent',
                animation: false,
                tooltip: {
                    trigger: 'axis',
                    axisPointer: {
                        type: 'cross',
                        label: { backgroundColor: '#1e293b', color: '#FFFFFF' },
                        lineStyle: { color: isDark ? '#475569' : '#94a3b8', type: 'dashed' },
                        crossStyle: { color: isDark ? '#475569' : '#94a3b8', type: 'dashed' }
                    },
                    backgroundColor: tooltipBg,
                    borderColor: tooltipBorder,
                    borderWidth: 1,
                    textStyle: { color: textColor, fontSize: 12 },
                    padding: [8, 12],
                    valueFormatter: (value) => value == null ? '-' : (typeof value === 'number' ? value.toFixed(2) + 'T KRW' : value)
                },
                legend: {
                    data: ['Total', 'KOSPI', 'KOSDAQ'],
                    textStyle: { color: textColor, fontSize: 12, fontWeight: 500 },
                    top: 4,
                    icon: 'circle',
                    itemWidth: 10,
                    itemHeight: 10
                },
                grid: { left: '2%', right: '2%', bottom: '14%', top: '12%', containLabel: true },
                dataZoom: [
                    { type: 'inside', start: 70, end: 100 },
                    {
                        show: true,
                        type: 'slider',
                        bottom: 4,
                        height: 20,
                        start: 70,
                        end: 100,
                        borderColor: 'transparent',
                        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                        fillerColor: isDark ? 'rgba(91,141,239,0.22)' : 'rgba(41,98,255,0.15)',
                        handleStyle: { color: '#2962FF', borderColor: '#2962FF' },
                        textStyle: { color: subColor, fontSize: 10 },
                        dataBackground: {
                            lineStyle: { color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' },
                            areaStyle: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }
                        }
                    }
                ],
                xAxis: {
                    type: 'category',
                    data: dates,
                    boundaryGap: false,
                    axisLabel: { color: textColor, fontSize: 11 },
                    axisLine: { lineStyle: { color: axisColor } },
                    axisTick: { show: false },
                    splitLine: { show: false }
                },
                yAxis: {
                    type: 'value',
                    name: 'Trillion KRW',
                    nameTextStyle: { color: subColor, fontSize: 11 },
                    axisLabel: { color: textColor, fontSize: 11 },
                    axisLine: { show: false },
                    axisTick: { show: false },
                    splitLine: { show: true, lineStyle: { color: axisColor, type: 'dashed' } }
                },
                series: [
                    {
                        name: 'Total',
                        type: 'line',
                        data: totalT,
                        showSymbol: false,
                        sampling: 'lttb',
                        lineStyle: { width: 2.2, color: '#2962FF' },
                        itemStyle: { color: '#2962FF' },
                        emphasis: { focus: 'series' }
                    },
                    {
                        name: 'KOSPI',
                        type: 'line',
                        data: kospiT,
                        showSymbol: false,
                        sampling: 'lttb',
                        lineStyle: { width: 1.8, color: '#26A69A' },
                        itemStyle: { color: '#26A69A' },
                        emphasis: { focus: 'series' }
                    },
                    {
                        name: 'KOSDAQ',
                        type: 'line',
                        data: kosdaqT,
                        showSymbol: false,
                        sampling: 'lttb',
                        lineStyle: { width: 1.8, color: '#FF9800' },
                        itemStyle: { color: '#FF9800' },
                        emphasis: { focus: 'series' }
                    }
                ]
            };
        }

        myChart.setOption(buildOption(isDarkMode));

        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            isDarkMode = e.matches;
            myChart.setOption(buildOption(isDarkMode), true);
        });

        window.addEventListener('resize', () => myChart.resize());

        // ===== Leverage ratio chart =====
        const levRes = await fetch('data/korea_leverage_ratio_analysis.csv');
        if (!levRes.ok) throw new Error(`Leverage CSV HTTP ${levRes.status}`);
        const levText = await levRes.text();

        const levLines = levText.trim().split(/\r?\n/);
        const levHeader = levLines[0].split(',').map(h => h.trim());
        const iDate = levHeader.indexOf('Date');
        const iClose = levHeader.indexOf('Close');
        const iRatio = levHeader.indexOf('Leverage_Ratio_%');

        const levDates = [];
        const levRatio = [];
        const levClose = [];
        for (let i = 1; i < levLines.length; i++) {
            const c = levLines[i].split(',').map(x => x.trim());
            if (c.length < 5) continue;
            const d = c[iDate];
            const ratio = Number(c[iRatio]);
            const close = Number(c[iClose]);
            if (!d || isNaN(ratio) || isNaN(close)) continue;
            levDates.push(d);
            levRatio.push(+ratio.toFixed(3));
            levClose.push(close);
        }

        const levChartDom = document.getElementById('chart-leverage');
        const levChart = echarts.init(levChartDom);

        function buildLeverageOption(isDark) {
            const textColor = isDark ? '#e2e8f0' : '#1e293b';
            const subColor = isDark ? '#94a3b8' : '#64748b';
            const axisColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
            const tooltipBg = isDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.98)';
            const tooltipBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)';
            const ratioColor = '#7E57C2';
            const closeColor = isDark ? '#5b8def' : '#2962FF';

            return {
                backgroundColor: 'transparent',
                animation: false,
                tooltip: {
                    trigger: 'axis',
                    axisPointer: {
                        type: 'cross',
                        label: { backgroundColor: '#1e293b', color: '#FFFFFF' },
                        lineStyle: { color: isDark ? '#475569' : '#94a3b8', type: 'dashed' },
                        crossStyle: { color: isDark ? '#475569' : '#94a3b8', type: 'dashed' }
                    },
                    backgroundColor: tooltipBg,
                    borderColor: tooltipBorder,
                    borderWidth: 1,
                    textStyle: { color: textColor, fontSize: 12 },
                    padding: [8, 12]
                },
                legend: {
                    data: ['Leverage Ratio %', 'KOSPI Close'],
                    textStyle: { color: textColor, fontSize: 12, fontWeight: 500 },
                    top: 4,
                    icon: 'circle',
                    itemWidth: 10,
                    itemHeight: 10
                },
                grid: { left: '2%', right: '2%', bottom: '14%', top: '12%', containLabel: true },
                dataZoom: [
                    { type: 'inside', start: 60, end: 100 },
                    {
                        show: true,
                        type: 'slider',
                        bottom: 4,
                        height: 20,
                        start: 60,
                        end: 100,
                        borderColor: 'transparent',
                        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                        fillerColor: isDark ? 'rgba(126,87,194,0.22)' : 'rgba(126,87,194,0.15)',
                        handleStyle: { color: ratioColor, borderColor: ratioColor },
                        textStyle: { color: subColor, fontSize: 10 },
                        dataBackground: {
                            lineStyle: { color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' },
                            areaStyle: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }
                        }
                    }
                ],
                xAxis: {
                    type: 'category',
                    data: levDates,
                    boundaryGap: false,
                    axisLabel: { color: textColor, fontSize: 11 },
                    axisLine: { lineStyle: { color: axisColor } },
                    axisTick: { show: false },
                    splitLine: { show: false }
                },
                yAxis: [
                    {
                        type: 'value',
                        name: 'Leverage %',
                        position: 'left',
                        nameTextStyle: { color: subColor, fontSize: 11 },
                        axisLabel: { color: textColor, fontSize: 11, formatter: '{value}%' },
                        axisLine: { show: false },
                        axisTick: { show: false },
                        splitLine: { show: true, lineStyle: { color: axisColor, type: 'dashed' } }
                    },
                    {
                        type: 'value',
                        name: 'KOSPI Close',
                        position: 'right',
                        scale: true,
                        nameTextStyle: { color: subColor, fontSize: 11 },
                        axisLabel: { color: textColor, fontSize: 11 },
                        axisLine: { show: false },
                        axisTick: { show: false },
                        splitLine: { show: false }
                    }
                ],
                series: [
                    {
                        name: 'Leverage Ratio %',
                        type: 'line',
                        yAxisIndex: 0,
                        data: levRatio,
                        showSymbol: false,
                        sampling: 'lttb',
                        lineStyle: { width: 2.2, color: ratioColor },
                        itemStyle: { color: ratioColor },
                        areaStyle: {
                            color: {
                                type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                                colorStops: [
                                    { offset: 0, color: isDark ? 'rgba(126,87,194,0.28)' : 'rgba(126,87,194,0.20)' },
                                    { offset: 1, color: 'rgba(126,87,194,0)' }
                                ]
                            }
                        },
                        emphasis: { focus: 'series' },
                        tooltip: { valueFormatter: (v) => v == null ? '-' : v.toFixed(3) + '%' }
                    },
                    {
                        name: 'KOSPI Close',
                        type: 'line',
                        yAxisIndex: 1,
                        data: levClose,
                        showSymbol: false,
                        sampling: 'lttb',
                        lineStyle: { width: 1.4, color: closeColor, opacity: 0.7 },
                        itemStyle: { color: closeColor },
                        emphasis: { focus: 'series' },
                        tooltip: { valueFormatter: (v) => v == null ? '-' : (typeof v === 'number' ? v.toFixed(2) : v) }
                    }
                ]
            };
        }

        levChart.setOption(buildLeverageOption(isDarkMode));

        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            isDarkMode = e.matches;
            levChart.setOption(buildLeverageOption(isDarkMode), true);
        });

        window.addEventListener('resize', () => levChart.resize());

    } catch (error) {
        console.error('Error loading Korea margin data:', error);
        const chartEl = document.getElementById('chart');
        if (chartEl) chartEl.innerHTML = `<div style="color: #ff4d4f; text-align: center; padding-top: 2rem;">Failed to load data. Please ensure data/korea_margin_loan_history.csv exists.</div>`;
    }
});
