document.addEventListener('DOMContentLoaded', async () => {
    // ECharts Instances
    let trendChart = null;
    let rankingChart = null;
    let modelTrendChart = null;
    
    let rawData = [];
    let currentTimeframe = 'daily';

    function getWeekIdentifier(dateStr) {
        const d = new Date(dateStr);
        const day = d.getUTCDay();
        const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
        return monday.toISOString().split('T')[0];
    }

    function aggregateWeeklyData(data) {
        const weeks = {};
        data.forEach(day => {
            const weekStr = getWeekIdentifier(day.date);
            if (!weeks[weekStr]) {
                weeks[weekStr] = {
                    date: `Week of ${weekStr}`,
                    startDate: weekStr,
                    total_revenue: 0,
                    modelMap: {}
                };
            }
            weeks[weekStr].total_revenue += day.total_revenue;
            
            if (day.models) {
                day.models.forEach(m => {
                    if (!weeks[weekStr].modelMap[m.id]) {
                        weeks[weekStr].modelMap[m.id] = { ...m, revenue: 0, total_tokens: 0 };
                    }
                    weeks[weekStr].modelMap[m.id].revenue += m.revenue;
                    weeks[weekStr].modelMap[m.id].total_tokens += (m.total_tokens || 0);
                });
            }
        });

        return Object.values(weeks).sort((a, b) => a.startDate.localeCompare(b.startDate)).map(w => {
            w.models = Object.values(w.modelMap)
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 10);
            delete w.modelMap;
            return w;
        });
    }

    // Wait for lang-toggle initialization from script.js if needed
    const currentLang = document.documentElement.lang || 'en';

    async function fetchData() {
        try {
            const response = await fetch('data/openrouter-global.json');
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching global economy data:', error);
            // If fetching fails, provide some fallback empty data
            return [];
        }
    }

    function initCharts() {
        const trendContainer = document.getElementById('trend-chart');
        const rankingContainer = document.getElementById('ranking-chart');
        const modelTrendContainer = document.getElementById('model-trend-chart');

        if (trendContainer) trendChart = echarts.init(trendContainer);
        if (rankingContainer) rankingChart = echarts.init(rankingContainer);
        if (modelTrendContainer) modelTrendChart = echarts.init(modelTrendContainer);

        window.addEventListener('resize', () => {
            if (trendChart) trendChart.resize();
            if (rankingChart) rankingChart.resize();
            if (modelTrendChart) modelTrendChart.resize();
        });
    }

    function updateStatsCards(latestData) {
        if (!latestData) return;

        const dateEl = document.getElementById('stat-date');
        const topModelEl = document.getElementById('stat-top-model');
        const totalRevEl = document.getElementById('stat-total-rev');

        if (dateEl) dateEl.textContent = latestData.date;
        if (totalRevEl) {
            totalRevEl.textContent = '$' + latestData.total_revenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
        }
        
        if (topModelEl && latestData.models && latestData.models.length > 0) {
            // Find top model
            const topModel = latestData.models[0];
            // Format name nicely, e.g. "Google: Gemini Pro 1.5" -> "Gemini Pro 1.5"
            let name = topModel.name || topModel.id;
            if (name.includes(': ')) name = name.split(': ')[1];
            topModelEl.textContent = name;
        }
    }

    function renderTrendChart(data) {
        if (!trendChart || !data || data.length === 0) return;

        const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const textColor = isDarkMode ? '#e2e8f0' : '#1e293b';
        const axisColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        const isMobile = window.innerWidth <= 768;

        const dates = data.map(item => item.date);
        const revenues = data.map(item => item.total_revenue);

        const option = {
            title: {
                text: 'Total Market Revenue Trend',
                left: 'center',
                textStyle: { color: textColor, fontWeight: '600' }
            },
            tooltip: {
                trigger: 'axis',
                formatter: function (params) {
                    const dataIndex = params[0].dataIndex;
                    const item = data[dataIndex];
                    const value = item.total_revenue;
                    
                    let html = `<div style="margin-bottom: 8px; border-bottom: 1px solid ${axisColor}; padding-bottom: 8px;">`;
                    html += `<strong style="font-size: 1.1em;">${item.date}</strong><br/>`;
                    html += `Total Revenue: <span style="font-weight: 600;">$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>`;
                    html += `</div>`;
                    
                    if (item.models && item.models.length > 0) {
                        html += `<div style="font-size: 0.85em; line-height: 1.5;">`;
                        const limit = Math.min(10, item.models.length);
                        let top10Revenue = 0;
                        for (let i = 0; i < limit; i++) {
                            const m = item.models[i];
                            top10Revenue += m.revenue;
                            let name = m.name || m.id;
                            if (name.includes(': ')) name = name.split(': ')[1];
                            if (name.length > 25) name = name.substring(0, 25) + '...';
                            
                            let revStr = '$' + (m.revenue >= 1000000 ? (m.revenue / 1000000).toFixed(2) + 'M' : 
                                         (m.revenue >= 1000 ? (m.revenue / 1000).toFixed(1) + 'k' : m.revenue.toLocaleString('en-US', { maximumFractionDigits: 0 })));
                                         
                            html += `<div style="display: flex; justify-content: space-between; gap: 16px;">
                                        <span style="opacity: 0.9;">${i+1}. ${name}</span>
                                        <span style="font-weight: 600;">${revStr}</span>
                                     </div>`;
                        }
                        
                        const othersRevenue = item.total_revenue - top10Revenue;
                        if (othersRevenue > 0) {
                            let revStr = '$' + (othersRevenue >= 1000000 ? (othersRevenue / 1000000).toFixed(2) + 'M' : 
                                         (othersRevenue >= 1000 ? (othersRevenue / 1000).toFixed(1) + 'k' : othersRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })));
                            html += `<div style="display: flex; justify-content: space-between; gap: 16px; margin-top: 4px; padding-top: 4px; border-top: 1px dashed rgba(128,128,128,0.4);">
                                        <span style="opacity: 0.8; font-style: italic;">11. Others</span>
                                        <span style="font-weight: 600; opacity: 0.8;">${revStr}</span>
                                     </div>`;
                        }
                        
                        html += `</div>`;
                    }
                    return html;
                },
                backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                borderColor: axisColor,
                textStyle: { color: textColor }
            },
            grid: {
                left: isMobile ? '2%' : '3%',
                right: isMobile ? '5%' : '4%',
                bottom: isMobile ? '5%' : '3%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: dates,
                axisLine: { lineStyle: { color: axisColor } },
                axisLabel: { color: textColor }
            },
            yAxis: {
                type: 'value',
                axisLine: { show: false },
                splitLine: { lineStyle: { color: axisColor, type: 'dashed' } },
                axisLabel: { 
                    color: textColor,
                    formatter: (value) => '$' + (value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value)
                }
            },
            series: [
                {
                    name: 'Revenue',
                    type: 'line',
                    symbol: 'circle',
                    symbolSize: 6,
                    itemStyle: {
                        color: '#3b82f6' // Blue-500
                    },
                    lineStyle: {
                        width: 2
                    },
                    data: revenues
                }
            ]
        };

        trendChart.setOption(option);
    }

    function renderRankingChart(latestData) {
        if (!rankingChart || !latestData || !latestData.models) return;

        const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const textColor = isDarkMode ? '#e2e8f0' : '#1e293b';
        const axisColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

        // Top 10 models for cleaner display
        const top10 = latestData.models.slice(0, 10).reverse(); // Reverse for horizontal bar chart (highest at top)

        // Calculate "Others" revenue
        let top10Revenue = top10.reduce((sum, m) => sum + m.revenue, 0);
        let othersRevenue = latestData.total_revenue - top10Revenue;

        if (othersRevenue > 0) {
            top10.unshift({ name: 'Others', revenue: othersRevenue });
        }

        const modelNames = top10.map(m => {
            if (m.name === 'Others') return 'Others';
            let name = m.name || m.id;
            if (name.includes(': ')) name = name.split(': ')[1];
            // Truncate long names
            return name.length > 25 ? name.substring(0, 25) + '...' : name;
        });
        const revenues = top10.map(m => m.revenue);

        const option = {
            title: {
                text: 'Top 10 Grossing Models',
                subtext: `Data for ${latestData.date}`,
                left: 'center',
                textStyle: { color: textColor, fontWeight: '600' },
                subtextStyle: { color: textColor, opacity: 0.7, fontSize: 13 }
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                formatter: function (params) {
                    const value = params[0].value;
                    const modelIndex = params[0].dataIndex;
                    const fullModelData = top10[modelIndex];
                    
                    if (fullModelData.name === 'Others') {
                        return `
                            <strong>Others (Models 11+)</strong><br/>
                            Revenue: $${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        `;
                    }

                    const tokens = fullModelData.total_tokens || fullModelData.prompt_tokens + fullModelData.completion_tokens || 0;
                    let tokenStr;
                    if (tokens >= 1e9) tokenStr = (tokens / 1e9).toFixed(2) + 'B';
                    else if (tokens >= 1e6) tokenStr = (tokens / 1e6).toFixed(2) + 'M';
                    else tokenStr = tokens.toLocaleString();
                    return `
                        <strong>${fullModelData.name || fullModelData.id}</strong><br/>
                        Revenue: $${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<br/>
                        Total Tokens: ${tokenStr}
                    `;
                },
                backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                borderColor: axisColor,
                textStyle: { color: textColor }
            },
            grid: {
                left: isMobile ? '2%' : '3%',
                right: isMobile ? '5%' : '8%',
                bottom: isMobile ? '5%' : '3%',
                containLabel: true
            },
            xAxis: {
                type: 'value',
                axisLine: { show: false },
                splitLine: { lineStyle: { color: axisColor, type: 'dashed' } },
                axisLabel: { 
                    color: textColor,
                    formatter: (value) => '$' + (value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value)
                }
            },
            yAxis: {
                type: 'category',
                data: modelNames,
                axisLine: { lineStyle: { color: axisColor } },
                axisLabel: { color: textColor, fontWeight: '500' }
            },
            series: [
                {
                    name: 'Revenue',
                    type: 'bar',
                    barWidth: '60%',
                    itemStyle: {
                        borderRadius: [0, 4, 4, 0],
                        color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [
                            { offset: 0, color: '#ec4899' }, // Pink-500
                            { offset: 1, color: '#8b5cf6' }  // Violet-500
                        ])
                    },
                    label: {
                        show: true,
                        position: 'right',
                        color: textColor,
                        formatter: (params) => '$' + params.value.toLocaleString('en-US', { maximumFractionDigits: 0 })
                    },
                    data: revenues
                }
            ]
        };

        rankingChart.setOption(option);
    }

    function renderModelTrendChart(data) {
        if (!modelTrendChart || !data || data.length === 0) return;

        const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const textColor = isDarkMode ? '#e2e8f0' : '#1e293b';
        const axisColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        const isMobile = window.innerWidth <= 768;

        const dates = data.map(item => item.date);
        
        // 1. Calculate overall revenue for all models across this timeframe
        const overallModelRev = {};
        const modelNamesMap = {}; // mapping id to name
        
        data.forEach(day => {
            if (day.models) {
                day.models.forEach(m => {
                    if (!overallModelRev[m.id]) {
                        overallModelRev[m.id] = 0;
                        let cleanName = m.name || m.id;
                        if (cleanName.includes(': ')) cleanName = cleanName.split(': ')[1];
                        modelNamesMap[m.id] = cleanName;
                    }
                    overallModelRev[m.id] += m.revenue;
                });
            }
        });

        // 2. Get Top 20 models
        const top20ModelIds = Object.keys(overallModelRev)
            .sort((a, b) => overallModelRev[b] - overallModelRev[a])
            .slice(0, 20);

        // 3. Build series data and legend data
        const seriesData = [];
        const legendData = [];
        const selected = {};

        top20ModelIds.forEach((id, index) => {
            const modelName = modelNamesMap[id];
            legendData.push(modelName);
            
            // Default select top 5
            selected[modelName] = index < 5;

            const seriesRevenues = data.map(day => {
                const modelInDay = day.models ? day.models.find(m => m.id === id) : null;
                return modelInDay ? modelInDay.revenue : 0;
            });

            seriesData.push({
                name: modelName,
                type: 'line',
                symbol: 'none', // clean lines without dots everywhere
                lineStyle: { width: 2 },
                data: seriesRevenues
            });
        });

        const option = {
            title: {
                text: 'Top Models Revenue Trend',
                left: 'center',
                textStyle: { color: textColor, fontWeight: '600' }
            },
            tooltip: {
                trigger: 'axis',
                backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                borderColor: axisColor,
                textStyle: { color: textColor },
                valueFormatter: (value) => '$' + value.toLocaleString('en-US', { maximumFractionDigits: 0 })
            },
            legend: {
                type: 'scroll',
                orient: isMobile ? 'horizontal' : 'vertical',
                right: isMobile ? 'center' : 10,
                bottom: isMobile ? 0 : 'auto',
                top: isMobile ? 'auto' : 'middle',
                data: legendData,
                selected: selected,
                textStyle: { color: textColor, fontSize: 11 },
                formatter: function (name) {
                    return name.length > 20 ? name.substring(0, 20) + '...' : name;
                }
            },
            grid: {
                left: isMobile ? '2%' : '3%',
                right: isMobile ? '5%' : 220,
                bottom: isMobile ? 50 : '3%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: dates,
                axisLine: { lineStyle: { color: axisColor } },
                axisLabel: { color: textColor }
            },
            yAxis: {
                type: 'value',
                axisLine: { show: false },
                splitLine: { lineStyle: { color: axisColor, type: 'dashed' } },
                axisLabel: { 
                    color: textColor,
                    formatter: (value) => '$' + (value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value)
                }
            },
            series: seriesData
        };

        modelTrendChart.setOption(option);
    }

    async function init() {
        initCharts();
        const data = await fetchData();
        if (data && data.length > 0) {
            rawData = data;
            const latestData = data[data.length - 1];
            updateStatsCards(latestData);
            renderTrendChart(rawData);
            renderModelTrendChart(rawData);
            renderRankingChart(latestData);
            
            // Setup toggle buttons
            const buttons = document.querySelectorAll('#timeframe-toggle button');
            buttons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    buttons.forEach(b => {
                        b.classList.remove('active');
                        b.style.border = '1px solid transparent';
                        b.style.background = 'transparent';
                        b.style.boxShadow = 'none';
                    });
                    
                    const target = e.currentTarget;
                    target.classList.add('active');
                    target.style.border = '1px solid rgba(255,255,255,0.2)';
                    target.style.background = 'rgba(128,128,128,0.2)';
                    target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                    
                    currentTimeframe = target.getAttribute('data-tf');
                    
                    if (currentTimeframe === 'weekly') {
                        const weeklyData = aggregateWeeklyData(rawData);
                        renderTrendChart(weeklyData);
                        renderModelTrendChart(weeklyData);
                    } else {
                        renderTrendChart(rawData);
                        renderModelTrendChart(rawData);
                    }
                });
            });
        }
    }

    init();

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async () => {
        if (rawData && rawData.length > 0) {
            if (currentTimeframe === 'weekly') {
                const weeklyData = aggregateWeeklyData(rawData);
                renderTrendChart(weeklyData);
                renderModelTrendChart(weeklyData);
            } else {
                renderTrendChart(rawData);
                renderModelTrendChart(rawData);
            }
            renderRankingChart(rawData[rawData.length - 1]);
        }
    });
});
