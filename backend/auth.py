import os
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
import jwt

# If firebase_admin is used in the app, we can import it to create a custom token
try:
    import firebase_admin
    from firebase_admin import auth as firebase_auth
    _FIREBASE_AVAILABLE = True
except ImportError:
    _FIREBASE_AVAILABLE = False

router = APIRouter(prefix="/auth", tags=["auth"])

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-super-secret-key-for-dev")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    return payload

@router.post("/token")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    admin_email = os.getenv("ADMIN_EMAIL", "admin@tekhportal.com")
    admin_password = os.getenv("ADMIN_PASSWORD", "Admin@123")

    if form_data.username != admin_email or form_data.password != admin_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": admin_email, "uid": "demo-admin-uid", "role": "admin"},
        expires_delta=access_token_expires
    )
    
    firebase_token = None
    if _FIREBASE_AVAILABLE:
        try:
            # We must ensure the firebase app is initialized
            from services.firebase_service import get_firebase_app
            get_firebase_app()
            # Create a Firebase custom token so the frontend can still talk to Firestore
            custom_token_bytes = firebase_auth.create_custom_token("demo-admin-uid")
            firebase_token = custom_token_bytes.decode("utf-8")
        except Exception as e:
            print(f"Warning: Failed to generate Firebase custom token: {e}")

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "firebase_token": firebase_token,
        "user": {
            "uid": "demo-admin-uid",
            "email": admin_email,
            "displayName": "Demo Admin"
        }
    }
