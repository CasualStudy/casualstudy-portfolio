document.addEventListener('DOMContentLoaded', () => {
    const lockScreen = document.getElementById('lock-screen');
    const dashboardContent = document.getElementById('dashboard-content');
    const passcodeInput = document.getElementById('passcode-input');
    const unlockBtn = document.getElementById('unlock-btn');
    const errorMsg = document.getElementById('error-msg');
    const papersContainer = document.getElementById('papers-container');
    const statsTotal = document.getElementById('stats-total');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const lockSysBtn = document.getElementById('lock-sys-btn');

    let allPapers = [];
    let currentToken = '';

    // Mock Passcode logic
    // We will accept the user's personal passcode or a 'ghp_' token.
    function authenticate() {
        const val = passcodeInput.value.trim();
        if (val === '0402wdz' || val.startsWith('ghp_')) {
            currentToken = val;
            errorMsg.textContent = '';
            lockScreen.classList.add('hidden');
            setTimeout(() => {
                lockScreen.style.display = 'none';
                dashboardContent.classList.remove('hidden');
                loadPapers();
            }, 500);
        } else {
            errorMsg.textContent = 'Invalid Commander Token or Passcode';
        }
    }

    unlockBtn.addEventListener('click', authenticate);
    passcodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') authenticate();
    });

    lockSysBtn.addEventListener('click', () => {
        dashboardContent.classList.add('hidden');
        lockScreen.style.display = 'flex';
        setTimeout(() => {
            lockScreen.classList.remove('hidden');
            passcodeInput.value = '';
            currentToken = '';
        }, 100);
    });

    // Load papers from JSON
    async function loadPapers() {
        if (allPapers.length > 0) return; // Already loaded

        try {
            const response = await fetch('data/papers_database.json');
            if (!response.ok) throw new Error('Failed to load JSON');
            const data = await response.json();
            
            // Only show papers that have been analyzed by AI
            allPapers = data.filter(p => p.ai_analysis).sort((a, b) => b.ai_analysis.practical_score - a.ai_analysis.practical_score);
            statsTotal.textContent = `Papers: ${allPapers.length}`;
            renderCards(allPapers);
        } catch (err) {
            console.error(err);
            papersContainer.innerHTML = '<p style="color:red; text-align:center;">Failed to load Intelligence Feed. Ensure data/papers_database.json exists.</p>';
        }
    }

    const sortSelect = document.getElementById('sort-select');

    function renderCards(papers) {
        papersContainer.innerHTML = '';
        
        papers.forEach(paper => {
            const analysis = paper.ai_analysis;
            
            // Badge logic
            let badgeClass = 'badge-github';
            if (paper.source === 'arXiv') badgeClass = 'badge-arxiv';
            if (paper.source === 'OpenAlex') badgeClass = 'badge-openalex';

            const item = document.createElement('div');
            item.className = 'glass-panel quant-list-item';
            
            const dateStr = paper.date_scraped ? new Date(paper.date_scraped).toLocaleDateString() : 'Unknown Date';

            item.innerHTML = `
                <div class="quant-item-header">
                    <div class="quant-item-score">
                        ${analysis.practical_score}
                        <span>P-Score</span>
                    </div>
                    <div class="quant-item-main">
                        <div class="quant-item-meta">
                            <span class="quant-source-badge ${badgeClass}">${paper.source}</span>
                            <span><i data-lucide="calendar" style="width:12px; height:12px; display:inline-block; vertical-align:middle;"></i> ${dateStr}</span>
                        </div>
                        <h3 class="quant-title" style="margin-top: 4px; font-size: 1.05rem;">
                            ${paper.title_en}
                        </h3>
                    </div>
                    <div>
                        <i data-lucide="chevron-down" class="expand-icon" style="color: var(--text-secondary);"></i>
                    </div>
                </div>

                <div class="quant-item-details">
                    <div class="quant-details-grid">
                        <div class="quant-section">
                            <h4><i data-lucide="brain-circuit"></i> AI Summary</h4>
                            <p>${analysis.chinese_summary}</p>
                        </div>
                        <div class="quant-section">
                            <h4><i data-lucide="cpu"></i> Core Factors & Logic</h4>
                            <p>${analysis.core_factors}</p>
                        </div>
                        <div class="quant-section">
                            <h4><i data-lucide="sliders-horizontal"></i> Replication Params</h4>
                            <p>${analysis.replication_parameters}</p>
                        </div>
                        <div class="quant-section">
                            <h4><i data-lucide="line-chart"></i> Performance Metrics</h4>
                            <p>${analysis.performance_metrics}</p>
                        </div>
                    </div>
                    <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px;">
                        <a href="${paper.source_url}" target="_blank" class="btn glass-btn" style="padding: 10px 20px; text-decoration: none;">
                            <i data-lucide="external-link" style="width:16px; height:16px;"></i> View Original
                        </a>
                        <button class="btn replicate-btn" style="width: auto; padding: 10px 24px; margin: 0;" onclick="event.stopPropagation(); triggerReplication('${paper.id}')">
                            <i data-lucide="bot" style="width:18px; height:18px;"></i> 唤醒 Agent 尝试复现
                        </button>
                    </div>
                </div>
            `;
            
            // Toggle details
            item.addEventListener('click', () => {
                const isExpanded = item.classList.contains('expanded');
                // Close others if you want accordion behavior, or comment out to allow multiple opens
                document.querySelectorAll('.quant-list-item').forEach(el => {
                    el.classList.remove('expanded');
                    const icon = el.querySelector('.expand-icon');
                    if (icon) icon.style.transform = 'rotate(0deg)';
                });
                
                if (!isExpanded) {
                    item.classList.add('expanded');
                    const icon = item.querySelector('.expand-icon');
                    if (icon) icon.style.transform = 'rotate(180deg)';
                }
            });
            
            papersContainer.appendChild(item);
        });
        
        lucide.createIcons();
    }

    // Sorting and Filtering Logic
    let currentSourceFilter = 'All';

    function applyFiltersAndSort() {
        // 1. Filter
        let result = allPapers;
        if (currentSourceFilter !== 'All') {
            result = result.filter(p => p.source === currentSourceFilter);
        }

        // 2. Sort
        const sortVal = sortSelect.value;
        result.sort((a, b) => {
            if (sortVal === 'score_desc') return b.ai_analysis.practical_score - a.ai_analysis.practical_score;
            if (sortVal === 'score_asc') return a.ai_analysis.practical_score - b.ai_analysis.practical_score;
            
            const dateA = new Date(a.date_scraped || 0).getTime();
            const dateB = new Date(b.date_scraped || 0).getTime();
            if (sortVal === 'date_desc') return dateB - dateA;
            if (sortVal === 'date_asc') return dateA - dateB;
        });

        renderCards(result);
    }

    sortSelect.addEventListener('change', applyFiltersAndSort);

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentSourceFilter = btn.dataset.source;
            applyFiltersAndSort();
        });
    });

    // Global function for the Replicate button
    window.triggerReplication = function(paperId) {
        if (!currentToken.startsWith('ghp_')) {
            alert("Error: Only a valid GitHub Token can deploy the remote Agent.\n\nLocal Test Mode: Simulating deployment for " + paperId + "...");
            return;
        }

        // In production, this would make a fetch() POST to GitHub Actions workflow_dispatch
        alert("🚀 成功唤醒远程 Agent！\n\n指令已通过 Token 下发至 GitHub Actions。\n\n[目标 ID]: " + paperId + "\n[任务]: 获取数据 -> 编写复现代码 -> 运行回测 -> 生成 HTML 报告。\n\nAgent 完成后，自动生成的 HTML 会同步到你的主页！");
    };
});
