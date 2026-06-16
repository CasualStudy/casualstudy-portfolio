import pandas as pd
import yfinance as yf
import requests
from io import StringIO
import datetime
import json
import os
import time
from dateutil.relativedelta import relativedelta

def fetch_sp500_additions():
    print("Fetching S&P 500 historical additions from Wikipedia...")
    url = 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies'
    headers = {'User-Agent': 'Mozilla/5.0'}
    response = requests.get(url, headers=headers)
    dfs = pd.read_html(StringIO(response.text))
    changes_df = dfs[1]
    
    additions = []
    for index, row in changes_df.iterrows():
        date_col = ('Date', 'Date') if ('Date', 'Date') in changes_df.columns else ('Effective Date', 'Effective Date')
        date_str = row[date_col]
        ticker = row[('Added', 'Ticker')]
        
        if pd.notna(ticker) and pd.notna(date_str):
            try:
                clean_date_str = date_str.split('[')[0].strip()
                dt = pd.to_datetime(clean_date_str).date()
                additions.append((dt, str(ticker).replace('.', '-')))
            except Exception as e:
                pass
                
    print(f"Found {len(additions)} additions.")
    return additions

def calculate_returns():
    additions = fetch_sp500_additions()
    
    today = datetime.date.today()
    cutoff_20y = today - relativedelta(years=20)
    cutoff_10y = today - relativedelta(years=10)
    
    recent_additions = [item for item in additions if item[0] >= cutoff_20y]
    
    results = {
        "10Y": {"pre_ret": [], "post1w_ret": [], "post1m_ret": []},
        "20Y": {"pre_ret": [], "post1w_ret": [], "post1m_ret": []}
    }
    
    print(f"Calculating statistics for {len(recent_additions)} events...")
    start_date = str(cutoff_20y - datetime.timedelta(days=100))
    
    for eff_date, ticker in recent_additions:
        try:
            # Fetch individually to avoid batch TLS issues
            t = yf.Ticker(ticker)
            df = t.history(start=start_date, auto_adjust=True)
            
            if df.empty:
                continue
                
            df = df.dropna(subset=['Close'])
            if df.empty:
                continue
                
            future_dates = df.index[df.index.date >= eff_date]
            if len(future_dates) == 0:
                continue
                
            eff_dt = future_dates[0]
            loc = df.index.get_loc(eff_dt)
            
            if loc < 5 or loc + 21 >= len(df):
                continue
                
            p_pre = df.iloc[loc - 5]['Close']
            p_eff = df.iloc[loc]['Close']
            p_post1w = df.iloc[loc + 5]['Close']
            p_post1m = df.iloc[loc + 21]['Close']
            
            ret_pre = (p_eff - p_pre) / p_pre
            ret_post1w = (p_post1w - p_eff) / p_eff
            ret_post1m = (p_post1m - p_eff) / p_eff
            
            results["20Y"]["pre_ret"].append(ret_pre)
            results["20Y"]["post1w_ret"].append(ret_post1w)
            results["20Y"]["post1m_ret"].append(ret_post1m)
            
            if eff_date >= cutoff_10y:
                results["10Y"]["pre_ret"].append(ret_pre)
                results["10Y"]["post1w_ret"].append(ret_post1w)
                results["10Y"]["post1m_ret"].append(ret_post1m)
                
        except Exception as e:
            continue

    stats = {}
    for period in ["10Y", "20Y"]:
        d = results[period]
        count = len(d["pre_ret"])
        if count == 0:
            continue
            
        pre_avg = sum(d["pre_ret"]) / count
        pre_win = sum(1 for x in d["pre_ret"] if x > 0) / count
        
        post1w_avg = sum(d["post1w_ret"]) / count
        post1w_win = sum(1 for x in d["post1w_ret"] if x > 0) / count
        
        post1m_avg = sum(d["post1m_ret"]) / count
        post1m_win = sum(1 for x in d["post1m_ret"] if x > 0) / count
        
        stats[period] = {
            "count": count,
            "pre_avg": round(pre_avg * 100, 2),
            "pre_win": round(pre_win * 100, 1),
            "post1w_avg": round(post1w_avg * 100, 2),
            "post1w_win": round(post1w_win * 100, 1),
            "post1m_avg": round(post1m_avg * 100, 2),
            "post1m_win": round(post1m_win * 100, 1)
        }
        
    return stats

if __name__ == "__main__":
    stats = calculate_returns()
    
    output = {
        "last_updated": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S NY Time"),
        "stats": stats
    }
    
    os.makedirs('data', exist_ok=True)
    with open('data/inclusion_data.json', 'w') as f:
        json.dump(output, f, indent=4)
        
    print("Data saved to data/inclusion_data.json")
    print(json.dumps(output, indent=2))
