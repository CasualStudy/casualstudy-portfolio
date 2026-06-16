document.addEventListener('DOMContentLoaded', () => {
    const feedContainer = document.getElementById('news-feed');
    const filterTabsContainer = document.getElementById('filter-tabs');
    const loadingState = document.getElementById('loading-state');
    
    let allNews = [];
    let currentFilter = 'All';
    let availableTags = new Set(['All']);

    // Fetch the news data
    fetch('data/news_radar.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            allNews = data;
            
            // Extract all unique tags
            data.forEach(item => {
                if (item.tags && item.tags.length > 0) {
                    item.tags.forEach(tag => availableTags.add(tag));
                }
            });
            
            renderFilters();
            renderFeed();
            loadingState.classList.add('hidden');
        })
        .catch(error => {
            console.error('Error fetching news:', error);
            loadingState.innerHTML = '<p style="color: #ef4444;">Failed to load news feed. Please try again later.</p>';
        });

    function renderFilters() {
        filterTabsContainer.innerHTML = '';
        
        // Sort tags (keep 'All' and 'Other' at specific positions if desired)
        const sortedTags = Array.from(availableTags).sort((a, b) => {
            if (a === 'All') return -1;
            if (b === 'All') return 1;
            if (a === 'Other') return 1;
            if (b === 'Other') return -1;
            return a.localeCompare(b);
        });

        sortedTags.forEach(tag => {
            const btn = document.createElement('button');
            btn.className = `filter-tab ${tag === currentFilter ? 'active' : ''}`;
            btn.textContent = tag;
            btn.addEventListener('click', () => {
                // Update active state
                document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                currentFilter = tag;
                renderFeed();
            });
            filterTabsContainer.appendChild(btn);
        });
    }

    function renderFeed() {
        feedContainer.innerHTML = '';
        
        const filteredNews = currentFilter === 'All' 
            ? allNews 
            : allNews.filter(item => item.tags && item.tags.includes(currentFilter));
            
        if (filteredNews.length === 0) {
            feedContainer.innerHTML = '<div class="loading-state"><p>No news found for this category.</p></div>';
            return;
        }

        filteredNews.forEach(item => {
            // Format date
            const dateObj = new Date(item.published);
            const dateStr = dateObj.toLocaleString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
                hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
            });

            const tagsHtml = (item.tags || []).map(tag => {
                const classFriendlyTag = tag.toLowerCase().replace(/[^a-z0-9]/g, '-');
                return `<span class="tag ${classFriendlyTag}">${tag}</span>`;
            }).join('');

            const newsItem = document.createElement('div');
            newsItem.className = 'news-item';
            newsItem.innerHTML = `
                <div class="news-date">${dateStr}</div>
                <div class="news-title">
                    <a href="${item.link}" target="_blank" rel="noopener noreferrer">${item.title}</a>
                </div>
                <div class="news-tags">
                    ${tagsHtml}
                </div>
            `;
            
            feedContainer.appendChild(newsItem);
        });
    }
});
