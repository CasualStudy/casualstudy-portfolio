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

    const formatTodayText = (data) => {
        if (!data) return '<span style="color:var(--text-muted);">No gap or market closed</span>';
        let dir = data.dir || '';
        let b = data.bucket || '';
        let pct = data.pct || '';
        if (!dir) return '<span style="color:var(--text-muted);">No Gap</span>';
        
        let color = dir === 'Up' ? '#4CAF50' : '#F44336';
        let arrow = dir === 'Up' ? '↑' : '↓';
        return `<span style="color:${color}; font-weight:bold;">Gap ${dir} ${arrow}</span><br/><span style="font-size:0.9rem; color:var(--text-secondary);">${b}</span>`;
    };

    const updateUI = () => {
        if (!globalData) return;
        const data = globalData.data[currentTicker];
        
        // Update today's cards
        const today = data.today;
        if (today) {
            document.getElementById('today-date').textContent = today.date;
            
            document.getElementById('today-classic').innerHTML = formatTodayText({
                dir: today.classic_dir,
                bucket: today.classic_bucket
            });
            
            document.getElementById('today-range').innerHTML = formatTodayText({
                dir: today.range_dir,
                bucket: today.range_bucket
            });
        } else {
            document.getElementById('today-date').textContent = "Not Available";
            document.getElementById('today-classic').textContent = "--";
            document.getElementById('today-range').textContent = "--";
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
