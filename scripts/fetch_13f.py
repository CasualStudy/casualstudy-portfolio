import os
import json
import re
import xml.etree.ElementTree as ET
import requests
from datetime import datetime

# SEC EDGAR requires a User-Agent with contact info
SEC_HEADERS = {
    "User-Agent": "CasualStudy contact@casualstudy.com",
    "Accept-Encoding": "gzip, deflate",
}
SEC_BASE = "https://data.sec.gov"

# Edgar cache directories — keep them inside the project so the script works
# in CI runners and local sandboxes without writing to ~/
_PROJ_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("EDGAR_LOCAL_DATA_DIR", os.path.join(_PROJ_DIR, ".edgar_data"))
os.environ.setdefault("EDGAR_CACHE_DIR", os.path.join(_PROJ_DIR, ".edgar_cache"))
os.environ.setdefault("EDGAR_IDENTITY", "CasualStudy contact@casualstudy.com")

# Ticker mapping for well-known institutional holdings.
# 13F XML infotable does NOT contain tickers, only issuer names — so we map
# the most common top holdings to their exchange tickers for chart display.
# Names are normalized to Title Case to match the parser output.
TICKER_MAP = {
    "Apple Inc": "AAPL",
    "American Express Co": "AXP",
    "Bank America Corp": "BAC",
    "Bank of America Corp": "BAC",
    "Coca Cola Co": "KO",
    "Coca-Cola Co": "KO",
    "Chevron Corporation": "CVX",
    "Chevron Corp": "CVX",
    "Occidental Pete Corp": "OXY",
    "Occidental Petroleum Corp": "OXY",
    "Alphabet Inc": "GOOGL",
    "Chubb Ltd Switz": "CB",
    "Chubb Ltd": "CB",
    "Moodys Corp": "MCO",
    "Moody's Corp": "MCO",
    "Amazon Com Inc": "AMZN",
    "Amazon.com Inc": "AMZN",
    "Microsoft Corp": "MSFT",
    "Meta Platforms Inc": "META",
    "Facebook Inc": "META",
    "Berkshire Hathaway Inc": "BRK.B",
    "Kraft Heinz Co": "KHC",
    "Johnson & Johnson": "JNJ",
    "Procter & Gamble Co": "PG",
    "Jpmorgan Chase & Co": "JPM",
    "JPMorgan Chase & Co": "JPM",
    "Visa Inc": "V",
    "Mastercard Inc": "MA",
    "Nvidia Corp": "NVDA",
    "NVIDIA Corp": "NVDA",
    "Tesla Inc": "TSLA",
    "Unitedhealth Group Inc": "UNH",
    "UnitedHealth Group Inc": "UNH",
    "Exxon Mobil Corp": "XOM",
    "AbbVie Inc": "ABBV",
    "Lilly Eli & Co": "LLY",
    "Eli Lilly & Co": "LLY",
    "Broadcom Inc": "AVGO",
    "Costco Wholesale Corp": "COST",
    "Home Depot Inc": "HD",
    "Salesforce Com Inc": "CRM",
    "Salesforce Inc": "CRM",
    "Adobe Inc": "ADBE",
    "Netflix Inc": "NFLX",
    "Cisco Systems Inc": "CSCO",
    "Intel Corp": "INTC",
    "Qualcomm Inc": "QCOM",
    "Texas Instruments Inc": "TXN",
    "Wells Fargo & Co": "WFC",
    "Goldman Sachs Group Inc": "GS",
    "Morgan Stanley": "MS",
    "Citigroup Inc": "C",
    "Boeing Co": "BA",
    "Disney Walt Co": "DIS",
    "Walt Disney Co": "DIS",
    "Pfizer Inc": "PFE",
    "Merck & Co Inc": "MRK",
    "Verizon Communications Inc": "VZ",
    "AT&T Inc": "T",
    "Comcast Corp": "CMCSA",
    "PepsiCo Inc": "PEP",
    "Walmart Inc": "WMT",
    "McDonald's Corp": "MCD",
    "Starbucks Corp": "SBUX",
    "Nike Inc": "NKE",
    "Cisco Inc": "CSCO",
    "Oracle Corp": "ORCL",
    "IBM Corp": "IBM",
    "International Business Machines Corp": "IBM",
    "Snowflake Inc": "SNOW",
    "Palantir Technologies Inc": "PLTR",
    "Coinbase Global Inc": "COIN",
    "Block Inc": "SQ",
    "Square Inc": "SQ",
    "Shopify Inc": "SHOP",
    "Roblox Corp": "RBLX",
    "Coinbase Inc": "COIN",
    "Twilio Inc": "TWLO",
    "Zoom Video Communications Inc": "ZM",
    "DocuSign Inc": "DOCU",
    "Roku Inc": "ROKU",
    "Spotify Technology SA": "SPOT",
    "UiPath Inc": "PATH",
    "Teladoc Health Inc": "TDOC",
    "Draftkings Inc": "DKNG",
    "Robinhood Markets Inc": "HOOD",
    "Intuit Inc": "INTU",
    "Servicenow Inc": "NOW",
    "ServiceNow Inc": "NOW",
    "Workday Inc": "WDAY",
    "Autodesk Inc": "ADSK",
    "Splunk Inc": "SPLK",
    "Datadog Inc": "DDOG",
    "MongoDB Inc": "MDB",
    "Elastic NV": "ESTC",
    "Crowdstrike Holdings Inc": "CRWD",
    "Zscaler Inc": "ZS",
    "Okta Inc": "OKTA",
    "Palo Alto Networks Inc": "PANW",
    "Fortinet Inc": "FTNT",
    "Tenable Holdings Inc": "TENB",
    "Cloudflare Inc": "NET",
    "Fastly Inc": "FSLY",
    "Akamai Technologies Inc": "AKAM",
    "F5 Networks Inc": "FFIV",
    "Juniper Networks Inc": "JNPR",
    "Arista Networks Inc": "ANET",
    "Ciena Corp": "CIEN",
    "Cognizant Technology Solutions Corp": "CTSH",
    "Accenture Plc": "ACN",
    "Capgemini SE": "CAP",
    "Infosys Ltd": "INFY",
    "Wipro Ltd": "WIT",
    # --- Overrides for tracking-stock / OTC mismatches and missing matches ---
    "Berkshire Hathaway Inc Del": "BRK.A",
    "Berkshire Hathaway Inc": "BRK.A",
    "Macys Inc": "M",
    "Macy's Inc": "M",
    "Hologic Inc": "HOLX",
    "Sealed Air Corp New": "SEE",
    "Sealed Air Corp": "SEE",
    "Siriusxm Holdings Inc": "SIRI",
    "Sirius Xm Holdings Inc": "SIRI",
    "Tri Pointe Homes Inc": "TPH",
    "New York Times Co Mtn Be": "NYT",
    "New York Times Co": "NYT",
    "Amicus Therapeutic": "FOLD",
    "Amicus Therapeutics Inc": "FOLD",
    "Credo Technology Group Holdi": "CRDO",
    "Credo Technology Group Holding": "CRDO",
    "Solaris Energy Infras Inc": "SEII",
    "Solaris Energy Infrastructure Inc": "SEII",
    "Jazz Investments I Ltd": "JAZZ",
    "Iren Limited": "IREN",
    "Bitfarms Ltd": "BITF",
    # Tracking-stock / ADR mismatches: prefer main common stock
    "Core Scientific Inc New": "CORZ",
    "Core Scientific Inc": "CORZ",
    "Honeywell Intl Inc": "HON",
    "Honeywell International Inc": "HON",
    "Taiwan Semiconductor Manufac": "TSM",
    "Taiwan Semiconductor Manufacturing Company Ltd": "TSM",
    "Taiwan Semiconductor Manufacturing Co Ltd": "TSM",
    "Asml Hldg Nv": "ASML",
    "Asml Hldg Nv N Y Registry": "ASML",
    "ASML Holding NV": "ASML",
    # --- Tickers missing from SEC company_tickers.json or fuzzy-mismatched ---
    "Brookfield Corp": "BN",
    "Brookfield Corporation": "BN",
    "Seaport Entmt Group Inc": "SEG",
    "Seaport Entertainment Group Inc": "SEG",
    "Deutsche Bk Ag": "DB",
    "Deutsche Bank Ag": "DB",
    "Crh Plc": "CRH",
    "CRH Plc": "CRH",
    "Wabtec": "WAB",
    "Westinghouse Air Brake Technologies": "WAB",
    "Belite Bio Inc Sponsored": "BLT",
    "Belite Bio Inc": "BLT",
}

# Cache for SEC's official company_tickers.json mapping
# Format: { "Company Name": "TICKER" }
_SEC_TICKER_CACHE = None


def _load_sec_ticker_map():
    """Download and cache SEC's official company_tickers.json.

    This file maps CIK -> { ticker, title } for ~6000 SEC-registered companies.
    We invert it to { title: ticker } for fuzzy name matching.
    """
    global _SEC_TICKER_CACHE
    if _SEC_TICKER_CACHE is not None:
        return _SEC_TICKER_CACHE

    try:
        url = "https://www.sec.gov/files/company_tickers.json"
        resp = requests.get(url, headers=SEC_HEADERS, timeout=15)
        resp.raise_for_status()
        data = resp.json()

        # data format: { "0": { "cik_str": 320193, "ticker": "AAPL", "title": "Apple Inc." }, ... }
        mapping = {}
        for entry in data.values():
            title = entry.get("title", "").strip().title()
            ticker = entry.get("ticker", "").strip().upper()
            if title and ticker:
                mapping[title] = ticker

        _SEC_TICKER_CACHE = mapping
        print(f"Loaded {len(mapping)} tickers from SEC company_tickers.json")
        return mapping
    except Exception as e:
        print(f"Warning: could not load SEC ticker map: {e}")
        _SEC_TICKER_CACHE = {}
        return _SEC_TICKER_CACHE


def lookup_ticker(name):
    """Return ticker for an issuer name.

    Strategy (in priority order):
    1. Hardcoded TICKER_MAP (manual overrides for known edge cases)
    2. SEC official company_tickers.json (exact match on normalized name)
    3. rapidfuzz fuzzy match against SEC data with token-overlap verification
    4. None if no confident match

    13F XML issuer names are frequently truncated/abbreviated (e.g.
    "Applied Matls Inc" for "Applied Materials, Inc.", "Ally Finl Inc" for
    "Ally Financial, Inc."), so we expand common abbreviations before
    matching and require token overlap to avoid false positives.
    """
    if not name:
        return None

    # 13F XML truncates long names — expand common abbreviations so they
    # can match the full names in SEC company_tickers.json.
    ABBREV = {
        "MATLS": "MATERIALS", "HLDGS": "HOLDINGS", "HLDG": "HOLDING",
        "FINL": "FINANCIAL", "INTL": "INTERNATIONAL", "MNG": "MINING",
        "MFG": "MANUFACTURING", "PMTS": "PAYMENTS", "SYS": "SYSTEMS",
        "TECH": "TECHNOLOGY", "TELECOM": "TELECOMMUNICATIONS",
        "COMM": "COMMUNICATIONS", "CP": "CORP", "PETE": "PETROLEUM",
        "MFGCO": "MANUFACTURING CO", "HLDNGS": "HOLDINGS",
        "SOLNS": "SOLUTIONS", "PHARMA": "PHARMACEUTICAL",
        "BANCORP": "BANCORPORATION", "BANC": "BANCORPORATION",
        "INDS": "INDUSTRIES", "PAC": "PACIFIC", "DEL": "DELAWARE",
        "RES": "RESOURCES", "REG": "REGIONAL", "NATL": "NATIONAL",
        "CAP": "CAPITAL", "ELEC": "ELECTRIC", "ELECT": "ELECTRONICS",
        "ENGR": "ENGINEERING", "CHEM": "CHEMICAL", "PHARMS": "PHARMACEUTICALS",
    }

    def normalize(s):
        """Lowercase, strip all punctuation/suffixes/location codes, expand abbreviations.

        Produces a canonical space-separated token string for robust matching
        against SEC company_tickers.json (which uses inconsistent casing,
        trailing /DE/ location codes, and "Inc." vs "Inc").
        """
        s = s.strip().lower()
        # Split on any non-alphanumeric (handles spaces, commas, periods,
        # hyphens, apostrophes, slashes) so "Louisiana-Pacific" and
        # "Macy's, Inc." tokenize cleanly.
        tokens = re.split(r'[^a-z0-9]+', s)
        expanded = []
        for tok in tokens:
            if not tok:
                continue
            up = tok.upper()
            expanded.append(ABBREV.get(up, tok).lower() if up in ABBREV else tok)
        # Drop corporate-suffix tokens and location/entity marker tokens
        DROP = {"inc", "corp", "corporation", "co", "ltd", "plc", "group",
                "holdings", "holding", "trust", "company", "the", "new",
                "class", "common", "stock", "ord", "shs", "shares",
                "de", "ny", "ca", "tx", "uk", "md", "oh", "il", "pa", "nj"}
        kept = [t for t in expanded if t not in DROP]
        return ' '.join(kept).strip()

    normalized = normalize(name)

    # 1. Hardcoded overrides (highest priority) — try both raw and normalized
    raw_title = name.strip().title()
    if raw_title in TICKER_MAP:
        return TICKER_MAP[raw_title]
    if normalized in TICKER_MAP:
        return TICKER_MAP[normalized]
    for suffix in [" Inc.", " Inc", " Corp.", " Corp", " Corporation",
                   " Co.", " Co", " Ltd.", " Ltd", " Plc", " Group",
                   " Holdings", " Trust"]:
        if raw_title.endswith(suffix):
            stripped = raw_title[:-len(suffix)]
            if stripped in TICKER_MAP:
                return TICKER_MAP[stripped]

    # 2 & 3. SEC official data + fuzzy match
    sec_map = _load_sec_ticker_map()
    if not sec_map:
        return None

    # Build a normalized version of the SEC titles once (cached).
    # When multiple SEC entries normalize to the same string, prefer the
    # shortest ticker (main common stock over tracking/preferred shares,
    # e.g. HON over HONIV).
    global _SEC_TICKER_NORM_CACHE
    if _SEC_TICKER_NORM_CACHE is None:
        norm_to_tickers = {}
        for title, ticker in sec_map.items():
            n = normalize(title)
            if n not in norm_to_tickers:
                norm_to_tickers[n] = []
            norm_to_tickers[n].append(ticker)
        _SEC_TICKER_NORM_CACHE = {
            n: sorted(ts, key=lambda t: (len(t), t))[0]
            for n, ts in norm_to_tickers.items()
        }
    sec_norm = _SEC_TICKER_NORM_CACHE

    # Exact match on normalized SEC data
    if normalized in sec_norm:
        return sec_norm[normalized]

    # Fuzzy match — use a strict scorer and require token overlap to avoid
    # false positives like "Macys Inc" -> AMZN.
    try:
        from rapidfuzz import process, fuzz

        result = process.extractOne(
            normalized,
            list(sec_norm.keys()),
            scorer=fuzz.ratio,  # stricter than WRatio
            score_cutoff=88
        )
        if result:
            matched_name = result[0]
            score = result[1]
            # Token-overlap verification: require shared significant tokens
            # (len>=3), OR a very high score (>=95) for near-exact matches.
            name_tokens = {t for t in normalized.split() if len(t) >= 3}
            match_tokens = {t for t in matched_name.split() if len(t) >= 3}
            overlap = name_tokens & match_tokens
            if score >= 95 or len(overlap) >= 2 or (len(overlap) >= 1 and len(name_tokens) <= 2):
                return sec_norm[matched_name]
    except ImportError:
        pass

    return None


# Cache for the normalized version of SEC titles (built lazily)
_SEC_TICKER_NORM_CACHE = None

FUNDS = [
    {
        "id": "berkshire",
        "name": "Berkshire Hathaway (Warren Buffett)",
        "cik": "0001067983"
    },
    {
        "id": "ark",
        "name": "ARK Investment (Cathie Wood)",
        "cik": "0001697748"
    },
    {
        "id": "soros",
        "name": "Soros Fund Management",
        "cik": "0001029160"
    },
    {
        "id": "bridgewater",
        "name": "Bridgewater Associates (Ray Dalio)",
        "cik": "0001350694"
    },
    {
        "id": "situational_awareness",
        "name": "Situational Awareness (Leopold Aschenbrenner)",
        "cik": "0002045724"
    },
    {
        "id": "pershing_square",
        "name": "Pershing Square (Bill Ackman)",
        "cik": "0001336528"
    },
    {
        "id": "appaloosa",
        "name": "Appaloosa Management (David Tepper)",
        "cik": "0001656456"
    },
    {
        "id": "duquesne",
        "name": "Duquesne Family Office (Stanley Druckenmiller)",
        "cik": "0001536411"
    },
    {
        # Note: Burry closed Scion in Nov 2025; latest 13F is Q3 2025
        "id": "scion",
        "name": "Scion Asset Management (Michael Burry)",
        "cik": "0001649339"
    }
]

def fetch_cash_from_10x(cik):
    """Fetch cash & equivalents + Short-term investments in U.S. Treasury Bills
    from the company's latest 10-K or 10-Q balance sheet using edgartools.

    13F filings do not report cash (cash is not a 13F-reportable security), so
    the authoritative source for a fund's cash position is the 10-K/10-Q balance
    sheet. Private investment advisers (e.g. ARK, Soros, Bridgewater) do not
    file 10-K/10-Q, in which case we return `{"available": False, ...}` and the
    frontend shows an explanatory message instead of misleading numbers.

    Returns a dict shaped like:
        {
            "available": True,
            "source": "10-Q",                 # or "10-K"
            "filing_date": "2026-05-04",
            "period_of_report": "2026-03-31",
            "items": [
                {"label": "Cash and cash equivalents",
                 "label_zh": "现金及现金等价物",
                 "value": 58122000000.0},
                {"label": "Short-term investments in U.S. Treasury Bills",
                 "label_zh": "短期美国国债投资",
                 "value": 339261000000.0}
            ],
            "total": 397383000000.0,
            "currency": "USD"
        }
    or `{"available": False, "reason": "no_10x"}` if no 10-K/10-Q is on file.
    """
    try:
        import edgar
        import pandas as pd
    except ImportError:
        print("edgartools/pandas not installed — skipping 10-K/10-Q cash extraction")
        return {"available": False, "reason": "edgartools_not_installed"}

    try:
        company = edgar.Company(cik)
        filings = company.get_filings(form=["10-K", "10-Q"])
        if len(filings) == 0:
            return {"available": False, "reason": "no_10x"}

        latest = filings[0]
        obj = latest.obj()
        fin = obj.financials
        bs = fin.balance_sheet()
        df = bs.to_dataframe()

        # Period date columns appear as strings like "2026-03-31".
        # Other columns (concept, label, etc.) are short strings, so we filter
        # by the YYYY-MM-DD pattern.
        date_cols = [c for c in df.columns
                     if isinstance(c, str) and len(c) == 10 and c[4] == '-']
        if not date_cols:
            return {"available": False, "reason": "no_date_columns"}
        latest_col = date_cols[0]  # most-recent period is the first column

        items = []

        # 1. Cash and cash equivalents — total row (no segment dimension).
        # Berkshire (and most public filers) uses the standard XBRL concept
        # us-gaap_CashAndCashEquivalentsAtCarryingValue; segment breakdowns
        # like "Insurance and Other" appear as separate rows with a
        # dimension_member_label — we skip those to avoid double counting.
        if 'concept' in df.columns and 'dimension_member_label' in df.columns:
            cash_mask = (
                (df['concept'] == 'us-gaap_CashAndCashEquivalentsAtCarryingValue') &
                (df['dimension_member_label'].isna() |
                 (df['dimension_member_label'].astype(str).str.strip() == ''))
            )
            if cash_mask.any():
                row = df[cash_mask].iloc[0]
                val = row[latest_col]
                if pd.notna(val):
                    items.append({
                        "label": "Cash and cash equivalents",
                        "label_zh": "现金及现金等价物",
                        "value": float(val)
                    })

        # 2. Short-term investments in U.S. Treasury Bills.
        # Berkshire reports this as an extension concept (brka_USTreasuryBills);
        # other filers may use us-gaap_ShortTermInvestments with a "Treasury
        # Bills" label. We match on the human-readable label so the logic is
        # robust to concept-name differences.
        for _, row in df.iterrows():
            label = str(row.get('label', '')).lower()
            val = row.get(latest_col)
            dim = row.get('dimension_member_label', '')
            if pd.isna(val):
                continue
            if pd.notna(dim) and str(dim).strip() != '':
                continue  # skip segment breakdowns
            if 'treasury' in label and 'bill' in label:
                items.append({
                    "label": str(row['label']).strip(),
                    "label_zh": "短期美国国债投资",
                    "value": float(val)
                })
                break

        # 3. Generic "Short-term investments" (not treasury bills) — only add
        # if the label says "short-term investments" without "treasury", to
        # surface other liquid short-term holdings without double counting.
        for _, row in df.iterrows():
            label = str(row.get('label', '')).lower()
            val = row.get(latest_col)
            dim = row.get('dimension_member_label', '')
            if pd.isna(val) or (pd.notna(dim) and str(dim).strip() != ''):
                continue
            if 'short-term investments' in label and 'treasury' not in label:
                items.append({
                    "label": str(row['label']).strip(),
                    "label_zh": "短期投资",
                    "value": float(val)
                })
                break

        total = sum(it['value'] for it in items)
        return {
            "available": True,
            "source": latest.form,  # "10-K" or "10-Q"
            "filing_date": str(latest.filing_date),
            "period_of_report": str(latest.period_of_report),
            "items": items,
            "total": total,
            "currency": "USD"
        }
    except Exception as e:
        print(f"Error fetching 10-K/10-Q cash for {cik}: {e}")
        return {"available": False, "reason": f"error: {e}"}


def fetch_fund_holdings(cik):
    """Fetch latest 13F-HR holdings + recent 13G/13D filings via SEC EDGAR REST API."""
    print(f"Fetching filings for CIK {cik}...")
    try:
        # 1. Get submissions index (JSON, fast)
        sub_url = f"{SEC_BASE}/submissions/CIK{cik}.json"
        resp = requests.get(sub_url, headers=SEC_HEADERS, timeout=15)
        resp.raise_for_status()
        submissions = resp.json()

        recent = submissions.get("filings", {}).get("recent", {})
        forms = recent.get("form", [])
        accession_numbers = recent.get("accessionNumber", [])
        filing_dates = recent.get("filingDate", [])

        # 2. Find latest 13F-HR
        latest_13f_idx = None
        for i, form in enumerate(forms):
            if form == "13F-HR":
                latest_13f_idx = i
                break

        if latest_13f_idx is None:
            print(f"No 13F-HR found for {cik}")
            return None

        accession = accession_numbers[latest_13f_idx].replace("-", "")
        filing_date = filing_dates[latest_13f_idx]
        # reportDate is the period of report (quarter-end date the holdings reflect)
        report_dates = recent.get("reportDate", [])
        period_of_report = report_dates[latest_13f_idx] if latest_13f_idx < len(report_dates) else filing_date

        # 3. Fetch the 13F infotable XML
        # Archives path is on www.sec.gov, not data.sec.gov
        cik_int = int(cik)
        index_url = f"https://www.sec.gov/Archives/edgar/data/{cik_int}/{accession}/index.json"
        resp = requests.get(index_url, headers=SEC_HEADERS, timeout=15)
        resp.raise_for_status()
        index_data = resp.json()

        # Find the infotable XML file (usually named like "infotable.xml" or contains it)
        infotable_file = None
        for item in index_data.get("directory", {}).get("item", []):
            name = item.get("name", "").lower()
            if "infotable" in name and name.endswith(".xml"):
                infotable_file = item["name"]
                break

        if not infotable_file:
            # Fallback: look for the primary document (sometimes holdings are in the main XML)
            for item in index_data.get("directory", {}).get("item", []):
                name = item.get("name", "")
                if name.endswith(".xml") and "primary" not in name.lower():
                    infotable_file = name
                    break

        if not infotable_file:
            print(f"No infotable XML found for {cik} accession {accession}")
            return None

        xml_url = f"https://www.sec.gov/Archives/edgar/data/{cik_int}/{accession}/{infotable_file}"
        resp = requests.get(xml_url, headers=SEC_HEADERS, timeout=30)
        resp.raise_for_status()
        xml_content = resp.text

        # Clean XML namespaces for easier parsing
        xml_content = re.sub(r'\sxmlns="[^"]+"', '', xml_content)
        xml_content = re.sub(r'ns\d+:', '', xml_content)

        root = ET.fromstring(xml_content)

        holdings = []
        for infoTable in root.findall('.//infoTable'):
            name = infoTable.findtext('nameOfIssuer')
            title = infoTable.findtext('titleOfClass')
            value = infoTable.findtext('value')
            put_call = infoTable.findtext('putCall')

            shrs_node = infoTable.find('shrsOrPrnAmt')
            shares = shrs_node.findtext('sshPrnamt') if shrs_node is not None else '0'

            if name and value:
                display_class = title.strip() if title else ''
                if put_call:
                    display_class = f"{display_class} ({put_call})"

                holdings.append({
                    'name': name.strip().title(),
                    'class': display_class,
                    'value': float(value),  # 13F values are already in USD
                    'shares': int(shares),
                    'ticker': lookup_ticker(name)
                })

        # Merge duplicates (e.g. same company, same class reported in multiple rows)
        merged = {}
        for h in holdings:
            key = f"{h['name']}_{h['class']}"
            if key in merged:
                merged[key]['value'] += h['value']
                merged[key]['shares'] += h['shares']
            else:
                merged[key] = h

        final_list = list(merged.values())

        # Heuristic: detect whether `value` is in USD or in thousands of USD.
        # The 13F XML spec says values are in dollars, but some filers (e.g.
        # Duquesne Family Office) actually report in thousands. We detect this
        # by checking the implied average price per share; if it's unreasonably
        # low (< $0.50) across most holdings, multiply values by 1000.
        priced = [h for h in final_list if h.get('shares', 0) > 0]
        if priced:
            low_price_ratio = sum(1 for h in priced
                                  if (h['value'] / h['shares']) < 0.5) / len(priced)
            if low_price_ratio > 0.5:
                for h in final_list:
                    h['value'] *= 1000.0

        final_list.sort(key=lambda x: x['value'], reverse=True)

        # Calculate total value and weights for 13F
        total_value = sum(h['value'] for h in final_list)
        for h in final_list:
            h['weight'] = (h['value'] / total_value) * 100 if total_value > 0 else 0
            h['is_13g'] = False

        # 3b. Cash & equivalents — extracted from 10-K / 10-Q balance sheets.
        # 13F filings do NOT include cash (cash is not a 13F-reportable security),
        # and earlier keyword-based matching on issuer names produced false
        # positives (e.g. "Firstcash Holdings" or "Bill Holdings Inc"). Instead
        # we use edgartools to read the latest 10-K/10-Q balance sheet, which is
        # the authoritative source for "Cash and cash equivalents" and
        # "Short-term investments in U.S. Treasury Bills".
        cash_data = fetch_cash_from_10x(cik)

        # 4. Process 13G / 13D filed AFTER the 13F-HR
        recent_13g_filings = []
        for i, form in enumerate(forms):
            if form in ["SCHEDULE 13G", "SCHEDULE 13G/A", "SCHEDULE 13D", "SCHEDULE 13D/A"]:
                fdate = filing_dates[i]
                if fdate > filing_date:
                    recent_13g_filings.append({
                        "form": form,
                        "accession": accession_numbers[i].replace("-", ""),
                        "filing_date": fdate
                    })

        for g_filing in recent_13g_filings[:5]:  # Limit to 5 most recent
            try:
                g_accession = g_filing["accession"]
                g_index_url = f"https://www.sec.gov/Archives/edgar/data/{cik_int}/{g_accession}/index.json"
                resp = requests.get(g_index_url, headers=SEC_HEADERS, timeout=15)
                resp.raise_for_status()
                g_index = resp.json()

                # Find the primary XML document
                g_xml_file = None
                for item in g_index.get("directory", {}).get("item", []):
                    name = item.get("name", "")
                    if name.endswith(".xml"):
                        g_xml_file = name
                        break

                if not g_xml_file:
                    continue

                g_xml_url = f"https://www.sec.gov/Archives/edgar/data/{cik_int}/{g_accession}/{g_xml_file}"
                resp = requests.get(g_xml_url, headers=SEC_HEADERS, timeout=15)
                resp.raise_for_status()
                g_xml = resp.text

                # Clean namespaces
                g_xml = re.sub(r'\sxmlns="[^"]+"', '', g_xml)
                g_xml = re.sub(r'ns\d+:', '', g_xml)
                g_root = ET.fromstring(g_xml)

                # 13G/13D XML structure: issuer name, class, shares
                issuer_name = g_root.findtext('.//issuerName') or g_root.findtext('.//nameOfIssuer') or "Unknown"
                sec_class = g_root.findtext('.//titleOfClass') or g_root.findtext('.//titleOfClass') or "Common Stock"
                shares_str = g_root.findtext('.//shares') or g_root.findtext('.//amount') or "0"

                # Try to extract event date
                event_date = g_root.findtext('.//dateOfEvent') or g_root.findtext('.//eventDate') or g_filing["filing_date"]

                shares = int(float(shares_str.replace(',', '')))
                if shares > 0:
                    final_list.insert(0, {
                        'name': issuer_name.strip().title(),
                        'class': sec_class.strip() if sec_class else '',
                        'value': 0,  # Value unknown from 13G
                        'shares': shares,
                        'weight': 0,
                        'is_13g': True,
                        'form_type': g_filing["form"].replace('SCHEDULE ', ''),
                        'event_date': str(event_date),
                        'ticker': lookup_ticker(issuer_name)
                    })
            except Exception as e:
                print(f"Error parsing 13G/D {g_filing['accession']}: {e}")

        return {
            "filing_date": str(filing_date),
            "period_of_report": str(period_of_report),
            "total_value": total_value,
            "cash_data": cash_data,
            "top_holdings": final_list[:50]  # Top 50 is enough for frontend
        }

    except Exception as e:
        print(f"Error processing {cik}: {e}")
        return None

def main():
    result = {
        "last_updated": None, # Will be set by github actions or frontend
        "funds": {}
    }
    
    for fund in FUNDS:
        data = fetch_fund_holdings(fund['cik'])
        if data:
            data['name'] = fund['name']
            result['funds'][fund['id']] = data
    
    # Save to data directory
    out_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
    os.makedirs(out_dir, exist_ok=True)
    
    out_file = os.path.join(out_dir, 'fund-holdings.json')
    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"Saved JSON to {out_file}")

if __name__ == "__main__":
    main()
