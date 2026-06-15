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
        document.getElementById("stat-fng").textContent = data.latest.fng;
        document.getElementById("stat-spx").textContent = data.latest.spx.toLocaleString();
        
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

        // Initialize ECharts
        const chartDom = document.getElementById('chart');
        // TradingView dark theme base
        const myChart = echarts.init(chartDom);
        
        const option = {
            backgroundColor: 'transparent',
            color: ['#FF9800', '#2962FF'], // SPX Orange, FNG Blue
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'cross',
                    label: {
                        backgroundColor: '#2B2B43',
                        color: '#D1D4DC'
                    },
                    lineStyle: {
                        color: '#2B2B43',
                        type: 'dashed'
                    },
                    crossStyle: {
                        color: '#2B2B43',
                        type: 'dashed'
                    }
                },
                backgroundColor: 'rgba(19, 23, 34, 0.9)',
                borderColor: '#2B2B43',
                textStyle: {
                    color: '#D1D4DC',
                    fontSize: 12
                },
                padding: [8, 12]
            },
            axisPointer: {
                link: { xAxisIndex: 'all' },
                label: { backgroundColor: '#777' }
            },
            legend: {
                data: ['S&P 500', 'Fear & Greed Index'],
                textStyle: {
                    color: '#D1D4DC',
                    fontSize: 12
                },
                top: 0,
                left: 'left',
                icon: 'circle'
            },
            grid: [
                {
                    // SPX Grid (Top)
                    left: '2%',
                    right: '5%',
                    top: '10%',
                    height: '50%',
                    containLabel: true
                },
                {
                    // FNG Grid (Bottom)
                    left: '2%',
                    right: '5%',
                    top: '65%',
                    height: '25%',
                    containLabel: true
                }
            ],
            dataZoom: [
                {
                    type: 'inside',
                    xAxisIndex: [0, 1],
                    start: 80,
                    end: 100
                },
                {
                    show: true,
                    type: 'slider',
                    xAxisIndex: [0, 1],
                    bottom: 0,
                    start: 80,
                    end: 100,
                    borderColor: 'transparent',
                    backgroundColor: 'rgba(43, 43, 67, 0.2)',
                    fillerColor: 'rgba(41, 98, 255, 0.1)',
                    handleStyle: {
                        color: '#D1D4DC',
                        borderColor: '#2B2B43'
                    },
                    textStyle: {
                        color: '#D1D4DC'
                    }
                }
            ],
            xAxis: [
                {
                    // SPX xAxis
                    type: 'category',
                    data: data.dates,
                    gridIndex: 0,
                    axisLabel: {
                        show: false // Hide labels for top chart
                    },
                    axisLine: { show: false },
                    axisTick: { show: false },
                    splitLine: {
                        show: true,
                        lineStyle: {
                            color: 'rgba(43, 43, 67, 0.5)',
                            type: 'solid'
                        }
                    }
                },
                {
                    // FNG xAxis
                    type: 'category',
                    data: data.dates,
                    gridIndex: 1,
                    axisLabel: {
                        color: '#787B86'
                    },
                    axisLine: { show: false },
                    axisTick: { show: false },
                    splitLine: {
                        show: true,
                        lineStyle: {
                            color: 'rgba(43, 43, 67, 0.5)',
                            type: 'solid'
                        }
                    }
                }
            ],
            yAxis: [
                {
                    // SPX yAxis
                    type: 'value',
                    name: 'S&P 500',
                    gridIndex: 0,
                    position: 'right',
                    min: 'dataMin',
                    max: 'dataMax',
                    nameTextStyle: {
                        color: '#787B86',
                        padding: [0, 20, 0, 0]
                    },
                    axisLabel: { color: '#787B86' },
                    axisLine: { show: false },
                    axisTick: { show: false },
                    splitLine: {
                        show: true,
                        lineStyle: {
                            color: 'rgba(43, 43, 67, 0.5)',
                            type: 'solid'
                        }
                    }
                },
                {
                    // FNG yAxis
                    type: 'value',
                    name: 'Fear & Greed',
                    gridIndex: 1,
                    position: 'right',
                    min: 0,
                    max: 100,
                    interval: 25,
                    nameTextStyle: {
                        color: '#787B86',
                        padding: [0, 0, 0, 20]
                    },
                    axisLabel: { color: '#787B86' },
                    axisLine: { show: false },
                    axisTick: { show: false },
                    splitLine: {
                        show: true,
                        lineStyle: {
                            color: 'rgba(43, 43, 67, 0.5)',
                            type: 'solid'
                        }
                    }
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
                    }
                },
                {
                    name: 'Fear & Greed Index',
                    type: 'line',
                    xAxisIndex: 1,
                    yAxisIndex: 1,
                    data: data.fng,
                    showSymbol: false,
                    lineStyle: {
                        width: 1.5,
                        color: '#2962FF'
                    }
                }
            ]
        };

        option && myChart.setOption(option);

        // Handle window resize
        window.addEventListener('resize', () => {
            myChart.resize();
        });

    } catch (error) {
        console.error("Error loading Fear & Greed data:", error);
        document.getElementById('chart').innerHTML = `<div style="color: #ff4d4f; text-align: center; padding-top: 2rem;">Failed to load data. Please ensure you have run the update script.</div>`;
    }
});
