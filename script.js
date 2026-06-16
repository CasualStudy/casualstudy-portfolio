document.addEventListener("DOMContentLoaded", () => {
    
    // Default language
    let currentLang = localStorage.getItem("siteLang") || "en";

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
