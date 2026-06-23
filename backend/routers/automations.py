from fastapi_cache.decorator import cache
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from models.automation import AutomationCreate, AutomationUpdate
from services.firebase_service import get_db
from auth import get_current_user

router = APIRouter(prefix="/automations", tags=["automations"])

@router.get("/")
@cache(expire=30)
async def get_automations(user: dict = Depends(get_current_user)):
    db = get_db()
    docs = db.collection("automations").where("userId", "==", user["uid"]).stream()
    automations = [{"id": d.id, **d.to_dict()} for d in docs]
    automations.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    return automations

@router.post("/", status_code=201)
async def create_automation(automation: AutomationCreate, user: dict = Depends(get_current_user)):
    db = get_db()
    now = datetime.utcnow().isoformat()
    data = {
        **automation.model_dump(),
        "userId": user["uid"],
        "createdAt": now,
        "updatedAt": now,
    }
    ref = db.collection("automations").add(data)
    return {"success": True, "id": ref[1].id}

@router.patch("/{automation_id}")
async def update_automation(automation_id: str, update: AutomationUpdate, user: dict = Depends(get_current_user)):
    db = get_db()
    doc_ref = db.collection("automations").document(automation_id)
    doc = doc_ref.get()
    if not doc.exists or doc.to_dict().get("userId") != user["uid"]:
        raise HTTPException(status_code=404, detail="Automation not found")
    
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    update_data["updatedAt"] = datetime.utcnow().isoformat()
    doc_ref.update(update_data)
    return {"success": True}

@router.delete("/{automation_id}")
async def delete_automation(automation_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc_ref = db.collection("automations").document(automation_id)
    doc = doc_ref.get()
    if not doc.exists or doc.to_dict().get("userId") != user["uid"]:
        raise HTTPException(status_code=404, detail="Automation not found")
    doc_ref.delete()
    return {"success": True}
