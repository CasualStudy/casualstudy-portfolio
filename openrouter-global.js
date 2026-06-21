document.addEventListener('DOMContentLoaded', async () => {
    // ECharts Instances
    let trendChart = null;
    let rankingChart = null;

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

        if (trendContainer) trendChart = echarts.init(trendContainer);
        if (rankingContainer) rankingChart = echarts.init(rankingContainer);

        window.addEventListener('resize', () => {
            if (trendChart) trendChart.resize();
            if (rankingChart) rankingChart.resize();
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
                    const value = params[0].value;
                    return `${params[0].name}<br/>$${value.toLocaleString('en-US')}`;
                },
                backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                borderColor: axisColor,
                textStyle: { color: textColor }
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
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
                    smooth: true,
                    symbol: 'circle',
                    symbolSize: 8,
                    itemStyle: {
                        color: '#6366f1' // Indigo-500
                    },
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(99, 102, 241, 0.5)' },
                            { offset: 1, color: 'rgba(99, 102, 241, 0.05)' }
                        ])
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

        const modelNames = top10.map(m => {
            let name = m.name || m.id;
            if (name.includes(': ')) name = name.split(': ')[1];
            // Truncate long names
            return name.length > 25 ? name.substring(0, 25) + '...' : name;
        });
        const revenues = top10.map(m => m.revenue);

        const option = {
            title: {
                text: 'Top 10 Grossing Models (Daily)',
                left: 'center',
                textStyle: { color: textColor, fontWeight: '600' }
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                formatter: function (params) {
                    const value = params[0].value;
                    const modelIndex = params[0].dataIndex;
                    const fullModelData = top10[modelIndex];
                    return `
                        <strong>${fullModelData.name || fullModelData.id}</strong><br/>
                        Revenue: $${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<br/>
                        Prompt Tokens: ${(fullModelData.prompt_tokens / 1000000).toFixed(2)}M<br/>
                        Completion Tokens: ${(fullModelData.completion_tokens / 1000000).toFixed(2)}M
                    `;
                },
                backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                borderColor: axisColor,
                textStyle: { color: textColor }
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
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

    async function init() {
        initCharts();
        const data = await fetchData();
        if (data && data.length > 0) {
            const latestData = data[data.length - 1];
            updateStatsCards(latestData);
            renderTrendChart(data);
            renderRankingChart(latestData);
        }
    }

    init();

    // Re-render charts when system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async () => {
        const data = await fetchData();
        if (data && data.length > 0) {
            renderTrendChart(data);
            renderRankingChart(data[data.length - 1]);
        }
    });
});
