# -*- coding: utf-8 -*-
"""把爬取的 CSV 数据转成前端友好的 JSON"""
import csv, json, os
from collections import defaultdict

DATA_DIR = "data"

# 1) 价格指数 (已经是 JSON，直接复制并补充最新当前值)
with open(os.path.join(DATA_DIR, "cfm_price_index.json"), encoding="utf-8") as f:
    index_data = json.load(f)

# 2) 全量历史价格 -> 按产品组织
products = defaultdict(list)
with open(os.path.join(DATA_DIR, "cfm_all_history.csv"), encoding="utf-8-sig") as f:
    for row in csv.DictReader(f):
        products[row["product_id"]].append({
            "category": row["category"],
            "product": row["product"],
            "date": row["date"],
            "low": float(row["low"]) if row["low"] else None,
            "open": float(row["open"]) if row["open"] else None,
            "close": float(row["close"]) if row["close"] else None,
        })

# 3) 产品列表
with open(os.path.join(DATA_DIR, "cfm_products.json"), encoding="utf-8") as f:
    product_list = json.load(f)

# 组装最终结构
result = {
    "index": index_data,
    "products": {},
}
for p in product_list:
    pid = p["path"].rsplit("/", 1)[-1]
    hist = products.get(pid, [])
    # 按日期升序排列
    hist.sort(key=lambda x: x["date"])
    result["products"][pid] = {
        "category": p["category"],
        "product": p["product"],
        "url": p["url"],
        "history": [(h["date"], h["low"], h["open"], h["close"]) for h in hist],
    }

out = os.path.join(DATA_DIR, "cfm_data.json")
with open(out, "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False)

# 统计
n_prod = len(result["products"])
n_hist = sum(len(v["history"]) for v in result["products"].values())
print(f"已生成 {out}")
print(f"  价格指数: NAND {len(index_data.get('NAND',[]))} + DRAM {len(index_data.get('DRAM',[]))} 点")
print(f"  产品: {n_prod} 个, 历史记录: {n_hist} 条")
print(f"  文件大小: {os.path.getsize(out)/1024:.1f} KB")
