# -*- coding: utf-8 -*-
"""
CFM 闪存市场 (chinaflashmarket.com) 全量数据爬虫

数据来源: https://www.chinaflashmarket.com/price
- NAND / DRAM 价格指数 (内嵌在页面 JS 变量中)
- 全品类现货报价 + 产品列表 (HTML 表格)
- 每个产品的近半年历史价格 (产品页面 HTML 表格: 日期/低点/开盘/收盘)

注意: 网站只公开最近半年的数据，更早的数据需登录。
"""

import re
import os
import json
import time
import csv
from datetime import datetime

import requests

BASE = "https://www.chinaflashmarket.com"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "zh-CN,zh;q=0.9",
    "Referer": BASE + "/",
}
TIMEOUT = 15
MAX_RETRY = 3
SLEEP = 1.5  # 请求间隔(秒)

DATA_DIR = "data"
HISTORY_DIR = os.path.join(DATA_DIR, "cfm_history")


def _get(url):
    """带重试的 GET 请求"""
    last_err = None
    for _ in range(MAX_RETRY):
        try:
            r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
            r.raise_for_status()
            return r.text
        except requests.RequestException as e:
            last_err = e
            time.sleep(SLEEP)
    raise RuntimeError(f"请求失败 {url}: {last_err}")


# ---------------- 价格指数 ----------------

_NAND_RE = re.compile(r'var\s+data\s*=\s*(\[\{.*?\}\])\s*;', re.S)
_DRAM_RE = re.compile(r'var\s+data1\s*=\s*(\[\{.*?\}\])\s*;', re.S)


def _assign_year(points):
    """页面日期只有 MM-DD，按当前月份往前回溯分配年份"""
    now = datetime.now()
    cur_year, cur_month = now.year, now.month
    out = []
    for p in points:
        mm = int(p["date"].split("-")[0])
        year = cur_year - 1 if mm > cur_month else cur_year
        out.append({"date": f"{year}-{p['date']}", "index": p["index"]})
    return out


def scrape_price_index():
    """抓取 NAND / DRAM 价格指数，返回 (index_data, html)"""
    html = _get(BASE + "/price")
    result = {}
    for name, pat in (("NAND", _NAND_RE), ("DRAM", _DRAM_RE)):
        m = pat.search(html)
        if not m:
            print(f"  [警告] 未找到 {name} 指数数据")
            continue
        points = json.loads(m.group(1))
        points = _assign_year(points)
        result[name] = points
        print(f"  {name} 指数: {len(points)} 个数据点, "
              f"最新 {points[-1]['date']} = {points[-1]['index']}")
    return result, html


# ---------------- 产品列表 ----------------

_CAT_RE = re.compile(r'<a class="nav-item title-h6 active" href="([^"]+)">([^<]+)</a>')
_PROD_RE = re.compile(r'<th scope="row" class="title"[^>]*><a href="(/price/[^"]+)">([^<]+)</a></th>')


def parse_product_list(html):
    """从 /price 页面解析分类 + 产品列表(去重)"""
    cats = [(m.start(), m.group(1), m.group(2).strip())
            for m in _CAT_RE.finditer(html)]
    products = []
    for i, (start, cat_url, cat_name) in enumerate(cats):
        end = cats[i + 1][0] if i + 1 < len(cats) else len(html)
        section = html[start:end]
        for m in _PROD_RE.finditer(section):
            products.append({
                "category": cat_name,
                "category_url": cat_url,
                "product": m.group(2).strip(),
                "url": BASE + m.group(1),
                "path": m.group(1),
            })
    # 去重 (同一产品可能出现在多个分类，保留首次出现的分类)
    seen, unique = set(), []
    for p in products:
        if p["path"] not in seen:
            seen.add(p["path"])
            unique.append(p)
    return unique


# ---------------- 单品历史价格 ----------------

# HTML 结构: <i>日期</i> <b>低点</b> <strong>开盘</strong> <span>收盘</span>
# 注: USB 3.0 等部分产品只有 <i>日期</i> <span>收盘</span>
_HIST_RE = re.compile(
    r'<i>(\d{4}-\d{2}-\d{2})</i>\s*'
    r'(?:<b>([\d.]+)</b>\s*)?'
    r'(?:<strong>([\d.]+)</strong>\s*)?'
    r'<span>([\d.]+)</span>'
)


def scrape_product_history(url):
    """抓取单个产品页面的历史价格(近半年)"""
    html = _get(url)
    matches = _HIST_RE.findall(html)
    return [
        {"date": m[0],
         "low": float(m[1]) if m[1] else None,
         "open": float(m[2]) if m[2] else None,
         "close": float(m[3])}
        for m in matches
    ]


# ---------------- 保存 ----------------

def save_index(index_data):
    rows = []
    for name, pts in index_data.items():
        for p in pts:
            rows.append({"type": name, "date": p["date"], "index": p["index"]})
    path = os.path.join(DATA_DIR, "cfm_price_index.csv")
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=["type", "date", "index"])
        w.writeheader()
        w.writerows(rows)
    print(f"  -> {path} ({len(rows)} 行)")
    path = os.path.join(DATA_DIR, "cfm_price_index.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(index_data, f, ensure_ascii=False, indent=2)
    print(f"  -> {path}")


def save_product_list(products):
    path = os.path.join(DATA_DIR, "cfm_products.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False, indent=2)
    print(f"  -> {path} ({len(products)} 个产品)")


def save_history_csv(product_info, history):
    pid = product_info["path"].rsplit("/", 1)[-1]
    path = os.path.join(HISTORY_DIR, f"{pid}.csv")
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=["date", "low", "open", "close"])
        w.writeheader()
        w.writerows(history)


def save_all_history(all_data):
    path = os.path.join(DATA_DIR, "cfm_all_history.csv")
    rows = []
    for item in all_data:
        pid = item["path"].rsplit("/", 1)[-1]
        for h in item["history"]:
            rows.append({
                "category": item["category"],
                "product": item["product"],
                "product_id": pid,
                "date": h["date"],
                "low": h["low"],
                "open": h["open"],
                "close": h["close"],
            })
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=["category", "product", "product_id",
                                          "date", "low", "open", "close"])
        w.writeheader()
        w.writerows(rows)
    print(f"  -> {path} ({len(rows)} 行)")


# ---------------- 主流程 ----------------

def main():
    os.makedirs(HISTORY_DIR, exist_ok=True)
    print("=" * 55)
    print("CFM 闪存市场全量数据爬虫")
    print("=" * 55)

    # 1) 价格指数 + 产品列表 (复用同一个 /price 页面)
    print("\n[1/3] 抓取价格指数...")
    index_data, html = scrape_price_index()
    save_index(index_data)

    # 2) 产品列表
    print("\n[2/3] 解析产品列表...")
    products = parse_product_list(html)
    save_product_list(products)
    cats = sorted(set(p["category"] for p in products))
    print(f"  共 {len(products)} 个产品, {len(cats)} 个分类: {', '.join(cats)}")

    # 3) 逐个抓取历史价格
    n = len(products)
    print(f"\n[3/3] 抓取 {n} 个产品的历史价格 (间隔 {SLEEP}s)...")
    all_data = []
    skipped = 0
    for i, p in enumerate(products, 1):
        pid = p["path"].rsplit("/", 1)[-1]
        csv_path = os.path.join(HISTORY_DIR, f"{pid}.csv")
        # 如果已有缓存文件且非空，跳过抓取
        if os.path.exists(csv_path) and os.path.getsize(csv_path) > 50:
            hist = []
            with open(csv_path, encoding="utf-8-sig") as f:
                for row in csv.DictReader(f):
                    hist.append({"date": row["date"],
                                 "low": float(row["low"]) if row["low"] else None,
                                 "open": float(row["open"]) if row["open"] else None,
                                 "close": float(row["close"])})
            all_data.append({**p, "history": hist})
            skipped += 1
            print(f"  [{i}/{n}] {p['category']} | {p['product']}: 跳过(已缓存) {len(hist)} 条")
            continue
        try:
            hist = scrape_product_history(p["url"])
            save_history_csv(p, hist)
            all_data.append({**p, "history": hist})
            print(f"  [{i}/{n}] {p['category']} | {p['product']}: {len(hist)} 条")
        except Exception as e:
            print(f"  [{i}/{n}] {p['product']}: 失败 - {e}")
        time.sleep(SLEEP)
    if skipped:
        print(f"  (其中 {skipped} 个已缓存跳过)")

    # 保存合并历史
    print("\n保存合并历史数据...")
    save_all_history(all_data)

    # 汇总
    total = sum(len(x["history"]) for x in all_data)
    print("\n" + "=" * 55)
    print("完成! 数据汇总:")
    print(f"  价格指数: NAND {len(index_data.get('NAND', []))} + "
          f"DRAM {len(index_data.get('DRAM', []))} 点")
    print(f"  产品数量: {len(products)}")
    print(f"  历史记录: {total} 条")
    print(f"  输出目录: {DATA_DIR}/")
    print("=" * 55)


if __name__ == "__main__":
    main()
