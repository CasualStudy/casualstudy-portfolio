document.addEventListener("DOMContentLoaded", async () => {
    let currentLang = localStorage.getItem("siteLang") || "en";

    // 监听语言切换
    window.addEventListener('languageChanged', () => {
        currentLang = localStorage.getItem("siteLang") || "en";
        renderAll();
    });

    const getIsDark = () => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    let rawData = null;
    let indexChart = null;
    let productChart = null;
    let selectedCategory = "all";

    try {
        const res = await fetch("data/cfm_data.json");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        rawData = await res.json();
    } catch (e) {
        console.error("Failed to load CFM data:", e);
        return;
    }

    const t = (en, zh) => currentLang === "zh" ? zh : en;

    // ========== 产业链档位映射 ==========
    // 每个分类对应的产业链信息：档位、卖方、买方、价格规律
    const CHAIN_MAP = {
        "Flash Wafer": {
            tier: 1,
            sellers: { en: "Five NAND fabricators (Samsung, SK Hynix, Micron, Kioxia, WD/SanDisk) spot wafer outside long-term contracts.", zh: "五大 NAND 原厂（三星、海力士、美光、铠侠、西数/闪迪）在合约之外的现货出货。" },
            buyers: { en: "Module makers topping up inventory + Huaqiangbei traders flipping stock.", zh: "模组厂临时补货 + 华强北贸易商倒库。" },
            logic: { en: "Leading indicator for contract prices (1-2 quarters ahead). Supply = fab utilization & cuts; demand = phone/PC/server shipments.", zh: "合约价的领先指标（领先 1-2 个季度）。供给看原厂产能利用率与减产；需求看手机/PC/服务器出货。" }
        },
        "DDR": {
            tier: 1,
            sellers: { en: "Three DRAM oligopolists (Samsung, SK Hynix, Micron) spot chips; eTT from Nanya/Winbond.", zh: "DRAM 三大寡头（三星、海力士、美光）现货颗粒；eTT 降级片来自南亚、华邦。" },
            buyers: { en: "Module makers (Longsys, ADATA, Biwin, Transcend, Innodisk) + Huaqiangbei traders.", zh: "模组厂（江波龙、威刚、佰维、创见、宜鼎）+ 华强北贸易商。" },
            logic: { en: "Leading indicator for DRAM contract prices. eTT (downgrade chips) are cheaper and more volatile.", zh: "DRAM 合约价的领先指标。eTT 降级片价格更低、波动更大。" }
        },
        "LPDDR": {
            tier: 1,
            sellers: { en: "Three DRAM oligopolists (Samsung, SK Hynix, Micron) spot LPDDR chips.", zh: "DRAM 三大寡头（三星、海力士、美光）现货 LPDDR 颗粒。" },
            buyers: { en: "Phone/tablet OEMs and some module traders.", zh: "手机/平板品牌厂及部分模组贸易商。" },
            logic: { en: "Tracks DDR spot with mobile-demand premium. Annual LTA volume.", zh: "跟随 DDR 现货但有手机需求溢价。量大走年度长协。" }
        },
        "eMMC": {
            tier: 2,
            sellers: { en: "Five fabricators (packaging outsourced to ASE, PTI, JCET, UTAC, SPIL, TSH).", zh: "五大原厂（封测外包给日月光、力成、长电、华泰、通富微电、华天）。" },
            buyers: { en: "Phone/tablet OEMs (Xiaomi, OPPO, vivo, Honor) + module traders.", zh: "手机/平板品牌厂（小米、OPPO、vivo、荣耀）+ 模组贸易商。" },
            logic: { en: "Follows wafer cost with a lag. Volume goes through annual LTAs.", zh: "跟随颗粒成本但滞后。量大走年度长协。" }
        },
        "eMCP": {
            tier: 2,
            sellers: { en: "Five fabricators (combo package: NAND + LPDDR).", zh: "五大原厂（合封产品：NAND + LPDDR）。" },
            buyers: { en: "Phone OEMs needing integrated storage + memory.", zh: "需要存储+内存一体方案的手机品牌厂。" },
            logic: { en: "Combo package, higher unit price, less volatile.", zh: "合封产品，单价更高、波动更小。" }
        },
        "UFS": {
            tier: 2,
            sellers: { en: "Four fab brands (Samsung, SK Hynix, Micron, Kioxia) UFS chips.", zh: "四大原厂品牌（三星、海力士、美光、铠侠）UFS 芯片。" },
            buyers: { en: "Mid-to-high-end phone OEMs (UFS replaces eMMC).", zh: "中高端手机品牌厂（UFS 替代 eMMC）。" },
            logic: { en: "Follows wafer cost; higher-speed spec = premium over eMMC.", zh: "跟随颗粒成本；高速规格相对 eMMC 有溢价。" }
        },
        "uMCP": {
            tier: 2,
            sellers: { en: "Three fab brands (Samsung, SK Hynix, Micron) combo package (LPDDR + UFS).", zh: "三大原厂品牌（三星、海力士、美光）合封产品（LPDDR + UFS）。" },
            buyers: { en: "Mid-range phone OEMs needing integrated storage + memory.", zh: "需要存储+内存一体方案的中端手机品牌厂。" },
            logic: { en: "Combo package, higher unit price, less volatile.", zh: "合封产品，单价更高、波动更小。" }
        },
        "内存条(服务器)": {
            tier: 3,
            sellers: { en: "Module brands (Longsys, ADATA, Biwin, Innodisk) + original brands (Samsung, Micron).", zh: "模组品牌（江波龙、威刚、佰维、宜鼎）+ 原厂品牌（三星、美光）。" },
            buyers: { en: "Server OEMs (Inspur, Lenovo, Huawei, Supermicro) + cloud datacenters.", zh: "服务器 OEM（浪潮、联想、华为、超微）+ 云数据中心。" },
            logic: { en: "Lags DRAM chip cost 1-2 months. RDIMM/ECC specs command premium. AI server demand drives DDR5 RDIMM.", zh: "滞后 DRAM 颗粒成本 1-2 月。RDIMM/ECC 规格有溢价。AI 服务器需求拉动 DDR5 RDIMM。" }
        },
        "内存条(渠道)": {
            tier: 3,
            sellers: { en: "Module brands (Longsys, ADATA, Biwin, Transcend, Netac) + original brands.", zh: "模组品牌（江波龙、威刚、佰维、创见、朗科）+ 原厂品牌。" },
            buyers: { en: "Retail / wholesale channels (consumer PC upgrades, SI).", zh: "零售/批发渠道（消费级 PC 升级、组装商）。" },
            logic: { en: "Lags chip cost 1-2 months. Thin margins (5-15%). Channel prices swing more than industry.", zh: "滞后颗粒成本 1-2 月。毛利薄（5-15%）。渠道价波动比行业价大。" }
        },
        "内存条(行业)": {
            tier: 3,
            sellers: { en: "Module brands (Longsys, ADATA, Biwin, Transcend, Innodisk).", zh: "模组品牌（江波龙、威刚、佰维、创见、宜鼎）。" },
            buyers: { en: "Brand OEMs spot buys (PC/server makers).", zh: "品牌厂 OEM 现货采购（PC/服务器制造商）。" },
            logic: { en: "Lags chip cost 1-2 months. Industry prices are stickier than channel.", zh: "滞后颗粒成本 1-2 月。行业价比渠道价更黏。" }
        },
        "SSD(渠道)": {
            tier: 3,
            sellers: { en: "Module brands (Longsys, Biwin, TWSC, Maxio, Daspeed) + original brands (Samsung, WD, SanDisk). Controllers: Phison, SMI, Maxio, ASolid.", zh: "模组品牌（江波龙、佰维、德明利、大普微、大为）+ 原厂品牌（三星、西数、闪迪）。主控：群联、慧荣、联芸、点序。" },
            buyers: { en: "Retail / consumer market (PC upgrades, DIY).", zh: "零售/消费市场（PC 升级、DIY）。" },
            logic: { en: "Lags wafer cost 1-2 months. Thin margins. Channel prices swing more than industry.", zh: "滞后颗粒成本 1-2 月。毛利薄。渠道价波动比行业价大。" }
        },
        "SSD(行业)": {
            tier: 3,
            sellers: { en: "Module brands (Longsys, Biwin, TWSC, Maxio) + original brands. Controllers: Phison, SMI, Maxio, ASolid.", zh: "模组品牌（江波龙、佰维、德明利、大普微）+ 原厂品牌。主控：群联、慧荣、联芸、点序。" },
            buyers: { en: "Brand OEMs spot buys (PC/server makers, enterprise).", zh: "品牌厂 OEM 现货采购（PC/服务器、企业级）。" },
            logic: { en: "Lags wafer cost 1-2 months. Industry prices are stickier than channel.", zh: "滞后颗粒成本 1-2 月。行业价比渠道价更黏。" }
        },
        "闪存卡": {
            tier: 3,
            sellers: { en: "SanDisk (original) + module brands (Longsys, ADATA, Netac).", zh: "闪迪（原厂）+ 模组品牌（江波龙、威刚、朗科）。" },
            buyers: { en: "Retail / consumer (camera, dashcam, phone storage).", zh: "零售/消费市场（相机、行车记录仪、手机存储卡）。" },
            logic: { en: "Lags wafer cost. Branded premium. RMB-denominated (domestic circulation).", zh: "滞后颗粒成本。品牌溢价。人民币计价（国内流通）。" }
        },
        "USB 2.0": {
            tier: 3,
            sellers: { en: "Module brands (Longsys, ADATA, Netac). Controllers: Phison, SMI.", zh: "模组品牌（江波龙、威刚、朗科）。主控：群联、慧荣。" },
            buyers: { en: "Retail / consumer (promo gifts, low-end storage).", zh: "零售/消费市场（礼品促销、低端存储）。" },
            logic: { en: "Lags wafer cost. Low-end, thin margins. RMB-denominated.", zh: "滞后颗粒成本。低端产品、毛利薄。人民币计价。" }
        },
        "USB 3.0": {
            tier: 3,
            sellers: { en: "Module brands (Longsys, ADATA, Netac). Controllers: Phison, SMI.", zh: "模组品牌（江波龙、威刚、朗科）。主控：群联、慧荣。" },
            buyers: { en: "Retail / consumer (mainstream portable storage).", zh: "零售/消费市场（主流便携存储）。" },
            logic: { en: "Lags wafer cost. Higher spec than USB 2.0. RMB-denominated.", zh: "滞后颗粒成本。规格高于 USB 2.0。人民币计价。" }
        }
    };

    function getChainInfo(category) {
        return CHAIN_MAP[category];
    }

    function updateProductContext(product) {
        const el = document.getElementById('product-context');
        if (!el) return;
        const info = getChainInfo(product.category);
        if (!info) {
            el.classList.remove('show');
            el.innerHTML = '';
            return;
        }
        const tierLabels = {
            1: { en: "TIER 1 · UPSTREAM", zh: "第一档 · 上游" },
            2: { en: "TIER 2 · MIDSTREAM", zh: "第二档 · 中游" },
            3: { en: "TIER 3 · DOWNSTREAM", zh: "第三档 · 下游" }
        };
        const tierNames = {
            1: { en: "Bare Wafer / Chip Spot", zh: "原厂颗粒现货" },
            2: { en: "Packaged IC (BGA)", zh: "原厂封装芯片" },
            3: { en: "Module / Finished Goods", zh: "模组成品" }
        };
        const tl = tierLabels[info.tier];
        const tn = tierNames[info.tier];
        el.innerHTML = `
            <div class="pc-head">
                <span class="pc-tier-badge t${info.tier}">${t(tl.en, tl.zh)}</span>
                <span class="pc-name">${t(tn.en, tn.zh)}</span>
            </div>
            <div class="pc-grid">
                <div class="pc-item">
                    <div class="pc-label">${t("Sellers", "卖方")}</div>
                    <div class="pc-value">${t(info.sellers.en, info.sellers.zh)}</div>
                </div>
                <div class="pc-item">
                    <div class="pc-label">${t("Buyers", "买方")}</div>
                    <div class="pc-value">${t(info.buyers.en, info.buyers.zh)}</div>
                </div>
                <div class="pc-item">
                    <div class="pc-label">${t("Price Logic", "价格规律")}</div>
                    <div class="pc-value">${t(info.logic.en, info.logic.zh)}</div>
                </div>
            </div>
        `;
        el.classList.add('show');
    }

    // ========== 更新统计卡片 ==========
    function updateStats() {
        const nand = rawData.index.NAND || [];
        const dram = rawData.index.DRAM || [];
        const products = Object.keys(rawData.products);

        if (nand.length > 0) {
            const latest = nand[nand.length - 1];
            const prev = nand.length > 1 ? nand[nand.length - 2] : null;
            document.getElementById("stat-nand").textContent = latest.index.toFixed(2);
            const chgEl = document.getElementById("stat-nand-change");
            if (prev) {
                const chg = latest.index - prev.index;
                const pct = (chg / prev.index * 100).toFixed(2);
                chgEl.textContent = `${chg >= 0 ? "+" : ""}${chg.toFixed(2)} (${pct}%)`;
                chgEl.className = "stat-change " + (chg > 0 ? "up" : chg < 0 ? "down" : "flat");
            }
        }

        if (dram.length > 0) {
            const latest = dram[dram.length - 1];
            const prev = dram.length > 1 ? dram[dram.length - 2] : null;
            document.getElementById("stat-dram").textContent = latest.index.toFixed(2);
            const chgEl = document.getElementById("stat-dram-change");
            if (prev) {
                const chg = latest.index - prev.index;
                const pct = (chg / prev.index * 100).toFixed(2);
                chgEl.textContent = `${chg >= 0 ? "+" : ""}${chg.toFixed(2)} (${pct}%)`;
                chgEl.className = "stat-change " + (chg > 0 ? "up" : chg < 0 ? "down" : "flat");
            }
        }

        const allDates = [...nand.map(d => d.date), ...dram.map(d => d.date)].sort();
        if (allDates.length > 0) {
            document.getElementById("stat-date").textContent = allDates[allDates.length - 1];
            document.getElementById("stat-range").textContent =
                `${allDates[0]} ~ ${allDates[allDates.length - 1]}`;
        }

        document.getElementById("stat-products").textContent = products.length;
    }

    // ========== 价格指数图表 ==========
    function renderIndexChart() {
        const chartDom = document.getElementById('index-chart');
        indexChart = echarts.init(chartDom);
        const isDark = getIsDark();

        const nand = rawData.index.NAND || [];
        const dram = rawData.index.DRAM || [];

        const textColor = isDark ? '#e2e8f0' : '#1e293b';
        const subColor = isDark ? '#94a3b8' : '#64748b';

        indexChart.setOption({
            backgroundColor: 'transparent',
            animation: false,
            tooltip: {
                trigger: 'axis',
                backgroundColor: isDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.98)',
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                borderWidth: 1,
                textStyle: { color: textColor, fontSize: 12 },
                valueFormatter: v => v != null ? Number(v).toFixed(2) : '-'
            },
            legend: {
                data: [t('NAND Index', 'NAND 指数'), t('DRAM Index', 'DRAM 指数')],
                textStyle: { color: subColor, fontSize: 12 },
                top: 0
            },
            grid: { left: '3%', right: '4%', top: '12%', bottom: '15%', containLabel: true },
            xAxis: {
                type: 'category',
                data: nand.map(d => d.date),
                axisLine: { lineStyle: { color: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' } },
                axisLabel: { color: subColor, fontSize: 11, rotate: 35 }
            },
            yAxis: {
                type: 'value',
                scale: true,
                axisLine: { show: false },
                splitLine: { lineStyle: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' } },
                axisLabel: { color: subColor, fontSize: 11 }
            },
            dataZoom: [
                { type: 'inside', start: 0, end: 100 },
                { type: 'slider', start: 0, end: 100, height: 20, bottom: 8,
                  textStyle: { color: subColor } }
            ],
            series: [
                {
                    name: t('NAND Index', 'NAND 指数'),
                    type: 'line',
                    data: nand.map(d => d.index),
                    smooth: true,
                    symbol: 'circle',
                    symbolSize: 5,
                    lineStyle: { width: 2.5, color: '#0071e3' },
                    itemStyle: { color: '#0071e3' },
                    areaStyle: {
                        color: {
                            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                            colorStops: [
                                { offset: 0, color: 'rgba(0,113,227,0.18)' },
                                { offset: 1, color: 'rgba(0,113,227,0)' }
                            ]
                        }
                    }
                },
                {
                    name: t('DRAM Index', 'DRAM 指数'),
                    type: 'line',
                    data: dram.map(d => d.index),
                    smooth: true,
                    symbol: 'circle',
                    symbolSize: 5,
                    lineStyle: { width: 2.5, color: '#34c759' },
                    itemStyle: { color: '#34c759' },
                    areaStyle: {
                        color: {
                            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                            colorStops: [
                                { offset: 0, color: 'rgba(52,199,89,0.18)' },
                                { offset: 1, color: 'rgba(52,199,89,0)' }
                            ]
                        }
                    }
                }
            ]
        });
    }

    // ========== 分类筛选 + 产品选择 ==========
    function getCategories() {
        const cats = new Set();
        Object.values(rawData.products).forEach(p => cats.add(p.category));
        return ["all", ...Array.from(cats).sort()];
    }

    function renderCategoryFilter() {
        const container = document.getElementById('category-filter');
        const cats = getCategories().filter(c => c !== "all");

        // 按 tier 分组
        const tiers = [
            { tier: 1, label: { en: "Tier 1 · Upstream", zh: "第一档 · 上游" }, cats: [] },
            { tier: 2, label: { en: "Tier 2 · Midstream", zh: "第二档 · 中游" }, cats: [] },
            { tier: 3, label: { en: "Tier 3 · Downstream", zh: "第三档 · 下游" }, cats: [] }
        ];
        cats.forEach(cat => {
            const info = getChainInfo(cat);
            const tierNum = info ? info.tier : 3;
            tiers.find(g => g.tier === tierNum)?.cats.push(cat);
        });

        let html = `<button class="filter-btn ${selectedCategory === "all" ? "active" : ""}" data-cat="all">${t("All", "全部")}</button>`;
        tiers.forEach(group => {
            if (group.cats.length === 0) return;
            html += `<span class="tier-separator">${t(group.label.en, group.label.zh)}</span>`;
            group.cats.forEach(cat => {
                const active = selectedCategory === cat ? "active" : "";
                html += `<button class="filter-btn ${active}" data-cat="${cat}">${cat}</button>`;
            });
        });
        container.innerHTML = html;

        container.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                selectedCategory = btn.dataset.cat;
                renderCategoryFilter();
                renderProductSelect();
            });
        });
    }

    function getFilteredProducts() {
        return Object.entries(rawData.products)
            .filter(([_, p]) => selectedCategory === "all" || p.category === selectedCategory)
            .map(([id, p]) => ({ id, ...p }));
    }

    function renderProductSelect() {
        const sel = document.getElementById('product-select');
        const prods = getFilteredProducts();
        sel.innerHTML = prods.map(p =>
            `<option value="${p.id}">${p.category} | ${p.product}</option>`
        ).join('');

        // 保留之前的选择如果在筛选范围内
        if (sel.value) renderProductChart(sel.value);

        sel.addEventListener('change', () => renderProductChart(sel.value));
    }

    function renderProductChart(productId) {
        const p = rawData.products[productId];
        if (!p) return;

        // 更新产业链上下文卡片
        updateProductContext(p);

        if (!productChart) {
            productChart = echarts.init(document.getElementById('product-chart'));
        }
        const isDark = getIsDark();
        const textColor = isDark ? '#e2e8f0' : '#1e293b';
        const subColor = isDark ? '#94a3b8' : '#64748b';

        const dates = p.history.map(h => h[0]);
        const closes = p.history.map(h => h[3]);
        const opens = p.history.map(h => h[2]);
        const lows = p.history.map(h => h[1]);

        const hasOHLC = opens.some(v => v != null);

        const series = [];
        if (hasOHLC) {
            // 有开高低收 -> K线图
            series.push({
                name: 'KLine',
                type: 'candlestick',
                data: p.history.map(h => [h[2], h[3], h[1], h[3]]), // open, close, low, close
                itemStyle: {
                    color: '#e53935',        // 涨色（红）
                    color0: '#43a047',       // 跌色（绿）
                    borderColor: '#e53935',
                    borderColor0: '#43a047'
                }
            });
        } else {
            // 只有收盘价 -> 折线图
            series.push({
                name: t('Close', '收盘价'),
                type: 'line',
                data: closes,
                smooth: true,
                symbol: 'circle',
                symbolSize: 4,
                lineStyle: { width: 2.5, color: '#0071e3' },
                itemStyle: { color: '#0071e3' },
                areaStyle: {
                    color: {
                        type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [
                            { offset: 0, color: 'rgba(0,113,227,0.18)' },
                            { offset: 1, color: 'rgba(0,113,227,0)' }
                        ]
                    }
                }
            });
        }

        productChart.setOption({
            backgroundColor: 'transparent',
            animation: false,
            title: {
                text: `${p.category} | ${p.product}`,
                left: 'center',
                textStyle: { color: textColor, fontSize: 14, fontWeight: 600 }
            },
            tooltip: {
                trigger: 'axis',
                backgroundColor: isDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.98)',
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                borderWidth: 1,
                textStyle: { color: textColor, fontSize: 12 }
            },
            grid: { left: '3%', right: '4%', top: '15%', bottom: '15%', containLabel: true },
            xAxis: {
                type: 'category',
                data: dates,
                axisLine: { lineStyle: { color: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' } },
                axisLabel: { color: subColor, fontSize: 11, rotate: 35 }
            },
            yAxis: {
                type: 'value',
                scale: true,
                axisLine: { show: false },
                splitLine: { lineStyle: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' } },
                axisLabel: { color: subColor, fontSize: 11 }
            },
            dataZoom: [
                { type: 'inside', start: 0, end: 100 },
                { type: 'slider', start: 0, end: 100, height: 20, bottom: 8,
                  textStyle: { color: subColor } }
            ],
            series: series
        }, true);
    }

    // ========== 渲染全部 ==========
    function renderAll() {
        updateStats();
        if (!indexChart) {
            renderIndexChart();
        } else {
            renderIndexChart();
        }
        renderCategoryFilter();
        renderProductSelect();
    }

    renderAll();

    // 响应窗口大小
    window.addEventListener('resize', () => {
        if (indexChart) indexChart.resize();
        if (productChart) productChart.resize();
    });
});
