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

    // Check for saved token
    const savedToken = localStorage.getItem('quant_commander_token');
    if (savedToken) {
        passcodeInput.value = savedToken;
        const rememberCheckbox = document.getElementById('remember-token');
        if (rememberCheckbox) rememberCheckbox.checked = true;
    }

    // Mock Passcode logic
    // We will accept the user's personal passcode or a 'ghp_' token.
    function authenticate() {
        const val = passcodeInput.value.trim();
        if (val === '0402wdz' || val.startsWith('ghp_')) {
            currentToken = val;
            
            // Save or clear from localStorage
            const rememberCheckbox = document.getElementById('remember-token');
            if (rememberCheckbox && rememberCheckbox.checked) {
                localStorage.setItem('quant_commander_token', currentToken);
            } else {
                localStorage.removeItem('quant_commander_token');
            }

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
            const response = await fetch('data/papers_database.json?t=' + new Date().getTime());
            if (!response.ok) throw new Error('Failed to load JSON');
            const data = await response.json();
            
            // Only show papers that have been analyzed by AI
            allPapers = data.filter(p => p.ai_analysis).sort((a, b) => b.ai_analysis.practical_score - a.ai_analysis.practical_score);
            statsTotal.textContent = `Papers: ${allPapers.length}`;
            renderCards(allPapers);
        } catch (err) {
            console.error(err);
            papersContainer.innerHTML = '<p style="color:red; text-align:center;">Failed to load Intelligence Feed. Error: ' + err.message + '</p>';
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
            
            const dateStr = paper.pub_date ? new Date(paper.pub_date).toLocaleDateString() : (paper.date_scraped ? new Date(paper.date_scraped).toLocaleDateString() : 'Unknown Date');

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
                    alert("📡 雷达扫描已启动！系统正在后台进行全网抓取和 AI 过滤。\n\n请不要关闭此页面，按钮会实时追踪进度。");
                    fetchMoreBtn.innerHTML = '<i data-lucide="loader" class="spin"></i> 云端任务排队中...';
                    
                    // Start Polling
                    setTimeout(async () => {
                        try {
                            // Fetch the latest run
                            const runsRes = await fetch('https://api.github.com/repos/CasualStudy/quant-scraper-backend/actions/workflows/daily_research.yml/runs?per_page=1', {
                                headers: { 'Authorization': 'token ' + currentToken }
                            });
                            const runsData = await runsRes.json();
                            if (runsData.workflow_runs && runsData.workflow_runs.length > 0) {
                                const runId = runsData.workflow_runs[0].id;
                                fetchMoreBtn.innerHTML = '<i data-lucide="loader" class="spin"></i> AI 正在全网清洗... (用时约3分钟)';
                                
                                const pollInterval = setInterval(async () => {
                                    const statusRes = await fetch(`https://api.github.com/repos/CasualStudy/quant-scraper-backend/actions/runs/${runId}`, {
                                        headers: { 'Authorization': 'token ' + currentToken }
                                    });
                                    const statusData = await statusRes.json();
                                    
                                    if (statusData.status === 'completed') {
                                        clearInterval(pollInterval);
                                        if (statusData.conclusion === 'success') {
                                            fetchMoreBtn.innerHTML = '<i data-lucide="check-circle"></i> 扫描完成！点击刷新';
                                            fetchMoreBtn.style.background = '#00ff88';
                                            fetchMoreBtn.style.color = '#000';
                                            fetchMoreBtn.disabled = false;
                                            // Optional alert
                                            alert("🎉 云端扫描与过滤已全部完成！\n全新的干货策略已同步至数据库，即将为您刷新页面。");
                                            location.reload(true);
                                        } else {
                                            fetchMoreBtn.innerHTML = '<i data-lucide="alert-triangle"></i> 扫描异常终止';
                                            fetchMoreBtn.style.color = '#ff4444';
                                            alert("❌ 云端扫描任务失败，可能是由于网络波动或请求超限，请稍后重试。");
                                            fetchMoreBtn.disabled = false;
                                        }
                                        lucide.createIcons();
                                    }
                                }, 10000); // Check every 10 seconds
                            }
                        } catch (e) {
                            console.error("Failed to track workflow:", e);
                        }
                    }, 5000); // Wait 5s before first check to ensure workflow is registered
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
    // OpenAlex Deep Scan button
    const openalexDeepBtn = document.getElementById('openalex-deep-btn');
    if (openalexDeepBtn) {
        openalexDeepBtn.addEventListener('click', async () => {
            if (!currentToken.startsWith('ghp_')) {
                alert("⚠️ 安全锁定：\n必须使用真实的 GitHub Token 才能唤醒深度挖掘。");
                return;
            }

            const originalText = openalexDeepBtn.innerHTML;
            openalexDeepBtn.innerHTML = '<i data-lucide="loader" class="spin"></i> 深度挖掘中...';
            openalexDeepBtn.disabled = true;

            try {
                const response = await fetch('https://api.github.com/repos/CasualStudy/quant-scraper-backend/actions/workflows/openalex_deep_scan.yml/dispatches', {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/vnd.github.v3+json',
                        'Authorization': 'token ' + currentToken,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        ref: 'main',
                        inputs: { github_token: currentToken }
                    })
                });

                if (response.ok) {
                    alert("🔬 OpenAlex 深度挖掘已启动！\n\n系统正在按 Topic T11186（金融市场与算法交易）+ 引用量 + 开放获取三重过滤，扫描历史3个月窗口。\n\n预计耗时约 2-4 分钟。");
                    openalexDeepBtn.innerHTML = '<i data-lucide="loader" class="spin"></i> 云端任务排队中...';

                    setTimeout(async () => {
                        try {
                            const runsRes = await fetch('https://api.github.com/repos/CasualStudy/quant-scraper-backend/actions/workflows/openalex_deep_scan.yml/runs?per_page=1', {
                                headers: { 'Authorization': 'token ' + currentToken }
                            });
                            const runsData = await runsRes.json();
                            if (runsData.workflow_runs && runsData.workflow_runs.length > 0) {
                                const runId = runsData.workflow_runs[0].id;
                                openalexDeepBtn.innerHTML = '<i data-lucide="loader" class="spin"></i> AI 正在筛选学术论文... (约3分钟)';

                                const pollInterval = setInterval(async () => {
                                    const statusRes = await fetch(`https://api.github.com/repos/CasualStudy/quant-scraper-backend/actions/runs/${runId}`, {
                                        headers: { 'Authorization': 'token ' + currentToken }
                                    });
                                    const statusData = await statusRes.json();

                                    if (statusData.status === 'completed') {
                                        clearInterval(pollInterval);
                                        if (statusData.conclusion === 'success') {
                                            openalexDeepBtn.innerHTML = '<i data-lucide="check-circle"></i> 挖掘完成！点击刷新';
                                            openalexDeepBtn.style.background = '#00ff88';
                                            openalexDeepBtn.style.color = '#000';
                                            openalexDeepBtn.disabled = false;
                                            alert("🎉 OpenAlex 深度挖掘完成！\n高引用量的交易策略学术论文已同步至数据库。");
                                            location.reload(true);
                                        } else {
                                            openalexDeepBtn.innerHTML = '<i data-lucide="alert-triangle"></i> 挖掘异常终止';
                                            openalexDeepBtn.style.color = '#ff4444';
                                            alert("❌ 深度挖掘任务失败，请稍后重试。");
                                            openalexDeepBtn.disabled = false;
                                        }
                                        lucide.createIcons();
                                    }
                                }, 10000);
                            }
                        } catch (e) {
                            console.error("Failed to track deep scan workflow:", e);
                        }
                    }, 5000);
                } else {
                    const errText = await response.text();
                    alert(`❌ 启动失败: ${response.status} ${response.statusText}\n请确认 Token 具备 workflow 权限。`);
                    openalexDeepBtn.innerHTML = originalText;
                    openalexDeepBtn.disabled = false;
                }
            } catch (error) {
                alert(`❌ 网络错误: ${error}`);
                openalexDeepBtn.innerHTML = originalText;
                openalexDeepBtn.disabled = false;
            }
            lucide.createIcons();
        });
    }

});
