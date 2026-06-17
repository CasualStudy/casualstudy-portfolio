import pandas as pd
import yfinance as yf
import requests
from io import StringIO
import datetime
import json
import os
from dateutil.relativedelta import relativedelta

CACHE_FILE = 'data/inclusion_raw_cache.json'
OUTPUT_FILE = 'data/inclusion_data.json'

def fetch_wiki_additions(url):
    print(f"Fetching additions from {url}...")
    headers = {'User-Agent': 'Mozilla/5.0'}
    response = requests.get(url, headers=headers)
    dfs = pd.read_html(StringIO(response.text))
    
    changes_df = None
    for df in dfs:
        if ('Added', 'Ticker') in df.columns:
            changes_df = df
            break
            
    if changes_df is None:
        print("Could not find the changes table.")
        return []
        
    additions = []
    for index, row in changes_df.iterrows():
        date_col = ('Date', 'Date') if ('Date', 'Date') in changes_df.columns else ('Effective Date', 'Effective Date')
        if date_col not in changes_df.columns:
            continue
            
        date_str = row[date_col]
        ticker = row[('Added', 'Ticker')]
        
        if pd.notna(ticker) and pd.notna(date_str):
            try:
                clean_date_str = str(date_str).split('[')[0].strip()
                dt = pd.to_datetime(clean_date_str).date()
                additions.append((dt, str(ticker).replace('.', '-')))
            except Exception as e:
                pass
                
    return additions

def load_cache():
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r') as f:
                return json.load(f)
        except:
            pass
    return {}

def save_cache(cache_data):
    os.makedirs('data', exist_ok=True)
    with open(CACHE_FILE, 'w') as f:
        json.dump(cache_data, f, indent=4)

def process_single_ticker(ticker, eff_date, df):
    # Ensure timezone naive and sort
    df.index = df.index.tz_localize(None)
    df = df.sort_index()
    
    future_dates = df.index[df.index.date >= eff_date]
    if len(future_dates) == 0:
        return None
        
    eff_dt = future_dates[0]
    loc = df.index.get_loc(eff_dt)
    
    if loc < 5:
        return None
        
    p_pre = float(df.iloc[loc - 5]['Close'])
    p_eff = float(df.iloc[loc]['Close'])
    
    daily_intraday = (df['Close'] - df['Open']) / df['Open']
    intraday_pre = float(daily_intraday.iloc[loc - 5 : loc + 1].sum())
    ret_pre = (p_eff - p_pre) / p_pre
    
    result = {
        "eff_date": eff_date.strftime("%Y-%m-%d"),
        "ticker": ticker,
        "pre_ret": ret_pre,
        "pre_intraday": intraday_pre,
        "post1w_ret": None, "post1w_intraday": None,
        "post1m_ret": None, "post1m_intraday": None,
        "post1y_ret": None, "post1y_intraday": None
    }

    if loc + 5 < len(df):
        p_post1w = float(df.iloc[loc + 5]['Close'])
        result["post1w_ret"] = (p_post1w - p_eff) / p_eff
        result["post1w_intraday"] = float(daily_intraday.iloc[loc + 1 : loc + 6].sum())
            
    if loc + 21 < len(df):
        p_post1m = float(df.iloc[loc + 21]['Close'])
        result["post1m_ret"] = (p_post1m - p_eff) / p_eff
        result["post1m_intraday"] = float(daily_intraday.iloc[loc + 1 : loc + 22].sum())
            
    if loc + 252 < len(df):
        p_post1y = float(df.iloc[loc + 252]['Close'])
        result["post1y_ret"] = (p_post1y - p_eff) / p_eff
        result["post1y_intraday"] = float(daily_intraday.iloc[loc + 1 : loc + 253].sum())

    return result

def calculate_returns(additions, cache):
    today = datetime.date.today()
    cutoff_20y = today - relativedelta(years=20)
    
    recent_additions = [item for item in additions if item[0] >= cutoff_20y]
    
    missing_additions = []
    for eff_date, ticker in recent_additions:
        cache_key = f"{eff_date.strftime('%Y-%m-%d')}_{ticker}"
        
        needs_update = True
        if cache_key in cache:
            item = cache[cache_key]
            if item.get("failed"):
                needs_update = False
            # Check if all fields are populated
            elif item.get("post1y_ret") is not None:
                needs_update = False
            else:
                # If post1y is null, check if a year has passed
                if today > eff_date + relativedelta(years=1, days=14):
                    needs_update = True # Try to fetch again
                else:
                    # Still waiting for 1y to pass, but check if 1m is missing
                    if item.get("post1m_ret") is None and today > eff_date + relativedelta(days=45):
                        needs_update = True
                    elif item.get("post1w_ret") is None and today > eff_date + relativedelta(days=10):
                        needs_update = True
                    else:
                        needs_update = False # Wait patiently
        
        if needs_update:
            missing_additions.append((eff_date, ticker))
            
    if missing_additions:
        print(f"Fetching data for {len(missing_additions)} missing/incomplete items...")
        tickers_to_fetch = list(set([t for d, t in missing_additions]))
        start_date = str(cutoff_20y - datetime.timedelta(days=100))
        
        # Batch download
        if len(tickers_to_fetch) > 0:
            df_batch = yf.download(tickers_to_fetch, start=start_date, auto_adjust=True, group_by="ticker", threads=True)
            
            for eff_date, ticker in missing_additions:
                cache_key = f"{eff_date.strftime('%Y-%m-%d')}_{ticker}"
                try:
                    if len(tickers_to_fetch) == 1:
                        df_ticker = df_batch.copy()
                    else:
                        df_ticker = df_batch[ticker].copy()
                        
                    df_ticker = df_ticker.dropna(subset=['Close'])
                    if not df_ticker.empty:
                        res = process_single_ticker(ticker, eff_date, df_ticker)
                        if res:
                            cache[cache_key] = res
                        else:
                            # Cache failure to avoid redownloading next time
                            cache[cache_key] = {"failed": True, "eff_date": eff_date.strftime("%Y-%m-%d"), "ticker": ticker, "post1y_ret": None}
                    else:
                        # Cache empty to avoid redownloading next time
                        cache[cache_key] = {"failed": True, "eff_date": eff_date.strftime("%Y-%m-%d"), "ticker": ticker, "post1y_ret": None}
                except Exception as e:
                    cache[cache_key] = {"failed": True, "eff_date": eff_date.strftime("%Y-%m-%d"), "ticker": ticker, "post1y_ret": None}
    else:
        print("All historical data is up to date in cache. Skipping download.")

    # Aggregate results from cache
    results = {
        "1Y": {"pre_ret": [], "post1w_ret": [], "post1m_ret": [], "post1y_ret": [],
               "pre_intraday": [], "post1w_intraday": [], "post1m_intraday": [], "post1y_intraday": []},
        "10Y": {"pre_ret": [], "post1w_ret": [], "post1m_ret": [], "post1y_ret": [],
                "pre_intraday": [], "post1w_intraday": [], "post1m_intraday": [], "post1y_intraday": []},
        "20Y": {"pre_ret": [], "post1w_ret": [], "post1m_ret": [], "post1y_ret": [],
                "pre_intraday": [], "post1w_intraday": [], "post1m_intraday": [], "post1y_intraday": []}
    }
    
    cutoff_10y = today - relativedelta(years=10)
    cutoff_1y = today - relativedelta(years=1)

    for eff_date, ticker in recent_additions:
        cache_key = f"{eff_date.strftime('%Y-%m-%d')}_{ticker}"
        if cache_key in cache:
            res = cache[cache_key]
            # Populate results dict
            # pre
            if res.get("pre_ret") is not None:
                results["20Y"]["pre_ret"].append((res["pre_ret"], ticker))
                results["20Y"]["pre_intraday"].append(res["pre_intraday"])
                if eff_date >= cutoff_10y:
                    results["10Y"]["pre_ret"].append((res["pre_ret"], ticker))
                    results["10Y"]["pre_intraday"].append(res["pre_intraday"])
                if eff_date >= cutoff_1y:
                    results["1Y"]["pre_ret"].append((res["pre_ret"], ticker))
                    results["1Y"]["pre_intraday"].append(res["pre_intraday"])
            
            # post1w
            if res.get("post1w_ret") is not None:
                results["20Y"]["post1w_ret"].append((res["post1w_ret"], ticker))
                results["20Y"]["post1w_intraday"].append(res["post1w_intraday"])
                if eff_date >= cutoff_10y:
                    results["10Y"]["post1w_ret"].append((res["post1w_ret"], ticker))
                    results["10Y"]["post1w_intraday"].append(res["post1w_intraday"])
                if eff_date >= cutoff_1y:
                    results["1Y"]["post1w_ret"].append((res["post1w_ret"], ticker))
                    results["1Y"]["post1w_intraday"].append(res["post1w_intraday"])
                    
            # post1m
            if res.get("post1m_ret") is not None:
                results["20Y"]["post1m_ret"].append((res["post1m_ret"], ticker))
                results["20Y"]["post1m_intraday"].append(res["post1m_intraday"])
                if eff_date >= cutoff_10y:
                    results["10Y"]["post1m_ret"].append((res["post1m_ret"], ticker))
                    results["10Y"]["post1m_intraday"].append(res["post1m_intraday"])
                if eff_date >= cutoff_1y:
                    results["1Y"]["post1m_ret"].append((res["post1m_ret"], ticker))
                    results["1Y"]["post1m_intraday"].append(res["post1m_intraday"])

            # post1y
            if res.get("post1y_ret") is not None:
                results["20Y"]["post1y_ret"].append((res["post1y_ret"], ticker))
                results["20Y"]["post1y_intraday"].append(res["post1y_intraday"])
                if eff_date >= cutoff_10y:
                    results["10Y"]["post1y_ret"].append((res["post1y_ret"], ticker))
                    results["10Y"]["post1y_intraday"].append(res["post1y_intraday"])
                if eff_date >= cutoff_1y:
                    results["1Y"]["post1y_ret"].append((res["post1y_ret"], ticker))
                    results["1Y"]["post1y_intraday"].append(res["post1y_intraday"])

    stats = {}
    for period in ["1Y", "10Y", "20Y"]:
        d = results[period]
        count = len(d["pre_ret"])
        if count == 0:
            continue
            
        pre_rets = [x[0] for x in d["pre_ret"]]
        pre_avg = sum(pre_rets) / count
        pre_win = sum(1 for x in pre_rets if x > 0) / count
        pre_max = max(d["pre_ret"], key=lambda x: x[0]) if pre_rets else (0, "N/A")
        pre_min = min(d["pre_ret"], key=lambda x: x[0]) if pre_rets else (0, "N/A")
        pre_intraday_avg = sum(d["pre_intraday"]) / len(d["pre_intraday"]) if d["pre_intraday"] else 0
        
        post1w_rets = [x[0] for x in d["post1w_ret"]]
        post1w_avg = sum(post1w_rets) / len(post1w_rets) if post1w_rets else 0
        post1w_win = sum(1 for x in post1w_rets if x > 0) / len(post1w_rets) if post1w_rets else 0
        post1w_max = max(d["post1w_ret"], key=lambda x: x[0]) if post1w_rets else (0, "N/A")
        post1w_min = min(d["post1w_ret"], key=lambda x: x[0]) if post1w_rets else (0, "N/A")
        post1w_intraday_avg = sum(d["post1w_intraday"]) / len(d["post1w_intraday"]) if d["post1w_intraday"] else 0
        
        post1m_rets = [x[0] for x in d["post1m_ret"]]
        post1m_avg = sum(post1m_rets) / len(post1m_rets) if post1m_rets else 0
        post1m_win = sum(1 for x in post1m_rets if x > 0) / len(post1m_rets) if post1m_rets else 0
        post1m_max = max(d["post1m_ret"], key=lambda x: x[0]) if post1m_rets else (0, "N/A")
        post1m_min = min(d["post1m_ret"], key=lambda x: x[0]) if post1m_rets else (0, "N/A")
        post1m_intraday_avg = sum(d["post1m_intraday"]) / len(d["post1m_intraday"]) if d["post1m_intraday"] else 0
        
        post1y_rets = [x[0] for x in d["post1y_ret"]]
        post1y_avg = sum(post1y_rets) / len(post1y_rets) if post1y_rets else 0
        post1y_win = sum(1 for x in post1y_rets if x > 0) / len(post1y_rets) if post1y_rets else 0
        post1y_max = max(d["post1y_ret"], key=lambda x: x[0]) if post1y_rets else (0, "N/A")
        post1y_min = min(d["post1y_ret"], key=lambda x: x[0]) if post1y_rets else (0, "N/A")
        post1y_intraday_avg = sum(d["post1y_intraday"]) / len(d["post1y_intraday"]) if d["post1y_intraday"] else 0
        
        stats[period] = {
            "count": count,
            "pre_avg": round(pre_avg * 100, 2),
            "pre_win": round(pre_win * 100, 1),
            "pre_intraday": round(pre_intraday_avg * 100, 2),
            "pre_max_val": round(pre_max[0] * 100, 2),
            "pre_max_ticker": pre_max[1],
            "pre_min_val": round(pre_min[0] * 100, 2),
            "pre_min_ticker": pre_min[1],
            
            "post1w_avg": round(post1w_avg * 100, 2),
            "post1w_win": round(post1w_win * 100, 1),
            "post1w_intraday": round(post1w_intraday_avg * 100, 2),
            "post1w_max_val": round(post1w_max[0] * 100, 2),
            "post1w_max_ticker": post1w_max[1],
            "post1w_min_val": round(post1w_min[0] * 100, 2),
            "post1w_min_ticker": post1w_min[1],
            
            "post1m_avg": round(post1m_avg * 100, 2),
            "post1m_win": round(post1m_win * 100, 1),
            "post1m_intraday": round(post1m_intraday_avg * 100, 2),
            "post1m_max_val": round(post1m_max[0] * 100, 2),
            "post1m_max_ticker": post1m_max[1],
            "post1m_min_val": round(post1m_min[0] * 100, 2),
            "post1m_min_ticker": post1m_min[1],
            
            "post1y_avg": round(post1y_avg * 100, 2),
            "post1y_win": round(post1y_win * 100, 1),
            "post1y_intraday": round(post1y_intraday_avg * 100, 2),
            "post1y_max_val": round(post1y_max[0] * 100, 2),
            "post1y_max_ticker": post1y_max[1],
            "post1y_min_val": round(post1y_min[0] * 100, 2),
            "post1y_min_ticker": post1y_min[1]
        }
        
    return stats

if __name__ == "__main__":
    cache = load_cache()
    
    spx_additions = fetch_wiki_additions('https://en.wikipedia.org/wiki/List_of_S%26P_500_companies')
    print("Processing S&P 500...")
    spx_stats = calculate_returns(spx_additions, cache)
    
    ndx_additions = fetch_wiki_additions('https://en.wikipedia.org/wiki/Nasdaq-100')
    print("Processing Nasdaq-100...")
    ndx_stats = calculate_returns(ndx_additions, cache)
    
    save_cache(cache)
    
    output = {
        "last_updated": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S NY Time"),
        "SPX": spx_stats,
        "NDX": ndx_stats
    }
    
    os.makedirs('data', exist_ok=True)
    with open('data/inclusion_data.json', 'w') as f:
        json.dump(output, f, indent=4)
        
    print("Data saved to data/inclusion_data.json")
