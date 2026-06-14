import requests
from bs4 import BeautifulSoup
import json
import os
from datetime import datetime
import time

# Configurations
BASE_URL = "https://quantpedia.com/screener/?free=1"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}
DB_PATH = os.path.join(os.path.dirname(__file__), 'papers_database.json')

def load_database():
    """Load existing papers database to avoid duplicates."""
    if os.path.exists(DB_PATH):
        with open(DB_PATH, 'r', encoding='utf-8') as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return []
    return []

def save_database(data):
    """Save papers to the database file."""
    with open(DB_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)
    print(f"✅ Saved {len(data)} total papers to database.")

def scrape_quantpedia_free_strategies():
    """Scrape the first page of Quantpedia free strategies."""
    print(f"⏳ Fetching data from {BASE_URL}...")
    try:
        response = requests.get(BASE_URL, headers=HEADERS, timeout=10)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to fetch Quantpedia: {e}")
        return []

    soup = BeautifulSoup(response.text, 'html.parser')
    
    # Quantpedia typically lists strategies in a grid/table
    # The exact CSS selector might change, we look for strategy links
    strategies = []
    
    # We look for common strategy row or card patterns in Quantpedia
    # Currently Quantpedia uses 'tr' or divs with 'strategy-row' / 'screener-row'
    rows = soup.select('.screener-table tbody tr')
    
    if not rows:
        print("⚠️ Could not find strategy rows. The site layout might have changed or Cloudflare blocked the request.")
        # Fallback to general links if table fails (for demonstration)
        links = soup.select('a')
        for a in links:
            href = a.get('href', '')
            if '/screener/details/' in href or '/strategy/' in href:
                title = a.get_text(strip=True)
                if title and len(title) > 5:
                    strategies.append({
                        "id": href.split('/')[-2] if href.endswith('/') else href.split('/')[-1],
                        "title_en": title,
                        "source_url": href if href.startswith('http') else f"https://quantpedia.com{href}",
                        "excerpt_en": "Needs further scraping to get detailed abstract.",
                        "date_scraped": datetime.now().isoformat(),
                        "source": "Quantpedia"
                    })
    else:
        for row in rows:
            title_elem = row.select_one('.strategy-title a')
            if title_elem:
                title = title_elem.get_text(strip=True)
                link = title_elem['href']
                # Try to extract brief description if available in table
                desc_elem = row.select_one('.strategy-description')
                excerpt = desc_elem.get_text(strip=True) if desc_elem else "Description not available in list view."
                
                strategies.append({
                    "id": link.split('/')[-2] if link.endswith('/') else link.split('/')[-1],
                    "title_en": title,
                    "source_url": link if link.startswith('http') else f"https://quantpedia.com{link}",
                    "excerpt_en": excerpt,
                    "date_scraped": datetime.now().isoformat(),
                    "source": "Quantpedia"
                })

    return strategies

def main():
    print("🚀 Starting Quantpedia Scraper (Phase 2)...")
    db = load_database()
    existing_ids = {p.get('id') for p in db}
    
    new_strategies = scrape_quantpedia_free_strategies()
    print(f"📊 Found {len(new_strategies)} strategies on the current page.")
    
    added_count = 0
    for strat in new_strategies:
        if strat['id'] not in existing_ids:
            db.append(strat)
            added_count += 1
            
    print(f"➕ Added {added_count} new strategies to the database.")
    
    if added_count > 0 or not os.path.exists(DB_PATH):
        save_database(db)

if __name__ == "__main__":
    main()
