from fastapi_cache.decorator import cache
from fastapi import APIRouter, Depends
from datetime import datetime
from collections import defaultdict
from services.firebase_service import get_db
from auth import get_current_user

router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.get("/")
@cache(expire=30)
async def get_dashboard_analytics(user: dict = Depends(get_current_user)):
    db = get_db()
    uid = user["uid"]

    # 1. Fetch leads
    leads_ref = db.collection("leads").where("userId", "==", uid).stream()
    leads = [d.to_dict() for d in leads_ref]

    # 2. Fetch clients
    clients_ref = db.collection("clients").where("userId", "==", uid).stream()
    clients = [d.to_dict() for d in clients_ref]

    # 3. Fetch messages (to count them)
    # The frontend just wants some numbers. We'll count all messages we can find.
    msgs_ref = db.collection("meta_messages").where("userId", "==", uid).stream()
    messages_count = sum(1 for _ in msgs_ref)

    # --- Metrics ---
    total_revenue = sum(c.get("totalPaid", 0) for c in clients)
    paying_clients = sum(1 for c in clients if c.get("totalPaid", 0) > 0)
    avg_deal_size = total_revenue / paying_clients if paying_clients > 0 else 0

    kpis = [
        { "label": 'Total Revenue', "value": f"₹{int(total_revenue):,}", "change": '+0%', "up": True, "color": '#100F88', "strip": '#100F88' },
        { "label": 'Avg Deal Size', "value": f"₹{int(avg_deal_size):,}", "change": '+0%', "up": True, "color": '#059669', "strip": '#10b981' },
        { "label": 'Total Leads', "value": str(len(leads)), "change": '+0%', "up": True, "color": '#7c3aed', "strip": '#7c3aed' },
        { "label": 'Total Clients', "value": str(len(clients)), "change": '+0%', "up": True, "color": '#ef4444', "strip": '#ef4444' },
    ]

    # --- Monthly Data (Jan, Feb, etc.) ---
    # We'll group by month. Since user wants it from "now", we just take actual data.
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    monthly_stats = {m: {"leads": 0, "messages": 0, "conversions": 0} for m in months}

    for l in leads:
        created = l.get("createdAt", "")
        if created:
            try:
                dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
                m = months[dt.month - 1]
                monthly_stats[m]["leads"] += 1
            except:
                pass

    for c in clients:
        created = c.get("createdAt", "")
        if created:
            try:
                dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
                m = months[dt.month - 1]
                monthly_stats[m]["conversions"] += 1
            except:
                pass

    monthly_data = [{"month": m, **stats} for m, stats in monthly_stats.items() if stats["leads"] > 0 or stats["conversions"] > 0]
    # If empty, just return the current month with zeros
    if not monthly_data:
        curr = months[datetime.utcnow().month - 1]
        monthly_data = [{"month": curr, "leads": 0, "messages": 0, "conversions": 0}]

    # --- Source Data ---
    source_counts = defaultdict(int)
    for l in leads:
        source_counts[l.get("leadSource", "Other")] += 1

    colors = ['#100F88', '#FFC263', '#10b981', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6']
    source_data = []
    for i, (src, count) in enumerate(source_counts.items()):
        source_data.append({"name": src, "value": count, "fill": colors[i % len(colors)]})
    if not source_data:
        source_data = [{"name": "No Data", "value": 1, "fill": "#e2e8f0"}]

    # --- Service Data ---
    service_counts = defaultdict(int)
    for c in clients:
        for s in c.get("services", []):
            service_counts[s.get("name", "Other")] += 1

    service_data = [{"name": name, "value": count} for name, count in sorted(service_counts.items(), key=lambda x: x[1], reverse=True)[:4]]
    if not service_data:
        service_data = [{"name": "No Data", "value": 1}]

    return {
        "kpis": kpis,
        "monthlyData": monthly_data,
        "sourceData": source_data,
        "serviceData": service_data
    }
