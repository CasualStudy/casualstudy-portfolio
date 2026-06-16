import pandas as pd
import yfinance as yf
import requests
from io import StringIO
import datetime
import json
import os
from dateutil.relativedelta import relativedelta

def fetch_wiki_additions(url):
    print(f"Fetching additions from {url}...")
    headers = {'User-Agent': 'Mozilla/5.0'}
    response = requests.get(url, headers=headers)
    dfs = pd.read_html(StringIO(response.text))
    
    changes_df = None
    for df in dfs:
        # Check if it has a MultiIndex column with ('Added', 'Ticker') or simple 'Added'
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
                
    print(f"Found {len(additions)} additions.")
    return additions

def calculate_returns(additions):
    today = datetime.date.today()
    cutoff_20y = today - relativedelta(years=20)
    cutoff_10y = today - relativedelta(years=10)
    cutoff_1y = today - relativedelta(years=1)
    
    recent_additions = [item for item in additions if item[0] >= cutoff_20y]
    
    results = {
        "1Y": {"pre_ret": [], "post1w_ret": [], "post1m_ret": [], "post1y_ret": [],
               "pre_intraday": [], "post1w_intraday": [], "post1m_intraday": [], "post1y_intraday": []},
        "10Y": {"pre_ret": [], "post1w_ret": [], "post1m_ret": [], "post1y_ret": [],
                "pre_intraday": [], "post1w_intraday": [], "post1m_intraday": [], "post1y_intraday": []},
        "20Y": {"pre_ret": [], "post1w_ret": [], "post1m_ret": [], "post1y_ret": [],
                "pre_intraday": [], "post1w_intraday": [], "post1m_intraday": [], "post1y_intraday": []}
    }
    
    print(f"Calculating statistics for {len(recent_additions)} events...")
    start_date = str(cutoff_20y - datetime.timedelta(days=100))
    
    for eff_date, ticker in recent_additions:
        try:
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
            
            if loc < 5:
                continue
                
            p_pre = df.iloc[loc - 5]['Close']
            p_eff = df.iloc[loc]['Close']
            
            daily_intraday = (df['Close'] - df['Open']) / df['Open']
            intraday_pre = daily_intraday.iloc[loc - 5 : loc + 1].sum()
            
            ret_pre = (p_eff - p_pre) / p_pre
            results["20Y"]["pre_ret"].append((ret_pre, ticker))
            results["20Y"]["pre_intraday"].append(intraday_pre)
            if eff_date >= cutoff_10y:
                results["10Y"]["pre_ret"].append((ret_pre, ticker))
                results["10Y"]["pre_intraday"].append(intraday_pre)
            if eff_date >= cutoff_1y:
                results["1Y"]["pre_ret"].append((ret_pre, ticker))
                results["1Y"]["pre_intraday"].append(intraday_pre)

            if loc + 5 < len(df):
                p_post1w = df.iloc[loc + 5]['Close']
                ret_post1w = (p_post1w - p_eff) / p_eff
                intraday_post1w = daily_intraday.iloc[loc + 1 : loc + 6].sum()
                results["20Y"]["post1w_ret"].append((ret_post1w, ticker))
                results["20Y"]["post1w_intraday"].append(intraday_post1w)
                if eff_date >= cutoff_10y:
                    results["10Y"]["post1w_ret"].append((ret_post1w, ticker))
                    results["10Y"]["post1w_intraday"].append(intraday_post1w)
                if eff_date >= cutoff_1y:
                    results["1Y"]["post1w_ret"].append((ret_post1w, ticker))
                    results["1Y"]["post1w_intraday"].append(intraday_post1w)
                    
            if loc + 21 < len(df):
                p_post1m = df.iloc[loc + 21]['Close']
                ret_post1m = (p_post1m - p_eff) / p_eff
                intraday_post1m = daily_intraday.iloc[loc + 1 : loc + 22].sum()
                results["20Y"]["post1m_ret"].append((ret_post1m, ticker))
                results["20Y"]["post1m_intraday"].append(intraday_post1m)
                if eff_date >= cutoff_10y:
                    results["10Y"]["post1m_ret"].append((ret_post1m, ticker))
                    results["10Y"]["post1m_intraday"].append(intraday_post1m)
                if eff_date >= cutoff_1y:
                    results["1Y"]["post1m_ret"].append((ret_post1m, ticker))
                    results["1Y"]["post1m_intraday"].append(intraday_post1m)
                    
            if loc + 252 < len(df):
                p_post1y = df.iloc[loc + 252]['Close']
                ret_post1y = (p_post1y - p_eff) / p_eff
                intraday_post1y = daily_intraday.iloc[loc + 1 : loc + 253].sum()
                results["20Y"]["post1y_ret"].append((ret_post1y, ticker))
                results["20Y"]["post1y_intraday"].append(intraday_post1y)
                if eff_date >= cutoff_10y:
                    results["10Y"]["post1y_ret"].append((ret_post1y, ticker))
                    results["10Y"]["post1y_intraday"].append(intraday_post1y)
                if eff_date >= cutoff_1y:
                    results["1Y"]["post1y_ret"].append((ret_post1y, ticker))
                    results["1Y"]["post1y_intraday"].append(intraday_post1y)
                
        except Exception as e:
            continue

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
    spx_additions = fetch_wiki_additions('https://en.wikipedia.org/wiki/List_of_S%26P_500_companies')
    print("Processing S&P 500...")
    spx_stats = calculate_returns(spx_additions)
    
    ndx_additions = fetch_wiki_additions('https://en.wikipedia.org/wiki/Nasdaq-100')
    print("Processing Nasdaq-100...")
    ndx_stats = calculate_returns(ndx_additions)
    
    output = {
        "last_updated": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S NY Time"),
        "SPX": spx_stats,
        "NDX": ndx_stats
    }
    
    os.makedirs('data', exist_ok=True)
    with open('data/inclusion_data.json', 'w') as f:
        json.dump(output, f, indent=4)
        
    print("Data saved to data/inclusion_data.json")
