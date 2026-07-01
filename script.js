document.addEventListener("DOMContentLoaded", () => {
    
    // Default language
    let currentLang = localStorage.getItem("siteLang");
    if (!currentLang) {
        currentLang = navigator.language.toLowerCase().includes("zh") ? "zh" : "en";
    }

    // Mock Data for Projects
    const projects = [
        {
            title_en: "Project 1 (TBD)",
            title_zh: "项目 1 (TBD)",
            excerpt_en: "TBD - Coming soon.",
            excerpt_zh: "敬请期待 - 建设中。",
            tech: "TBD",
            icon: "layout-dashboard"
        },
        {
            title_en: "Project 2 (TBD)",
            title_zh: "项目 2 (TBD)",
            excerpt_en: "TBD - Coming soon.",
            excerpt_zh: "敬请期待 - 建设中。",
            tech: "TBD",
            icon: "terminal"
        },
        {
            title_en: "Project 3 (TBD)",
            title_zh: "项目 3 (TBD)",
            excerpt_en: "TBD - Coming soon.",
            excerpt_zh: "敬请期待 - 建设中。",
            tech: "TBD",
            icon: "bot"
        }
    ];

    // Mock Data for Data Analysis
    const analyses = [
        {
            title_en: "Flash Market Index",
            title_zh: "闪存市场价格指数",
            excerpt_en: "NAND/DRAM price index and memory product spot price tracking.",
            excerpt_zh: "NAND/DRAM 价格指数与存储产品现货报价追踪。",
            tools: "ECharts, Python, GitHub Actions",
            icon: "database",
            link: "cfm-market.html"
        },
        {
            title_en: "Korea Margin Loan Balance",
            title_zh: "韩国融资融券余额",
            excerpt_en: "Daily margin loan balance and leverage ratio for KOSPI and KOSDAQ.",
            excerpt_zh: "每日更新的韩国 KOSPI 和 KOSDAQ 融资余额及杠杆比率跟踪。",
            tools: "ECharts, Python, GitHub Actions",
            icon: "trending-down",
            link: "korea-margin.html"
        },
        {
            title_en: "Global AI Economy Tracker",
            title_zh: "全球 AI 大模型流水监控",
            excerpt_en: "Estimated daily revenue across top models routed through OpenRouter.",
            excerpt_zh: "根据全网日调用量估算的 OpenRouter 大模型真实流水大盘。",
            tools: "ECharts, Python, GitHub Actions",
            icon: "globe",
            link: "ai-revenue-tracker.html"
        },

        {
            title_en: "Fear & Greed Index vs S&P 500",
            title_zh: "恐慌与贪婪指数 vs 标普500",
            excerpt_en: "Daily updated interactive chart comparing market sentiment against S&P 500 performance.",
            excerpt_zh: "每日更新的交互式图表，对比市场情绪与标普500表现。",
            tools: "ECharts, Python, GitHub Actions",
            icon: "line-chart",
            link: "fear-greed.html"
        },
        {
            title_en: "Index Gap Fill Probability",
            title_zh: "指数跳空缺口回补概率",
            excerpt_en: "Daily updated heatmaps analyzing the probability of SPY & QQQ gap fills based on 30 years of historical data.",
            excerpt_zh: "每日更新的热力图，基于30年历史数据分析 SPY 与 QQQ 的跳空缺口回补概率。",
            tools: "ECharts, Python, GitHub Actions",
            icon: "bar-chart-2",
            link: "gap-study.html"
        },
        {
            title_en: "Index Inclusion Effect",
            title_zh: "指数纳入效应",
            excerpt_en: "Analysis of post-inclusion performance for stocks added to the S&P 500.",
            excerpt_zh: "标普500成分股被纳入前后的表现统计。",
            tools: "ECharts, Python",
            icon: "trending-up",
            link: "inclusion-study.html"
        },
        {
            title_en: "Institutional Holdings Tracker",
            title_zh: "机构持仓追踪",
            excerpt_en: "Interactive dashboard tracking 13F filings of top funds like Buffett, Soros and ARK.",
            excerpt_zh: "交互式仪表盘，追踪巴菲特、索罗斯和 ARK 等顶级基金的最新的 13F 季度持仓。",
            tools: "ECharts, Python, GitHub Actions",
            icon: "pie-chart",
            link: "fund-holdings.html"
        }
    ];

    // Mock Data for TradingView Indicators
    const indicators = [
        {
            title_en: "Smart Money RVOL System (Smart RVOL)",
            title_zh: "Smart Money RVOL System (Smart RVOL)",
            excerpt_en: "A custom TradingView indicator for analyzing relative volume and smart money footprints.",
            excerpt_zh: "用于分析相对成交量和聪明钱足迹的自定义 TradingView 指标。",
            tools: "Pine Script",
            icon: "activity",
            link: "https://www.tradingview.com/script/rRpmHLGr-Smart-Money-RVOL-System/"
        },
        {
            title_en: "CNN Fear and Greedy Index",
            title_zh: "CNN 恐慌与贪婪指数",
            excerpt_en: "A custom TradingView indicator porting the CNN Fear and Greed Index directly into your charts.",
            excerpt_zh: "将 CNN 恐慌与贪婪指数直接引入图表的自定义 TradingView 指标。",
            tools: "Pine Script",
            icon: "bar-chart",
            link: "https://www.tradingview.com/script/bJ9E8wB1-CNN-Fear-and-Greedy-Index/"
        }
    ];

    // Mock Data for In Development
    const development = [
        {
            title_en: "News Radar",
            title_zh: "新闻雷达",
            excerpt_en: "Automatically tracking and categorizing PRNewswire feed to detect market-moving news.",
            excerpt_zh: "自动追踪并对美通社新闻进行分类，捕捉影响市场的重磅信息。",
            tools: "JavaScript, Python, GitHub Actions",
            icon: "radar",
            link: "news-radar.html"
        },
        {
            title_en: "Quantitative Paper Analysis",
            title_zh: "量化论文分析库",
            excerpt_en: "Deep dives into SSRN and Quantpedia trading strategies, replicated and analyzed.",
            excerpt_zh: "深入剖析 SSRN 和 Quantpedia 前沿交易策略，代码复现与实证分析。",
            tools: "Python, Jupyter",
            icon: "book-open",
            link: "paper-analysis/index.html"
        }
    ];

    // Function to render cards
    const renderCards = (data, containerId, linkTextEn, linkTextZh) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = ''; // Clear existing cards before re-rendering

        const linkText = currentLang === 'zh' ? linkTextZh : linkTextEn;

        data.forEach(item => {
            const card = document.createElement("div");
            card.className = "item-card";
            
            const title = currentLang === 'zh' ? item.title_zh : item.title_en;
            const excerpt = currentLang === 'zh' ? item.excerpt_zh : item.excerpt_en;
            let footerInfo = item.date || item.tech || item.tools;

            card.style.cursor = "pointer";
            card.onclick = () => {
                if (item.link) window.location.href = item.link;
            };

            card.innerHTML = `
                <div class="card-icon">
                    <i data-lucide="${item.icon}"></i>
                </div>
                <h3>${title}</h3>
                <p>${excerpt}</p>
                <div class="card-footer">
                    <span>${footerInfo}</span>
                    <a href="${item.link || '#'}" class="read-more">${linkText} <i data-lucide="arrow-right" style="width:16px; height:16px;"></i></a>
                </div>
            `;
            container.appendChild(card);
        });
    };

    // Update all static HTML texts
    const updateStaticTexts = () => {
        document.querySelectorAll('.lang-text').forEach(el => {
            const text = currentLang === 'zh' ? el.getAttribute('data-zh') : el.getAttribute('data-en');
            if (text) el.innerHTML = text;
        });
    };

    // Main render function
    const renderAll = () => {
        updateStaticTexts();
        renderCards(projects, "projects-container", "View Project", "查看项目");
        renderCards(analyses, "analysis-container", "View Analysis", "查看分析");
        renderCards(indicators, "indicators-container", "View Indicator", "查看指标");
        renderCards(development, "development-container", "View Progress", "查看进度");
        lucide.createIcons();
    };

    // Initialize
    renderAll();

    // Language Toggle
    const langBtn = document.getElementById("lang-toggle");
    if (langBtn) {
        langBtn.addEventListener("click", () => {
            currentLang = currentLang === "en" ? "zh" : "en";
            localStorage.setItem("siteLang", currentLang);
            renderAll();
            window.dispatchEvent(new Event('languageChanged'));
        });
    }

    // Smooth Scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if(targetId === '#') return;
            const targetElement = document.querySelector(targetId);
            if(targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop - 80, // Offset for fixed nav
                    behavior: 'smooth'
                });
            }
        });
    });

    // Discord links custom modal
    const discordModal = document.getElementById('discord-modal');
    const closeBtn = document.getElementById('close-modal-btn');

    document.querySelectorAll('a[aria-label="Discord"], #hero-discord-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (discordModal) {
                discordModal.classList.add('active');
            }
        });
    });

    if (closeBtn && discordModal) {
        closeBtn.addEventListener('click', () => {
            discordModal.classList.remove('active');
        });
        
        // Click outside to close
        discordModal.addEventListener('click', (e) => {
            if (e.target === discordModal) {
                discordModal.classList.remove('active');
            }
        });
    }
});
