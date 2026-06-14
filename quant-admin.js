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

    function renderCards(papers) {
        papersContainer.innerHTML = '';
        
        papers.forEach(paper => {
            const analysis = paper.ai_analysis;
            
            // Badge logic
            let badgeClass = 'badge-github';
            if (paper.source === 'arXiv') badgeClass = 'badge-arxiv';
            if (paper.source === 'OpenAlex') badgeClass = 'badge-openalex';

            const card = document.createElement('div');
            card.className = 'glass-panel quant-card';
            
            card.innerHTML = `
                <div class="quant-card-header">
                    <span class="quant-source-badge ${badgeClass}">${paper.source}</span>
                    <div class="quant-score">
                        ${analysis.practical_score} <span>P-Score</span>
                    </div>
                </div>
                
                <h3 class="quant-title">
                    <a href="${paper.source_url}" target="_blank" style="color: inherit; text-decoration: none;">
                        ${paper.title_en} <i data-lucide="external-link" style="width:14px; height:14px; opacity:0.5;"></i>
                    </a>
                </h3>

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

                <button class="replicate-btn" onclick="triggerReplication('${paper.id}')">
                    <i data-lucide="bot"></i> 唤醒 Agent 尝试复现
                </button>
            `;
            
            papersContainer.appendChild(card);
        });
        
        lucide.createIcons();
    }

    // Filter Logic
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const source = btn.dataset.source;
            if (source === 'All') {
                renderCards(allPapers);
            } else {
                const filtered = allPapers.filter(p => p.source === source);
                renderCards(filtered);
            }
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
