import yfinance as yf
import pandas as pd
import json
import os
from datetime import datetime
from dateutil.relativedelta import relativedelta
from zoneinfo import ZoneInfo

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)
JSON_OUTPUT = os.path.join(DATA_DIR, "gap_data.json")

def bucket_size(gap_pct):
    if gap_pct < 0.5:
        return "<0.5%"
    elif gap_pct < 1.0:
        return "0.5%-1%"
    elif gap_pct < 2.0:
        return "1%-2%"
    elif gap_pct < 3.0:
        return "2%-3%"
    else:
        return ">=3%"

def analyze_gaps(df):
    df = df.copy()
    # Calculate prev day stats
    df['Prev_Close'] = df['Close'].shift(1)
    df['Prev_High'] = df['High'].shift(1)
    df['Prev_Low'] = df['Low'].shift(1)
    
    # Drop first row (no prev data)
    df = df.dropna()
    
    results = []
    for date, row in df.iterrows():
        o, h, l, c = row['Open'], row['High'], row['Low'], row['Close']
        pc, ph, pl = row['Prev_Close'], row['Prev_High'], row['Prev_Low']
        
        # Classic Gap
        classic_gap_dir = None
        classic_gap_pct = 0.0
        classic_filled = False
        
        if o > pc:
            classic_gap_dir = "Up"
            classic_gap_pct = (o - pc) / pc * 100
            if l <= pc:
                classic_filled = True
        elif o < pc:
            classic_gap_dir = "Down"
            classic_gap_pct = (pc - o) / pc * 100
            if h >= pc:
                classic_filled = True
                
        # Range Gap
        range_gap_dir = None
        range_gap_pct = 0.0
        range_filled = False
        
        if o > ph:
            range_gap_dir = "Up"
            range_gap_pct = (o - ph) / ph * 100
            if l <= ph:
                range_filled = True
        elif o < pl:
            range_gap_dir = "Down"
            range_gap_pct = (pl - o) / pl * 100
            if h >= pl:
                range_filled = True
                
        results.append({
            "date": date,
            "classic_dir": classic_gap_dir,
            "classic_pct": classic_gap_pct,
            "classic_bucket": bucket_size(classic_gap_pct) if classic_gap_dir else None,
            "classic_filled": classic_filled,
            "range_dir": range_gap_dir,
            "range_pct": range_gap_pct,
            "range_bucket": bucket_size(range_gap_pct) if range_gap_dir else None,
            "range_filled": range_filled,
            "open": o,
            "prev_close": pc,
            "prev_high": ph,
            "prev_low": pl
        })
    return pd.DataFrame(results)

def aggregate_stats(df_gaps, end_date, years):
    start_date = end_date - relativedelta(years=years)
    mask = df_gaps['date'] >= pd.Timestamp(start_date)
    df_period = df_gaps[mask]
    
    stats = {
        "Classic": {"Up": {}, "Down": {}},
        "Range": {"Up": {}, "Down": {}}
    }
    
    buckets = ["<0.5%", "0.5%-1%", "1%-2%", "2%-3%", ">=3%"]
    
    for b in buckets:
        for d in ["Up", "Down"]:
            # Classic
            c_subset = df_period[(df_period['classic_dir'] == d) & (df_period['classic_bucket'] == b)]
            c_total = len(c_subset)
            c_filled = c_subset['classic_filled'].sum()
            stats["Classic"][d][b] = {
                "total": int(c_total),
                "filled": int(c_filled),
                "prob": round(c_filled / c_total * 100, 1) if c_total > 0 else 0
            }
            
            # Range
            r_subset = df_period[(df_period['range_dir'] == d) & (df_period['range_bucket'] == b)]
            r_total = len(r_subset)
            r_filled = r_subset['range_filled'].sum()
            stats["Range"][d][b] = {
                "total": int(r_total),
                "filled": int(r_filled),
                "prob": round(r_filled / r_total * 100, 1) if r_total > 0 else 0
            }
            
    return stats

def main():
    et_tz = ZoneInfo("America/New_York")
    now_et = datetime.now(et_tz)
    today_str = now_et.strftime("%Y-%m-%d")
    
    tickers = ["SPY", "QQQ"]
    all_data = {}
    
    for ticker in tickers:
        print(f"Fetching {ticker}...")
        df = yf.Ticker(ticker).history(period="max", auto_adjust=True)
        if df.empty:
            continue
            
        # Ensure timezone-naive dates for easy filtering
        df.index = df.index.tz_localize(None)
        
        # Analyze all rows
        df_gaps = analyze_gaps(df)
        
        # Check if the last row is "today"
        last_date = df_gaps.iloc[-1]['date']
        is_today = (last_date.strftime("%Y-%m-%d") == today_str)
        
        if is_today:
            # Separate today's live data from historical stats
            today_data = df_gaps.iloc[-1].to_dict()
            df_hist = df_gaps.iloc[:-1]
            end_date_for_stats = df_hist.iloc[-1]['date']
        else:
            today_data = None
            df_hist = df_gaps
            end_date_for_stats = df_hist.iloc[-1]['date']
            
        # Aggregate 5Y, 10Y, 30Y
        stats = {
            "5Y": aggregate_stats(df_hist, end_date_for_stats, 5),
            "10Y": aggregate_stats(df_hist, end_date_for_stats, 10),
            "30Y": aggregate_stats(df_hist, end_date_for_stats, 30)
        }
        
        # Format today data
        today_summary = None
        if today_data:
            today_summary = {
                "date": today_str,
                "classic_dir": today_data["classic_dir"],
                "classic_pct": round(today_data["classic_pct"], 2),
                "classic_bucket": today_data["classic_bucket"],
                "range_dir": today_data["range_dir"],
                "range_pct": round(today_data["range_pct"], 2),
                "range_bucket": today_data["range_bucket"],
                "open": round(today_data["open"], 2),
                "prev_close": round(today_data["prev_close"], 2),
                "prev_high": round(today_data["prev_high"], 2),
                "prev_low": round(today_data["prev_low"], 2)
            }
            
        all_data[ticker] = {
            "today": today_summary,
            "stats": stats
        }
        
    output_json = {
        "last_updated": now_et.strftime("%Y-%m-%d %H:%M:%S %Z"),
        "data": all_data
    }
    
    with open(JSON_OUTPUT, 'w') as f:
        json.dump(output_json, f, indent=2)
        
    print(f"Data saved to {JSON_OUTPUT}")

if __name__ == "__main__":
    main()
