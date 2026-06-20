"""
Team router — Manage CRM team members with credentials and roles
Supports: Create/Read/Update/Delete team members, invite by email
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from pydantic import BaseModel
from typing import Optional
from services.firebase_service import get_db
from services.email_service import send_email
from auth import get_current_user
import hashlib
import os
import secrets
import string

router = APIRouter(prefix="/team", tags=["team"])

# ── Models ────────────────────────────────────────────────────────────────────

class TeamMemberCreate(BaseModel):
    name: str
    email: str
    username: str
    password: str
    role: str = "agent"           # admin | manager | agent | viewer
    department: Optional[str] = None
    phone: Optional[str] = None
    send_welcome_email: bool = True

class TeamMemberUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    username: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = None

class PasswordReset(BaseModel):
    new_password: str

# ── Helpers ───────────────────────────────────────────────────────────────────

ROLE_TEMPLATES = {
    "admin": {
        "label": "Admin",
        "description": "Full access to all CRM features, settings, billing and team management.",
        "color": "purple",
        "permissions": ["leads", "campaigns", "email", "whatsapp", "meta", "analytics", "settings", "team", "documents"]
    },
    "manager": {
        "label": "Manager",
        "description": "Can manage leads, run campaigns, view analytics and assign tasks.",
        "color": "blue",
        "permissions": ["leads", "campaigns", "email", "whatsapp", "meta", "analytics", "tasks", "documents"]
    },
    "agent": {
        "label": "Sales Agent",
        "description": "Can manage assigned leads, send WhatsApp/Email messages and update deal stages.",
        "color": "emerald",
        "permissions": ["leads", "whatsapp", "email", "tasks"]
    },
    "viewer": {
        "label": "Viewer",
        "description": "Read-only access to leads, campaigns and analytics.",
        "color": "slate",
        "permissions": ["leads", "analytics"]
    }
}

def hash_password(password: str) -> str:
    """Simple SHA-256 hash for password storage (use bcrypt in production)."""
    salt = os.getenv("JWT_SECRET_KEY", "tekhportal-salt")
    return hashlib.sha256(f"{salt}{password}".encode()).hexdigest()

def generate_temp_password(length: int = 10) -> str:
    chars = string.ascii_letters + string.digits + "@#$"
    return ''.join(secrets.choice(chars) for _ in range(length))

def build_welcome_email(name: str, email: str, username: str, password: str, role: str) -> str:
    role_info = ROLE_TEMPLATES.get(role, ROLE_TEMPLATES["agent"])
    role_label = role_info["label"]
    perms = ", ".join(p.capitalize() for p in role_info["permissions"])
    frontend_url = os.getenv("FRONTEND_URL", "https://tpcrm.netlify.app")
    return f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to TekhPortal CRM</title>
  <style>
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #f1f5f9; }}
    .wrapper {{ max-width: 580px; margin: 32px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }}
    .header {{ background: linear-gradient(135deg, #1e3a8a, #2563eb); padding: 40px 40px 32px; text-align: center; }}
    .header h1 {{ color: #fff; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; margin-top: 16px; }}
    .header p {{ color: rgba(255,255,255,0.7); font-size: 13px; margin-top: 6px; }}
    .logo {{ width: 48px; height: 48px; background: rgba(255,255,255,0.15); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; }}
    .body {{ padding: 36px 40px; }}
    .greeting {{ font-size: 16px; color: #1e293b; font-weight: 600; margin-bottom: 12px; }}
    .intro {{ font-size: 14px; color: #64748b; line-height: 1.7; margin-bottom: 28px; }}
    .cred-box {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 28px; }}
    .cred-box h3 {{ font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 16px; }}
    .cred-row {{ display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f1f5f9; }}
    .cred-row:last-child {{ border-bottom: none; padding-bottom: 0; }}
    .cred-label {{ font-size: 12px; color: #64748b; font-weight: 600; }}
    .cred-value {{ font-family: 'Courier New', monospace; font-size: 13px; color: #1e293b; font-weight: 700; background: #e0f2fe; padding: 4px 10px; border-radius: 6px; }}
    .role-badge {{ display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; background: #ede9fe; color: #7c3aed; }}
    .perms-box {{ background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin-bottom: 28px; }}
    .perms-box h3 {{ font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #16a34a; margin-bottom: 10px; }}
    .perms-list {{ font-size: 13px; color: #166534; line-height: 2; }}
    .btn {{ display: block; width: calc(100% - 80px); margin: 0 40px; padding: 14px 24px; background: linear-gradient(135deg, #1e40af, #2563eb); color: #fff; text-decoration: none; text-align: center; border-radius: 12px; font-size: 14px; font-weight: 700; letter-spacing: 0.3px; }}
    .footer {{ padding: 24px 40px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }}
    .warning {{ background: #fefce8; border: 1px solid #fde68a; border-radius: 12px; padding: 14px 20px; margin: 24px 0; font-size: 12px; color: #92400e; }}
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5z" stroke="white" stroke-width="2" stroke-linejoin="round"/><path d="M2 17l10 5 10-5" stroke="white" stroke-width="2" stroke-linejoin="round"/><path d="M2 12l10 5 10-5" stroke="white" stroke-width="2" stroke-linejoin="round"/></svg>
      </div>
      <h1>Welcome to TekhPortal CRM 🎉</h1>
      <p>You have been added as a team member</p>
    </div>
    <div class="body">
      <p class="greeting">Hi {name},</p>
      <p class="intro">
        You've been invited to join your team's TekhPortal CRM workspace as a <strong>{role_label}</strong>. 
        Your account is ready and the login credentials are below. Please change your password on your first login.
      </p>

      <div class="cred-box">
        <h3>🔐 Your Login Credentials</h3>
        <div class="cred-row">
          <span class="cred-label">Login URL</span>
          <span class="cred-value">{frontend_url}/login</span>
        </div>
        <div class="cred-row">
          <span class="cred-label">Email</span>
          <span class="cred-value">{email}</span>
        </div>
        <div class="cred-row">
          <span class="cred-label">Username</span>
          <span class="cred-value">{username}</span>
        </div>
        <div class="cred-row">
          <span class="cred-label">Temporary Password</span>
          <span class="cred-value">{password}</span>
        </div>
        <div class="cred-row">
          <span class="cred-label">Your Role</span>
          <span class="role-badge">{role_label}</span>
        </div>
      </div>

      <div class="perms-box">
        <h3>✅ Your Access Permissions</h3>
        <p class="perms-list">{perms}</p>
      </div>

      <div class="warning">
        ⚠️ <strong>Security Notice:</strong> Please change your password immediately after first login. Do not share your credentials with anyone.
      </div>
    </div>

    <a href="{frontend_url}/login" class="btn">Login to TekhPortal CRM →</a>

    <div class="footer">
      <p>© {datetime.utcnow().year} TekhPortal CRM. This email was sent automatically.</p>
      <p style="margin-top:6px">If you did not expect this, please contact your administrator.</p>
    </div>
  </div>
</body>
</html>
"""


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/members")
async def get_team_members(user: dict = Depends(get_current_user)):
    """Get all team members for this account."""
    db = get_db()
    docs = db.collection("team_members").where("accountId", "==", user["uid"]).stream()
    members = []
    for d in docs:
        m = {"id": d.id, **d.to_dict()}
        m.pop("password_hash", None)  # Never return password hash
        members.append(m)
    members.sort(key=lambda x: x.get("createdAt", ""), reverse=True)

    # Always include the current admin
    admin_exists = any(m.get("uid") == user["uid"] for m in members)
    if not admin_exists:
        members.insert(0, {
            "id": user["uid"],
            "uid": user["uid"],
            "name": "TekhPortal Admin",
            "email": user.get("sub", "tekhportal@gmail.com"),
            "username": "admin",
            "role": "admin",
            "status": "active",
            "department": "Management",
            "createdAt": datetime.utcnow().isoformat(),
            "accountId": user["uid"],
        })
    return members


@router.get("/roles")
async def get_role_templates():
    """Get all available role definitions."""
    return ROLE_TEMPLATES


@router.post("/members", status_code=201)
async def create_team_member(member: TeamMemberCreate, user: dict = Depends(get_current_user)):
    """Create a new team member with credentials."""
    db = get_db()
    now = datetime.utcnow().isoformat()

    # Check username uniqueness
    existing = db.collection("team_members").where("username", "==", member.username.strip()).stream()
    for _ in existing:
        raise HTTPException(status_code=409, detail="Username already taken. Please choose a different username.")

    # Check email uniqueness
    existing_email = db.collection("team_members").where("email", "==", member.email.strip().lower()).stream()
    for _ in existing_email:
        raise HTTPException(status_code=409, detail="A member with this email already exists.")

    data = {
        "name": member.name.strip(),
        "email": member.email.strip().lower(),
        "username": member.username.strip().lower(),
        "password_hash": hash_password(member.password),
        "role": member.role,
        "department": member.department or "",
        "phone": member.phone or "",
        "status": "active",
        "accountId": user["uid"],
        "createdAt": now,
        "updatedAt": now,
        "lastLogin": None,
        "permissions": ROLE_TEMPLATES.get(member.role, ROLE_TEMPLATES["agent"])["permissions"],
    }

    ref = db.collection("team_members").add(data)
    member_id = ref[1].id

    # Send welcome email
    if member.send_welcome_email:
        try:
            html = build_welcome_email(member.name, member.email, member.username, member.password, member.role)
            send_email(
                to_email=member.email,
                to_name=member.name,
                subject="Welcome to TekhPortal CRM — Your Login Credentials",
                html_content=html,
                text_content=f"Welcome {member.name}! Your TekhPortal CRM credentials: Email: {member.email}, Username: {member.username}, Password: {member.password}. Please login at {os.getenv('FRONTEND_URL', 'https://tpcrm.netlify.app')}/login"
            )
        except Exception as e:
            pass  # Don't fail creation if email fails

    return {"success": True, "id": member_id, "message": f"Team member {member.name} added successfully."}


@router.get("/members/{member_id}")
async def get_team_member(member_id: str, user: dict = Depends(get_current_user)):
    """Get a single team member by ID."""
    db = get_db()
    doc = db.collection("team_members").document(member_id).get()
    if not doc.exists or doc.to_dict().get("accountId") != user["uid"]:
        raise HTTPException(status_code=404, detail="Member not found")
    data = {"id": doc.id, **doc.to_dict()}
    data.pop("password_hash", None)
    return data


@router.put("/members/{member_id}")
@router.patch("/members/{member_id}")
async def update_team_member(member_id: str, update: TeamMemberUpdate, user: dict = Depends(get_current_user)):
    """Update a team member's details."""
    db = get_db()
    doc_ref = db.collection("team_members").document(member_id)
    doc = doc_ref.get()
    if not doc.exists or doc.to_dict().get("accountId") != user["uid"]:
        raise HTTPException(status_code=404, detail="Member not found")

    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    update_data["updatedAt"] = datetime.utcnow().isoformat()

    if "role" in update_data:
        update_data["permissions"] = ROLE_TEMPLATES.get(update_data["role"], ROLE_TEMPLATES["agent"])["permissions"]

    doc_ref.update(update_data)
    return {"success": True, "message": "Member updated successfully."}


@router.post("/members/{member_id}/reset-password")
async def reset_member_password(member_id: str, body: PasswordReset, user: dict = Depends(get_current_user)):
    """Reset a team member's password."""
    db = get_db()
    doc_ref = db.collection("team_members").document(member_id)
    doc = doc_ref.get()
    if not doc.exists or doc.to_dict().get("accountId") != user["uid"]:
        raise HTTPException(status_code=404, detail="Member not found")

    doc_ref.update({
        "password_hash": hash_password(body.new_password),
        "updatedAt": datetime.utcnow().isoformat(),
    })
    return {"success": True, "message": "Password reset successfully."}


@router.delete("/members/{member_id}")
async def delete_team_member(member_id: str, user: dict = Depends(get_current_user)):
    """Remove a team member."""
    db = get_db()
    doc_ref = db.collection("team_members").document(member_id)
    doc = doc_ref.get()
    if not doc.exists or doc.to_dict().get("accountId") != user["uid"]:
        raise HTTPException(status_code=404, detail="Member not found")
    doc_ref.delete()
    return {"success": True, "message": "Member removed successfully."}
