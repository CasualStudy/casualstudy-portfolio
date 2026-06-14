document.addEventListener("DOMContentLoaded", () => {
    
    // Mock Data for X Posts
    const posts = [
        {
            title: "Thoughts on Modern Web Design",
            excerpt: "Glassmorphism is making a huge comeback, blending minimal aesthetics with depth. Here's how to implement it effectively...",
            date: "Oct 12",
            icon: "twitter"
        },
        {
            title: "Data Analysis: The Next Big Trend",
            excerpt: "Looking at the numbers from Q3, it's clear that AI-driven data pipelines are outperforming traditional ETL setups.",
            date: "Oct 5",
            icon: "twitter"
        },
        {
            title: "Building my Portfolio",
            excerpt: "Decided to build a custom portfolio to showcase my projects. Opted for an Apple-inspired UI. Clean, simple, fast.",
            date: "Sep 28",
            icon: "twitter"
        }
    ];

    // Mock Data for Projects
    const projects = [
        {
            title: "DataViz Dashboard",
            excerpt: "A comprehensive dashboard for visualizing real-time financial data using D3.js and React.",
            tech: "React, D3.js",
            icon: "layout-dashboard"
        },
        {
            title: "Crypto Tracker",
            excerpt: "A lightweight CLI tool built in Python to track cryptocurrency portfolio performance.",
            tech: "Python, API",
            icon: "terminal"
        },
        {
            title: "AI Chat Interface",
            excerpt: "A minimal, glassmorphism-styled chat interface designed for LLM interactions.",
            tech: "HTML, CSS, JS",
            icon: "bot"
        }
    ];

    // Mock Data for Data Analysis
    const analyses = [
        {
            title: "E-commerce User Retention 2023",
            excerpt: "An in-depth Jupyter Notebook exploring what factors drive long-term user retention in e-commerce platforms.",
            tools: "Python, Pandas, Seaborn",
            icon: "pie-chart"
        },
        {
            title: "Market Sentiment Analysis",
            excerpt: "Scraping and analyzing social media sentiment to predict short-term stock movements.",
            tools: "NLP, Scikit-Learn",
            icon: "trending-up"
        }
    ];

    // Function to render cards
    const renderCards = (data, containerId, linkText) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        data.forEach(item => {
            const card = document.createElement("div");
            card.className = "item-card";
            
            // Generate footer info based on data type
            let footerInfo = item.date || item.tech || item.tools;

            card.innerHTML = `
                <div class="card-icon">
                    <i data-lucide="${item.icon}"></i>
                </div>
                <h3>${item.title}</h3>
                <p>${item.excerpt}</p>
                <div class="card-footer">
                    <span>${footerInfo}</span>
                    <a href="#" class="read-more">${linkText} <i data-lucide="arrow-right" style="width:16px; height:16px;"></i></a>
                </div>
            `;
            container.appendChild(card);
        });
    };

    // Render all sections
    renderCards(projects, "projects-container", "View Project");
    renderCards(analyses, "analysis-container", "View Analysis");

    // Re-initialize Lucide icons for dynamically added content
    lucide.createIcons();

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
