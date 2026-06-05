from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from models.task import TaskCreate, TaskUpdate
from services.firebase_service import get_db
from auth import get_current_user

router = APIRouter(prefix="/tasks", tags=["tasks"])

@router.get("/")
async def get_tasks(user: dict = Depends(get_current_user)):
    db = get_db()
    docs = db.collection("tasks").where("userId", "==", user["uid"]).stream()
    tasks = [{"id": d.id, **d.to_dict()} for d in docs]
    tasks.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    return tasks

@router.post("/", status_code=201)
async def create_task(task: TaskCreate, user: dict = Depends(get_current_user)):
    db = get_db()
    now = datetime.utcnow().isoformat()
    data = {
        **task.model_dump(),
        "userId": user["uid"],
        "createdAt": now,
        "updatedAt": now,
    }
    ref = db.collection("tasks").add(data)
    return {"success": True, "id": ref[1].id}

@router.patch("/{task_id}")
async def update_task(task_id: str, update: TaskUpdate, user: dict = Depends(get_current_user)):
    db = get_db()
    doc_ref = db.collection("tasks").document(task_id)
    doc = doc_ref.get()
    if not doc.exists or doc.to_dict().get("userId") != user["uid"]:
        raise HTTPException(status_code=404, detail="Task not found")
    
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    update_data["updatedAt"] = datetime.utcnow().isoformat()
    doc_ref.update(update_data)
    return {"success": True}

@router.delete("/{task_id}")
async def delete_task(task_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc_ref = db.collection("tasks").document(task_id)
    doc = doc_ref.get()
    if not doc.exists or doc.to_dict().get("userId") != user["uid"]:
        raise HTTPException(status_code=404, detail="Task not found")
    doc_ref.delete()
    return {"success": True}
