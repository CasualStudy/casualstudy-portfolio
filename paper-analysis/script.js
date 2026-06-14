document.addEventListener("DOMContentLoaded", () => {
    
    // Default language from localStorage (syncs with main site)
    let currentLang = localStorage.getItem("siteLang") || "en";

    // Mock Data for Papers
    const papers = [
        {
            title_en: "Momentum Crashes and Recovery",
            title_zh: "动量崩盘与复苏",
            excerpt_en: "An analysis of Daniel & Moskowitz (2016). Shows how momentum strategies fail during market recoveries and how dynamic volatility scaling can prevent it.",
            excerpt_zh: "分析 Daniel & Moskowitz (2016) 的经典论文。探讨动量策略在市场触底反弹时的崩溃现象，以及如何通过波动率动态调整来规避风险。",
            tags_en: "Momentum | US Equities",
            tags_zh: "动量因子 | 美股",
            icon: "file-text",
            link: "reports/sample-report.html"
        },
        {
            title_en: "Quality Minus Junk (QMJ)",
            title_zh: "高质量减去低质量 (QMJ)",
            excerpt_en: "Replicating the AQR Quality factor. Defining 'quality' based on profitability, growth, and safety, and analyzing its premium across global markets.",
            excerpt_zh: "复现 AQR 的质量因子（Quality Factor）。通过盈利能力、成长性和安全性定义高质量股票，并分析其在全球市场的溢价。",
            tags_en: "AQR | Quality Factor",
            tags_zh: "AQR | 质量因子",
            icon: "file-text",
            link: "#"
        }
    ];

    // Function to render cards
    const renderCards = () => {
        const container = document.getElementById("papers-container");
        if (!container) return;
        container.innerHTML = ''; // Clear existing cards

        const linkText = currentLang === 'zh' ? "阅读分析报告" : "Read Full Analysis";

        papers.forEach(item => {
            const card = document.createElement("div");
            card.className = "item-card";
            
            const title = currentLang === 'zh' ? item.title_zh : item.title_en;
            const excerpt = currentLang === 'zh' ? item.excerpt_zh : item.excerpt_en;
            const footerInfo = currentLang === 'zh' ? item.tags_zh : item.tags_en;

            card.innerHTML = `
                <div class="card-icon">
                    <i data-lucide="${item.icon}"></i>
                </div>
                <h3>${title}</h3>
                <p>${excerpt}</p>
                <div class="card-footer">
                    <span>${footerInfo}</span>
                    <a href="${item.link}" class="read-more">${linkText} <i data-lucide="arrow-right" style="width:16px; height:16px;"></i></a>
                </div>
            `;
            container.appendChild(card);
        });
        lucide.createIcons();
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
        renderCards();
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
});
