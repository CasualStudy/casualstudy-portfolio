import os
import json
import requests
from datetime import datetime, timezone

# OpenRouter API Endpoints
MODELS_API_URL = "https://openrouter.ai/api/v1/models"
RANKINGS_API_URL = "https://openrouter.ai/api/v1/datasets/rankings-daily"

DATA_FILE = "data/openrouter-global.json"


def fetch_models():
    """Fetch all models and their pricing from OpenRouter."""
    print("Fetching models pricing...")
    try:
        response = requests.get(MODELS_API_URL)
        response.raise_for_status()
        data = response.json().get("data", [])
        models_dict = {}
        for m in data:
            model_id = m["id"]
            prompt_price = float(m.get("pricing", {}).get("prompt", 0))
            completion_price = float(m.get("pricing", {}).get("completion", 0))
            models_dict[model_id] = {
                "name": m.get("name", model_id),
                "prompt_price": prompt_price,
                "completion_price": completion_price,
            }
        print(f"  Loaded {len(models_dict)} models with pricing.")
        return models_dict
    except Exception as e:
        print(f"Error fetching models: {e}")
        return {}


def fetch_rankings(api_key):
    """Fetch daily rankings (total token usage per model) from OpenRouter."""
    if not api_key:
        print("No OPENROUTER_API_KEY found. Cannot fetch rankings.")
        return [], {}

    headers = {
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": "https://casualstudy.site",
        "X-Title": "CasualStudy Global AI Economy Tracker",
    }

    try:
        response = requests.get(RANKINGS_API_URL, headers=headers)
        if response.status_code == 200:
            payload = response.json()
            data = payload.get("data", [])
            meta = payload.get("meta", {})
            print(f"  Rankings API returned {len(data)} records "
                  f"({meta.get('start_date', '?')} to {meta.get('end_date', '?')}).")
            return data, meta
        else:
            print(f"Rankings API returned {response.status_code}: {response.text[:200]}")
            return [], {}
    except Exception as e:
        print(f"Error fetching rankings: {e}")
        return [], {}


def match_model(permaslug, models_dict):
    """
    Match a model_permaslug (e.g. 'deepseek/deepseek-v4-flash-20260423')
    to a model ID in the models dict.

    Strategy:
    1. Exact match
    2. Strip :variant suffix and try again
    3. Strip date suffix (e.g. -20260423) and try again
    4. Try matching base slug (provider/model-name) prefix
    """
    if permaslug in models_dict:
        return permaslug

    # Strip :variant suffix (e.g. "openai/gpt-4o:free" -> "openai/gpt-4o")
    base = permaslug.split(":")[0]
    if base in models_dict:
        return base

    # Strip trailing date suffix like -20260423 or -20250101
    import re
    no_date = re.sub(r"-\d{8}$", "", base)
    if no_date in models_dict:
        return no_date

    # Try prefix matching: find the model whose ID is a prefix of the permaslug
    # e.g. "google/gemini-2.5-flash" matches "google/gemini-2.5-flash-preview-05-20"
    candidates = []
    for model_id in models_dict:
        if base.startswith(model_id) or model_id.startswith(base):
            candidates.append(model_id)

    if candidates:
        # Pick the longest matching ID (most specific)
        candidates.sort(key=len, reverse=True)
        return candidates[0]

    return None


def process_rankings(rankings_data, models_dict):
    """
    Process the raw rankings data (which spans ~30 days) into
    per-date revenue entries.

    Returns a dict: { "2026-06-20": { "total_revenue": ..., "models": [...] }, ... }
    """
    # Group records by date
    by_date = {}
    for r in rankings_data:
        slug = r.get("model_permaslug", "")
        # Skip the aggregate "other" row
        if slug == "other":
            continue

        date = r.get("date", "")
        if not date:
            continue

        total_tokens = int(r.get("total_tokens", 0))
        if total_tokens == 0:
            continue

        matched_id = match_model(slug, models_dict)
        if not matched_id:
            continue

        m_info = models_dict[matched_id]

        # Estimate revenue: use average of prompt and completion price
        # since the API only provides total_tokens (not split by prompt/completion)
        avg_price = (m_info["prompt_price"] + m_info["completion_price"]) / 2
        revenue = total_tokens * avg_price

        if date not in by_date:
            by_date[date] = []

        by_date[date].append({
            "id": matched_id,
            "name": m_info["name"],
            "revenue": round(revenue, 2),
            "total_tokens": total_tokens,
        })

    # Build per-date summaries
    result = {}
    for date, model_list in by_date.items():
        # Sort by revenue descending
        model_list.sort(key=lambda x: x["revenue"], reverse=True)
        total_rev = sum(m["revenue"] for m in model_list)
        result[date] = {
            "total_revenue": round(total_rev, 2),
            "models": model_list[:20],  # Top 20 for dashboard
            "model_count": len(model_list),
        }

    return result


def main():
    api_key = os.environ.get("OPENROUTER_API_KEY")

    models = fetch_models()
    if not models:
        print("Failed to fetch models. Exiting.")
        return

    rankings_data, meta = fetch_rankings(api_key)
    if not rankings_data:
        print("No rankings data available. Exiting.")
        return

    daily_results = process_rankings(rankings_data, models)

    if not daily_results:
        print("No revenue data could be calculated (model matching failed). Exiting.")
        return

    # Read existing history
    history = []
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, "r") as f:
                history = json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            history = []

    # Build a lookup of existing dates
    existing_dates = {h["date"] for h in history}

    # Merge new data: update existing dates, add new ones
    new_count = 0
    updated_count = 0
    for date in sorted(daily_results.keys()):
        entry = {
            "date": date,
            "total_revenue": daily_results[date]["total_revenue"],
            "models": daily_results[date]["models"],
        }
        if date in existing_dates:
            # Update existing entry
            history = [h if h["date"] != date else entry for h in history]
            updated_count += 1
        else:
            history.append(entry)
            new_count += 1

    # Sort history by date
    history.sort(key=lambda x: x["date"])

    # Ensure directory exists
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)

    # Save
    with open(DATA_FILE, "w") as f:
        json.dump(history, f, indent=2)

    latest_date = sorted(daily_results.keys())[-1]
    latest = daily_results[latest_date]
    print(f"\nSuccessfully processed {len(daily_results)} days of data.")
    print(f"  New dates added: {new_count}")
    print(f"  Existing dates updated: {updated_count}")
    print(f"  Total history entries: {len(history)}")
    print(f"\nLatest date: {latest_date}")
    print(f"  Models matched: {latest['model_count']}")
    print(f"  Est. daily market revenue: ${latest['total_revenue']:,.2f}")
    if latest["models"]:
        print(f"  #1 model: {latest['models'][0]['name']} "
              f"(${latest['models'][0]['revenue']:,.2f})")


if __name__ == "__main__":
    main()
