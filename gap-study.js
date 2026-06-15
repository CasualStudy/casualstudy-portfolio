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

    const getHeatmapOption = (dataSeries, title) => {
        // Find max value to scale color
        let maxVal = 0;
        dataSeries.forEach(item => {
            if (item[2] > maxVal) maxVal = item[2];
        });
        
        return {
            tooltip: {
                position: 'top',
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
                top: '10%'
            },
            xAxis: {
                type: 'category',
                data: periods,
                splitArea: { show: true },
                axisLabel: { color: 'rgba(255, 255, 255, 0.7)' }
            },
            yAxis: {
                type: 'category',
                data: buckets,
                splitArea: { show: true },
                axisLabel: { color: 'rgba(255, 255, 255, 0.7)' }
            },
            visualMap: {
                min: 0,
                max: 100,
                calculable: true,
                orient: 'horizontal',
                left: 'center',
                bottom: '0%',
                inRange: {
                    color: ['#1a1a2e', '#457b9d', '#e63946']
                },
                textStyle: { color: 'rgba(255, 255, 255, 0.7)' }
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
                    color: '#fff'
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
        if (!todayObj) return '<span style="color:var(--text-muted);">No gap or market closed</span>';
        
        let dir = typeStr === "Classic" ? todayObj.classic_dir : todayObj.range_dir;
        let b = typeStr === "Classic" ? todayObj.classic_bucket : todayObj.range_bucket;
        let pct = typeStr === "Classic" ? todayObj.classic_pct : todayObj.range_pct;
        
        const openPrice = todayObj.open;
        const prevPrice = typeStr === "Classic" ? todayObj.prev_close : (dir === 'Up' ? todayObj.prev_high : todayObj.prev_low);
        const prevLabel = typeStr === "Classic" ? "昨日收盘价" : (dir === 'Up' ? "昨日最高价" : "昨日最低价");
        const typeLabel = typeStr === "Classic" ? "经典缺口" : "区间缺口";
        const noteText = typeStr === "Classic" ? 
            "注释：经典缺口是今日开盘价与昨日收盘价的差值。" : 
            "注释：区间缺口是今日开盘价与昨日最高点(向上跳空)或最低点(向下跳空)的差值。";

        if (!dir) {
            return `
                <div style="font-size:1.1rem; font-weight:600; margin-bottom:0.5rem;">${typeLabel} (${typeStr} Gap)</div>
                <div style="color:var(--text-muted);">今日 ${ticker} 开盘价 $${openPrice}，${prevLabel} $${prevPrice}，未出现跳空缺口。</div>
                <div style="font-size:0.85rem; color:var(--text-muted); margin-top:0.8rem;">${noteText}</div>
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
                今日 ${ticker} 开盘价 <span style="color:#fff;">$${openPrice}</span>，
                ${prevLabel} <span style="color:#fff;">$${prevPrice}</span>。<br/>
                今日的${typeLabel}是 <span style="color:${color}; font-weight:bold;">${sign}${pct}% ${arrow}</span>
            </div>
            <div style="font-size:1rem; color:var(--text-secondary); margin-bottom:0.8rem;">
                根据过去的统计，过去30年、10年、5年，缺口落在 <span style="color:#fff; font-weight:bold;">${b}</span> 区间时，
                今天能回补缺口的概率分别是：<br/>
                <span style="color:var(--accent); font-weight:bold; font-size:1.1rem;">30年: ${prob30Y}% &nbsp;|&nbsp; 10年: ${prob10Y}% &nbsp;|&nbsp; 5年: ${prob5Y}%</span>
            </div>
            <div style="font-size:0.85rem; color:var(--text-muted);">
                ${noteText}
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
            document.getElementById('card-classic').innerHTML = "Not Available";
            document.getElementById('card-range').innerHTML = "Not Available";
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

    // Resize
    window.addEventListener('resize', () => {
        Object.values(charts).forEach(c => c.resize());
    });
});
