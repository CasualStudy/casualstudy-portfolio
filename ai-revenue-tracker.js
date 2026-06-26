document.addEventListener('DOMContentLoaded', async () => {
    // ECharts Instances
    let trendChart = null;
    let rankingChart = null;
    let modelTrendChart = null;
    let usageTrendChart = null;
    let modelUsageTrendChart = null;
    
    let rawData = [];
    let currentTimeframe = 'daily';

    // ----- Helpers ----------------------------------------------------------

    // Compact currency formatter: 1234567 -> "$1.23M"
    function fmtCompactUSD(v) {
        if (v == null || isNaN(v)) return '--';
        const abs = Math.abs(v);
        if (abs >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
        if (abs >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M';
        if (abs >= 1e3) return '$' + (v / 1e3).toFixed(1) + 'k';
        return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 });
    }

    // Compact integer formatter (for tokens etc.): 1234567 -> "1.23M"
    function fmtCompactInt(v) {
        if (v == null || isNaN(v)) return '--';
        const abs = Math.abs(v);
        if (abs >= 1e9) return (v / 1e9).toFixed(2) + 'B';
        if (abs >= 1e6) return (v / 1e6).toFixed(2) + 'M';
        if (abs >= 1e3) return (v / 1e3).toFixed(1) + 'k';
        return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
    }

    // Strip vendor prefix: "Anthropic: Claude Opus 4.7" -> "Claude Opus 4.7"
    function shortModelName(name) {
        if (!name) return '';
        return name.includes(': ') ? name.split(': ')[1] : name;
    }

    // Extract vendor key from id "anthropic/claude-opus-4.7" -> "anthropic"
    function vendorKey(id) {
        if (!id) return 'other';
        return id.split('/')[0].toLowerCase();
    }

    // Vendor color palette — each vendor gets a consistent color across all
    // charts, so users can spot "Anthropic is orange" instantly.
    const VENDOR_COLORS = {
        'anthropic':   '#d97757',  // Anthropic brand orange-brown
        'openai':      '#10a37f',  // OpenAI green
        'google':      '#4285f4',  // Google blue
        'meta':        '#0668e1',  // Meta blue
        'mistralai':   '#fa520f',  // Mistral orange
        'deepseek':    '#4d6bfe',  // DeepSeek blue
        'x-ai':        '#0f0f0f',  // xAI (Grok) — overridden to lighter in dark mode
        'moonshotai':  '#7c3aed',  // Moonshot purple
        'cohere':      '#39594d',  // Cohere teal-green
        'perplexity':  '#20808d',  // Perplexity teal
        'nvidia':      '#76b900',  // NVIDIA green
        'microsoft':   '#5e5e5e',  // Microsoft gray
        'amazon':      '#ff9900',  // Amazon orange
        'alibaba':     '#ff6a00',  // Qwen orange
        '01-ai':       '#0ea5e9',  // Yi sky-blue
        'z-ai':        '#e91e63',  // Zhipu GLM prominent magenta
        'other':       '#94a3b8'   // slate-400
    };

    // Returns a color for a model, preferring vendor color but adjusting shade
    // per-model within the same vendor so different Anthropic models differ.
    const _vendorShadeCache = {};
    function modelColor(id, name) {
        const vk = vendorKey(id);
        const base = VENDOR_COLORS[vk] || VENDOR_COLORS['other'];
        if (!_vendorShadeCache[vk]) _vendorShadeCache[vk] = 0;
        const shadeIdx = _vendorShadeCache[vk]++;
        if (shadeIdx === 0) return base;
        // For 2nd/3rd model of same vendor, lighten/darken the base color.
        return shadeColor(base, shadeIdx * 12);
    }

    // Lighten (positive percent) or darken (negative) a hex color.
    function shadeColor(hex, percent) {
        const h = hex.replace('#', '');
        let r = parseInt(h.substring(0, 2), 16);
        let g = parseInt(h.substring(2, 4), 16);
        let b = parseInt(h.substring(4, 6), 16);
        r = Math.max(0, Math.min(255, Math.round(r + (percent / 100) * 255)));
        g = Math.max(0, Math.min(255, Math.round(g + (percent / 100) * 255)));
        b = Math.max(0, Math.min(255, Math.round(b + (percent / 100) * 255)));
        return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
    }

    // Compute % change vs previous period, returns {delta, dir}
    function pctChange(curr, prev) {
        if (prev == null || prev === 0 || curr == null) return null;
        const d = (curr - prev) / prev * 100;
        const dir = d > 0.5 ? 'up' : (d < -0.5 ? 'down' : 'flat');
        return { delta: d, dir };
    }

    function setDeltaEl(elId, change) {
        const el = document.getElementById(elId);
        if (!el) return;
        if (!change) { el.innerHTML = '&nbsp;'; return; }
        const sign = change.delta > 0 ? '+' : '';
        const arrow = change.dir === 'up' ? '&#9650;' : (change.dir === 'down' ? '&#9660;' : '&#9679;');
        el.innerHTML = `<span class="stat-delta ${change.dir}">${arrow} ${sign}${change.delta.toFixed(1)}%</span>`;
    }

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
        const usageTrendContainer = document.getElementById('usage-trend-chart');
        const modelUsageTrendContainer = document.getElementById('model-usage-trend-chart');

        if (trendContainer) trendChart = echarts.init(trendContainer);
        if (rankingContainer) rankingChart = echarts.init(rankingContainer);
        if (modelTrendContainer) modelTrendChart = echarts.init(modelTrendContainer);
        if (usageTrendContainer) usageTrendChart = echarts.init(usageTrendContainer);
        if (modelUsageTrendContainer) modelUsageTrendChart = echarts.init(modelUsageTrendContainer);

        window.addEventListener('resize', () => {
            if (trendChart) trendChart.resize();
            if (rankingChart) rankingChart.resize();
            if (modelTrendChart) modelTrendChart.resize();
            if (usageTrendChart) usageTrendChart.resize();
            if (modelUsageTrendChart) modelUsageTrendChart.resize();
        });
    }

    function updateStatsCards(latestData, prevData) {
        if (!latestData) return;

        const dateEl = document.getElementById('stat-date');
        const topModelEl = document.getElementById('stat-top-model');
        const totalRevEl = document.getElementById('stat-total-rev');
        const topShareEl = document.getElementById('stat-top-share');

        // --- Card 1: date ---
        if (dateEl) dateEl.textContent = latestData.date;
        const dateSubEl = document.getElementById('stat-date-sub');
        if (dateSubEl) {
            if (prevData) {
                dateSubEl.innerHTML = `<span class="lang-text" data-en="vs prev" data-zh="对比上期">vs prev</span>: ${prevData.date}`;
            } else {
                dateSubEl.innerHTML = '&nbsp;';
            }
        }

        // --- Card 3: total revenue (compute before card 2/4 sub-deltas) ---
        const totalRev = latestData.total_revenue;
        if (totalRevEl) totalRevEl.textContent = fmtCompactUSD(totalRev);
        setDeltaEl('stat-total-rev-sub', prevData ? pctChange(totalRev, prevData.total_revenue) : null);

        // --- Card 2: top model ---
        if (topModelEl && latestData.models && latestData.models.length > 0) {
            const topModel = latestData.models[0];
            const name = shortModelName(topModel.name || topModel.id);
            topModelEl.textContent = name;
            // Sub-line: vendor + revenue
            const vendor = vendorKey(topModel.id);
            const vendorLabel = vendor.charAt(0).toUpperCase() + vendor.slice(1);
            const subEl = document.getElementById('stat-top-model-sub');
            if (subEl) {
                let html = `<span style="opacity:0.8">${vendorLabel}</span> &middot; ${fmtCompactUSD(topModel.revenue)}`;
                if (prevData && prevData.models && prevData.models.length > 0) {
                    // Find same model in previous period to compute rank/revenue change
                    const prevSameModel = prevData.models.find(m => m.id === topModel.id);
                    if (prevSameModel) {
                        const ch = pctChange(topModel.revenue, prevSameModel.revenue);
                        if (ch) html += ` <span class="stat-delta ${ch.dir}">${ch.delta > 0 ? '+' : ''}${ch.delta.toFixed(1)}%</span>`;
                    }
                }
                subEl.innerHTML = html;
            }
        }

        // --- Card 4: top model market share ---
        if (topShareEl && latestData.models && latestData.models.length > 0) {
            const topModel = latestData.models[0];
            const share = totalRev > 0 ? (topModel.revenue / totalRev * 100) : 0;
            topShareEl.textContent = share.toFixed(1) + '%';
            const shareSubEl = document.getElementById('stat-top-share-sub');
            if (shareSubEl) {
                if (prevData && prevData.models && prevData.models.length > 0 && prevData.total_revenue > 0) {
                    const prevTop = prevData.models[0];
                    const prevShare = (prevTop.revenue / prevData.total_revenue * 100);
                    const ch = pctChange(share, prevShare);
                    if (ch) {
                        const sign = ch.delta > 0 ? '+' : '';
                        const arrow = ch.dir === 'up' ? '&#9650;' : (ch.dir === 'down' ? '&#9660;' : '&#9679;');
                        shareSubEl.innerHTML = `<span class="stat-delta ${ch.dir}">${arrow} ${sign}${ch.delta.toFixed(1)}pp</span> <span style="opacity:0.7">vs ${shortModelName(prevTop.name || prevTop.id)}</span>`;
                    } else {
                        shareSubEl.innerHTML = '&nbsp;';
                    }
                } else {
                    shareSubEl.innerHTML = '&nbsp;';
                }
            }
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

        // Default zoom window: show last 60 data points (or all if fewer)
        const zoomEnd = 100;
        const zoomStart = data.length > 60 ? Math.max(0, 100 - (60 / data.length) * 100) : 0;

        const option = {
            tooltip: {
                trigger: 'axis',
                formatter: function (params) {
                    const dataIndex = params[0].dataIndex;
                    const item = data[dataIndex];
                    const value = item.total_revenue;
                    
                    let html = `<div style="margin-bottom: 8px; border-bottom: 1px solid ${axisColor}; padding-bottom: 8px;">`;
                    html += `<strong style="font-size: 1.1em;">${item.date}</strong><br/>`;
                    html += `Total Revenue: <span style="font-weight: 600;">${fmtCompactUSD(value)}</span>`;
                    html += ` <span style="opacity:0.6; font-size:0.9em;">($${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })})</span>`;
                    html += `</div>`;
                    
                    if (item.models && item.models.length > 0) {
                        html += `<div style="font-size: 0.85em; line-height: 1.5;">`;
                        const limit = Math.min(10, item.models.length);
                        let top10Revenue = 0;
                        for (let i = 0; i < limit; i++) {
                            const m = item.models[i];
                            top10Revenue += m.revenue;
                            const name = shortModelName(m.name || m.id);
                            const truncName = name.length > 25 ? name.substring(0, 25) + '...' : name;
                            const sharePct = value > 0 ? (m.revenue / value * 100).toFixed(1) : '0.0';
                            html += `<div style="display: flex; justify-content: space-between; gap: 16px;">
                                        <span style="opacity: 0.9;">${i+1}. ${truncName}</span>
                                        <span style="font-weight: 600;">${fmtCompactUSD(m.revenue)} <span style="opacity:0.6; font-size:0.9em">(${sharePct}%)</span></span>
                                     </div>`;
                        }
                        
                        const othersRevenue = item.total_revenue - top10Revenue;
                        if (othersRevenue > 0) {
                            const othersPct = value > 0 ? (othersRevenue / value * 100).toFixed(1) : '0.0';
                            html += `<div style="display: flex; justify-content: space-between; gap: 16px; margin-top: 4px; padding-top: 4px; border-top: 1px dashed rgba(128,128,128,0.4);">
                                        <span style="opacity: 0.8; font-style: italic;">11+. Others</span>
                                        <span style="font-weight: 600; opacity: 0.8;">${fmtCompactUSD(othersRevenue)} <span style="opacity:0.6; font-size:0.9em">(${othersPct}%)</span></span>
                                     </div>`;
                        }
                        
                        html += `</div>`;
                    }
                    return html;
                },
                backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                borderColor: axisColor,
                textStyle: { color: textColor },
                confine: true
            },
            grid: {
                left: isMobile ? '2%' : '3%',
                right: isMobile ? '5%' : '4%',
                bottom: isMobile ? '15%' : '12%',
                top: 12,
                containLabel: true
            },
            toolbox: {
                right: 10,
                top: -4,
                itemSize: 15,
                feature: {
                    dataZoom: { yAxisIndex: 'none', title: { zoom: 'Zoom', back: 'Reset' } },
                    saveAsImage: { title: 'Save PNG', name: 'ai-market-trend', pixelRatio: 2 }
                },
                iconStyle: { borderColor: isDarkMode ? '#94a3b8' : '#475569' }
            },
            dataZoom: [
                {
                    type: 'inside',
                    start: zoomStart,
                    end: zoomEnd
                },
                {
                    type: 'slider',
                    start: zoomStart,
                    end: zoomEnd,
                    height: 18,
                    bottom: 4,
                    borderColor: 'transparent',
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                    fillerColor: isDarkMode ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.15)',
                    handleStyle: { color: '#3b82f6', borderColor: '#3b82f6' },
                    textStyle: { color: textColor, fontSize: 10 },
                    dataBackground: {
                        lineStyle: { color: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' },
                        areaStyle: { color: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }
                    }
                }
            ],
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
                    formatter: (value) => fmtCompactUSD(value)
                }
            },
            series: [
                {
                    name: 'Revenue',
                    type: 'line',
                    symbol: 'circle',
                    symbolSize: 6,
                    showSymbol: false,
                    sampling: 'lttb',
                    itemStyle: {
                        color: '#3b82f6'
                    },
                    lineStyle: {
                        width: 2.5
                    },
                    emphasis: {
                        focus: 'series',
                        scale: 1.4
                    },
                    data: revenues
                }
            ]
        };

        trendChart.setOption(option, true);
    }

    function renderRankingChart(latestData) {
        if (!rankingChart || !latestData || !latestData.models) return;

        const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const textColor = isDarkMode ? '#e2e8f0' : '#1e293b';
        const axisColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        const isMobile = window.innerWidth <= 768;

        // Update the HTML subtitle below the section header
        const subtitleEl = document.getElementById('ranking-subtitle');
        if (subtitleEl) {
            const lang = document.documentElement.lang || 'en';
            subtitleEl.textContent = lang === 'zh'
                ? `数据日期：${latestData.date}`
                : `Data for ${latestData.date}`;
        }

        // Reset vendor shade cache so colors are deterministic per render
        Object.keys(_vendorShadeCache).forEach(k => delete _vendorShadeCache[k]);

        // Top 10 models for cleaner display
        const top10 = latestData.models.slice(0, 10).reverse(); // Reverse for horizontal bar chart (highest at top)

        // Calculate "Others" revenue
        let top10Revenue = top10.reduce((sum, m) => sum + m.revenue, 0);
        let othersRevenue = latestData.total_revenue - top10Revenue;

        const hasOthers = othersRevenue > 0;
        if (hasOthers) {
            top10.unshift({ name: 'Others', revenue: othersRevenue, id: 'other/others' });
        }

        const totalRev = latestData.total_revenue;
        const modelNames = top10.map(m => {
            if (m.name === 'Others' || m.id === 'other/others') return 'Others';
            const name = shortModelName(m.name || m.id);
            return name.length > 25 ? name.substring(0, 25) + '...' : name;
        });
        const revenues = top10.map(m => m.revenue);
        const shares = top10.map(m => totalRev > 0 ? (m.revenue / totalRev * 100) : 0);
        const barColors = top10.map(m => {
            if (m.id === 'other/others') return isDarkMode ? '#475569' : '#94a3b8';
            return modelColor(m.id, m.name);
        });

        const option = {
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                formatter: function (params) {
                    const value = params[0].value;
                    const modelIndex = params[0].dataIndex;
                    const fullModelData = top10[modelIndex];
                    const sharePct = shares[modelIndex].toFixed(2);
                    
                    if (fullModelData.id === 'other/others') {
                        return `
                            <strong>Others (Models 11+)</strong><br/>
                            Revenue: ${fmtCompactUSD(value)} <span style="opacity:0.6">($${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })})</span><br/>
                            Market Share: ${sharePct}%
                        `;
                    }

                    const tokens = fullModelData.total_tokens || (fullModelData.prompt_tokens + fullModelData.completion_tokens) || 0;
                    const vendor = vendorKey(fullModelData.id);
                    const vendorLabel = vendor.charAt(0).toUpperCase() + vendor.slice(1);
                    return `
                        <strong>${fullModelData.name || fullModelData.id}</strong><br/>
                        <span style="opacity:0.7">Vendor: ${vendorLabel}</span><br/>
                        Revenue: ${fmtCompactUSD(value)} <span style="opacity:0.6">($${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })})</span><br/>
                        Market Share: ${sharePct}%<br/>
                        Total Tokens: ${fmtCompactInt(tokens)}
                    `;
                },
                backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                borderColor: axisColor,
                textStyle: { color: textColor },
                confine: true
            },
            grid: {
                left: isMobile ? '2%' : '3%',
                right: isMobile ? '12%' : '14%',
                bottom: isMobile ? '5%' : '3%',
                top: 12,
                containLabel: true
            },
            toolbox: {
                right: 10,
                top: -4,
                itemSize: 15,
                feature: {
                    saveAsImage: { title: 'Save PNG', name: 'ai-top10-models', pixelRatio: 2 }
                },
                iconStyle: { borderColor: isDarkMode ? '#94a3b8' : '#475569' }
            },
            xAxis: {
                type: 'value',
                axisLine: { show: false },
                splitLine: { lineStyle: { color: axisColor, type: 'dashed' } },
                axisLabel: { 
                    color: textColor,
                    formatter: (value) => fmtCompactUSD(value)
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
                        color: function (params) {
                            return barColors[params.dataIndex];
                        }
                    },
                    label: {
                        show: true,
                        position: 'right',
                        color: textColor,
                        formatter: (params) => {
                            const sharePct = shares[params.dataIndex].toFixed(1);
                            return `${fmtCompactUSD(params.value)}  (${sharePct}%)`;
                        }
                    },
                    data: revenues
                }
            ]
        };

        rankingChart.setOption(option, true);
    }

    function renderModelTrendChart(data) {
        if (!modelTrendChart || !data || data.length === 0) return;

        const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const textColor = isDarkMode ? '#e2e8f0' : '#1e293b';
        const axisColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        const isMobile = window.innerWidth <= 768;

        // Reset vendor shade cache for deterministic colors
        Object.keys(_vendorShadeCache).forEach(k => delete _vendorShadeCache[k]);

        const dates = data.map(item => item.date);
        
        // 1. Calculate overall revenue for all models across this timeframe
        const overallModelRev = {};
        const modelNamesMap = {}; // mapping id to name
        
        data.forEach(day => {
            if (day.models) {
                day.models.forEach(m => {
                    if (!overallModelRev[m.id]) {
                        overallModelRev[m.id] = 0;
                        modelNamesMap[m.id] = shortModelName(m.name || m.id);
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
                // null => line breaks (model dropped out of Top 20 that day), not 0
                return modelInDay ? modelInDay.revenue : null;
            });
            // connectNulls=false so missing Top20 days show as gaps, not dips to 0

            const color = modelColor(id, modelName);
            // xAI's pure black is invisible in dark mode — bump to slate
            const lineColor = (color === '#0f0f0f' && isDarkMode) ? '#94a3b8' : color;

            seriesData.push({
                name: modelName,
                type: 'line',
                symbol: 'none',
                sampling: 'lttb',
                connectNulls: false,
                lineStyle: { width: 2.2, color: lineColor },
                itemStyle: { color: lineColor },
                emphasis: { focus: 'series' },
                data: seriesRevenues
            });
        });

        // Default zoom: last 60 points
        const zoomStart = data.length > 60 ? Math.max(0, 100 - (60 / data.length) * 100) : 0;
        const zoomEnd = 100;

        const option = {
            tooltip: {
                trigger: 'axis',
                backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                borderColor: axisColor,
                textStyle: { color: textColor },
                confine: true,
                valueFormatter: (value) => fmtCompactUSD(value)
            },
            legend: {
                type: 'scroll',
                orient: isMobile ? 'horizontal' : 'vertical',
                right: isMobile ? 'center' : 6,
                bottom: isMobile ? 0 : 'auto',
                top: isMobile ? 'auto' : 'middle',
                data: legendData,
                selected: selected,
                // Show total revenue alongside name so users can pick the biggest at a glance
                formatter: function (name) {
                    const id = top20ModelIds.find(i => modelNamesMap[i] === name);
                    const total = id ? overallModelRev[id] : 0;
                    const totalStr = fmtCompactUSD(total);
                    const truncName = name.length > 22 ? name.substring(0, 22) + '...' : name;
                    return `${truncName}  {sub|${totalStr}}`;
                },
                textStyle: {
                    color: textColor,
                    fontSize: 11,
                    rich: {
                        sub: { fontSize: 10, color: isDarkMode ? '#94a3b8' : '#64748b' }
                    }
                }
            },
            grid: {
                left: isMobile ? '2%' : '3%',
                right: isMobile ? '5%' : 230,
                bottom: isMobile ? '20%' : '12%',
                top: 12,
                containLabel: true
            },
            toolbox: {
                right: 10,
                top: -4,
                itemSize: 15,
                feature: {
                    dataZoom: { yAxisIndex: 'none', title: { zoom: 'Zoom', back: 'Reset' } },
                    saveAsImage: { title: 'Save PNG', name: 'ai-models-trend', pixelRatio: 2 }
                },
                iconStyle: { borderColor: isDarkMode ? '#94a3b8' : '#475569' }
            },
            dataZoom: [
                { type: 'inside', start: zoomStart, end: zoomEnd },
                {
                    type: 'slider',
                    start: zoomStart,
                    end: zoomEnd,
                    height: 18,
                    bottom: 4,
                    borderColor: 'transparent',
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                    fillerColor: isDarkMode ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.15)',
                    handleStyle: { color: '#3b82f6', borderColor: '#3b82f6' },
                    textStyle: { color: textColor, fontSize: 10 },
                    dataBackground: {
                        lineStyle: { color: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' },
                        areaStyle: { color: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }
                    }
                }
            ],
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
                    formatter: (value) => fmtCompactUSD(value)
                }
            },
            series: seriesData
        };

        modelTrendChart.setOption(option, true);
    }

    // --- Total market usage trend (token volume) -----------------------------
    function renderUsageTrendChart(data) {
        if (!usageTrendChart || !data || data.length === 0) return;

        const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const textColor = isDarkMode ? '#e2e8f0' : '#1e293b';
        const axisColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        const isMobile = window.innerWidth <= 768;

        const dates = data.map(item => item.date);
        // Sum total_tokens across models per day (some days may already aggregate, but to be safe)
        const usages = data.map(item => {
            if (item.models && item.models.length > 0) {
                return item.models.reduce((s, m) => s + (m.total_tokens || 0), 0);
            }
            return 0;
        });

        const zoomEnd = 100;
        const zoomStart = data.length > 60 ? Math.max(0, 100 - (60 / data.length) * 100) : 0;

        const option = {
            tooltip: {
                trigger: 'axis',
                formatter: function (params) {
                    const dataIndex = params[0].dataIndex;
                    const item = data[dataIndex];
                    const value = usages[dataIndex];
                    let html = `<div style="margin-bottom: 8px; border-bottom: 1px solid ${axisColor}; padding-bottom: 8px;">`;
                    html += `<strong style="font-size: 1.1em;">${item.date}</strong><br/>`;
                    html += `Total Usage: <span style="font-weight: 600;">${fmtCompactInt(value)}</span>`;
                    html += ` <span style="opacity:0.6; font-size:0.9em;">(${value.toLocaleString('en-US')} tokens)</span>`;
                    html += `</div>`;

                    if (item.models && item.models.length > 0) {
                        // Sort by tokens desc for the tooltip
                        const sorted = [...item.models].sort((a, b) => (b.total_tokens || 0) - (a.total_tokens || 0));
                        html += `<div style="font-size: 0.85em; line-height: 1.5;">`;
                        const limit = Math.min(10, sorted.length);
                        let top10Tokens = 0;
                        for (let i = 0; i < limit; i++) {
                            const m = sorted[i];
                            const t = m.total_tokens || 0;
                            top10Tokens += t;
                            const name = shortModelName(m.name || m.id);
                            const truncName = name.length > 25 ? name.substring(0, 25) + '...' : name;
                            const sharePct = value > 0 ? (t / value * 100).toFixed(1) : '0.0';
                            html += `<div style="display: flex; justify-content: space-between; gap: 16px;">
                                        <span style="opacity: 0.9;">${i+1}. ${truncName}</span>
                                        <span style="font-weight: 600;">${fmtCompactInt(t)} <span style="opacity:0.6; font-size:0.9em">(${sharePct}%)</span></span>
                                     </div>`;
                        }

                        const othersTokens = value - top10Tokens;
                        if (othersTokens > 0) {
                            const othersPct = value > 0 ? (othersTokens / value * 100).toFixed(1) : '0.0';
                            html += `<div style="display: flex; justify-content: space-between; gap: 16px; margin-top: 4px; padding-top: 4px; border-top: 1px dashed rgba(128,128,128,0.4);">
                                        <span style="opacity: 0.8; font-style: italic;">11+. Others</span>
                                        <span style="font-weight: 600; opacity: 0.8;">${fmtCompactInt(othersTokens)} <span style="opacity:0.6; font-size:0.9em">(${othersPct}%)</span></span>
                                     </div>`;
                        }
                        html += `</div>`;
                    }
                    return html;
                },
                backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                borderColor: axisColor,
                textStyle: { color: textColor },
                confine: true
            },
            grid: {
                left: isMobile ? '2%' : '3%',
                right: isMobile ? '5%' : '4%',
                bottom: isMobile ? '15%' : '12%',
                top: 12,
                containLabel: true
            },
            toolbox: {
                right: 10,
                top: -4,
                itemSize: 15,
                feature: {
                    dataZoom: { yAxisIndex: 'none', title: { zoom: 'Zoom', back: 'Reset' } },
                    saveAsImage: { title: 'Save PNG', name: 'ai-market-usage-trend', pixelRatio: 2 }
                },
                iconStyle: { borderColor: isDarkMode ? '#94a3b8' : '#475569' }
            },
            dataZoom: [
                { type: 'inside', start: zoomStart, end: zoomEnd },
                {
                    type: 'slider',
                    start: zoomStart,
                    end: zoomEnd,
                    height: 18,
                    bottom: 4,
                    borderColor: 'transparent',
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                    fillerColor: isDarkMode ? 'rgba(16,163,127,0.2)' : 'rgba(16,163,127,0.15)',
                    handleStyle: { color: '#10a37f', borderColor: '#10a37f' },
                    textStyle: { color: textColor, fontSize: 10 },
                    dataBackground: {
                        lineStyle: { color: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' },
                        areaStyle: { color: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }
                    }
                }
            ],
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
                    formatter: (value) => fmtCompactInt(value)
                }
            },
            series: [
                {
                    name: 'Usage',
                    type: 'line',
                    symbol: 'circle',
                    symbolSize: 6,
                    showSymbol: false,
                    sampling: 'lttb',
                    itemStyle: { color: '#10a37f' },
                    lineStyle: { width: 2.5 },
                    emphasis: { focus: 'series', scale: 1.4 },
                    data: usages
                }
            ]
        };

        usageTrendChart.setOption(option, true);
    }

    // --- Top models usage trend (multi-line, color-coded by vendor) ----------
    function renderModelUsageTrendChart(data) {
        if (!modelUsageTrendChart || !data || data.length === 0) return;

        const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const textColor = isDarkMode ? '#e2e8f0' : '#1e293b';
        const axisColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        const isMobile = window.innerWidth <= 768;

        // Reset vendor shade cache for deterministic colors
        Object.keys(_vendorShadeCache).forEach(k => delete _vendorShadeCache[k]);

        const dates = data.map(item => item.date);

        // 1. Aggregate total tokens per model across the timeframe
        const overallModelTokens = {};
        const modelNamesMap = {};

        data.forEach(day => {
            if (day.models) {
                day.models.forEach(m => {
                    const t = m.total_tokens || 0;
                    if (!overallModelTokens[m.id]) {
                        overallModelTokens[m.id] = 0;
                        modelNamesMap[m.id] = shortModelName(m.name || m.id);
                    }
                    overallModelTokens[m.id] += t;
                });
            }
        });

        // 2. Top 20 models by token usage
        const top20ModelIds = Object.keys(overallModelTokens)
            .sort((a, b) => overallModelTokens[b] - overallModelTokens[a])
            .slice(0, 20);

        // 3. Build series + legend
        const seriesData = [];
        const legendData = [];
        const selected = {};

        top20ModelIds.forEach((id, index) => {
            const modelName = modelNamesMap[id];
            legendData.push(modelName);
            selected[modelName] = index < 5;

            const seriesTokens = data.map(day => {
                const modelInDay = day.models ? day.models.find(m => m.id === id) : null;
                // null => line breaks (model dropped out of Top 20 that day), not 0
                return modelInDay ? (modelInDay.total_tokens || 0) : null;
            });

            const color = modelColor(id, modelName);
            const lineColor = (color === '#0f0f0f' && isDarkMode) ? '#94a3b8' : color;

            seriesData.push({
                name: modelName,
                type: 'line',
                symbol: 'none',
                sampling: 'lttb',
                connectNulls: false,
                lineStyle: { width: 2.2, color: lineColor },
                itemStyle: { color: lineColor },
                emphasis: { focus: 'series' },
                data: seriesTokens
            });
        });

        const zoomStart = data.length > 60 ? Math.max(0, 100 - (60 / data.length) * 100) : 0;
        const zoomEnd = 100;

        const option = {
            tooltip: {
                trigger: 'axis',
                backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                borderColor: axisColor,
                textStyle: { color: textColor },
                confine: true,
                valueFormatter: (value) => fmtCompactInt(value)
            },
            legend: {
                type: 'scroll',
                orient: isMobile ? 'horizontal' : 'vertical',
                right: isMobile ? 'center' : 6,
                bottom: isMobile ? 0 : 'auto',
                top: isMobile ? 'auto' : 'middle',
                data: legendData,
                selected: selected,
                formatter: function (name) {
                    const id = top20ModelIds.find(i => modelNamesMap[i] === name);
                    const total = id ? overallModelTokens[id] : 0;
                    const totalStr = fmtCompactInt(total);
                    const truncName = name.length > 22 ? name.substring(0, 22) + '...' : name;
                    return `${truncName}  {sub|${totalStr}}`;
                },
                textStyle: {
                    color: textColor,
                    fontSize: 11,
                    rich: {
                        sub: { fontSize: 10, color: isDarkMode ? '#94a3b8' : '#64748b' }
                    }
                }
            },
            grid: {
                left: isMobile ? '2%' : '3%',
                right: isMobile ? '5%' : 230,
                bottom: isMobile ? '20%' : '12%',
                top: 12,
                containLabel: true
            },
            toolbox: {
                right: 10,
                top: -4,
                itemSize: 15,
                feature: {
                    dataZoom: { yAxisIndex: 'none', title: { zoom: 'Zoom', back: 'Reset' } },
                    saveAsImage: { title: 'Save PNG', name: 'ai-models-usage-trend', pixelRatio: 2 }
                },
                iconStyle: { borderColor: isDarkMode ? '#94a3b8' : '#475569' }
            },
            dataZoom: [
                { type: 'inside', start: zoomStart, end: zoomEnd },
                {
                    type: 'slider',
                    start: zoomStart,
                    end: zoomEnd,
                    height: 18,
                    bottom: 4,
                    borderColor: 'transparent',
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                    fillerColor: isDarkMode ? 'rgba(16,163,127,0.2)' : 'rgba(16,163,127,0.15)',
                    handleStyle: { color: '#10a37f', borderColor: '#10a37f' },
                    textStyle: { color: textColor, fontSize: 10 },
                    dataBackground: {
                        lineStyle: { color: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' },
                        areaStyle: { color: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }
                    }
                }
            ],
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
                    formatter: (value) => fmtCompactInt(value)
                }
            },
            series: seriesData
        };

        modelUsageTrendChart.setOption(option, true);
    }

    async function init() {
        initCharts();
        const data = await fetchData();
        if (data && data.length > 0) {
            rawData = data;
            const latestData = data[data.length - 1];
            const prevData = data.length > 1 ? data[data.length - 2] : null;
            updateStatsCards(latestData, prevData);
            renderTrendChart(rawData);
            renderModelTrendChart(rawData);
            renderRankingChart(latestData);
            renderUsageTrendChart(rawData);
            renderModelUsageTrendChart(rawData);
            
            // Setup toggle buttons
            const buttons = document.querySelectorAll('#timeframe-toggle button');
            const activateBtn = (target) => {
                buttons.forEach(b => {
                    b.classList.remove('active');
                    b.style.border = '1px solid transparent';
                    b.style.background = 'transparent';
                    b.style.boxShadow = 'none';
                    b.style.color = '';
                    b.style.fontWeight = '';
                });
                target.classList.add('active');
                const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (isDark) {
                    target.style.border = '1px solid rgba(255,255,255,0.2)';
                    target.style.background = 'rgba(255,255,255,0.1)';
                    target.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)';
                } else {
                    target.style.border = '1px solid rgba(0,0,0,0.12)';
                    target.style.background = 'rgba(255,255,255,0.85)';
                    target.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                }
                target.style.color = 'var(--accent)';
                target.style.fontWeight = '600';
            };
            buttons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    activateBtn(e.currentTarget);
                    currentTimeframe = e.currentTarget.getAttribute('data-tf');
                    
                    if (currentTimeframe === 'weekly') {
                        const weeklyData = aggregateWeeklyData(rawData);
                        renderTrendChart(weeklyData);
                        renderModelTrendChart(weeklyData);
                        renderUsageTrendChart(weeklyData);
                        renderModelUsageTrendChart(weeklyData);
                        // Update card deltas to use the previous *week* rather than previous *day*
                        if (weeklyData.length > 1) {
                            updateStatsCards(weeklyData[weeklyData.length - 1], weeklyData[weeklyData.length - 2]);
                        }
                    } else {
                        renderTrendChart(rawData);
                        renderModelTrendChart(rawData);
                        renderUsageTrendChart(rawData);
                        renderModelUsageTrendChart(rawData);
                        updateStatsCards(latestData, prevData);
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
                renderUsageTrendChart(weeklyData);
                renderModelUsageTrendChart(weeklyData);
            } else {
                renderTrendChart(rawData);
                renderModelTrendChart(rawData);
                renderUsageTrendChart(rawData);
                renderModelUsageTrendChart(rawData);
            }
            renderRankingChart(rawData[rawData.length - 1]);
        }
    });
});
