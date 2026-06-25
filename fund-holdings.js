document.addEventListener("DOMContentLoaded", () => {
    // ============ Constants ============
    const CHART_TOP_N = 10;
    const TABLE_TOP_N = 50;
    const PORTRAIT_SIZE = 140;
    const SMALL_SLIDE_THRESHOLD = 2; // % — hide outer label below this share

    // ============ Language Setup ============
    let currentLang = localStorage.getItem("siteLang") || (navigator.language.toLowerCase().includes("zh") ? "zh" : "en");

    const updateStaticTexts = () => {
        document.querySelectorAll('.lang-text').forEach(el => {
            const text = currentLang === 'zh' ? el.getAttribute('data-zh') : el.getAttribute('data-en');
            if (text) el.innerHTML = text;
        });
    };

    const langBtn = document.getElementById("lang-toggle");
    if (langBtn) {
        langBtn.addEventListener("click", () => {
            currentLang = currentLang === "en" ? "zh" : "en";
            localStorage.setItem("siteLang", currentLang);
            updateStaticTexts();
            // Re-render to update dynamic texts (chart "Others" label, meta date prefix)
            if (currentFundId) renderFundData(currentFundId);
            // Notify other components (e.g. dropdown) to refresh with new language
            window.dispatchEvent(new Event('langChanged'));
        });
    }

    updateStaticTexts();

    // ============ ECharts Instance ============
    const chartDom = document.getElementById('chart-container');
    const myChart = echarts.init(chartDom);
    myChart.showLoading({
        text: '',
        color: '#0071e3',
        textColor: '#6e6e73',
        maskColor: 'rgba(255, 255, 255, 0.4)',
        zlevel: 0
    });

    // Fund Portraits Mapping (local images to avoid hotlink protection).
    // All portraits are from Wikimedia Commons under free licenses:
    //   - pershing_square: "Bill Ackman (26410186110) (cropped).jpg" by Senate Democrats, CC BY 2.0
    //   - appaloosa: "David Tepper 01.jpg" by Appaloosa Management, CC BY-SA 3.0
    const fundPortraits = {
        'berkshire': 'assets/fund-portraits/berkshire.jpg',
        'ark': 'assets/fund-portraits/ark.jpg',
        'soros': 'assets/fund-portraits/soros.jpg',
        'bridgewater': 'assets/fund-portraits/bridgewater.jpg',
        'pershing_square': 'assets/fund-portraits/pershing_square.jpg',
        'appaloosa': 'assets/fund-portraits/appaloosa.jpg'
    };

    // Initials shown in the donut center when no portrait image is available.
    // Used for funds whose manager has no freely licensed photo.
    const fundInitials = {
        'situational_awareness': 'LA',  // Leopold Aschenbrenner
        'pershing_square': 'BA',        // Bill Ackman
        'appaloosa': 'DT',              // David Tepper
        'duquesne': 'SD',              // Stanley Druckenmiller
        'scion': 'MB',                  // Michael Burry
    };

    // Chinese names for funds (shown in dropdown when lang=zh)
    const fundNamesZh = {
        'berkshire': '伯克希尔·哈撒韦 (沃伦·巴菲特)',
        'ark': 'ARK 投资 (凯西·伍德)',
        'soros': '索罗斯基金管理',
        'bridgewater': '桥水基金 (瑞·达利欧)',
        'situational_awareness': '情境感知资本 (利奥波德·阿申布伦纳)',
        'pershing_square': '潘兴广场 (比尔·阿克曼)',
        'appaloosa': '阿帕卢萨管理 (大卫·泰珀)',
        'duquesne': '杜肯家族办公室 (斯坦利·德鲁肯米勒)',
        'scion': '赛恩资产管理 (迈克尔·伯里)'
    };

    // Chinese names for holdings, keyed by TICKER (stable, not affected by
    // 13F XML name truncation/suffix differences). Updated to cover all
    // tickers appearing in the current dataset. For holdings without a
    // ticker (ETFs/mutual funds), fall back to name-based `holdingNamesZhFallback`.
    const tickerNamesZh = {
        'AAPL': '苹果公司',
        'AXP': '美国运通',
        'BAC': '美国银行',
        'KO': '可口可乐',
        'CVX': '雪佛龙',
        'OXY': '西方石油',
        'GOOGL': '谷歌 (Alphabet)',
        'AMZN': '亚马逊',
        'MSFT': '微软',
        'NVDA': '英伟达',
        'META': 'Meta 平台',
        'TSLA': '特斯拉',
        'BRK.A': '伯克希尔·哈撒韦',
        'V': 'Visa',
        'MA': '万事达',
        'JNJ': '强生',
        'PG': '宝洁',
        'UNH': '联合健康集团',
        'XOM': '埃克森美孚',
        'JPM': '摩根大通',
        'GS': '高盛集团',
        'MS': '摩根士丹利',
        'DIS': '迪士尼',
        'NFLX': '奈飞',
        'ADBE': 'Adobe',
        'CRM': 'Salesforce',
        'ORCL': '甲骨文',
        'INTC': '英特尔',
        'CSCO': '思科',
        'QCOM': '高通',
        'AVGO': '博通',
        'AMD': '超微半导体 (AMD)',
        'TSM': '台积电',
        'COST': '好市多',
        'WMT': '沃尔玛',
        'HD': '家得宝',
        'NKE': '耐克',
        'SBUX': '星巴克',
        'MCD': '麦当劳',
        'PEP': '百事可乐',
        'BA': '波音',
        'PFE': '辉瑞',
        'ABBV': '艾伯维',
        'LLY': '礼来',
        'MRK': '默克',
        'CAT': '卡特彼勒',
        'CB': '安达保险',
        'MCO': '穆迪',
        'DVA': '达维塔',
        'VRSN': '威瑞信',
        'KHC': '卡夫亨氏',
        'C': '花旗集团',
        'PLTR': 'Palantir',
        'COIN': 'Coinbase',
        'HOOD': 'Robinhood',
        'SQ': 'Block',
        'SHOP': 'Shopify',
        'SNOW': 'Snowflake',
        'DDOG': 'Datadog',
        'MDB': 'MongoDB',
        'PATH': 'UiPath',
        'TWLO': 'Twilio',
        'TDOC': 'Teladoc',
        'ZM': 'Zoom',
        'SPOT': 'Spotify',
        'RBLX': 'Roblox',
        'DKNG': 'DraftKings',
        'RIVN': 'Rivian',
        'TEM': 'Tempus AI',
        'CRWV': 'CoreWeave',
        'CRCL': 'Circle',
        'SNDK': 'SanDisk',
        'MU': '美光科技',
        'GEV': 'GE Vernova',
        'ILMN': 'Illumina',
        'NTRA': 'Natera',
        'CRSP': 'CRISPR Therapeutics',
        'DXCM': '德康医疗',
        'TXG': '10x Genomics',
        'FOLD': 'Amicus 制药',
        'NTLA': 'Intellia 治疗',
        'RXRX': 'Recursion 制药',
        'BEAM': 'Beam 治疗',
        'TWST': 'Twist 生物科学',
        'PEN': 'Penumbra',
        'PSNL': 'Personalis',
        'VCYT': 'Veracyte',
        'VRNS': 'Varonis',
        'WGSWW': 'GeneDx',
        'BLSH': 'Bullish',
        'FIG': 'Figma',
        'MDLN': 'Medline',
        'KDKRW': 'Kodiak AI',
        'SHAZW': 'Sharonai',
        'WYFI': 'Whitefiber',
        'HTO': 'H2O America',
        'TE-WT': 'T1 Energy',
        'JOBY-WT': 'Joby Aviation',
        'ACHR-WT': 'Archer Aviation',
        'CLSKW': 'CleanSpark',
        'BMNP': 'Bitmine Immersion',
        'SHAZW': 'Sharonai Holdings',
        // Energy / Utilities / Industrial
        'NEE-PS': 'NextEra Energy',
        'NRG': 'NRG Energy',
        'CMS-PC': 'CMS Energy',
        'IDA': 'Idacorp',
        'WEC': 'WEC Energy',
        'PCG-PX': 'PG&E (太平洋煤气电力)',
        'PCAR': 'Paccar',
        'DE': '迪尔 (John Deere)',
        'UNP': '联合太平洋',
        'CSX': 'CSX 运输',
        'NUE': '纽柯钢铁',
        'LPX': '路易斯安那太平洋',
        'LEN-B': 'Lennar',
        'TPH': 'Tri Pointe Homes',
        'NVR': 'NVR',
        'FIX': 'Comfort Systems',
        'BWXT': 'BWX 科技',
        'BW-PA': '巴布科克-威尔科克斯',
        'KTOS': 'Kratos 防务',
        'LHX': 'L3Harris 科技',
        'ESLT': 'Elbit 系统',
        'AVAV': 'AeroVironment',
        'LUNR': 'Intuitive Machines',
        'RKLB': 'Rocket Lab',
        'SW': 'Smurfit Westrock',
        'STX': '希捷科技',
        'TER': 'Teradyne',
        'ITRI': 'Itron',
        'TRMB': 'Trimble',
        'SNPS': 'Synopsys',
        'KLAC': 'KLA',
        'LRCX': '泛林半导体',
        'AMAT': '应用材料',
        'ASML': 'ASML',
        'ARM': 'Arm Holdings',
        'MRVL': 'Marvell 科技',
        'ANET': 'Arista Networks',
        'LITE': 'Lumentum',
        'CRDO': 'Credo 科技',
        'CWAN': 'Clearwater Analytics',
        'BL': 'BlackLine',
        'DBX': 'Dropbox',
        'ROKU': 'Roku',
        'SNAP': 'Snap',
        'SOFI': 'SoFi',
        'TOST': 'Toast',
        'DASH': 'DoorDash',
        'EA': '电子艺界 (EA)',
        'TKO': 'TKO Group',
        'JEF': 'Jefferies',
        'WBS-PG': 'Webster Financial',
        'COF-PN': '第一资本金融',
        'CRBD': 'Corebridge Financial',
        'GPN': 'Global Payments',
        'STZ': 'Constellation Brands',
        'MO': '奥驰亚',
        'KR': '克罗格',
        'KVUE': 'Kenvue',
        'NYT': '纽约时报',
        'SIRI': 'SiriusXM',
        'LLYVK': 'Liberty Live',
        'M': '梅西百货',
        'GLW': '康宁',
        'HON': '霍尼韦尔',
        'HOLX': 'Hologic',
        'LIN': '林德',
        'NEMCL': '纽蒙特',
        'B': '巴里克黄金',
        'GTLS': 'Chart Industries',
        'SEE': '希悦尔',
        'SEII': 'Solaris Energy',
        'PSIX': 'Power Solutions',
        'PUMP': 'ProPetro',
        'CORZ': 'Core Scientific',
        'RIOT': 'Riot Platforms',
        'HIVE': 'Hive Digital',
        'IREN': 'IREN',
        'BTDR': 'Bitdeer',
        'JDCMF': '京东 (JD.com)',
        'BAIDF': '百度',
        'BBAAY': '阿里巴巴',
        'INFY': 'Infosys',
        'SE': 'Sea Ltd',
        'ARKB': 'ARK 21Shares 比特币 ETF',
        'VRT': 'Vertiv',
        'TLN': 'Talen Energy',
        'NTRA': 'Natera',
        // Remaining tickers from the dataset
        'ALLY': 'Ally 金融',
        'APH': '安费诺',
        'APLD': 'Applied Digital',
        'BE': 'Bloom Energy',
        'BHFAP': 'Brighthouse Financial',
        'BILL': 'Bill Holdings',
        'BITF': 'Bitfarms',
        'BKR': '贝克休斯',
        'CLS': 'Celestica',
        'DAL': '达美航空',
        'JAZZ': 'Jazz 制药',
        // Tickers from newly added funds (Ackman / Tepper / Druckenmiller / Burry)
        'BN': '布鲁克菲尔德',
        'UBER': '优步',
        'QSR': '餐饮品牌国际',
        'HHH': '霍华德·休斯控股',
        'SEG': '海港娱乐集团',
        'HTZWW': '赫兹全球',
        'VST': 'Vistra 能源',
        'WHR-PA': '惠而浦',
        'PDD': '拼多多',
        'RTX': '雷神技术',
        'BALL': '波尔',
        'LYFT': 'Lyft',
        'ET-PI': 'Energy Transfer',
        'MPLXP': 'MPLX',
        'DB': '德意志银行',
        'INSM': 'Insmed',
        'YPF': 'YPF (阿根廷石油)',
        'TBBB': 'BBB Foods',
        'AA': '美国铝业',
        'NAMSW': 'NewAmsterdam Pharma',
        'STMEF': '意法半导体',
        'WWD': 'Woodward',
        'TEVJF': '梯瓦制药',
        'CPNG': 'Coupang',
        'OPCH': 'Option Care Health',
        'CRH': 'CRH (建材)',
        'FGRS': 'Figure Technology',
        'CAI': 'Caris Life Sciences',
        'RVMDW': 'Revolution Medicines',
        'LSCC': 'Lattice Semiconductor',
        'UAL': '联合大陆航空',
        'HUM': '哈门那',
        'WAB': '西屋制动',
        'JBL': '捷普',
        'SCCO': '南方铜业',
        'CLF': '克利夫兰克利夫斯',
        'NUVB': 'Nuvation Bio',
        'BLT': 'Belite Bio',
        'PTGX': 'Protagonist Therapeutics',
        'U': 'Unity Software',
        'OLMA': 'Olema Pharmaceuticals',
        'Q': 'Qnity Electronics',
        'ADMA': 'ADMA Biologics',
        'XENE': 'Xenon Pharmaceuticals',
        'HAL': '哈里伯顿',
        'MOH': '莫利纳医疗',
        'LULU': '露露乐蒙',
        'SLMBP': 'SLM (Sallie Mae)',
        'BRKRP': 'Bruker',
    };

    // Fallback for holdings WITHOUT a ticker (ETFs / mutual funds whose
    // names don't resolve to a single stock). Keyed by the raw 13F name.
    const holdingNamesZhFallback = {
        'Ishares Inc': 'iShares ETF',
        'Ishares Tr': 'iShares ETF',
        'Ishares S&P Gsci Commodity-': 'iShares S&P GSCI 商品 ETF',
        'Spdr Series Trust': 'SPDR 系列 ETF',
        'Select Sector Spdr Tr': 'SPDR 行业精选 ETF',
        'State Str Spdr S&P 500 Etf T': 'SPDR 标普500 ETF',
        'Vaneck Etf Trust': 'VanEck ETF',
        'Vanguard Index Fds': '先锋指数基金',
        'Vanguard Intl Equity Index F': '先锋国际指数基金',
        'Invesco Exchange Traded Fd T': '景顺 ETF',
        'Kraneshares Trust': 'KraneShares ETF',
        'Global X Fds': 'Global X ETF',
    };

    window.addEventListener('resize', () => myChart.resize());

    // Helper: get localized holding name.
    // Priority in zh mode: ticker map > name fallback map > English name.
    // `holding` is the holding object (has .name and .ticker); we also accept
    // a bare string for convenience (used in some call sites).
    const getHoldingName = (nameOrHolding) => {
        const name = typeof nameOrHolding === 'string' ? nameOrHolding : nameOrHolding.name;
        if (currentLang === 'zh') {
            const ticker = typeof nameOrHolding === 'object' ? nameOrHolding.ticker : null;
            if (ticker && tickerNamesZh[ticker]) {
                return tickerNamesZh[ticker];
            }
            if (holdingNamesZhFallback[name]) {
                return holdingNamesZhFallback[name];
            }
        }
        return name;
    };

    // Helper: get localized fund name for dropdown
    const getFundDisplayName = (key, fund) => {
        if (currentLang === 'zh' && fundNamesZh[key]) {
            return fundNamesZh[key];
        }
        return fund.name;
    };

    let fundsData = null;
    let currentFundId = null;
    let currentColorMap = []; // [{name, color}] for table dot sync

    // ============ Helpers ============
    const formatCurrency = (value) => {
        if (value >= 1e9) return '$' + (value / 1e9).toFixed(2) + 'B';
        if (value >= 1e6) return '$' + (value / 1e6).toFixed(2) + 'M';
        return '$' + value.toLocaleString();
    };

    const t = (zh, en) => currentLang === 'zh' ? zh : en;

    // Continuous HSL gradient palette (purple → blue), no hard hue jumps
    const generatePalette = (n) => {
        // From #c4b5fd (hsl 258, 90%, 76%) to #1e40af (hsl 221, 70%, 40%)
        const startH = 258, startS = 90, startL = 76;
        const endH = 221, endS = 70, endL = 40;
        const colors = [];
        for (let i = 0; i < n; i++) {
            const ratio = n === 1 ? 0 : i / (n - 1);
            const h = startH + (endH - startH) * ratio;
            const s = startS + (endS - startS) * ratio;
            const l = startL + (endL - startL) * ratio;
            colors.push(`hsl(${h.toFixed(0)}, ${s.toFixed(0)}%, ${l.toFixed(0)}%)`);
        }
        return colors;
    };

    const OTHERS_COLOR = '#4b5563'; // neutral gray for "Others"

    // Build a short display label from company name; prefer ticker if provided
    const buildShortLabel = (holding) => {
        if (holding.ticker) return holding.ticker.toUpperCase();
        const parts = holding.name.split(' ');
        let shortName = parts[0].replace(/[,.]/g, '');
        if (shortName.length <= 2 && parts.length > 1) {
            shortName = parts[0] + ' ' + parts[1];
        }
        if (shortName.length > 8) shortName = shortName.substring(0, 8);
        return shortName.toUpperCase();
    };

    // ============ Render: Meta Info ============
    const renderMeta = (fund) => {
        document.getElementById('fund-total-value').innerText = formatCurrency(fund.total_value);

        // Show both period of report (quarter-end, the actual holdings date)
        // and filing date (when the 13F was submitted)
        const por = fund.period_of_report || fund.filing_date;
        const metaText = t(
            `持仓截止: ${por}  ·  提交日期: ${fund.filing_date}`,
            `Holdings as of: ${por}  ·  Filed: ${fund.filing_date}`
        );
        document.getElementById('fund-meta-info').innerText = metaText;

        // Chart cutoff date badge uses period of report (the actual holdings date)
        const cutoffEl = document.getElementById('chart-cutoff-date');
        if (cutoffEl) {
            cutoffEl.textContent = t(`数据截止: ${por}`, `As of ${por}`);
        }

        const imgEl = document.getElementById('fund-center-img');
        const initialsEl = document.getElementById('fund-center-initials');
        if (imgEl) {
            imgEl.style.width = PORTRAIT_SIZE + 'px';
            imgEl.style.height = PORTRAIT_SIZE + 'px';
            if (fundPortraits[currentFundId]) {
                imgEl.src = fundPortraits[currentFundId];
                imgEl.style.display = 'block';
                // Hide initials fallback when real portrait is shown
                if (initialsEl) initialsEl.style.display = 'none';
            } else {
                imgEl.style.display = 'none';
                // No freely licensed portrait available — show initials avatar
                // (e.g. for Situational Awareness Capital / Leopold Aschenbrenner)
                if (initialsEl) {
                    const initials = (fundInitials[currentFundId] || currentFundId.slice(0, 2)).toUpperCase();
                    initialsEl.textContent = initials;
                    initialsEl.style.width = PORTRAIT_SIZE + 'px';
                    initialsEl.style.height = PORTRAIT_SIZE + 'px';
                    initialsEl.style.display = 'flex';
                }
            }
        }
    };

    // ============ Render: Table (DOM API, with color dot) ============
    const renderTable = (fund, colorMap) => {
        const tbody = document.getElementById('holdings-tbody');
        tbody.innerHTML = '';

        // Only render non-13G holdings in the main table
        const regularHoldings = fund.top_holdings.filter(h => !h.is_13g).slice(0, TABLE_TOP_N);

        regularHoldings.forEach((h, index) => {
            const tr = document.createElement('tr');

            // Company cell with color dot (matches pie slice for top 10)
            const tdCompany = document.createElement('td');
            const nameWrap = document.createElement('div');
            nameWrap.className = 'company-name';
            nameWrap.style.display = 'flex';
            nameWrap.style.alignItems = 'center';
            nameWrap.style.gap = '8px';

            // Color dot — only for items in pie chart
            if (index < CHART_TOP_N) {
                const dot = document.createElement('span');
                dot.style.cssText = `display:inline-block;width:10px;height:10px;border-radius:50%;background:${colorMap[index].color};flex-shrink:0;`;
                nameWrap.appendChild(dot);
            } else {
                // Non-chart items: empty placeholder to keep alignment
                const dot = document.createElement('span');
                dot.style.cssText = 'display:inline-block;width:10px;height:10px;flex-shrink:0;';
                nameWrap.appendChild(dot);
            }

            const nameText = document.createElement('span');
            nameText.textContent = getHoldingName(h);
            nameWrap.appendChild(nameText);
            tdCompany.appendChild(nameWrap);

            const tickerDiv = document.createElement('div');
            tickerDiv.className = 'company-ticker';
            const tickerLabel = h.ticker ? `${h.ticker} · ${h.class}` : h.class;
            tickerDiv.textContent = `${tickerLabel} | ${h.shares.toLocaleString()} shrs`;
            tdCompany.appendChild(tickerDiv);
            tr.appendChild(tdCompany);

            // Value cell
            const tdValue = document.createElement('td');
            tdValue.style.cssText = 'text-align: right; font-weight: 600; color: #1d1d1f;';
            tdValue.textContent = formatCurrency(h.value);
            tr.appendChild(tdValue);

            // Weight cell
            const tdWeight = document.createElement('td');
            tdWeight.style.cssText = 'text-align: right; font-weight: 600;';
            tdWeight.textContent = `${h.weight.toFixed(2)}%`;
            tdWeight.style.color = '#0071e3';
            tr.appendChild(tdWeight);

            tbody.appendChild(tr);
        });
    };

    // ============ Render: Cash Position Panel (from 10-K / 10-Q) ============
    const renderCashPanel = (fund) => {
        const contentEl = document.getElementById('cash-content');
        const badgeEl = document.getElementById('cash-source-badge');
        contentEl.innerHTML = '';

        const cash = fund.cash_data;

        // When no 10-K/10-Q is available (private investment advisers),
        // show an explanatory message instead of misleading numbers.
        if (!cash || !cash.available) {
            badgeEl.textContent = t('无数据', 'N/A');
            badgeEl.style.background = 'rgba(0, 0, 0, 0.06)';
            badgeEl.style.color = '#86868b';

            const unavail = document.createElement('div');
            unavail.className = 'cash-unavailable';

            const icon = document.createElement('div');
            icon.className = 'cash-unavailable-icon';
            icon.textContent = '🔒';
            unavail.appendChild(icon);

            const reason = document.createElement('div');
            reason.textContent = t(
                '该基金为私人投资顾问，未提交 10-K / 10-Q 文件，现金头寸不予公开披露。',
                'This fund is a private investment adviser and does not file 10-K / 10-Q, so its cash position is not publicly disclosed.'
            );
            unavail.appendChild(reason);

            contentEl.appendChild(unavail);
            return;
        }

        // Source badge: "10-Q · 2026-03-31"
        badgeEl.textContent = `${cash.source} · ${cash.period_of_report}`;
        badgeEl.style.background = '';
        badgeEl.style.color = '';

        // Summary block: total + period + as-of date
        const summary = document.createElement('div');
        summary.className = 'cash-summary';

        const totalLabel = document.createElement('div');
        totalLabel.className = 'cash-summary-label';
        totalLabel.textContent = t('现金及短期投资合计', 'Total Cash & Short-Term Investments');
        summary.appendChild(totalLabel);

        const totalValue = document.createElement('div');
        totalValue.className = 'cash-summary-total';
        totalValue.textContent = formatCurrency(cash.total);
        summary.appendChild(totalValue);

        const periodInfo = document.createElement('div');
        periodInfo.className = 'cash-summary-period';
        periodInfo.textContent = t(
            `截止 ${cash.period_of_report} · 提交于 ${cash.filing_date}`,
            `As of ${cash.period_of_report} · Filed ${cash.filing_date}`
        );
        summary.appendChild(periodInfo);

        contentEl.appendChild(summary);

        // Items grid: one card per cash-like line item
        const grid = document.createElement('div');
        grid.className = 'cash-items-grid';

        cash.items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'cash-item-card';

            const labelEl = document.createElement('div');
            labelEl.className = 'cash-item-label';
            labelEl.textContent = currentLang === 'zh' ? item.label_zh : item.label;
            card.appendChild(labelEl);

            // In zh mode, also show the English label as a subtitle (helps for
            // unfamiliar concepts like "U.S. Treasury Bills"). In en mode, show zh.
            const subLabel = document.createElement('div');
            subLabel.className = 'cash-item-label-zh';
            subLabel.textContent = currentLang === 'zh' ? item.label : item.label_zh;
            card.appendChild(subLabel);

            const valueEl = document.createElement('div');
            valueEl.className = 'cash-item-value';
            valueEl.textContent = formatCurrency(item.value);
            card.appendChild(valueEl);

            // Percentage of cash total (not of 13F portfolio — those are
            // different scopes and would mislead users).
            const pctEl = document.createElement('div');
            pctEl.className = 'cash-item-pct';
            const pctOfCash = cash.total > 0 ? (item.value / cash.total * 100) : 0;
            pctEl.textContent = t(`占现金合计 ${pctOfCash.toFixed(1)}%`, `${pctOfCash.toFixed(1)}% of cash total`);
            card.appendChild(pctEl);

            grid.appendChild(card);
        });

        contentEl.appendChild(grid);
    };

    // ============ Render: 13G/13D Sudden Stakes Panel ============
    const render13GPanel = (fund) => {
        const contentEl = document.getElementById('sudden-stakes-content');
        const badgeEl = document.getElementById('stakes-count-badge');
        const panelEl = document.getElementById('sudden-stakes-panel');
        contentEl.innerHTML = '';

        const stakes = fund.top_holdings.filter(h => h.is_13g);

        if (stakes.length === 0) {
            badgeEl.textContent = t('无', 'None');
            badgeEl.className = 'stakes-count-badge empty';
            contentEl.innerHTML = `<div class="stakes-empty">${t('该基金近期无 13G/13D 突发举牌记录。', 'No recent 13G/13D filings for this fund.')}</div>`;
            return;
        }

        badgeEl.textContent = t(`${stakes.length} 条`, `${stakes.length} filing${stakes.length > 1 ? 's' : ''}`);
        badgeEl.className = 'stakes-count-badge';

        stakes.forEach(h => {
            const card = document.createElement('div');
            card.className = 'stake-card';

            // Header: company name + filing type badge
            const header = document.createElement('div');
            header.className = 'stake-card-header';

            const nameEl = document.createElement('div');
            nameEl.className = 'stake-card-name';
            nameEl.textContent = getHoldingName(h);
            header.appendChild(nameEl);

            const typeBadge = document.createElement('span');
            typeBadge.className = 'stake-card-type';
            typeBadge.textContent = h.form_type || '13G/D';
            header.appendChild(typeBadge);

            card.appendChild(header);

            // Meta: ticker · class · shares
            const metaEl = document.createElement('div');
            metaEl.className = 'stake-card-meta';
            const tickerLabel = h.ticker ? `${h.ticker} · ${h.class}` : h.class;
            metaEl.textContent = `${tickerLabel} | ${h.shares.toLocaleString()} ${t('股', 'shares')}`;
            card.appendChild(metaEl);

            // Date row
            const dateEl = document.createElement('div');
            dateEl.className = 'stake-card-date';
            const eventDate = h.event_date || 'Unknown';
            dateEl.textContent = t(`事件日期: ${eventDate}`, `Event Date: ${eventDate}`);
            card.appendChild(dateEl);

            contentEl.appendChild(card);
        });
    };

    // ============ Build Chart Data ============
    const buildChartData = (fund) => {
        const chartData = [];
        let otherValue = 0;
        let count = 0;

        fund.top_holdings.forEach(h => {
            if (h.is_13g) return;
            if (count < CHART_TOP_N) {
                // Detect option type (CALL/PUT) from the class field
                // 13F XML infotable's putCall field is reflected into class as "COM (Put)" etc.
                const cls = (h.class || '').toUpperCase();
                let optionType = null;
                if (cls.includes('PUT')) optionType = 'PUT';
                else if (cls.includes('CALL')) optionType = 'CALL';

                chartData.push({
                    value: h.value,
                    name: getHoldingName(h),
                    ticker: buildShortLabel(h),
                    optionType: optionType
                });
                count++;
            } else {
                otherValue += h.value;
            }
        });

        if (otherValue > 0) {
            chartData.push({
                value: otherValue,
                name: t('其他 (Others)', 'Others'),
                ticker: 'OTHER',
                isOthers: true
            });
        }
        return chartData;
    };

    // ============ Build Color Map ============
    // Returns array of {name, color} aligned with chartData indices
    const buildColorMap = (chartData) => {
        const sliceColors = generatePalette(CHART_TOP_N);
        return chartData.map((d, i) => ({
            name: d.name,
            color: d.isOthers ? OTHERS_COLOR : sliceColors[i]
        }));
    };

    // ============ Build Chart Option ============
    const buildChartOption = (chartData, colorMap) => {
        const colorList = colorMap.map(c => c.color);

        return {
            backgroundColor: 'transparent',
            color: colorList,
            tooltip: {
                trigger: 'item',
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                borderColor: 'rgba(0, 0, 0, 0.08)',
                borderWidth: 1,
                textStyle: { color: '#1d1d1f', fontSize: 13 },
                extraCssText: 'box-shadow: 0 8px 24px rgba(31, 38, 135, 0.15); backdrop-filter: blur(20px);',
                formatter: (params) => {
                    const opt = params.data.optionType ? ` <span style="color:#86868b;font-weight:600">[${params.data.optionType}]</span>` : '';
                    return `<strong style="color:#1d1d1f">${params.data.name}</strong>${opt}<br/><span style="color:#1d1d1f;font-weight:500">${formatCurrency(params.value)}</span> <span style="color:#0071e3;font-weight:700">(${params.percent}%)</span>`;
                }
            },
            legend: { show: false },
            series: [{
                name: 'Holdings',
                type: 'pie',
                radius: ['45%', '65%'],
                center: ['50%', '50%'],
                avoidLabelOverlap: true,
                itemStyle: {
                    borderRadius: 0,
                    borderColor: 'rgba(255, 255, 255, 0.85)', // crisp white separator on light bg
                    borderWidth: 2
                },
                emphasis: {
                    scale: true,
                    scaleSize: 8,
                    itemStyle: {
                        shadowBlur: 20,
                        shadowColor: 'rgba(0, 113, 227, 0.35)'
                    }
                },
                animationDuration: 1200,
                animationEasing: 'cubicOut',
                animationType: 'expansion',
                label: {
                    show: true,
                    position: 'outside',
                    formatter: (params) => {
                        // Hide label for very small slices to avoid crowding
                        if (params.percent < SMALL_SLIDE_THRESHOLD) return '';
                        const opt = params.data.optionType ? ` (${params.data.optionType})` : '';
                        return `{ticker|${params.data.ticker}${opt}}\n{perc|${params.percent}%}`;
                    },
                    rich: {
                        ticker: {
                            fontSize: 13,
                            fontWeight: 'bold',
                            color: '#1d1d1f',
                            align: 'center',
                            padding: [0, 0, 4, 0]
                        },
                        perc: {
                            fontSize: 12,
                            fontWeight: '600',
                            color: '#515154',
                            align: 'center'
                        }
                    }
                },
                labelLine: {
                    show: true,
                    length: 12,
                    length2: 20,
                    lineStyle: {
                        color: 'rgba(0, 0, 0, 0.25)',
                        type: 'dashed',
                        width: 1
                    }
                },
                data: chartData
            }]
        };
    };

    // ============ Render: Chart ============
    const renderChart = (chartData, colorMap) => {
        myChart.setOption(buildChartOption(chartData, colorMap), true);
    };

    // ============ Main Render Orchestrator ============
    const renderFundData = (fundId, opts = {}) => {
        if (!fundsData || !fundsData.funds[fundId]) return;
        currentFundId = fundId;
        const fund = fundsData.funds[fundId];

        renderMeta(fund);

        const chartData = buildChartData(fund);
        const colorMap = buildColorMap(chartData);
        currentColorMap = colorMap;

        renderTable(fund, colorMap);
        renderChart(chartData, colorMap);
        renderCashPanel(fund);
        render13GPanel(fund);
    };

    // ============ Loading & Error States ============
    const showError = (msg) => {
        myChart.hideLoading();
        myChart.setOption({
            title: {
                text: msg,
                left: 'center',
                top: 'center',
                textStyle: { color: '#dc2626', fontSize: 14, fontWeight: '500' }
            }
        });
    };

    // ============ Load Data ============
    fetch('data/fund-holdings.json')
        .then(res => {
            if (!res.ok) throw new Error('Network response was not ok');
            return res.json();
        })
        .then(data => {
            fundsData = data;
            myChart.hideLoading();

            // Populate dropdown with localized names
            const populateFundSelect = () => {
                const select = document.getElementById('fund-select');
                const prevValue = select.value;
                select.innerHTML = '';
                Object.keys(data.funds).forEach(key => {
                    const option = document.createElement('option');
                    option.value = key;
                    option.innerText = getFundDisplayName(key, data.funds[key]);
                    select.appendChild(option);
                });
                // Preserve selection if possible
                if (prevValue && [...select.options].some(o => o.value === prevValue)) {
                    select.value = prevValue;
                }
            };
            populateFundSelect();

            const firstFund = Object.keys(data.funds)[0];
            if (firstFund) renderFundData(firstFund);

            const select = document.getElementById('fund-select');
            select.addEventListener('change', (e) => renderFundData(e.target.value));

            // Re-populate dropdown on language toggle (renderFundData handles the rest)
            window.addEventListener('langChanged', populateFundSelect);
        })
        .catch(err => {
            console.error("Error loading fund data:", err);
            showError(currentLang === 'zh' ? '数据加载失败' : 'Failed to load data.');
        });
});
