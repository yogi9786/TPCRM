"""
Content Planner router — Plan, schedule, and manage content across channels
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from models.content_plan import ContentPlanCreate, ContentPlanUpdate
from services.firebase_service import get_db
from auth import get_current_user

router = APIRouter(prefix="/content-plans", tags=["content-plans"])


@router.get("/")
async def get_content_plans(
    platform: str = None,
    status: str = None,
    user: dict = Depends(get_current_user),
):
    """Get all content plans for a user, optionally filtered by platform/status."""
    db = get_db()
    query = db.collection("content_plans").where("userId", "==", user["uid"])
    docs = query.stream()
    plans = [{"id": d.id, **d.to_dict()} for d in docs]

    # Client-side filter (Firestore compound indexes not always pre-built)
    if platform:
        plans = [p for p in plans if p.get("platform") == platform]
    if status:
        plans = [p for p in plans if p.get("status") == status]

    plans.sort(key=lambda x: x.get("scheduledAt") or x.get("createdAt", ""), reverse=False)
    return plans[:200]


@router.post("/", status_code=201)
async def create_content_plan(
    plan: ContentPlanCreate,
    user: dict = Depends(get_current_user),
):
    """Create a new content plan."""
    db = get_db()
    now = datetime.utcnow().isoformat()
    data = {
        **plan.model_dump(),
        "userId": user["uid"],
        "createdAt": now,
        "updatedAt": now,
    }
    ref = db.collection("content_plans").add(data)
    return {"success": True, "id": ref[1].id}


@router.get("/{plan_id}")
async def get_content_plan(plan_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = db.collection("content_plans").document(plan_id).get()
    if not doc.exists or doc.to_dict().get("userId") != user["uid"]:
        raise HTTPException(status_code=404, detail="Content plan not found")
    return {"id": doc.id, **doc.to_dict()}


@router.patch("/{plan_id}")
async def update_content_plan(
    plan_id: str,
    update: ContentPlanUpdate,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    doc_ref = db.collection("content_plans").document(plan_id)
    doc = doc_ref.get()
    if not doc.exists or doc.to_dict().get("userId") != user["uid"]:
        raise HTTPException(status_code=404, detail="Content plan not found")

    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    update_data["updatedAt"] = datetime.utcnow().isoformat()
    doc_ref.update(update_data)
    return {"success": True}


@router.delete("/{plan_id}")
async def delete_content_plan(plan_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc_ref = db.collection("content_plans").document(plan_id)
    doc = doc_ref.get()
    if not doc.exists or doc.to_dict().get("userId") != user["uid"]:
        raise HTTPException(status_code=404, detail="Content plan not found")
    doc_ref.delete()
    return {"success": True}


@router.post("/{plan_id}/publish")
async def publish_content_plan(plan_id: str, user: dict = Depends(get_current_user)):
    """Mark a content plan as published."""
    db = get_db()
    doc_ref = db.collection("content_plans").document(plan_id)
    doc = doc_ref.get()
    if not doc.exists or doc.to_dict().get("userId") != user["uid"]:
        raise HTTPException(status_code=404, detail="Content plan not found")
    doc_ref.update({
        "status": "published",
        "publishedAt": datetime.utcnow().isoformat(),
        "updatedAt": datetime.utcnow().isoformat(),
    })
    return {"success": True}
