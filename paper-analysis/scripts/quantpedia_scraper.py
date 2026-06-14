import json
import os
from datetime import datetime
import time
import random
from playwright.sync_api import sync_playwright
from playwright_stealth import stealth_sync

# Configurations
BASE_URL = "https://quantpedia.com/screener/?free=1"
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

def scrape_quantpedia_with_playwright():
    strategies = []
    print(f"🕵️  Starting headless browser with Stealth mode...")
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Randomize User Agent slightly
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 800}
        )
        page = context.new_page()
        
        # Apply stealth to bypass Cloudflare
        stealth_sync(page)

        print(f"⏳ Navigating to {BASE_URL} ...")
        page.goto(BASE_URL, wait_until="networkidle")
        
        # Human-like delay
        time.sleep(random.uniform(2.5, 4.0))

        # Check for dynamic rows. Quantpedia might use .screener-row, .strategy-row or tr
        print("🔍 Searching for strategy links on the page...")
        
        # Wait for potential JS rendering
        try:
            page.wait_for_selector('a[href*="/screener/details/"]', timeout=5000)
        except Exception:
            print("⚠️ Timeout waiting for specific selector, attempting general link extraction.")

        # Extract all links that look like a strategy
        links = page.locator('a').all()
        for link in links:
            href = link.get_attribute('href')
            if href and ('/screener/details/' in href or '/strategy/' in href):
                title = link.inner_text().strip()
                if title and len(title) > 5 and title.lower() != 'read more':
                    strategies.append({
                        "id": f"qp_{href.split('/')[-2] if href.endswith('/') else href.split('/')[-1]}",
                        "title_en": title,
                        "source_url": href if href.startswith('http') else f"https://quantpedia.com{href}",
                        "excerpt_en": "Needs further AI processing.",
                        "date_scraped": datetime.now().isoformat(),
                        "source": "Quantpedia"
                    })
                    
        browser.close()

    # Deduplicate within the same run just in case page has duplicate links
    unique_strategies = {strat['id']: strat for strat in strategies}.values()
    return list(unique_strategies)

def main():
    print("🚀 Starting Quantpedia Playwright Scraper...")
    db = load_database()
    existing_ids = {p.get('id') for p in db}
    
    new_strategies = scrape_quantpedia_with_playwright()
    print(f"📊 Found {len(new_strategies)} strategies on the current page.")
    
    added_count = 0
    for strat in new_strategies:
        if strat['id'] not in existing_ids:
            db.append(strat)
            added_count += 1
            
    print(f"➕ Added {added_count} new Quantpedia sources to the database.")
    
    if added_count > 0 or not os.path.exists(DB_PATH):
        save_database(db)

if __name__ == "__main__":
    main()
