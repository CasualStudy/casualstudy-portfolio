document.addEventListener('DOMContentLoaded', () => {
    // If translations exist globally from script.js, merge our local ones
    if (window.translations && window.pageDict) {
        for (const [lang, dict] of Object.entries(window.pageDict)) {
            if (!window.translations[lang]) window.translations[lang] = {};
            Object.assign(window.translations[lang], dict);
        }
    }

    fetch('data/inclusion_data.json')
        .then(response => response.json())
        .then(data => {
            document.getElementById('last-updated').textContent = `Last updated: ${data.last_updated}`;
            renderContent(data.stats);

            // Re-render narrative when language changes
            const originalToggle = window.toggleLanguage;
            window.toggleLanguage = () => {
                if(originalToggle) originalToggle();
                renderContent(data.stats); // Re-generate narrative and cards with new language
            };
        })
        .catch(err => {
            console.error('Failed to load inclusion data:', err);
            document.getElementById('narrative-content').innerHTML = '<p>Error loading data. Please try again later.</p>';
        });
});

function renderContent(stats) {
    const lang = localStorage.getItem('language') || 'en';
    const dict = window.translations ? window.translations[lang] : window.pageDict[lang];
    
    // We expect stats to have "10Y" and "20Y"
    const s10 = stats["10Y"];
    const s20 = stats["20Y"];
    
    if (!s10 || !s20) return;

    // 1. Render Narrative
    const narrativeContainer = document.getElementById('narrative-content');
    if (lang === 'en') {
        narrativeContainer.innerHTML = `
            <p>Over the past <strong>20 years</strong>, we tracked <strong>${s20.count}</strong> stocks added to the S&P 500 index. In the 5 trading days leading up to the Effective Date (our proxy for the announcement rally), stocks averaged a <strong><span class="${s20.pre_avg >= 0 ? 'positive' : 'negative'}">${s20.pre_avg > 0 ? '+' : ''}${s20.pre_avg}%</span></strong> return with a <strong>${s20.pre_win}%</strong> win rate.</p>
            <p>However, the "post-inclusion" reality often paints a different picture. Once officially added, the average return over the next 1 week was <strong><span class="${s20.post1w_avg >= 0 ? 'positive' : 'negative'}">${s20.post1w_avg > 0 ? '+' : ''}${s20.post1w_avg}%</span></strong>, and over the next 1 month it was <strong><span class="${s20.post1m_avg >= 0 ? 'positive' : 'negative'}">${s20.post1m_avg > 0 ? '+' : ''}${s20.post1m_avg}%</span></strong> (with a win rate of <strong>${s20.post1m_win}%</strong>).</p>
            <p>In the more recent <strong>10 years</strong> (${s10.count} events), the pre-inclusion rally averaged <strong><span class="${s10.pre_avg >= 0 ? 'positive' : 'negative'}">${s10.pre_avg > 0 ? '+' : ''}${s10.pre_avg}%</span></strong>, while the 1-month post-inclusion return shifted to <strong><span class="${s10.post1m_avg >= 0 ? 'positive' : 'negative'}">${s10.post1m_avg > 0 ? '+' : ''}${s10.post1m_avg}%</span></strong>.</p>
        `;
    } else {
        narrativeContainer.innerHTML = `
            <p>在过去的 <strong>20 年</strong> 中，我们追踪了 <strong>${s20.count}</strong> 只被纳入标普500指数的股票。在正式生效日之前的 5 个交易日内（我们用来模糊替代“宣布日”大涨的指标），这些股票平均上涨了 <strong><span class="${s20.pre_avg >= 0 ? 'positive' : 'negative'}">${s20.pre_avg > 0 ? '+' : ''}${s20.pre_avg}%</span></strong>，胜率达到 <strong>${s20.pre_win}%</strong>。</p>
            <p>然而，正式纳入后的表现往往截然不同。从生效日起，未来 1 周的平均涨跌幅为 <strong><span class="${s20.post1w_avg >= 0 ? 'positive' : 'negative'}">${s20.post1w_avg > 0 ? '+' : ''}${s20.post1w_avg}%</span></strong>，而未来 1 个月的平均涨跌幅为 <strong><span class="${s20.post1m_avg >= 0 ? 'positive' : 'negative'}">${s20.post1m_avg > 0 ? '+' : ''}${s20.post1m_avg}%</span></strong>（胜率为 <strong>${s20.post1m_win}%</strong>）。</p>
            <p>在最近的 <strong>10 年</strong>（共 ${s10.count} 起事件）中，纳入前的平均涨幅为 <strong><span class="${s10.pre_avg >= 0 ? 'positive' : 'negative'}">${s10.pre_avg > 0 ? '+' : ''}${s10.pre_avg}%</span></strong>，而纳入后 1 个月的平均表现则变动为 <strong><span class="${s10.post1m_avg >= 0 ? 'positive' : 'negative'}">${s10.post1m_avg > 0 ? '+' : ''}${s10.post1m_avg}%</span></strong>。</p>
        `;
    }

    // 2. Render Stat Cards
    const container = document.getElementById('stats-container');
    container.innerHTML = '';
    
    const periods = ["20Y", "10Y"];
    periods.forEach(period => {
        const s = stats[period];
        const title = period === "20Y" ? dict.series_20y : dict.series_10y;
        
        const cardHtml = `
            <div class="stat-card">
                <div class="stat-header">
                    <span class="stat-title">${title} (${s.count})</span>
                    <span class="stat-period">${dict.stat_pre}</span>
                </div>
                <div class="stat-metrics">
                    <div class="metric">
                        <span class="metric-label">${dict.metric_avg}</span>
                        <span class="metric-value ${s.pre_avg >= 0 ? 'positive' : 'negative'}">${s.pre_avg > 0 ? '+' : ''}${s.pre_avg}%</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">${dict.metric_win}</span>
                        <span class="metric-value" style="color: #e5e7eb">${s.pre_win}%</span>
                    </div>
                </div>
                
                <div class="stat-header" style="margin-top: 1.5rem">
                    <span class="stat-period">${dict.stat_post1m}</span>
                </div>
                <div class="stat-metrics">
                    <div class="metric">
                        <span class="metric-label">${dict.metric_avg}</span>
                        <span class="metric-value ${s.post1m_avg >= 0 ? 'positive' : 'negative'}">${s.post1m_avg > 0 ? '+' : ''}${s.post1m_avg}%</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">${dict.metric_win}</span>
                        <span class="metric-value" style="color: #e5e7eb">${s.post1m_win}%</span>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += cardHtml;
    });

    // 3. Render ECharts
    renderCharts(stats, dict);
}

function renderCharts(stats, dict) {
    const s10 = stats["10Y"];
    const s20 = stats["20Y"];
    
    const xLabels = [dict.stat_pre, dict.stat_post1w, dict.stat_post1m];
    
    // Theme colors matching dark mode
    const color10Y = '#818cf8'; // Indigo
    const color20Y = '#34d399'; // Emerald

    // Common options
    const commonOptions = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' }
        },
        legend: {
            textStyle: { color: '#9ca3af' },
            top: 0
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: xLabels,
            axisLabel: { color: '#9ca3af' },
            axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }
        },
        yAxis: {
            type: 'value',
            axisLabel: { color: '#9ca3af' },
            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
        }
    };

    // Chart 1: Average Returns
    const returnChart = echarts.init(document.getElementById('avg-return-chart'));
    returnChart.setOption({
        ...commonOptions,
        title: {
            text: dict.chart_return_title,
            textStyle: { color: '#e5e7eb', fontSize: 16, fontWeight: 600 },
            left: 'center',
            top: -5
        },
        grid: { ...commonOptions.grid, top: 40 },
        yAxis: {
            ...commonOptions.yAxis,
            axisLabel: { formatter: '{value}%', color: '#9ca3af' }
        },
        series: [
            {
                name: dict.series_20y,
                type: 'bar',
                data: [s20.pre_avg, s20.post1w_avg, s20.post1m_avg],
                itemStyle: { color: color20Y, borderRadius: [4, 4, 0, 0] }
            },
            {
                name: dict.series_10y,
                type: 'bar',
                data: [s10.pre_avg, s10.post1w_avg, s10.post1m_avg],
                itemStyle: { color: color10Y, borderRadius: [4, 4, 0, 0] }
            }
        ]
    });

    // Chart 2: Win Rates
    const winChart = echarts.init(document.getElementById('win-rate-chart'));
    winChart.setOption({
        ...commonOptions,
        title: {
            text: dict.chart_win_title,
            textStyle: { color: '#e5e7eb', fontSize: 16, fontWeight: 600 },
            left: 'center',
            top: -5
        },
        grid: { ...commonOptions.grid, top: 40 },
        yAxis: {
            ...commonOptions.yAxis,
            min: 0,
            max: 100,
            axisLabel: { formatter: '{value}%', color: '#9ca3af' }
        },
        series: [
            {
                name: dict.series_20y,
                type: 'bar',
                data: [s20.pre_win, s20.post1w_win, s20.post1m_win],
                itemStyle: { color: color20Y, borderRadius: [4, 4, 0, 0] }
            },
            {
                name: dict.series_10y,
                type: 'bar',
                data: [s10.pre_win, s10.post1w_win, s10.post1m_win],
                itemStyle: { color: color10Y, borderRadius: [4, 4, 0, 0] }
            }
        ]
    });

    window.addEventListener('resize', () => {
        returnChart.resize();
        winChart.resize();
    });
}
