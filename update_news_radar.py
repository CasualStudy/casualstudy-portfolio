import feedparser
import json
import os
from datetime import datetime

DATA_FILE = "data/news_radar.json"
MAX_ITEMS = 500

def categorize_news(title):
    title_lower = title.lower()
    
    # Categories and their keywords
    categories = {
        "M&A": ["acquire", "merger", "buyout", "definitive agreement", "take-private"],
        "Earnings": ["financial results", "earnings", "reports record revenue", "raises guidance", "outlook", "preliminary results", "q1", "q2", "q3", "q4"],
        "Buyback": ["share repurchase", "stock buyback"],
        "Stock Split": ["stock split", "forward stock split"],
        "Dividend": ["declares dividend", "dividend yield"],
        "Offering": ["public offering", "private placement", "pricing of"],
        "FDA": ["fda approves", "fda clearance", "complete response letter"],
        "Index Changes": ["s&p 500", "spx", "nasdaq-100", "nasdaq 100", "dow jones indices"],
        "Executive Changes": ["appoints", "names new", "steps down", "resigns", "board of directors"]
    }
    
    tags = []
    
    for category, keywords in categories.items():
        if any(kw in title_lower for kw in keywords):
            tags.append(category)
            
    # Default tag if none matched
    if not tags:
        tags.append("Other")
        
    return tags

def fetch_and_process_news():
    url = "https://www.prnewswire.com/rss/financial-services-latest-news/financial-services-latest-news-list.rss"
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Fetching PRNewswire RSS...")
    
    feed = feedparser.parse(url)
    
    if hasattr(feed, 'status') and feed.status != 200:
        print(f"Error fetching feed: Status {feed.status}")
        return

    new_items = []
    
    for entry in feed.entries:
        tags = categorize_news(entry.title)
        
        news_item = {
            "title": entry.title,
            "published": entry.published,
            "link": entry.link,
            "id": entry.id if hasattr(entry, 'id') else entry.link,
            "tags": tags
        }
        new_items.append(news_item)
        
    print(f"Fetched {len(new_items)} news items. Processing for updates...")
    save_to_json(new_items)

def save_to_json(new_items):
    os.makedirs("data", exist_ok=True)
    
    existing_data = []
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            try:
                existing_data = json.load(f)
            except json.JSONDecodeError:
                pass
                
    existing_ids = {item['id'] for item in existing_data}
    
    added_count = 0
    # Process backwards so the most recent ends up at index 0 when inserting
    for item in reversed(new_items):
        if item['id'] not in existing_ids:
            existing_data.insert(0, item)
            existing_ids.add(item['id'])
            added_count += 1
            print(f"⭐ New Article: [{', '.join(item['tags'])}] {item['title']}")
            
    if added_count > 0:
        # Keep only the latest MAX_ITEMS
        existing_data = existing_data[:MAX_ITEMS]
        
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(existing_data, f, ensure_ascii=False, indent=4)
        print(f"Saved {added_count} new items. Total items: {len(existing_data)}")
    else:
        print("No new articles to add.")

if __name__ == "__main__":
    fetch_and_process_news()
