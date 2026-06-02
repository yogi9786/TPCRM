"""
Live Chat / Chatbot router — Uses Groq API to reply to customer questions based on company.txt data
"""
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
import os
from typing import Optional, List

from groq import Groq
from auth import get_current_user

router = APIRouter(prefix="/chatbot", tags=["chatbot"])



class ChatMessage(BaseModel):
    role: str
    content: str

class ChatQueryRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []

# Global cache for company.txt knowledge
COMPANY_KNOWLEDGE = ""

def load_company_knowledge() -> str:
    global COMPANY_KNOWLEDGE
    if COMPANY_KNOWLEDGE:
        return COMPANY_KNOWLEDGE
        
    possible_paths = [
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "ingest", "company.txt"),
        "ingest/company.txt",
        "backend/ingest/company.txt",
        "../backend/ingest/company.txt",
    ]
    
    for path in possible_paths:
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    COMPANY_KNOWLEDGE = f.read()
                    return COMPANY_KNOWLEDGE
            except Exception as e:
                print(f"Error reading company knowledge: {e}")
                
    return "TekhPortal Digital Marketing Agency. We provide Brand Strategy, Market Research, and marketing ads services."

@router.post("/query")
async def chat_query(req: ChatQueryRequest, user: dict = Depends(get_current_user)):
    """Query the Groq chatbot model trained with company.txt data."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY is not configured in backend environment")

    # Load context
    knowledge = load_company_knowledge()
    
    # Initialize Groq client
    try:
        client = Groq(api_key=api_key)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to initialize Groq client: {str(e)}")
        
    system_prompt = (
        "You are an AI Sales & Customer Support Assistant for TekhPortal, a high-growth Digital Marketing Agency.\n"
        "Your task is to answer user inquiries accurately, professionally, and enthusiastically using ONLY the company knowledge base provided below.\n\n"
        "--- COMPANY KNOWLEDGE BASE ---\n"
        f"{knowledge}\n"
        "-------------------------------\n\n"
        "Guidelines:\n"
        "1. Be polite, friendly, professional, and clear.\n"
        "2. Base all facts on the company knowledge base. If asked about something not covered in the knowledge base, state that you are representing TekhPortal but do not have information on that specific inquiry and offer to have a human agent follow up.\n"
        "3. Highlight services such as Brand Strategy, Market Research, ads, and digital campaigns where relevant."
    )
    
    # Build messages chain
    messages = [
        {"role": "system", "content": system_prompt}
    ]
    
    # Add history
    if req.history:
        for msg in req.history:
            messages.append({"role": msg.role, "content": msg.content})
            
    # Add user message
    messages.append({"role": "user", "content": req.message})
    
    try:
        completion = client.chat.completions.create(
            model="llama3-8b-8192",  # ultra fast and high quality
            messages=messages,
            temperature=0.7,
            max_tokens=1024,
        )
        response_text = completion.choices[0].message.content
        return {"response": response_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Groq API Error: {str(e)}")
