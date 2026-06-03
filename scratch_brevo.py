import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), "backend"))

from backend.services.email_service import HEADERS, BREVO_API_URL
import requests
import json

response = requests.get(
    f"{BREVO_API_URL}/smtp/statistics/events",
    headers=HEADERS,
    params={"limit": 50, "offset": 0, "sort": "desc"},
    timeout=15,
)
print(json.dumps(response.json(), indent=2))
