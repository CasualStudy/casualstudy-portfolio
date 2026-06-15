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
        // Check if dark mode is preferred for theme
        const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const myChart = echarts.init(chartDom, isDarkMode ? 'dark' : null);
        
        // ECharts uses transparent backgrounds by default, which is perfect for our glassmorphism
        
        const option = {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'cross',
                    crossStyle: {
                        color: '#999'
                    }
                },
                backgroundColor: 'rgba(25, 25, 30, 0.8)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                textStyle: {
                    color: '#fff'
                }
            },
            toolbox: {
                feature: {
                    dataZoom: {
                        yAxisIndex: 'none'
                    },
                    restore: {},
                    saveAsImage: {
                        name: 'Fear_and_Greed_vs_SPX'
                    }
                },
                iconStyle: {
                    borderColor: 'var(--text-primary)'
                }
            },
            legend: {
                data: ['Fear & Greed Index', 'S&P 500'],
                textStyle: {
                    color: 'var(--text-primary)'
                },
                top: 0
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '10%',
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
                    textStyle: {
                        color: 'var(--text-primary)'
                    }
                }
            ],
            xAxis: [
                {
                    type: 'category',
                    data: data.dates,
                    axisPointer: {
                        type: 'shadow'
                    },
                    axisLine: {
                        lineStyle: {
                            color: 'var(--text-secondary)'
                        }
                    }
                }
            ],
            yAxis: [
                {
                    type: 'value',
                    name: 'Fear & Greed',
                    min: 0,
                    max: 100,
                    interval: 20,
                    axisLabel: {
                        formatter: '{value}'
                    },
                    axisLine: {
                        show: true,
                        lineStyle: {
                            color: '#0071e3'
                        }
                    },
                    splitLine: {
                        show: false
                    }
                },
                {
                    type: 'value',
                    name: 'S&P 500',
                    min: 'dataMin',
                    max: 'dataMax',
                    axisLabel: {
                        formatter: '{value}'
                    },
                    axisLine: {
                        show: true,
                        lineStyle: {
                            color: '#ff6b35'
                        }
                    },
                    splitLine: {
                        lineStyle: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            type: 'dashed'
                        }
                    }
                }
            ],
            visualMap: {
                show: false,
                pieces: [
                    {gt: 0, lte: 25, color: 'rgba(255, 77, 79, 0.8)'},   // Extreme Fear
                    {gt: 25, lte: 45, color: 'rgba(250, 173, 20, 0.8)'},  // Fear
                    {gt: 45, lte: 55, color: 'rgba(250, 219, 20, 0.8)'},  // Neutral
                    {gt: 55, lte: 75, color: 'rgba(82, 196, 26, 0.8)'},   // Greed
                    {gt: 75, lte: 100, color: 'rgba(56, 158, 13, 0.8)'}   // Extreme Greed
                ],
                seriesIndex: 0
            },
            series: [
                {
                    name: 'Fear & Greed Index',
                    type: 'line',
                    yAxisIndex: 0,
                    data: data.fng,
                    smooth: true,
                    lineStyle: {
                        width: 2
                    },
                    areaStyle: {
                        opacity: 0.1
                    },
                    symbol: 'none'
                },
                {
                    name: 'S&P 500',
                    type: 'line',
                    yAxisIndex: 1,
                    data: data.spx,
                    smooth: true,
                    lineStyle: {
                        width: 2,
                        color: '#ff6b35'
                    },
                    itemStyle: {
                        color: '#ff6b35'
                    },
                    symbol: 'none'
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
        document.getElementById('chart').innerHTML = `<div style="color: red; text-align: center; padding-top: 2rem;">Failed to load data. Please ensure you have run the update script.</div>`;
    }
});
