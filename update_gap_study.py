import yfinance as yf
import pandas as pd
import json
import os
from datetime import datetime
from dateutil.relativedelta import relativedelta
from zoneinfo import ZoneInfo
import numpy as np

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)
JSON_OUTPUT = os.path.join(DATA_DIR, "gap_data.json")

def bucket_size_vectorized(pct, gdir):
    if pd.isna(gdir): return None
    if pct < 0.5: return "<0.5%"
    elif pct < 1.0: return "0.5%-1%"
    elif pct < 2.0: return "1%-2%"
    elif pct < 3.0: return "2%-3%"
    else: return ">=3%"

def analyze_gaps(df):
    df = df.copy()
    df['Prev_Close'] = df['Close'].shift(1)
    df['Prev_High'] = df['High'].shift(1)
    df['Prev_Low'] = df['Low'].shift(1)
    df = df.dropna()

    o, h, l, c = df['Open'], df['High'], df['Low'], df['Close']
    pc, ph, pl = df['Prev_Close'], df['Prev_High'], df['Prev_Low']

    # Classic
    up_classic = o > pc
    down_classic = o < pc

    classic_gap_pct = pd.Series(0.0, index=df.index)
    classic_gap_pct[up_classic] = (o - pc) / pc * 100
    classic_gap_pct[down_classic] = (pc - o) / pc * 100

    classic_gap_dir = pd.Series(None, index=df.index)
    classic_gap_dir[up_classic] = "Up"
    classic_gap_dir[down_classic] = "Down"

    classic_filled = pd.Series(False, index=df.index)
    classic_filled[up_classic] = l <= pc
    classic_filled[down_classic] = h >= pc

    # Range
    up_range = o > ph
    down_range = o < pl

    range_gap_pct = pd.Series(0.0, index=df.index)
    range_gap_pct[up_range] = (o - ph) / ph * 100
    range_gap_pct[down_range] = (pl - o) / pl * 100

    range_gap_dir = pd.Series(None, index=df.index)
    range_gap_dir[up_range] = "Up"
    range_gap_dir[down_range] = "Down"

    range_filled = pd.Series(False, index=df.index)
    range_filled[up_range] = l <= ph
    range_filled[down_range] = h >= pl

    # Apply buckets
    classic_bucket = [bucket_size_vectorized(p, d) for p, d in zip(classic_gap_pct, classic_gap_dir)]
    range_bucket = [bucket_size_vectorized(p, d) for p, d in zip(range_gap_pct, range_gap_dir)]

    res_df = pd.DataFrame({
        "date": df.index,
        "classic_dir": classic_gap_dir,
        "classic_pct": classic_gap_pct,
        "classic_bucket": classic_bucket,
        "classic_filled": classic_filled,
        "range_dir": range_gap_dir,
        "range_pct": range_gap_pct,
        "range_bucket": range_bucket,
        "range_filled": range_filled,
        "open": o,
        "prev_close": pc,
        "prev_high": ph,
        "prev_low": pl
    })
    
    return res_df

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
    
    print("Downloading max historical data for SPY & QQQ...")
    df_batch = yf.download(tickers, period="max", auto_adjust=True, group_by="ticker", threads=True)
    
    for ticker in tickers:
        print(f"Processing {ticker}...")
        df = df_batch[ticker].copy()
        df = df.dropna(subset=['Close'])
        
        if df.empty:
            continue
            
        df.index = df.index.tz_localize(None)
        
        # Fast vectorized analysis
        df_gaps = analyze_gaps(df)
        
        last_date = df_gaps.iloc[-1]['date']
        is_today = (last_date.strftime("%Y-%m-%d") == today_str)
        
        if is_today:
            today_data = df_gaps.iloc[-1].to_dict()
            df_hist = df_gaps.iloc[:-1]
            end_date_for_stats = df_hist.iloc[-1]['date']
        else:
            today_data = None
            df_hist = df_gaps
            end_date_for_stats = df_hist.iloc[-1]['date']
            
        stats = {
            "5Y": aggregate_stats(df_hist, end_date_for_stats, 5),
            "10Y": aggregate_stats(df_hist, end_date_for_stats, 10),
            "30Y": aggregate_stats(df_hist, end_date_for_stats, 30)
        }
        
        today_summary = None
        if today_data:
            today_summary = {
                "date": today_str,
                "classic_dir": today_data.get("classic_dir"),
                "classic_pct": round(today_data.get("classic_pct", 0), 2) if today_data.get("classic_pct") else 0,
                "classic_bucket": today_data.get("classic_bucket"),
                "range_dir": today_data.get("range_dir"),
                "range_pct": round(today_data.get("range_pct", 0), 2) if today_data.get("range_pct") else 0,
                "range_bucket": today_data.get("range_bucket"),
                "open": round(today_data.get("open", 0), 2),
                "prev_close": round(today_data.get("prev_close", 0), 2),
                "prev_high": round(today_data.get("prev_high", 0), 2),
                "prev_low": round(today_data.get("prev_low", 0), 2)
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
