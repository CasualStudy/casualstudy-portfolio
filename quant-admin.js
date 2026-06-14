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
    window.triggerReplication = async function(paperId) {
        if (!currentToken.startsWith('ghp_')) {
            alert("⚠️ 安全锁定：\n要唤醒云端 Agent，你必须输入真实的 GitHub Token 作为指挥官密钥（现在的密码只是本地演示）。");
            return;
        }

        const btn = event.currentTarget;
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="loader" class="spin"></i> Agent 唤醒中...';
        btn.disabled = true;

        try {
            const response = await fetch('https://api.github.com/repos/CasualStudy/quant-scraper-backend/actions/workflows/replicate.yml/dispatches', {
                method: 'POST',
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'Authorization': 'token ' + currentToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ref: 'main',
                    inputs: {
                        paper_id: paperId,
                        github_token: currentToken
                    }
                })
            });

            if (response.ok) {
                alert(`🚀 指令已送达云端！\n\nAgent 正在后台为论文 [${paperId}] 编写代码并生成 HTML。\n请耐心等待 1-2 分钟，生成的研报将自动推送至您的公开主页！`);
                btn.innerHTML = '<i data-lucide="check"></i> 任务已指派';
                btn.style.background = 'linear-gradient(135deg, #00c6ff, #0072ff)';
            } else {
                const errText = await response.text();
                alert(`❌ 唤醒失败: ${response.status} ${response.statusText}\n请确认 Token 是否具备 workflow 权限。`);
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        } catch (error) {
            alert(`❌ 网络错误: ${error}`);
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
        lucide.createIcons();
    };

    // Fetch More Papers Logic
    const fetchMoreBtn = document.getElementById('fetch-more-btn');
    if (fetchMoreBtn) {
        fetchMoreBtn.addEventListener('click', async () => {
            if (!currentToken.startsWith('ghp_')) {
                alert("⚠️ 安全锁定：\n必须使用真实的 GitHub Token 才能唤醒云端雷达。");
                return;
            }

            const originalText = fetchMoreBtn.innerHTML;
            fetchMoreBtn.innerHTML = '<i data-lucide="loader" class="spin"></i> 雷达扫描中...';
            fetchMoreBtn.disabled = true;

            try {
                const response = await fetch('https://api.github.com/repos/CasualStudy/quant-scraper-backend/actions/workflows/daily_research.yml/dispatches', {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/vnd.github.v3+json',
                        'Authorization': 'token ' + currentToken,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        ref: 'main',
                        inputs: {
                            github_token: currentToken
                        }
                    })
                });

                if (response.ok) {
                    alert("📡 雷达扫描已启动！\n\n云端爬虫正在抓取 GitHub/arXiv/OpenAlex 最新论文，\n并且 DeepSeek 正在进行严格的交易策略相关性过滤。\n\n过滤清洗完成后，全新的数据会自动推送到当前仓库，请在 3-5 分钟后刷新页面！");
                    fetchMoreBtn.innerHTML = '<i data-lucide="check"></i> 扫描任务已指派';
                    fetchMoreBtn.style.color = '#00ff88';
                } else {
                    const errText = await response.text();
                    alert(`❌ 启动失败: ${response.status} ${response.statusText}\n请确认 Token 具备 workflow 权限。`);
                    fetchMoreBtn.innerHTML = originalText;
                    fetchMoreBtn.disabled = false;
                }
            } catch (error) {
                alert(`❌ 网络错误: ${error}`);
                fetchMoreBtn.innerHTML = originalText;
                fetchMoreBtn.disabled = false;
            }
            lucide.createIcons();
        });
    }

});
