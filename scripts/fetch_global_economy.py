import os
import re
import json
import requests
from datetime import datetime, timezone
from collections import defaultdict

# OpenRouter API Endpoints
MODELS_API_URL = "https://openrouter.ai/api/v1/models"
RANKINGS_API_URL = "https://openrouter.ai/api/v1/datasets/rankings-daily"

DATA_FILE = "data/openrouter-global.json"
PRICES_FILE = "data/openrouter-prices.json"
USAGE_FILE = "data/openrouter-usage.json"


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
        return all_data, {"latest_date": data.get("latest_date")}

def merge_raw_usage(new_rankings):
    """
    Merge the newly fetched 30-day rankings data with the historical database.
    This ensures no raw usage data is ever lost.
    Returns the complete historical rankings data as a flat list.
    """
    # Load existing usage
    usage_history = {}
    if os.path.exists(USAGE_FILE):
        try:
            with open(USAGE_FILE, "r") as f:
                usage_history = json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            usage_history = {}

    # Merge new data
    for r in new_rankings:
        date = r.get("date", "")
        slug = r.get("model_permaslug", "")
        if not date or not slug:
            continue
            
        if date not in usage_history:
            usage_history[date] = {}
            
        usage_history[date][slug] = r

    # Save merged data
    os.makedirs(os.path.dirname(USAGE_FILE), exist_ok=True)
    with open(USAGE_FILE, "w") as f:
        json.dump(usage_history, f, indent=2)

    # Convert back to flat list for processing
    flat_list = []
    for date in sorted(usage_history.keys()):
        for slug in usage_history[date]:
            flat_list.append(usage_history[date][slug])
            
    return flat_list

def match_model(permaslug, models_dict):
    """
    Match a model_permaslug (e.g. 'deepseek/deepseek-v4-flash-20260423')
    to a model ID in the models dict.

    Strategy:
    1. Exact match
    2. Strip :variant suffix and try again
    3. Strip date suffix (e.g. -20260423) and try again
    4. Strip version suffix (e.g. -001, -002) and try again
    5. Handle Anthropic reversed naming (claude-X.Y-type -> claude-type-X.Y)
    6. Handle Anthropic new types (claude-N-fable -> claude-fable-N)
    7. Prefix matching as last resort
    """
    if permaslug in models_dict:
        return permaslug

    # Strip :variant suffix (e.g. "openai/gpt-4o:free" -> "openai/gpt-4o")
    base = permaslug.split(":")[0]
    if base in models_dict:
        return base

    # Strip trailing date suffix like -20260423 or -20250101
    no_date = re.sub(r"-\d{8}$", "", base)
    if no_date in models_dict:
        return no_date

    # Strip trailing version suffix like -001, -002
    no_ver = re.sub(r"-\d{3}$", "", no_date)
    if no_ver in models_dict:
        return no_ver

    # Handle Anthropic's reversed naming convention:
    # Rankings API:  anthropic/claude-4.6-sonnet  (version-type)
    # Models API:    anthropic/claude-sonnet-4.6  (type-version)
    flip_match = re.match(
        r"^(.*?/claude)-(\d+(?:\.\d+)?)-(sonnet|opus|haiku|fable)(.*?)$", no_date
    )
    if flip_match:
        prefix, version, model_type, suffix = flip_match.groups()
        flipped = f"{prefix}-{model_type}-{version}{suffix}"
        if flipped in models_dict:
            return flipped
        # Also try with -fast suffix variant
        if f"{flipped}-fast" in models_dict:
            return f"{flipped}-fast"

    # Collect all candidate names to try prefix matching on
    variants = {base, no_date, no_ver}

    # Try prefix matching: find the model whose ID is a prefix of the permaslug
    # e.g. "google/gemini-2.5-flash" matches "google/gemini-2.5-flash-preview-05-20"
    candidates = []
    for model_id in models_dict:
        for v in variants:
            if v.startswith(model_id) or model_id.startswith(v):
                candidates.append(model_id)
                break

    if candidates:
        # Pick the longest matching ID (most specific)
        candidates.sort(key=len, reverse=True)
        return candidates[0]

    return None


def process_rankings(rankings_data, models_dict, prices_history):
    """
    Process the raw rankings data (which spans ~30 days) into
    per-date revenue entries, using historical prices if available.

    Returns: (result_dict, unmatched_list, updated_prices_history)
    """
    # Group records by date
    by_date = {}
    # Track unmatched models for warnings
    unmatched = defaultdict(lambda: {"dates": [], "total_tokens": 0})

    # Step 1: Ensure today's full live pricing snapshot is saved.
    today_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    def snapshot_all_models():
        return {
            m_id: (info["prompt_price"] + info["completion_price"]) / 2
            for m_id, info in models_dict.items()
        }

    if today_utc not in prices_history:
        prices_history[today_utc] = snapshot_all_models()

    # Step 2: Ensure any past date present in rankings ALSO gets a full snapshot if missing models.
    for r in rankings_data:
        date = r.get("date", "")
        if date:
            if date not in prices_history:
                prices_history[date] = snapshot_all_models()
            else:
                # Merge missing models into existing date
                snapshot = snapshot_all_models()
                for m_id, price in snapshot.items():
                    if m_id not in prices_history[date]:
                        prices_history[date][m_id] = price

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
            unmatched[slug]["dates"].append(date)
            unmatched[slug]["total_tokens"] += total_tokens
            continue

        m_info = models_dict[matched_id]

        # Get historical price from the full snapshot
        avg_price = prices_history[date].get(matched_id)
        if avg_price is None:
            # Fallback if model wasn't in snapshot (e.g. brand new model just added today)
            avg_price = (m_info["prompt_price"] + m_info["completion_price"]) / 2
            prices_history[date][matched_id] = avg_price

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

    return result, dict(unmatched), prices_history


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

    # Merge and get full historical usage
    full_rankings_data = merge_raw_usage(rankings_data)

    # Load historical prices
    prices_history = {}
    if os.path.exists(PRICES_FILE):
        try:
            with open(PRICES_FILE, "r") as f:
                prices_history = json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            prices_history = {}

    daily_results, unmatched, updated_prices = process_rankings(full_rankings_data, models, prices_history)

    if not daily_results:
        print("No revenue data could be calculated (model matching failed). Exiting.")
        return

    # === UNMATCHED MODEL WARNINGS ===
    if unmatched:
        print(f"\n⚠️  WARNING: {len(unmatched)} model(s) could not be matched to pricing data!")
        print("=" * 70)
        for slug, info in sorted(unmatched.items(), key=lambda x: -x[1]["total_tokens"]):
            tokens_b = info['total_tokens'] / 1e9
            days = len(info['dates'])
            date_range = f"{info['dates'][0]} ~ {info['dates'][-1]}"
            print(f"  {slug}")
            print(f"    Days: {days}  |  Tokens: {tokens_b:.1f}B  |  Range: {date_range}")
            # GitHub Actions annotation format for CI visibility
            print(f"::warning::Unmatched model: {slug} "
                  f"({tokens_b:.1f}B tokens over {days} days)")
        print("=" * 70)
        print("  These models' revenue is NOT included in the total.")
        print("  To fix: update match_model() or check if model was removed from /models API.")
        print()

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

    # Save global economy data
    with open(DATA_FILE, "w") as f:
        json.dump(history, f, indent=2)

    # Save updated prices history
    with open(PRICES_FILE, "w") as f:
        json.dump(updated_prices, f, indent=2)

    latest_date = sorted(daily_results.keys())[-1]
    latest = daily_results[latest_date]
    print(f"\n✅ Successfully processed {len(daily_results)} days of data.")
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
