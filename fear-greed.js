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

        // Initialize ECharts
        const chartDom = document.getElementById('chart');
        // TradingView dark theme base
        const myChart = echarts.init(chartDom);
        
        const option = {
            backgroundColor: 'transparent',
            color: ['#2962FF', '#FF9800'], // TradingView style blue and orange
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'cross',
                    label: {
                        backgroundColor: '#2B2B43', // TV axis label color
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
                backgroundColor: 'rgba(19, 23, 34, 0.9)', // TV dark tooltip
                borderColor: '#2B2B43',
                textStyle: {
                    color: '#D1D4DC',
                    fontSize: 12
                },
                padding: [8, 12]
            },
            legend: {
                data: ['Fear & Greed Index', 'S&P 500'],
                textStyle: {
                    color: '#D1D4DC',
                    fontSize: 12
                },
                top: 0,
                left: 'left',
                icon: 'circle'
            },
            grid: {
                left: '2%',
                right: '5%',
                bottom: '10%',
                top: '12%',
                containLabel: true
            },
            dataZoom: [
                {
                    type: 'inside',
                    start: 80,
                    end: 100
                },
                {
                    show: true,
                    type: 'slider',
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
                    type: 'category',
                    data: data.dates,
                    axisLabel: {
                        color: '#787B86' // TV muted text
                    },
                    axisLine: {
                        show: false
                    },
                    axisTick: {
                        show: false
                    },
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
                    type: 'value',
                    name: 'Fear & Greed',
                    position: 'left',
                    min: 0,
                    max: 100,
                    interval: 20,
                    nameTextStyle: {
                        color: '#787B86',
                        padding: [0, 0, 0, 20]
                    },
                    axisLabel: {
                        color: '#787B86'
                    },
                    axisLine: {
                        show: false
                    },
                    axisTick: {
                        show: false
                    },
                    splitLine: {
                        show: true,
                        lineStyle: {
                            color: 'rgba(43, 43, 67, 0.5)',
                            type: 'solid'
                        }
                    }
                },
                {
                    type: 'value',
                    name: 'S&P 500',
                    position: 'right',
                    min: 'dataMin',
                    max: 'dataMax',
                    nameTextStyle: {
                        color: '#787B86',
                        padding: [0, 20, 0, 0]
                    },
                    axisLabel: {
                        color: '#787B86'
                    },
                    axisLine: {
                        show: false
                    },
                    axisTick: {
                        show: false
                    },
                    splitLine: {
                        show: false
                    }
                }
            ],
            series: [
                {
                    name: 'Fear & Greed Index',
                    type: 'line',
                    yAxisIndex: 0,
                    data: data.fng,
                    showSymbol: false,
                    lineStyle: {
                        width: 1.5,
                        color: '#2962FF' // TradingView Blue
                    },
                    tooltip: {
                        valueFormatter: function (value) {
                            return value.toFixed(2);
                        }
                    }
                },
                {
                    name: 'S&P 500',
                    type: 'candlestick',
                    yAxisIndex: 1,
                    data: data.spx_ohlc,
                    itemStyle: {
                        color: '#26A69A', // TradingView Green (Up)
                        color0: '#EF5350', // TradingView Red (Down)
                        borderColor: '#26A69A',
                        borderColor0: '#EF5350'
                    },
                    tooltip: {
                        valueFormatter: function (value) {
                            // ECharts candlestick value is an array: [open, close, low, high]
                            if (Array.isArray(value)) {
                                return `Open: ${value[0].toFixed(2)}  Close: ${value[1].toFixed(2)}  Low: ${value[2].toFixed(2)}  High: ${value[3].toFixed(2)}`;
                            }
                            return value;
                        }
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
