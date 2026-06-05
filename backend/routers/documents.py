from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from models.document import DocumentCreate, DocumentUpdate
from services.firebase_service import get_db
from auth import get_current_user

router = APIRouter(prefix="/documents", tags=["documents"])

@router.get("/")
async def get_documents(user: dict = Depends(get_current_user)):
    db = get_db()
    docs = db.collection("documents").where("userId", "==", user["uid"]).stream()
    documents = [{"id": d.id, **d.to_dict()} for d in docs]
    documents.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    return documents

@router.post("/", status_code=201)
async def create_document(document: DocumentCreate, user: dict = Depends(get_current_user)):
    db = get_db()
    now = datetime.utcnow().isoformat()
    data = {
        **document.model_dump(),
        "userId": user["uid"],
        "createdAt": now,
        "updatedAt": now,
    }
    ref = db.collection("documents").add(data)
    return {"success": True, "id": ref[1].id}

@router.patch("/{document_id}")
async def update_document(document_id: str, update: DocumentUpdate, user: dict = Depends(get_current_user)):
    db = get_db()
    doc_ref = db.collection("documents").document(document_id)
    doc = doc_ref.get()
    if not doc.exists or doc.to_dict().get("userId") != user["uid"]:
        raise HTTPException(status_code=404, detail="Document not found")
    
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    update_data["updatedAt"] = datetime.utcnow().isoformat()
    doc_ref.update(update_data)
    return {"success": True}

@router.delete("/{document_id}")
async def delete_document(document_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc_ref = db.collection("documents").document(document_id)
    doc = doc_ref.get()
    if not doc.exists or doc.to_dict().get("userId") != user["uid"]:
        raise HTTPException(status_code=404, detail="Document not found")
    doc_ref.delete()
    return {"success": True}
