import requests
import json
import os
from datetime import datetime

# Configurations
GITHUB_API_URL = "https://api.github.com/search/repositories"
# To avoid hitting rate limits, the user can optionally add a token here later
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")

# Search query: look for repos mentioning SSRN replication or quantitative strategy in Python
SEARCH_QUERY = '("SSRN" OR "quantitative strategy" OR "factor investing") AND "replication" in:readme,description language:python'
DB_PATH = os.path.join(os.path.dirname(__file__), 'papers_database.json')

def load_database():
    if os.path.exists(DB_PATH):
        with open(DB_PATH, 'r', encoding='utf-8') as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return []
    return []

def save_database(data):
    with open(DB_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)
    print(f"✅ Saved {len(data)} total records to database.")

def scrape_github():
    print(f"🔍 Searching GitHub API for quantitative papers...")
    headers = {"Accept": "application/vnd.github.v3+json"}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"token {GITHUB_TOKEN}"

    params = {
        "q": SEARCH_QUERY,
        "sort": "stars",
        "order": "desc",
        "per_page": 10 # Just fetch top 10 for demonstration/daily batch
    }

    try:
        response = requests.get(GITHUB_API_URL, headers=headers, params=params, timeout=10)
        
        # Check if rate limited
        if response.status_code == 403:
            print("⚠️ GitHub API rate limit exceeded. Please configure a GITHUB_TOKEN or try again later.")
            return []
            
        response.raise_for_status()
        data = response.json()
    except Exception as e:
        print(f"❌ Failed to fetch from GitHub: {e}")
        return []

    repos = data.get('items', [])
    extracted = []
    
    for repo in repos:
        repo_name = repo.get("full_name")
        description = repo.get("description", "No description provided.")
        url = repo.get("html_url")
        stars = repo.get("stargazers_count")
        
        extracted.append({
            "id": f"github_{repo.get('id')}",
            "title_en": f"Replication Repo: {repo_name}",
            "source_url": url,
            "excerpt_en": f"[⭐ {stars} Stars] {description}",
            "date_scraped": datetime.now().isoformat(),
            "source": "GitHub"
        })

    return extracted

def main():
    print("🚀 Starting GitHub Scraper...")
    db = load_database()
    existing_ids = {p.get('id') for p in db}
    
    new_repos = scrape_github()
    print(f"📊 Found {len(new_repos)} relevant repositories.")
    
    added_count = 0
    for repo in new_repos:
        if repo['id'] not in existing_ids:
            db.append(repo)
            added_count += 1
            
    print(f"➕ Added {added_count} new GitHub sources to the database.")
    
    if added_count > 0 or not os.path.exists(DB_PATH):
        save_database(db)

if __name__ == "__main__":
    main()
