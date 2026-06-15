import json
import requests
import pandas as pd
import yfinance as yf
from fake_useragent import UserAgent
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import os

# Configuration
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
FNG_CSV = os.path.join(DATA_DIR, "all_fng_csv4.csv")
SPX_CSV = os.path.join(DATA_DIR, "SPX_data.csv")
JSON_OUTPUT = os.path.join(DATA_DIR, "fng_data.json")
YEARS = 6

ET = ZoneInfo("America/New_York")
UA = UserAgent()
CNN_BASE_URL = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata/"

def now_et_naive():
    return datetime.now(ET).replace(tzinfo=None)

def fetch_fng_from_cnn(start_date):
    headers = {"User-Agent": UA.random}
    try:
        r = requests.get(CNN_BASE_URL + start_date, headers=headers, timeout=15)
        r.raise_for_status()
        data = r.json()
        records = []
        for item in data["fear_and_greed_historical"]["data"]:
            ts = item["x"] / 1000
            date_str = datetime.fromtimestamp(ts, tz=ET).strftime("%Y-%m-%d")
            records.append({"Date": date_str, "Fear Greed": item["y"]})
        return pd.DataFrame(records)
    except Exception as e:
        print(f"CNN API request failed: {e}")
        return pd.DataFrame()

def find_fng_gap_start(df_local):
    df_nz = df_local[df_local["Fear Greed"] != 0]
    if df_nz.empty:
        return None
    dates = df_nz.index.sort_values()
    for i in range(1, len(dates)):
        gap_days = (dates[i] - dates[i - 1]).days
        if gap_days > 7:
            return dates[i - 1]
    return None

def update_fng_data():
    if os.path.exists(FNG_CSV):
        df_local = pd.read_csv(FNG_CSV)
        df_local["Date"] = pd.to_datetime(df_local["Date"])
        df_local = df_local.drop_duplicates(subset="Date", keep="last")
        df_local.set_index("Date", inplace=True)
    else:
        print(f"File {FNG_CSV} not found, initializing fresh.")
        df_local = pd.DataFrame(columns=["Date", "Fear Greed"]).set_index("Date")

    if not df_local.empty:
        gap_start = find_fng_gap_start(df_local)
        if gap_start is not None:
            start_date = (gap_start - timedelta(days=5)).strftime("%Y-%m-%d")
            print(f"Detected data gap after {gap_start.strftime('%Y-%m-%d')}, fetching from {start_date} ...")
        else:
            df_nz = df_local[df_local["Fear Greed"] != 0]
            last_valid = df_nz.index[-1] if not df_nz.empty else df_local.index[0]
            start_date = (last_valid - timedelta(days=5)).strftime("%Y-%m-%d")
            print(f"No gaps detected. Fetching FNG data from {start_date} ...")
    else:
        start_date = (now_et_naive() - timedelta(days=YEARS * 365 + 30)).strftime("%Y-%m-%d")
        print(f"Fetching FNG data from {start_date} ...")

    df_new = fetch_fng_from_cnn(start_date)
    if not df_new.empty:
        df_new["Date"] = pd.to_datetime(df_new["Date"])
        df_new = df_new.drop_duplicates(subset="Date", keep="last")
        df_new.set_index("Date", inplace=True)
        if not df_local.empty:
            combined = pd.concat([df_local, df_new])
            combined = combined[~combined.index.duplicated(keep="last")]
        else:
            combined = df_new
        combined.sort_index(inplace=True)
        combined.to_csv(FNG_CSV)
        print(f"FNG data updated, latest: {combined.index[-1].strftime('%Y-%m-%d')}")
        return combined
    else:
        print("FNG data: using local data only")

    return df_local

def update_spx_data():
    if os.path.exists(SPX_CSV):
        df_spx = pd.read_csv(SPX_CSV, index_col=0)
        df_spx.index = pd.to_datetime(df_spx.index)
        df_spx.index.name = "time"
    else:
        df_spx = pd.DataFrame()

    today = now_et_naive().date()
    
    if not df_spx.empty:
        last_date = df_spx.index[-1]
        if last_date.date() >= today:
            print(f"SPX data already up to date: {last_date.strftime('%Y-%m-%d')}")
            return df_spx
        start = last_date + timedelta(days=1)
    else:
        start = today - timedelta(days=YEARS * 365 + 30)
        
    print(f"Fetching SPX data from {start.strftime('%Y-%m-%d')} to today...")
    try:
        ticker = yf.Ticker("^GSPC")
        df_new = ticker.history(start=start.strftime("%Y-%m-%d"), end=(today + timedelta(days=1)).strftime("%Y-%m-%d"))
        if not df_new.empty:
            df_new.index = df_new.index.tz_localize(None)
            df_new = df_new[["Open", "High", "Low", "Close"]].copy()
            df_new.columns = ["open", "high", "low", "close"]
            df_new["USI:ADDQ: close"] = ""
            if not df_spx.empty:
                df_spx = pd.concat([df_spx, df_new])
            else:
                df_spx = df_new
            df_spx.sort_index(inplace=True)
            df_spx.index.name = "time"
            df_spx.to_csv(SPX_CSV)
            print(f"SPX data updated, latest: {df_spx.index[-1].strftime('%Y-%m-%d')}")
        else:
            print("No new SPX data available")
    except Exception as e:
        print(f"yfinance fetch failed: {e}")

    return df_spx

def get_sentiment(fng_value):
    if fng_value <= 25:
        return "Extreme Fear"
    elif fng_value <= 45:
        return "Fear"
    elif fng_value <= 55:
        return "Neutral"
    elif fng_value <= 75:
        return "Greed"
    else:
        return "Extreme Greed"

def export_json(df_fng, df_spx):
    cutoff = now_et_naive() - timedelta(days=YEARS * 365)
    df_fng = df_fng[df_fng.index >= cutoff].copy()
    df_spx = df_spx[df_spx.index >= cutoff].copy()

    df_fng = df_fng[df_fng["Fear Greed"] != 0]

    df_merged = df_fng[["Fear Greed"]].join(df_spx[["close"]], how="inner")
    df_merged.columns = ["Fear Greed", "SPX"]
    df_merged.dropna(subset=["Fear Greed"], inplace=True)
    
    # Fill any NaN SPX values with forward fill, just in case
    df_merged["SPX"] = df_merged["SPX"].ffill()
    df_merged.dropna(inplace=True)

    # Format for JSON output
    data = {
        "dates": df_merged.index.strftime("%Y-%m-%d").tolist(),
        "fng": df_merged["Fear Greed"].tolist(),
        "spx": df_merged["SPX"].tolist(),
        "latest": {
            "date": df_merged.index[-1].strftime("%Y-%m-%d"),
            "fng": round(df_merged["Fear Greed"].iloc[-1], 1),
            "spx": round(df_merged["SPX"].iloc[-1], 2),
            "sentiment": get_sentiment(df_merged["Fear Greed"].iloc[-1])
        }
    }

    with open(JSON_OUTPUT, 'w') as f:
        json.dump(data, f)
        
    print(f"Successfully exported data to {JSON_OUTPUT}")
    print(f"Latest FNG: {data['latest']['fng']} ({data['latest']['sentiment']}), SPX: {data['latest']['spx']}")

if __name__ == "__main__":
    df_fng = update_fng_data()
    df_spx = update_spx_data()
    export_json(df_fng, df_spx)
