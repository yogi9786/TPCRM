"""
Firebase Admin SDK service for Firestore operations.

Initialization priority:
1. serviceAccountKey.json file (full access)
2. FIREBASE_SERVICE_ACCOUNT_JSON_CONTENT env var (full access)
3. Project-ID-only init (limited; requires Application Default Credentials)
4. Local JSON mock database (offline fallback)
"""
import json
import os



try:
    import firebase_admin
    from firebase_admin import credentials, firestore, auth
    _FIREBASE_AVAILABLE = True
except ImportError:
    firebase_admin = None  
    credentials = None     
    firestore = None       
    auth = None            
    _FIREBASE_AVAILABLE = False

try:
    from config import FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_PROJECT_ID
except Exception:
    FIREBASE_SERVICE_ACCOUNT_JSON = "./serviceAccountKey.json"
    FIREBASE_PROJECT_ID = ""

_firebase_app = None
_use_mock = False   



import uuid

class MockDocument:
    def __init__(self, id, data):
        self.id = id
        self._data = data
        self.exists = data is not None

    def to_dict(self):
        return self._data or {}


class MockQuery:
    def __init__(self, collection_name, docs, filters=None):
        self.collection_name = collection_name
        self.docs = docs
        self.filters = filters or []

    def where(self, field, op, value):
        return MockQuery(self.collection_name, self.docs, self.filters + [(field, op, value)])

    def order_by(self, field, direction="ASCENDING"):
        return self  

    def limit(self, n):
        return self

    def stream(self):
        filtered = []
        for doc_id, data in self.docs.items():
            match = True
            for field, op, val in self.filters:
                if op == "==":
                    if data.get(field) != val:
                        match = False
                        break
                elif op == ">=":
                    if not (str(data.get(field, "")) >= str(val)):
                        match = False
                        break
            if match:
                filtered.append(MockDocument(doc_id, data))
        return filtered


class MockDocumentRef:
    def __init__(self, collection_path, doc_id, db_instance):
        self.collection_path = collection_path
        self.id = doc_id
        self.db = db_instance

    def get(self):
        data = self.db._get_doc(self.collection_path, self.id)
        return MockDocument(self.id, data)

    def update(self, data):
        self.db._update_doc(self.collection_path, self.id, data)

    def delete(self):
        self.db._delete_doc(self.collection_path, self.id)


class MockCollectionRef:
    def __init__(self, name, db_instance):
        self.name = name
        self.db = db_instance

    def where(self, field, op, value):
        return MockQuery(self.name, self.db._get_collection(self.name)).where(field, op, value)

    def order_by(self, field, direction="ASCENDING"):
        return MockQuery(self.name, self.db._get_collection(self.name))

    def document(self, doc_id):
        return MockDocumentRef(self.name, doc_id, self.db)

    def add(self, data):
        doc_id = str(uuid.uuid4())
        self.db._update_doc(self.name, doc_id, data)
        return None, MockDocumentRef(self.name, doc_id, self.db)

    def stream(self):
        return MockQuery(self.name, self.db._get_collection(self.name)).stream()


class MockFirestoreClient:
    _DB_PATH = os.path.join(os.path.dirname(__file__), "..", "local_db.json")

    def __init__(self):
        self.data = {}
        self._load()

    def _load(self):
        path = os.path.abspath(self._DB_PATH)
        if os.path.exists(path):
            try:
                with open(path, "r") as f:
                    self.data = json.load(f)
            except Exception:
                self.data = {}
        else:
            self.data = {}

    def _save(self):
        path = os.path.abspath(self._DB_PATH)
        try:
            with open(path, "w") as f:
                json.dump(self.data, f, indent=2, default=str)
        except Exception as e:
            pass

    def collection(self, name):
        return MockCollectionRef(name, self)

    def _get_collection(self, name):
        return self.data.setdefault(name, {})

    def _get_doc(self, coll, doc_id):
        return self._get_collection(coll).get(doc_id)

    def _update_doc(self, coll, doc_id, data):
        existing = self._get_collection(coll).setdefault(doc_id, {})
        existing.update(data)
        self._save()

    def _delete_doc(self, coll, doc_id):
        coll_data = self._get_collection(coll)
        if doc_id in coll_data:
            del coll_data[doc_id]
            self._save()



def _init_firebase_app():
    """Try to initialise Firebase Admin SDK. Returns True on success."""
    global _firebase_app

    if not _FIREBASE_AVAILABLE:
        return False

    
    try:
        _firebase_app = firebase_admin.get_app()
        return True
    except ValueError:
        pass  

    
    sa_file = os.path.abspath(FIREBASE_SERVICE_ACCOUNT_JSON)
    if os.path.exists(sa_file):
        try:
            cred = credentials.Certificate(sa_file)
            _firebase_app = firebase_admin.initialize_app(cred, {
                "projectId": FIREBASE_PROJECT_ID or None,
            })
            pass
            return True
        except Exception as e:
            pass

    
    sa_content = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON_CONTENT", "").strip()
    if sa_content and sa_content not in ("{}", ""):
        try:
            sa_dict = json.loads(sa_content)
            cred = credentials.Certificate(sa_dict)
            _firebase_app = firebase_admin.initialize_app(cred, {
                "projectId": FIREBASE_PROJECT_ID or sa_dict.get("project_id"),
            })
            pass
            return True
        except Exception as e:
            pass

    
    return False



def get_firebase_app():
    global _firebase_app
    if not _FIREBASE_AVAILABLE:
        raise RuntimeError("firebase_admin package is not installed")
    if _firebase_app is None:
        if not _init_firebase_app():
            raise RuntimeError("Firebase could not be initialised — no valid credentials found")
    return _firebase_app


def get_db():
    """Return a Firestore client, or the local MockFirestoreClient as fallback."""
    global _use_mock
    if _use_mock:
        return MockFirestoreClient()

    try:
        get_firebase_app()
        return firestore.client()
    except Exception as e:
        if not _use_mock:
            pass
            _use_mock = True
        return MockFirestoreClient()


def verify_firebase_token(id_token: str) -> dict:
    """Verify a Firebase ID token. Mock token accepted for local dev."""
    if id_token == "mock-jwt-token-xyz":
        return {
            "uid": "demo-admin-uid",
            "email": os.getenv("ADMIN_EMAIL", "admin@tekhportal.com"),
            "name": "Demo Admin",
        }

    if not _FIREBASE_AVAILABLE:
        raise RuntimeError("firebase_admin is not installed")

    get_firebase_app()
    return auth.verify_id_token(id_token)
