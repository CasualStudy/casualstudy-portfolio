document.addEventListener("DOMContentLoaded", async () => {
    try {
        // Fetch data
        const response = await fetch("data/fng_data.json");
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        // Update stat cards
        document.getElementById("stat-date").textContent = data.latest.date;
        document.getElementById("stat-fng").textContent = Number(data.latest.fng).toFixed(2);
        document.getElementById("stat-spx").textContent = Number(data.latest.spx).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        
        const sentimentEl = document.getElementById("stat-sentiment");
        sentimentEl.textContent = data.latest.sentiment;
        
        // Add color coding to sentiment
        if (data.latest.fng <= 25) {
            sentimentEl.style.color = "#ff4d4f"; // Extreme Fear (Red)
        } else if (data.latest.fng <= 45) {
            sentimentEl.style.color = "#faad14"; // Fear (Orange)
        } else if (data.latest.fng <= 55) {
            sentimentEl.style.color = "#fadb14"; // Neutral (Yellow)
        } else if (data.latest.fng <= 75) {
            sentimentEl.style.color = "#52c41a"; // Greed (Green)
        } else {
            sentimentEl.style.color = "#389e0d"; // Extreme Greed (Dark Green)
        }

        // Single chart with two stacked grids sharing one time axis + one dataZoom
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

            // Sentiment zone colors (translucent bands on the F&G grid)
            const zoneExtremeFear = isDark ? 'rgba(255,77,79,0.16)' : 'rgba(239,83,80,0.14)';
            const zoneFear        = isDark ? 'rgba(250,173,20,0.14)' : 'rgba(255,167,38,0.12)';
            const zoneNeutral     = isDark ? 'rgba(250,219,20,0.12)' : 'rgba(255,235,59,0.12)';
            const zoneGreed       = isDark ? 'rgba(82,196,26,0.14)'  : 'rgba(102,187,106,0.12)';
            const zoneExtremeGreed= isDark ? 'rgba(56,158,13,0.18)'  : 'rgba(67,160,71,0.14)';

            const fngLineColor = isDark ? '#5b8def' : '#2962FF';

            return {
                backgroundColor: 'transparent',
                animation: false,
                tooltip: {
                    trigger: 'axis',
                    axisPointer: {
                        type: 'cross',
                        link: [{ xAxisIndex: 'all' }],
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
                axisPointer: { link: [{ xAxisIndex: 'all' }] },
                // Two grids: SPX on top, F&G on bottom
                grid: [
                    { left: '3%', right: '3%', top: '6%',  height: '46%' },
                    { left: '3%', right: '3%', top: '58%', height: '30%' }
                ],
                // ONE shared dataZoom controlling both xAxis[0] (SPX) and xAxis[1] (F&G)
                dataZoom: [
                    { type: 'inside', xAxisIndex: [0, 1], start: 80, end: 100 },
                    {
                        show: true,
                        type: 'slider',
                        xAxisIndex: [0, 1],
                        bottom: 4,
                        height: 20,
                        start: 80,
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
                // Two x-axes (one per grid), same category data
                xAxis: [
                    {
                        type: 'category',
                        gridIndex: 0,
                        data: data.dates,
                        boundaryGap: true,
                        axisLabel: { show: false },
                        axisLine: { lineStyle: { color: axisColor } },
                        axisTick: { show: false },
                        splitLine: { show: false },
                        axisPointer: { show: true, label: { show: true } }
                    },
                    {
                        type: 'category',
                        gridIndex: 1,
                        data: data.dates,
                        boundaryGap: true,
                        axisLabel: { color: textColor, fontSize: 11 },
                        axisLine: { lineStyle: { color: axisColor } },
                        axisTick: { show: false },
                        splitLine: { show: false },
                        axisPointer: { show: true, label: { show: true } }
                    }
                ],
                // Three y-axes: SPX price (top grid), F&G 0-100 (bottom grid)
                yAxis: [
                    {
                        type: 'value',
                        name: 'S&P 500',
                        gridIndex: 0,
                        scale: true,
                        nameTextStyle: { color: subColor, fontSize: 11 },
                        axisLabel: { color: textColor, fontSize: 11 },
                        axisLine: { show: false },
                        axisTick: { show: false },
                        splitLine: { show: true, lineStyle: { color: axisColor, type: 'dashed' } }
                    },
                    {
                        type: 'value',
                        name: 'F&G',
                        gridIndex: 1,
                        min: 0,
                        max: 100,
                        interval: 20,
                        nameTextStyle: { color: subColor, fontSize: 11 },
                        axisLabel: { color: textColor, fontSize: 11 },
                        axisLine: { show: false },
                        axisTick: { show: false },
                        splitLine: { show: true, lineStyle: { color: axisColor, type: 'dashed' } }
                    }
                ],
                series: [
                    {
                        name: 'S&P 500',
                        type: 'candlestick',
                        xAxisIndex: 0,
                        yAxisIndex: 0,
                        data: data.spx_ohlc,
                        itemStyle: {
                            color: '#26A69A',
                            color0: '#EF5350',
                            borderColor: '#26A69A',
                            borderColor0: '#EF5350'
                        },
                        tooltip: {
                            valueFormatter: (value) => {
                                if (value == null) return '-';
                                if (Array.isArray(value) && value.length >= 4) {
                                    return `O ${Number(value[0]).toFixed(2)}  H ${Number(value[3]).toFixed(2)}  L ${Number(value[2]).toFixed(2)}  C ${Number(value[1]).toFixed(2)}`;
                                }
                                return typeof value === 'number' ? value.toFixed(2) : value;
                            }
                        }
                    },
                    {
                        name: 'Fear & Greed Index',
                        type: 'line',
                        xAxisIndex: 1,
                        yAxisIndex: 1,
                        data: data.fng,
                        symbol: 'circle',
                        symbolSize: 4,
                        showSymbol: false,
                        sampling: 'lttb',
                        lineStyle: { width: 2.2, color: fngLineColor },
                        itemStyle: { color: fngLineColor },
                        emphasis: { focus: 'series' },
                        markArea: {
                            silent: true,
                            itemStyle: { borderWidth: 0 },
                            data: [
                                [{ yAxis: 0,  itemStyle: { color: zoneExtremeFear } }, { yAxis: 25 }],
                                [{ yAxis: 25, itemStyle: { color: zoneFear } },        { yAxis: 45 }],
                                [{ yAxis: 45, itemStyle: { color: zoneNeutral } },     { yAxis: 55 }],
                                [{ yAxis: 55, itemStyle: { color: zoneGreed } },       { yAxis: 75 }],
                                [{ yAxis: 75, itemStyle: { color: zoneExtremeGreed } },{ yAxis: 100 }]
                            ]
                        },
                        markLine: {
                            silent: true,
                            symbol: 'none',
                            label: {
                                formatter: 'Now: {c}',
                                position: 'insideEndTop',
                                color: textColor,
                                fontSize: 11,
                                fontWeight: 600
                            },
                            lineStyle: { color: fngLineColor, type: 'dashed', width: 1.2, opacity: 0.7 },
                            data: [{ yAxis: data.latest.fng }]
                        },
                        tooltip: {
                            valueFormatter: (value) => value == null ? '-' : (typeof value === 'number' ? value.toFixed(2) : value)
                        }
                    }
                ]
            };
        }

        myChart.setOption(buildOption(isDarkMode));

        // Re-render on theme change
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            isDarkMode = e.matches;
            myChart.setOption(buildOption(isDarkMode), true);
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            myChart.resize();
        });

        // Expose for error handler
        window.__fngChart = myChart;

    } catch (error) {
        console.error("Error loading Fear & Greed data:", error);
        const chartEl = document.getElementById('chart');
        if (chartEl) chartEl.innerHTML = `<div style="color: #ff4d4f; text-align: center; padding-top: 2rem;">Failed to load data. Please ensure you have run the update script.</div>`;
    }
});
