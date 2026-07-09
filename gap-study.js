document.addEventListener("DOMContentLoaded", () => {
    let globalData = null;
    let currentTicker = "SPY";
    
    const buckets = ["<0.5%", "0.5%-1%", "1%-2%", "2%-3%", ">=3%"];
    const periods = ["5Y", "10Y", "30Y"];
    
    const charts = {
        classicUp: echarts.init(document.getElementById('classic-up-chart')),
        classicDown: echarts.init(document.getElementById('classic-down-chart')),
        rangeUp: echarts.init(document.getElementById('range-up-chart')),
        rangeDown: echarts.init(document.getElementById('range-down-chart'))
    };

    const getIsDark = () => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const getIsSmall = () => window.innerWidth <= 768;

    const getHeatmapOption = (dataSeries, title) => {
        const isDark = getIsDark();
        const isSmall = getIsSmall();
        const textColor = isDark ? '#e2e8f0' : '#1e293b';
        const cellLabelColor = isDark ? '#f1f5f9' : '#111';

        return {
            tooltip: {
                position: 'top',
                backgroundColor: isDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.98)',
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                borderWidth: 1,
                textStyle: { color: textColor, fontSize: 12 },
                formatter: function (params) {
                    const d = params.data;
                    return `
                        <strong>${periods[d[0]]} | ${buckets[d[1]]}</strong><br/>
                        Fill Probability: <strong>${d[2]}%</strong><br/>
                        Filled: ${d[4]} / Total: ${d[3]}
                    `;
                }
            },
            grid: {
                height: '70%',
                top: '6%',
                left: isSmall ? 2 : '10%',
                right: isSmall ? 8 : '5%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                data: ['5Y', '10Y', '30Y'],
                splitArea: { show: true },
                axisLabel: { color: textColor, fontWeight: 'bold', fontSize: isSmall ? 12 : 13 }
            },
            yAxis: {
                type: 'category',
                data: ['<0.5%', '0.5%-1%', '1%-2%', '2%-3%', '3%+'],
                splitArea: { show: true },
                axisLabel: { color: textColor, fontWeight: 'bold', fontSize: isSmall ? 12 : 13 }
            },
            visualMap: {
                min: 0,
                max: 100,
                calculable: true,
                orient: 'horizontal',
                left: 'center',
                bottom: '0%',
                itemWidth: isSmall ? 14 : 20,
                itemHeight: isSmall ? 110 : 140,
                inRange: {
                    // Deepen the colors slightly: Slate 400 -> Blue 400 -> Red 400
                    color: ['#94a3b8', '#60a5fa', '#f87171']
                },
                textStyle: { color: textColor, fontWeight: 'bold' }
            },
            series: [{
                name: title,
                type: 'heatmap',
                data: dataSeries,
                label: {
                    show: true,
                    formatter: function(params) {
                        return params.data[2] > 0 ? params.data[2] + '%' : '-';
                    },
                    color: cellLabelColor,
                    fontSize: isSmall ? 12 : 15,
                    fontWeight: 'bold'
                },
                emphasis: {
                    itemStyle: {
                        shadowBlur: 10,
                        shadowColor: 'rgba(0, 0, 0, 0.5)'
                    }
                }
            }]
        };
    };

    const formatTodayNarrative = (todayObj, typeStr, statsObj, ticker) => {
        if (!todayObj) {
            return `
                <span class="lang-text" data-en="No gap or market closed" data-zh="未出现缺口或未开盘" style="color:var(--text-muted);">
                    未出现缺口或未开盘
                </span>
            `;
        }
        
        let dir = typeStr === "Classic" ? todayObj.classic_dir : todayObj.range_dir;
        let b = typeStr === "Classic" ? todayObj.classic_bucket : todayObj.range_bucket;
        let pct = typeStr === "Classic" ? todayObj.classic_pct : todayObj.range_pct;
        
        const openPrice = todayObj.open;
        const prevPrice = typeStr === "Classic" ? todayObj.prev_close : (dir === 'Up' ? todayObj.prev_high : todayObj.prev_low);
        
        const prevLabelEn = typeStr === "Classic" ? "yesterday's close" : (dir === 'Up' ? "yesterday's high" : "yesterday's low");
        const prevLabelZh = typeStr === "Classic" ? "昨日收盘价" : (dir === 'Up' ? "昨日最高价" : "昨日最低价");
        
        const typeLabelEn = typeStr === "Classic" ? "Classic Gap" : "Range Gap";
        const typeLabelZh = typeStr === "Classic" ? "经典缺口" : "区间缺口";
        
        const updateRemarkEn = "Updates daily within ~15 minutes after market open.";
        const updateRemarkZh = "每日开盘后约15分钟内自动更新。";
        
        const noteTextEn = typeStr === "Classic" ? 
            "Note: Classic Gap is the difference between today's open and yesterday's close. " + updateRemarkEn : 
            "Note: Range Gap is the difference between today's open and yesterday's high (for gap up) or low (for gap down). " + updateRemarkEn;
        const noteTextZh = typeStr === "Classic" ? 
            "注释：经典缺口是今日开盘价与昨日收盘价的差值。" + updateRemarkZh : 
            "注释：区间缺口是今日开盘价与昨日最高点(向上跳空)或最低点(向下跳空)的差值。" + updateRemarkZh;

        const dateStr = todayObj.date ? `(${todayObj.date})` : "";

        if (!dir) {
            return `
                <div style="font-size:1.1rem; font-weight:600; margin-bottom:0.5rem;" class="lang-text" data-en="${typeLabelEn}" data-zh="${typeLabelZh}">${typeLabelZh}</div>
                <div style="color:var(--text-muted);">
                    <span class="lang-text" data-en="Today's ${dateStr} ${ticker} open is" data-zh="今日${dateStr} ${ticker} 开盘价">今日${dateStr} ${ticker} 开盘价</span> 
                    <strong>$${openPrice}</strong>, 
                    <span class="lang-text" data-en="${prevLabelEn} is" data-zh="${prevLabelZh}"> ${prevLabelZh}</span> 
                    <strong>$${prevPrice}</strong>. 
                    <span class="lang-text" data-en="No gap detected." data-zh="未出现跳空缺口。">未出现跳空缺口。</span>
                </div>
                <div style="font-size:0.85rem; color:var(--text-muted); margin-top:0.8rem;" class="lang-text" data-en="${noteTextEn}" data-zh="${noteTextZh}">${noteTextZh}</div>
            `;
        }
        
        let color = dir === 'Up' ? '#4CAF50' : '#F44336';
        let sign = dir === 'Up' ? '+' : '-';
        let arrow = dir === 'Up' ? '↑' : '↓';
        
        let prob5Y = statsObj["5Y"][typeStr][dir][b]?.prob || 0;
        let prob10Y = statsObj["10Y"][typeStr][dir][b]?.prob || 0;
        let prob30Y = statsObj["30Y"][typeStr][dir][b]?.prob || 0;

        return `
            <div style="font-size:1.1rem; font-weight:600; margin-bottom:0.8rem; color:var(--text-main);">
                <span class="lang-text" data-en="Today's ${dateStr} ${ticker} open is" data-zh="今日${dateStr} ${ticker} 开盘价">今日${dateStr} ${ticker} 开盘价</span> 
                <strong>$${openPrice}</strong>，
                <span class="lang-text" data-en="${prevLabelEn} is" data-zh="${prevLabelZh}">${prevLabelZh}</span> 
                <strong>$${prevPrice}</strong>。<br/>
                <span class="lang-text" data-en="Today's ${typeLabelEn} is" data-zh="今日的${typeLabelZh}是">今日的${typeLabelZh}是</span> 
                <span style="color:${color}; font-weight:bold;">${sign}${pct}% ${arrow}</span>
            </div>
            <div style="font-size:1rem; color:var(--text-secondary); margin-bottom:0.8rem;">
                <span class="lang-text" data-en="Historically, over the past 30Y, 10Y, and 5Y, when the gap falls in the" data-zh="根据过去的统计，过去30年、10年、5年，缺口落在">根据过去的统计，过去30年、10年、5年，缺口落在</span> 
                <strong style="color:var(--text-main);">${b}</strong> 
                <span class="lang-text" data-en="range, the probability of the gap filling today is:" data-zh="区间时，今天能回补缺口的概率分别是：">区间时，今天能回补缺口的概率分别是：</span><br/>
                <span style="color:var(--accent); font-weight:bold; font-size:1.1rem;">
                    <span class="lang-text" data-en="30Y" data-zh="30年">30年</span>: ${prob30Y}% &nbsp;|&nbsp; 
                    <span class="lang-text" data-en="10Y" data-zh="10年">10年</span>: ${prob10Y}% &nbsp;|&nbsp; 
                    <span class="lang-text" data-en="5Y" data-zh="5年">5年</span>: ${prob5Y}%
                </span>
            </div>
            <div style="font-size:0.85rem; color:var(--text-muted);" class="lang-text" data-en="${noteTextEn}" data-zh="${noteTextZh}">
                ${noteTextZh}
            </div>
        `;
    };

    const updateUI = () => {
        if (!globalData) return;
        const data = globalData.data[currentTicker];
        
        const today = data.today;
        if (today) {
            document.getElementById('card-classic').innerHTML = formatTodayNarrative(today, "Classic", data.stats, currentTicker);
            document.getElementById('card-range').innerHTML = formatTodayNarrative(today, "Range", data.stats, currentTicker);
        } else {
            document.getElementById('card-classic').innerHTML = '<span class="lang-text" data-en="Not Available" data-zh="暂无数据">暂无数据</span>';
            document.getElementById('card-range').innerHTML = '<span class="lang-text" data-en="Not Available" data-zh="暂无数据">暂无数据</span>';
        }
        
        // Trigger translation manually since script.js's function is not global
        const currentLang = localStorage.getItem("siteLang") || "en";
        const cards = document.getElementById('today-narrative-cards');
        if (cards) {
            cards.querySelectorAll('.lang-text').forEach(el => {
                const text = currentLang === 'zh' ? el.getAttribute('data-zh') : el.getAttribute('data-en');
                if (text) el.innerHTML = text;
            });
        }

        // Build data arrays for Heatmaps: [x(period), y(bucket), prob, total, filled]
        const cUp = [], cDown = [], rUp = [], rDown = [];
        
        periods.forEach((period, xIdx) => {
            const pData = data.stats[period];
            buckets.forEach((bucket, yIdx) => {
                const cu = pData.Classic.Up[bucket];
                const cd = pData.Classic.Down[bucket];
                const ru = pData.Range.Up[bucket];
                const rd = pData.Range.Down[bucket];
                
                cUp.push([xIdx, yIdx, cu ? cu.prob : 0, cu ? cu.total : 0, cu ? cu.filled : 0]);
                cDown.push([xIdx, yIdx, cd ? cd.prob : 0, cd ? cd.total : 0, cd ? cd.filled : 0]);
                rUp.push([xIdx, yIdx, ru ? ru.prob : 0, ru ? ru.total : 0, ru ? ru.filled : 0]);
                rDown.push([xIdx, yIdx, rd ? rd.prob : 0, rd ? rd.total : 0, rd ? rd.filled : 0]);
            });
        });

        charts.classicUp.setOption(getHeatmapOption(cUp, 'Classic Gap Up'));
        charts.classicDown.setOption(getHeatmapOption(cDown, 'Classic Gap Down'));
        charts.rangeUp.setOption(getHeatmapOption(rUp, 'Range Gap Up'));
        charts.rangeDown.setOption(getHeatmapOption(rDown, 'Range Gap Down'));
    };

    // Fetch data
    fetch('data/gap_data.json')
        .then(response => response.json())
        .then(data => {
            globalData = data;
            updateUI();
        })
        .catch(error => console.error("Error loading gap data:", error));

    // Handle toggle
    document.getElementById('btn-spy').addEventListener('click', (e) => {
        document.getElementById('btn-spy').classList.add('active');
        document.getElementById('btn-qqq').classList.remove('active');
        currentTicker = "SPY";
        updateUI();
    });

    document.getElementById('btn-qqq').addEventListener('click', (e) => {
        document.getElementById('btn-qqq').classList.add('active');
        document.getElementById('btn-spy').classList.remove('active');
        currentTicker = "QQQ";
        updateUI();
    });

    // Re-render when the OS theme flips so heatmap text stays readable
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => updateUI());
    }

    // Resize; re-render when crossing the mobile/desktop breakpoint so
    // font sizes and grid paddings adapt
    let wasSmall = getIsSmall();
    let resizeTimer = null;
    window.addEventListener('resize', () => {
        Object.values(charts).forEach(c => c.resize());
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (getIsSmall() !== wasSmall) {
                wasSmall = getIsSmall();
                updateUI();
            }
        }, 200);
    });
});
