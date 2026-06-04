import requests

# 1. Login
login_response = requests.post(
    "https://tpcrm.onrender.com/auth/token",
    data={
        "username": "admin@tekhportal.com",
        "password": "Admin@123"
    }
)
login_data = login_response.json()
token = login_data.get("access_token")

# 2. Get history
history_response = requests.get(
    "https://tpcrm.onrender.com/email/history?limit=100",
    headers={"Authorization": f"Bearer {token}"}
)

print(history_response.status_code)
print(history_response.text)
