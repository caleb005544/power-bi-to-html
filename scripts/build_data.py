#!/usr/bin/env python3
"""Convert the simulated source CSVs (data generator output) into one compact JSON file.

usage: python3 scripts/build_data.py <source_csv_dir> [out=data/dashboard.json]

Only the columns the dashboard pages need are kept. Account names are type-based anonymous
labels (e.g. "Campus Account A") and site names generic labels (e.g. "Campus A – Site 01");
anything not matching those patterns is relabelled. Months are indexes relative to the first
month of the data window (negative = before the window); dates are days since 1970-01-01.
All data is simulated data for demo purposes.
"""
import csv, json, os, re, sys
from collections import defaultdict
from datetime import date

if len(sys.argv) < 2:
    sys.exit(__doc__)
SRC = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), "..", "data", "dashboard.json")

def rows(name):
    with open(os.path.join(SRC, name + ".csv"), newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))

def num(x):
    return float(x) if x not in ("", None) else 0.0

def r2(x):
    x = round(x, 2)
    return int(x) if x == int(x) else x

def day(s):  # 'YYYY-MM-DD' -> days since epoch, None if blank
    return (date.fromisoformat(s[:10]) - date(1970, 1, 1)).days if s else None

def opt(x):
    return None if x in ("", None) else r2(float(x))

# --- months: data window only (page filter Dim_Date[IsInDataWindow] = 1)
dates = rows("Dim_Date")
months = [d["MonthStart"][:7] for d in dates if d["IsInDataWindow"] == "1"]
y0, m0 = map(int, months[0].split("-"))
def mi(s):  # month index relative to the window start (may be negative / beyond the window)
    if not s: return None
    y, m = int(s[:4]), int(s[5:7]); return (y - y0) * 12 + (m - m0)

# --- accounts: anonymised by type
accounts, account_ids, aidx, used = [], [], {}, defaultdict(int)
for a in rows("Dim_Account"):
    name = a["account_name"].strip()
    if not re.fullmatch(r"[A-Z][a-z]+ Account [A-Z]", name):
        t = a["channel"].split()[0] or "Customer"
        name = f"{t} Account {chr(65 + used[t])}"; used[t] += 1
    aidx[a["account_id"]] = len(accounts); accounts.append(name); account_ids.append(a["account_id"])

# --- sites: [account, region, venue_type, name, lat, lon, volume_tier]
regions, venues, tiers = [], [], []
def code(lst, v):
    if v not in lst: lst.append(v)
    return lst.index(v)
sites, sidx, seq = [], {}, defaultdict(int)
for s in rows("Dim_Site"):
    name = s["site_name"].strip()
    if not re.fullmatch(r"[A-Z][a-z]+ [A-Z] – Site \d+", name):   # generic label if not already anonymous
        seq[s["venue_type"]] += 1; name = f"{s['venue_type']} – Site {seq[s['venue_type']]:02d}"
    sidx[s["site_id"]] = len(sites)
    sites.append([aidx[s["account_id"]], code(regions, s["region"]), code(venues, s["venue_type"]), name,
                  round(num(s["latitude"]), 5), round(num(s["longitude"]), 5), code(tiers, s["volume_tier"])])

# --- machines: [site, contract type, cohort]
ctypes_rows = rows("Dim_ContractType")
ctypes = [c["contract_type"] for c in ctypes_rows]
cidx = {c["contract_type_id"]: i for i, c in enumerate(ctypes_rows)}
coh_rows = rows("Dim_Cohort")
cohorts = [c["cohort_label"] for c in coh_rows]
cohidx = {c["cohort_id"]: i for i, c in enumerate(coh_rows)}
machines, mach_idx = [], {}
for m in rows("Dim_Machine"):
    mach_idx[m["machine_id"]] = len(machines)
    machines.append([sidx[m["site_id"]], cidx[m["contract_type_id"]], cohidx.get(m["cohort_id"], -1)])

items = [i["item_name"] for i in rows("Dim_Item")]
iidx = {i["item_id"]: k for k, i in enumerate(rows("Dim_Item"))}
recurring = {r["revenue_line_id"]: r["is_recurring"] == "1" for r in rows("Dim_RevenueLine")}

# --- finance: [month, machine, site, recurring, revenue, cogs, logistics, service, equipment_cogs]
fin = defaultdict(lambda: [0.0] * 5)
for r in rows("Fact_FinanceMonth"):
    k = (mi(r["month_start"]), mach_idx[r["machine_id"]], sidx[r["site_id"]], 1 if recurring[r["revenue_line_id"]] else 0)
    v = fin[k]
    for i, c in enumerate(("revenue", "cogs", "logistics_cost", "service_cost", "equipment_cogs")):
        v[i] += num(r[c])
finance = [list(k) + [r2(x) for x in v] for k, v in sorted(fin.items())]

# --- machine-month
MM_COLS = ["is_active_eom", "is_mature", "operating_days", "paid_cups", "sellable_min", "scheduled_min",
           "uptime_min", "downtime_min", "stockout_min", "staff_gap_min", "failures", "repair_min", "active_calendar_days"]
mm = [[mi(r["month_start"]), mach_idx[r["machine_id"]], sidx[r["site_id"]]] + [r2(num(r[c])) for c in MM_COLS]
      for r in rows("Fact_MachineMonth")]

# --- deployments
deploy = []
for r in rows("Fact_Deployment"):
    deploy.append([mach_idx[r["machine_id"]], sidx[r["site_id"]], r2(num(r["deploy_cost"])),
                   day(r["signed_date"]), day(r["live_date"]), day(r["removed_date"]),
                   mi(r["live_month_start"]), mi(r["removed_month_start"]),
                   opt(r["days_sign_to_live"]), opt(r["days_ready_to_live"]), int(num(r["is_first_machine_at_site"]))])

# --- sales by machine-month-item
sales = [[mi(r["month_start"]), mach_idx[r["machine_id"]], sidx[r["site_id"]], iidx[r["item_id"]],
          r2(num(r["net_revenue"])), r2(num(r["consumer_sales"])), r2(num(r["cashless_sales"])), int(num(r["transactions"]))]
         for r in rows("Fact_SalesMonth")]

# --- inventory aggregated to machine-month
inv = defaultdict(lambda: [0] * 6)
INV_COLS = ["received_cups", "waste_cups", "actual_use_cups", "theoretical_use_cups", "slots_due", "slots_filled_on_time"]
for r in rows("Fact_InventoryMonth"):
    v = inv[(mi(r["month_start"]), mach_idx[r["machine_id"]], sidx[r["site_id"]])]
    for i, c in enumerate(INV_COLS): v[i] += int(num(r[c]))
inventory = [list(k) + v for k, v in sorted(inv.items())]

out = {
    "note": "All data is simulated data for demo purposes.",
    "months": months, "accounts": accounts, "accountIds": account_ids, "regions": regions, "venues": venues,
    "volumeTiers": tiers, "contractTypes": ctypes, "cohorts": cohorts, "cohortIds": [c["cohort_id"] for c in coh_rows], "items": items,
    "siteCols": ["account", "region", "venue", "name", "lat", "lon", "volumeTier"], "sites": sites,
    "machineCols": ["site", "contractType", "cohort"], "machines": machines,
    "financeCols": ["month", "machine", "site", "recurring", "revenue", "cogs", "logistics", "service", "equipmentCogs"],
    "finance": finance,
    "machineMonthCols": ["month", "machine", "site", "activeEom", "mature", "operatingDays", "paidCups", "sellableMin", "scheduledMin",
                         "uptimeMin", "downtimeMin", "stockoutMin", "staffGapMin", "failures", "repairMin", "activeCalendarDays"],
    "machineMonth": mm,
    "deploymentCols": ["machine", "site", "deployCost", "signedDay", "liveDay", "removedDay", "liveMonth", "removedMonth",
                       "daysSignToLive", "daysReadyToLive", "isFirstMachineAtSite"],
    "deployments": deploy,
    "salesCols": ["month", "machine", "site", "item", "netRevenue", "consumerSales", "cashlessSales", "transactions"],
    "sales": sales,
    "inventoryCols": ["month", "machine", "site", "receivedCups", "wasteCups", "actualUseCups", "theoreticalUseCups", "slotsDue", "slotsFilledOnTime"],
    "inventory": inventory,
}
txt = json.dumps(out, separators=(",", ":"), ensure_ascii=False)
# guard: the original company name must never reach the published data (stored reversed so it never appears in this repo)
BLOCKED = ["".join(reversed("atsirtob"))]
assert not any(w in txt.lower() for w in BLOCKED), "blocked brand name found in output"
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    f.write(txt)
print(f"wrote {OUT}: {len(txt)/1024:.0f} KB, {len(finance)} finance, {len(mm)} machine-month, {len(sales)} sales, {len(inventory)} inventory rows")
