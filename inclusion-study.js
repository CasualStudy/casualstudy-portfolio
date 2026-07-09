let currentData = null;
let currentIndex = 'SPX';
let currentPostTimeframe = 'post1m';

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
            currentData = data;
            const updateTextAndRender = () => {
                const lang = localStorage.getItem('siteLang') || 'en';
                document.getElementById('last-updated').textContent = lang === 'zh' 
                    ? `最后更新: ${data.last_updated}` 
                    : `Last updated: ${data.last_updated}`;
                renderContent(data[currentIndex]);
            };

            updateTextAndRender();

            window.addEventListener('languageChanged', () => {
                updateTextAndRender();
            });

            // Re-render on OS theme change so chart text stays readable
            if (window.matchMedia) {
                window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => updateTextAndRender());
            }

            // Re-render when crossing the mobile/desktop breakpoint so
            // bar labels show/hide appropriately
            let wasSmall = window.innerWidth <= 768;
            let resizeTimer = null;
            window.addEventListener('resize', () => {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(() => {
                    const nowSmall = window.innerWidth <= 768;
                    if (nowSmall !== wasSmall) {
                        wasSmall = nowSmall;
                        updateTextAndRender();
                    }
                }, 200);
            });

            document.getElementById('btn-spx').addEventListener('click', (e) => {
                e.target.classList.add('active');
                document.getElementById('btn-ndx').classList.remove('active');
                currentIndex = 'SPX';
                updateTextAndRender();
            });

            document.getElementById('btn-ndx').addEventListener('click', (e) => {
                e.target.classList.add('active');
                document.getElementById('btn-spx').classList.remove('active');
                currentIndex = 'NDX';
                updateTextAndRender();
            });
        })
        .catch(err => {
            console.error('Failed to load inclusion data:', err);
            document.getElementById('narrative-content').innerHTML = '<p>Error loading data. Please try again later.</p>';
        });
});

function renderContent(stats) {
    const lang = localStorage.getItem('siteLang') || 'en';
    const dict = window.translations ? window.translations[lang] : window.pageDict[lang];
    
    // We expect stats to have "1Y", "10Y" and "20Y"
    const s20 = stats["20Y"];
    const s10 = stats["10Y"];
    const s1 = stats["1Y"];

    if (!s20 || !s10 || !s1) return;

    const indexName = currentIndex === 'SPX' ? dict.index_spx : dict.index_ndx;

    // 1. Render Narrative
    const narrativeContainer = document.getElementById('narrative-content');
    if (lang === 'en') {
        narrativeContainer.innerHTML = `
            <p>Over the past <strong>20 years</strong>, we tracked <strong>${s20.count}</strong> stocks added to the <strong>${indexName}</strong>. In the 5 trading days leading up to the Effective Date (our proxy for the announcement rally), stocks averaged a <strong><span class="${s20.pre_avg >= 0 ? 'positive' : 'negative'}">${s20.pre_avg > 0 ? '+' : ''}${s20.pre_avg}%</span></strong> return with a <strong>${s20.pre_win}%</strong> ratio of stocks up. The highest pre-inclusion rally was <strong>+${s20.pre_max_val}%</strong> (${s20.pre_max_ticker}), while the worst was <strong>${s20.pre_min_val}%</strong> (${s20.pre_min_ticker}).</p>
            <p>However, the "post-inclusion" reality often paints a different picture. Once officially added, the average return over the next 1 week was <strong><span class="${s20.post1w_avg >= 0 ? 'positive' : 'negative'}">${s20.post1w_avg > 0 ? '+' : ''}${s20.post1w_avg}%</span></strong>, and over the next 1 month it was <strong><span class="${s20.post1m_avg >= 0 ? 'positive' : 'negative'}">${s20.post1m_avg > 0 ? '+' : ''}${s20.post1m_avg}%</span></strong> (with <strong>${s20.post1m_win}%</strong> of stocks up). Post-inclusion (1 month), the best performer was <strong>+${s20.post1m_max_val}%</strong> (${s20.post1m_max_ticker}) and the worst was <strong>${s20.post1m_min_val}%</strong> (${s20.post1m_min_ticker}).</p>
            <p>In the more recent <strong>10 years</strong> (${s10.count} events), the pre-inclusion rally averaged <strong><span class="${s10.pre_avg >= 0 ? 'positive' : 'negative'}">${s10.pre_avg > 0 ? '+' : ''}${s10.pre_avg}%</span></strong>, while the 1-month post-inclusion return shifted to <strong><span class="${s10.post1m_avg >= 0 ? 'positive' : 'negative'}">${s10.post1m_avg > 0 ? '+' : ''}${s10.post1m_avg}%</span></strong>. And in the very recent <strong>1 year</strong> (${s1.count} events), the 1-month return was <strong><span class="${s1.post1m_avg >= 0 ? 'positive' : 'negative'}">${s1.post1m_avg > 0 ? '+' : ''}${s1.post1m_avg}%</span></strong>.</p>
        `;
    } else {
        narrativeContainer.innerHTML = `
            <p>在过去的 <strong>20 年</strong> 中，我们追踪了 <strong>${s20.count}</strong> 只被纳入<strong>${indexName}</strong>的股票。在正式生效日之前的 5 个交易日内（我们用来模糊替代“宣布日”大涨的指标），这些股票平均上涨了 <strong><span class="${s20.pre_avg >= 0 ? 'positive' : 'negative'}">${s20.pre_avg > 0 ? '+' : ''}${s20.pre_avg}%</span></strong>，上涨股票占比达到 <strong>${s20.pre_win}%</strong>。其中，纳入前表现最亮眼的是 <strong>${s20.pre_max_ticker}</strong>（大涨 <strong>+${s20.pre_max_val}%</strong>），最差的则是 <strong>${s20.pre_min_ticker}</strong>（跌 <strong>${s20.pre_min_val}%</strong>）。</p>
            <p>然而，正式纳入后的表现往往截然不同。从生效日起，未来 1 周的平均涨跌幅为 <strong><span class="${s20.post1w_avg >= 0 ? 'positive' : 'negative'}">${s20.post1w_avg > 0 ? '+' : ''}${s20.post1w_avg}%</span></strong>，而未来 1 个月的平均涨跌幅为 <strong><span class="${s20.post1m_avg >= 0 ? 'positive' : 'negative'}">${s20.post1m_avg > 0 ? '+' : ''}${s20.post1m_avg}%</span></strong>（上涨股票占比为 <strong>${s20.post1m_win}%</strong>）。纳入后一个月，表现最好的是 <strong>${s20.post1m_max_ticker}</strong>（<strong>+${s20.post1m_max_val}%</strong>），最差的则是 <strong>${s20.post1m_min_ticker}</strong>（<strong>${s20.post1m_min_val}%</strong>）。</p>
            <p>在最近的 <strong>10 年</strong>（共 ${s10.count} 起事件）中，纳入前的平均涨幅为 <strong><span class="${s10.pre_avg >= 0 ? 'positive' : 'negative'}">${s10.pre_avg > 0 ? '+' : ''}${s10.pre_avg}%</span></strong>，而纳入后 1 个月的平均表现则变动为 <strong><span class="${s10.post1m_avg >= 0 ? 'positive' : 'negative'}">${s10.post1m_avg > 0 ? '+' : ''}${s10.post1m_avg}%</span></strong>。而在极近的 <strong>1 年内</strong>（${s1.count} 起），1个月收益率为 <strong><span class="${s1.post1m_avg >= 0 ? 'positive' : 'negative'}">${s1.post1m_avg > 0 ? '+' : ''}${s1.post1m_avg}%</span></strong>。</p>
        `;
    }

    // 2. Render Stat Cards
    const container = document.getElementById('stats-container');
    
    container.innerHTML = `
        <div class="stat-card wide-card">
            <div class="stat-header">
                <h3 class="stat-title">${dict.card_pre_title}</h3>
            </div>
            <div class="metrics-grid">
                ${renderColumn(stats["20Y"], dict.series_20y, 'pre', dict)}
                ${renderColumn(stats["10Y"], dict.series_10y, 'pre', dict)}
                ${renderColumn(stats["1Y"], dict.series_1y, 'pre', dict)}
            </div>
        </div>
        
        <div class="stat-card wide-card">
            <div class="stat-header" style="display:flex; justify-content:space-between; align-items:center;">
                <h3 class="stat-title">${dict.card_post_title}</h3>
                <select id="post-timeframe-select" class="styled-select">
                    <option value="post1w" ${currentPostTimeframe === 'post1w' ? 'selected' : ''}>${dict.select_1w}</option>
                    <option value="post1m" ${currentPostTimeframe === 'post1m' ? 'selected' : ''}>${dict.select_1m}</option>
                    <option value="post1y" ${currentPostTimeframe === 'post1y' ? 'selected' : ''}>${dict.select_1y}</option>
                </select>
            </div>
            <div class="metrics-grid">
                ${renderColumn(stats["20Y"], dict.series_20y, currentPostTimeframe, dict)}
                ${renderColumn(stats["10Y"], dict.series_10y, currentPostTimeframe, dict)}
                ${renderColumn(stats["1Y"], dict.series_1y, currentPostTimeframe, dict)}
            </div>
        </div>
    `;

    document.getElementById('post-timeframe-select').addEventListener('change', (e) => {
        currentPostTimeframe = e.target.value;
        renderContent(stats);
    });

    // 3. Render ECharts
    renderCharts(stats, dict);
}

function renderColumn(s, title, prefix, dict) {
    if (!s) return '<div></div>';
    return `
        <div class="metrics-column">
            <div class="metrics-column-title">${title} (${s.count})</div>
            <div class="metric">
                <span class="metric-label">${dict.metric_avg}</span>
                <span class="metric-value ${s[prefix + '_avg'] >= 0 ? 'positive' : 'negative'}">${s[prefix + '_avg'] > 0 ? '+' : ''}${s[prefix + '_avg']}%</span>
            </div>
            <div class="metric">
                <span class="metric-label">${dict.metric_intraday}</span>
                <span class="metric-value ${s[prefix + '_intraday'] >= 0 ? 'positive' : 'negative'}">${s[prefix + '_intraday'] > 0 ? '+' : ''}${s[prefix + '_intraday']}%</span>
            </div>
            <div class="metric">
                <span class="metric-label">${dict.metric_win}</span>
                <span class="metric-value" style="color: #111827">${s[prefix + '_win']}%</span>
            </div>
        </div>
    `;
}

function renderCharts(stats, dict) {
    const s1 = stats["1Y"] || {pre_avg:0, post1w_avg:0, post1m_avg:0, post1y_avg:0, pre_win:0, post1w_win:0, post1m_win:0, post1y_win:0};
    const s10 = stats["10Y"] || {pre_avg:0, post1w_avg:0, post1m_avg:0, post1y_avg:0, pre_win:0, post1w_win:0, post1m_win:0, post1y_win:0};
    const s20 = stats["20Y"] || {pre_avg:0, post1w_avg:0, post1m_avg:0, post1y_avg:0, pre_win:0, post1w_win:0, post1m_win:0, post1y_win:0};
    
    const xLabels = [dict.stat_pre, dict.select_1w, dict.select_1m, dict.select_1y];

    // Theme colors matching dark mode
    const color1Y = '#f472b6'; // Pink
    const color10Y = '#818cf8'; // Indigo
    const color20Y = '#34d399'; // Emerald

    const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isSmall = window.innerWidth <= 768;
    const textColor = isDark ? '#e2e8f0' : '#111827';
    const axisLineColor = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)';
    const splitLineColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    // On phones the bars are narrow — per-bar value labels overlap, so
    // hide them and rely on the tooltip instead.
    const barLabel = isSmall
        ? { show: false }
        : { show: true, position: 'top', color: textColor, fontWeight: 600, formatter: '{c}%' };

    // Common options
    const commonOptions = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            backgroundColor: isDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.98)',
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
            borderWidth: 1,
            textStyle: { color: textColor, fontSize: 12 },
            valueFormatter: (v) => v == null ? '-' : v + '%'
        },
        legend: {
            textStyle: { color: textColor, fontWeight: 600 },
            top: 30
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
            axisLabel: {
                color: textColor,
                fontWeight: 600,
                interval: 0,
                fontSize: isSmall ? 10 : 12,
                rotate: isSmall ? 25 : 0
            },
            axisLine: { lineStyle: { color: axisLineColor } }
        },
        yAxis: {
            type: 'value',
            axisLabel: { color: textColor, fontWeight: 600 },
            splitLine: { lineStyle: { color: splitLineColor } }
        }
    };

    // Reuse existing chart instances on re-render (language / index /
    // theme switches) instead of re-initializing over the same DOM node.
    const returnDom = document.getElementById('avg-return-chart');
    const winDom = document.getElementById('win-rate-chart');

    // Chart 1: Average Returns
    const returnChart = echarts.getInstanceByDom(returnDom) || echarts.init(returnDom);
    returnChart.setOption({
        ...commonOptions,
        title: {
            text: dict.chart_return_title,
            textStyle: { color: textColor, fontSize: 16, fontWeight: 700 },
            left: 'center',
            top: 0
        },
        grid: { ...commonOptions.grid, top: 80 },
        yAxis: {
            ...commonOptions.yAxis,
            axisLabel: { formatter: '{value}%', color: textColor, fontWeight: 600 }
        },
        series: [
            {
                name: dict.series_20y,
                type: 'bar',
                data: [s20.pre_avg, s20.post1w_avg, s20.post1m_avg, s20.post1y_avg],
                itemStyle: { color: color20Y, borderRadius: [4, 4, 0, 0] },
                label: barLabel
            },
            {
                name: dict.series_10y,
                type: 'bar',
                data: [s10.pre_avg, s10.post1w_avg, s10.post1m_avg, s10.post1y_avg],
                itemStyle: { color: color10Y, borderRadius: [4, 4, 0, 0] },
                label: barLabel
            },
            {
                name: dict.series_1y,
                type: 'bar',
                data: [s1.pre_avg, s1.post1w_avg, s1.post1m_avg, s1.post1y_avg],
                itemStyle: { color: color1Y, borderRadius: [4, 4, 0, 0] },
                label: barLabel
            }
        ]
    }, true);

    // Chart 2: Win Rates
    const winChart = echarts.getInstanceByDom(winDom) || echarts.init(winDom);
    winChart.setOption({
        ...commonOptions,
        title: {
            text: dict.chart_win_title,
            textStyle: { color: textColor, fontSize: 16, fontWeight: 700 },
            left: 'center',
            top: 0
        },
        grid: { ...commonOptions.grid, top: 80 },
        yAxis: {
            ...commonOptions.yAxis,
            min: 0,
            max: 100,
            axisLabel: { formatter: '{value}%', color: textColor, fontWeight: 600 }
        },
        series: [
            {
                name: dict.series_20y,
                type: 'bar',
                data: [s20.pre_win, s20.post1w_win, s20.post1m_win, s20.post1y_win],
                itemStyle: { color: color20Y, borderRadius: [4, 4, 0, 0] },
                label: barLabel
            },
            {
                name: dict.series_10y,
                type: 'bar',
                data: [s10.pre_win, s10.post1w_win, s10.post1m_win, s10.post1y_win],
                itemStyle: { color: color10Y, borderRadius: [4, 4, 0, 0] },
                label: barLabel
            },
            {
                name: dict.series_1y,
                type: 'bar',
                data: [s1.pre_win, s1.post1w_win, s1.post1m_win, s1.post1y_win],
                itemStyle: { color: color1Y, borderRadius: [4, 4, 0, 0] },
                label: barLabel
            }
        ]
    }, true);
}
