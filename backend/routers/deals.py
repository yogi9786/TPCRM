from fastapi_cache.decorator import cache
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from models.deal import DealCreate, DealUpdate
from services.firebase_service import get_db
from auth import get_current_user

router = APIRouter(prefix="/deals", tags=["deals"])

@router.get("/")
@cache(expire=30)
async def get_deals(user: dict = Depends(get_current_user)):
    db = get_db()
    docs = db.collection("deals").where("userId", "==", user["uid"]).stream()
    deals = [{"id": d.id, **d.to_dict()} for d in docs]
    deals.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    return deals

@router.post("/", status_code=201)
async def create_deal(deal: DealCreate, user: dict = Depends(get_current_user)):
    db = get_db()
    now = datetime.utcnow().isoformat()
    data = {
        **deal.model_dump(),
        "userId": user["uid"],
        "createdAt": now,
        "updatedAt": now,
    }
    ref = db.collection("deals").add(data)
    return {"success": True, "id": ref[1].id}

@router.patch("/{deal_id}")
async def update_deal(deal_id: str, update: DealUpdate, user: dict = Depends(get_current_user)):
    db = get_db()
    doc_ref = db.collection("deals").document(deal_id)
    doc = doc_ref.get()
    if not doc.exists or doc.to_dict().get("userId") != user["uid"]:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    update_data["updatedAt"] = datetime.utcnow().isoformat()
    doc_ref.update(update_data)
    return {"success": True}

@router.delete("/{deal_id}")
async def delete_deal(deal_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc_ref = db.collection("deals").document(deal_id)
    doc = doc_ref.get()
    if not doc.exists or doc.to_dict().get("userId") != user["uid"]:
        raise HTTPException(status_code=404, detail="Deal not found")
    doc_ref.delete()
    return {"success": True}
