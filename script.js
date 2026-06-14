document.addEventListener("DOMContentLoaded", () => {
    
    // Default language
    let currentLang = localStorage.getItem("siteLang") || "en";

    // Mock Data for Projects
    const projects = [
        {
            title_en: "DataViz Dashboard",
            title_zh: "数据可视化大屏",
            excerpt_en: "A comprehensive dashboard for visualizing real-time financial data using D3.js and React.",
            excerpt_zh: "使用 D3.js 和 React 构建的用于可视化实时财务数据的综合仪表盘。",
            tech: "React, D3.js",
            icon: "layout-dashboard"
        },
        {
            title_en: "Crypto Tracker",
            title_zh: "加密货币追踪器",
            excerpt_en: "A lightweight CLI tool built in Python to track cryptocurrency portfolio performance.",
            excerpt_zh: "使用 Python 构建的轻量级命令行工具，用于跟踪加密货币投资组合的绩效。",
            tech: "Python, API",
            icon: "terminal"
        },
        {
            title_en: "AI Chat Interface",
            title_zh: "AI 聊天界面",
            excerpt_en: "A minimal, glassmorphism-styled chat interface designed for LLM interactions.",
            excerpt_zh: "专为大语言模型交互设计的极简、毛玻璃风格聊天界面。",
            tech: "HTML, CSS, JS",
            icon: "bot"
        }
    ];

    // Mock Data for Data Analysis
    const analyses = [
        {
            title_en: "E-commerce User Retention 2023",
            title_zh: "2023 电子商务用户留存分析",
            excerpt_en: "An in-depth Jupyter Notebook exploring what factors drive long-term user retention in e-commerce platforms.",
            excerpt_zh: "一个深度的 Jupyter Notebook，探索驱动电子商务平台长期用户留存的因素。",
            tools: "Python, Pandas, Seaborn",
            icon: "pie-chart"
        },
        {
            title_en: "Market Sentiment Analysis",
            title_zh: "市场情绪分析",
            excerpt_en: "Scraping and analyzing social media sentiment to predict short-term stock movements.",
            excerpt_zh: "抓取并分析社交媒体情绪，以预测短期股票波动。",
            tools: "NLP, Scikit-Learn",
            icon: "trending-up"
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
                    <a href="#" class="read-more">${linkText} <i data-lucide="arrow-right" style="width:16px; height:16px;"></i></a>
                </div>
            `;
            container.appendChild(card);
        });
    };

    // Update all static HTML texts
    const updateStaticTexts = () => {
        document.querySelectorAll('.lang-text').forEach(el => {
            const text = currentLang === 'zh' ? el.getAttribute('data-zh') : el.getAttribute('data-en');
            if (text) el.textContent = text;
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
});
