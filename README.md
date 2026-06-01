# TekhPortal CRM

Full-stack CRM with WhatsApp automation (Twilio) and Meta Ads (Facebook/Instagram) integration.

## Project Structure

```
TPCRM/
├── frontend/        ← React + Vite + Tailwind + Firebase
│   └── src/
│       ├── pages/   ← Login, Dashboard, CRM, WhatsApp, Meta, Campaigns, Analytics, Settings
│       ├── layouts/ ← Sidebar + MainLayout
│       ├── contexts/ ← AuthContext (Firebase Auth)
│       └── types/   ← TypeScript definitions
│
└── backend/         ← Node.js + Express API Server
    └── src/
        ├── routes/  ← whatsapp.js, meta.js, leads.js, campaigns.js
        ├── middleware/ ← auth.js (Firebase ID Token verification)
        ├── firebase.js ← Firebase Admin SDK
        └── index.js ← Express server entry point
```

## Quick Start

### 1. Setup Frontend
```bash
cd frontend
npm install
cp .env.example .env      # Fill Firebase credentials
npm run dev               # Starts at http://localhost:5173
```

### 2. Setup Backend
```bash
cd backend
npm install
cp .env.example .env      # Fill Firebase Admin + Twilio + Meta credentials
npm run dev               # Starts at http://localhost:4000
```

### 3. Firebase Setup
- Create project at [Firebase Console](https://console.firebase.google.com)
- Enable **Authentication** (Email/Password)
- Enable **Firestore** database
- Create admin user: Console → Auth → Add User
  - Email: `admin@tekhportal.com`
  - Password: `Admin@123`
- For backend: Project Settings → Service Accounts → Generate Private Key

### 4. Twilio WhatsApp Setup
- Create account at [Twilio](https://console.twilio.com)
- Enable WhatsApp Sandbox or buy a WhatsApp Business number
- Get Account SID + Auth Token from Console

### 5. Meta Lead Ads Setup
- Create Meta App at [developers.facebook.com](https://developers.facebook.com)
- Add "Lead Ads" product
- Get Page Access Token
- Set webhook URL: `https://your-backend.com/api/meta/webhook`
- Verify token: `tekhportal_verify_2024`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server health check |
| POST | `/api/whatsapp/send` | Send single WhatsApp |
| POST | `/api/whatsapp/bulk` | Bulk WhatsApp send |
| POST | `/api/whatsapp/webhook` | Twilio callback |
| GET | `/api/whatsapp/messages` | Message history |
| GET | `/api/meta/webhook` | Meta webhook verify |
| POST | `/api/meta/webhook` | Receive Meta leads |
| GET | `/api/meta/leads` | Fetch Meta leads |
| POST | `/api/meta/leads/:id/import` | Import to CRM |
| GET | `/api/leads` | List leads |
| POST | `/api/leads` | Create lead |
| PATCH | `/api/leads/:id` | Update lead |
| DELETE | `/api/leads/:id` | Delete lead |
| GET | `/api/campaigns` | List campaigns |
| POST | `/api/campaigns` | Create campaign |
| POST | `/api/campaigns/:id/launch` | Launch broadcast |

## Tech Stack

**Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + Firebase SDK + Recharts  
**Backend**: Node.js + Express + Firebase Admin SDK + Twilio + Meta Graph API  
**Database**: Firebase Firestore  
**Auth**: Firebase Authentication
