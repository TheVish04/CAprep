# CAprep

A web application for Indian Chartered Accountancy (CA) students to practice exams, access study resources, take AI-powered quizzes, and track progress. The project is a monorepo with a React frontend and an Express backend.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Folder Structure](#folder-structure)
- [Environment Variables](#environment-variables)
- [Development Setup](#development-setup)
- [API Overview](#api-overview)
- [Deployment](#deployment)
- [Security](#security)
- [Future Roadmap](#future-roadmap)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Overview

CAprep helps CA students prepare for Foundation, Intermediate, and Final exams with:

- **Question bank** — Filter by subject, exam stage, paper type, year, and month; bookmark questions.
- **Quizzes** — Generated from the question bank or from **Google Gemini** (AI) by subject and exam stage.
- **Resources** — PDFs (MTP, RTP, PYQS, etc.) stored on Cloudinary; search and download.
- **Discussions** — Per-question and per-resource threads with replies and likes.
- **Dashboard** — Quiz history, study hours, bookmarks, recent activity, and announcements.
- **Admin** — User management, questions/resources/announcements CRUD, analytics, cache clear.

Authentication uses **email + OTP** for registration and **JWT** for sessions. Protected routes require a valid `Authorization: Bearer <token>` header.

---

## Features

| Area | Capabilities |
|------|----------------|
| **Auth** | Email OTP verification, register, login, forgot/reset password (OTP), JWT, role-based access (user/admin). |
| **Questions** | List/filter, bookmark, CRUD (admin); quiz generation from DB or AI. |
| **Resources** | List/filter, bookmark, download; upload/update/delete (admin); Cloudinary storage. |
| **Quizzes** | Generate from DB by subject/exam stage; submit answers; view history and review. |
| **AI Quiz** | Generate MCQs via Gemini; CA-focused chat assistant (`/api/ai-quiz/ask`). |
| **Dashboard** | Stats, quiz trends, study hours, recent questions/resources, bookmarks, announcements. |
| **Discussions** | Threads per question or resource; post reply, edit, delete, like. |
| **Admin** | Users list, role update; announcements CRUD; analytics (resources, quizzes, donations); clear cache. |

---

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| **Frontend** | React 19, React Router 7, Vite 6, Tailwind CSS 4, Chart.js, Framer Motion, Axios, DOMPurify, html2pdf.js, react-pdf, react-error-boundary |
| **Backend** | Node.js, Express 4, Mongoose 8, JWT, bcrypt, Joi, Multer, Helmet, xss-clean, express-mongo-sanitize, express-rate-limit, NodeCache |
| **Database** | MongoDB (Atlas or self-hosted) |
| **Auth** | JWT (Bearer), OTP (in-memory + disk for verified emails), SendGrid or Nodemailer for email |
| **External** | Google Generative AI (Gemini), Cloudinary (file storage) |

---

## Architecture

- **Frontend:** Single-page app (SPA). Routes are protected by checking `localStorage` for a JWT; admin routes also require `role === 'admin'` from the decoded token. API calls use an Axios instance that attaches `Authorization: Bearer <token>`.
- **Backend:** REST API. Auth middleware validates JWT and attaches `req.user`; admin middleware checks `req.user.role === 'admin'`. Global rate limit (e.g. 200 requests per 15 minutes per IP). GET responses for questions/resources can be cached (NodeCache) with a TTL; cache is cleared on mutations.
- **Auth flow:** Register: send OTP → verify OTP → register (password hashed with bcrypt) → JWT. Login: email + password → JWT. Password reset: forgot (OTP sent) → verify OTP → reset password. Token is used as Bearer in `Authorization` header; expiry is controlled by `JWT_EXPIRES_IN` on the server.
- **Database:** MongoDB with Mongoose. Main collections: User, Question, Resource, Discussion, Announcement. Indexes are defined on models for common filters and searches.

---

## Folder Structure

```
CAPrep/
├── backend/
│   ├── config/           # database.js, cloudinary.js, logger.js
│   ├── middleware/       # authMiddleware.js, cacheMiddleware.js
│   ├── models/           # UserModel, QuestionModel, ResourceModel, DiscussionModel, AnnouncementModel
│   ├── routes/           # auth, questions, resources, users, admin, discussions, dashboard, aiQuiz
│   ├── services/         # otpService.js (OTP generation, verification, email)
│   ├── server.js         # Express app, DB connect, route mounting, security middleware
│   └── .env              # Environment variables (do not commit)
├── frontend/
│   ├── src/
│   │   ├── components/   # Login, Register, Dashboard, Quiz, AdminPanel, Resources, etc.
│   │   ├── pages/        # LandingPage, About, ContactUs, FAQ, ChatBotPage, QuizReview
│   │   ├── utils/        # axiosConfig.js, apiUtils.js, authUtils.js, pdfGenerator.js
│   │   ├── App.jsx       # Router, routes, protected/redirect guards
│   │   └── main.jsx
│   ├── dist/             # Production build output
│   ├── vite.config.js
│   └── package.json
├── README.md
└── .gitignore
```

- **Backend:** Entry point is `server.js`. It connects to MongoDB, mounts routes under `/api/*`, and applies security (Helmet, CORS, rate limit, body parsers). Announcements are served at `/api/announcements` (inline in server) and admin clear-cache at `POST /api/admin/clear-cache`.
- **Frontend:** `App.jsx` defines all routes; protected routes use a wrapper that reads `localStorage.getItem('token')` and decodes the JWT for role. Most API calls use the Axios instance from `utils/axiosConfig.js`, which sets the base URL from `VITE_API_URL` and adds the Bearer token.

---

## Environment Variables

**Important:** Never commit `.env` files. Use `.env.example` with placeholder values and keep real secrets in your environment or secret store.

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default `5000`) |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Secret for signing JWTs |
| `JWT_EXPIRES_IN` | No | JWT lifetime (e.g. `1d`, `24h`) |
| `CORS_ORIGIN` | No | Comma-separated allowed origins (e.g. `http://localhost:5173,https://caprep.vercel.app`) |
| `GEMINI_API_KEY` | Yes for AI | Google Gemini API key (AI quiz and chat) |
| `CLOUDINARY_CLOUD_NAME` | Yes | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Yes | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Yes | Cloudinary API secret |
| `SENDGRID_API_KEY` | One of email | SendGrid API key (recommended for serverless) |
| `SENDGRID_FROM_EMAIL` | With SendGrid | Verified sender email for SendGrid |
| `EMAIL_USER` | One of email | SMTP user (e.g. Gmail) if not using SendGrid |
| `EMAIL_PASSWORD` | With EMAIL_USER | SMTP password |
| `ADMIN_EMAIL` | No | Email for bootstrap admin (default `admin@example.com`) |
| `ADMIN_PASSWORD` | No | Password for bootstrap admin (min 8 chars) |
| `ADMIN_FULL_NAME` | No | Display name for bootstrap admin |
| `NODE_ENV` | No | `development` or `production` |

### Frontend (`frontend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Yes | Backend API base URL (e.g. `http://localhost:5000/api` for dev, `https://your-api.com/api` for prod) |

Use **one** name only: `VITE_API_URL`. The app expects the base URL to include `/api` (e.g. `https://api.example.com/api`).

---

## Development Setup

### Prerequisites

- Node.js v18+
- MongoDB v6+ (local or Atlas)
- npm or yarn

### Steps

1. **Clone and install**

   ```bash
   git clone https://github.com/yourusername/CAPrep.git
   cd CAPrep
   ```

   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

2. **Backend environment**

   In `backend/`, create `.env` with at least:

   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/CAPrep
   JWT_SECRET=your_secure_random_string
   JWT_EXPIRES_IN=1d
   CORS_ORIGIN=http://localhost:5173
   GEMINI_API_KEY=your_gemini_api_key
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_key
   CLOUDINARY_API_SECRET=your_secret
   SENDGRID_API_KEY=your_sendgrid_key
   SENDGRID_FROM_EMAIL=your-verified@example.com
   ```

   For local SMTP instead of SendGrid, set `EMAIL_USER` and `EMAIL_PASSWORD`.

3. **Frontend environment**

   In `frontend/`, create `.env`:

   ```env
   VITE_API_URL=http://localhost:5000/api
   ```

4. **Run**

   ```bash
   # Terminal 1 – backend
   cd backend && npm run dev

   # Terminal 2 – frontend
   cd frontend && npm run dev
   ```

   - Frontend: http://localhost:5173  
   - Backend: http://localhost:5000  
   - Health: http://localhost:5000/health  

---

## API Overview

Base path: `/api`. Authenticated routes require header: `Authorization: Bearer <token>`.

| Group | Endpoints (summary) |
|-------|----------------------|
| **Auth** | `POST /auth/send-otp`, `POST /auth/verify-otp`, `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/refresh-token`, `POST /auth/forgot-password`, `POST /auth/verify-reset-otp`, `POST /auth/reset-password` |
| **Users** | `GET /users/me`, `GET /users/me/bookmarks/ids`, `POST /users/me/bookmarks/:questionId`, `DELETE /users/me/bookmarks/:questionId`, profile/avatar/password and resource bookmark routes |
| **Questions** | `GET /questions` (filter, optional cache), `GET /questions/:id`, `POST /questions` (admin), `PUT /questions/:id` (admin), `DELETE /questions/:id` (admin), `GET /questions/count`, `GET /questions/quiz`, `POST /questions/quiz/submit`, bookmark routes under users |
| **Resources** | `GET /resources`, `GET /resources/count`, `GET /resources/:id`, `POST /resources` (admin, multipart), `PUT /resources/:id` (admin), `DELETE /resources/:id` (admin), download via backend or Cloudinary URL |
| **Quizzes / AI** | `POST /ai-quiz/generate` (auth), `POST /ai-quiz/ask` (chat) |
| **Discussions** | `GET /discussions/:itemType/:itemId` (question or resource), `POST /discussions/:itemType/:itemId/message`, and reply/edit/delete/like as implemented in routes |
| **Dashboard** | `GET /dashboard` (auth; returns stats, trends, announcements, recent activity, bookmarks), `POST /dashboard/study-session`, `POST /dashboard/resource-engagement`, `POST /dashboard/question-view`, `POST /dashboard/resource-view`, `GET /dashboard/announcements` |
| **Announcements** | `GET /announcements` (auth; active announcements) |
| **Admin** | `GET /admin/analytics`, `POST /admin/announcements`, `GET /admin/announcements`, `PUT /admin/announcements/:id`, `DELETE /admin/announcements/:id`, `POST /admin/clear-cache` (auth + admin) |

---

## Deployment

### Frontend (Vercel)

1. Connect the repo to Vercel.
2. Set **Root Directory** to `frontend` (or build from repo root with correct root in config).
3. Build: `npm run build`; output directory: `dist`.
4. Set environment variable: `VITE_API_URL=https://your-backend-url.com/api`.
5. Deploy; ensure rewrites/redirects for SPA (e.g. all routes → `index.html`).

### Backend (Render / Railway / VPS)

1. Use Node.js; start command: `node server.js` (from `backend/` if root is repo root, or set root to `backend`).
2. Set all required backend environment variables (see [Environment Variables](#environment-variables)).
3. Set `CORS_ORIGIN` to your frontend origin(s), comma-separated (e.g. `https://caprep.vercel.app`).
4. For MongoDB, use Atlas or another managed service and set `MONGODB_URI`.
5. For email, prefer SendGrid (`SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`) on serverless/hosted platforms.

**PM2 (VPS):**

```bash
cd backend
npm install -g pm2
pm2 start server.js --name caprep-api
pm2 save
```

---

## Security

- **Secrets:** Never commit `.env`. Rotate JWT secret, DB credentials, and API keys if ever exposed.
- **Auth:** Passwords hashed with bcrypt (e.g. 12 rounds). JWT signed with `JWT_SECRET`; use `JWT_EXPIRES_IN` for short-lived tokens.
- **HTTP:** Helmet, CORS allowlist, rate limiting, body size limits. Request/response sanitization (xss-clean, express-mongo-sanitize).
- **Validation:** Joi for request validation; Mongoose schemas and sanitization to reduce injection risk.
- **Admin:** Sensitive actions (e.g. clear-cache, announcements, analytics) behind admin middleware; bootstrap admin from env only on first run.

---

## Future Roadmap

- **High:** Fix login response to use `fullName`; fix cache clear when passing multiple patterns; fix dashboard Question populate field name; use `JWT_EXPIRES_IN` for login; replace hardcoded API URLs with `VITE_API_URL`; optional token refresh flow.
- **Medium:** Pagination for questions/resources and admin lists; stricter rate limits for auth endpoints; optional email verification link; in-app notifications; PWA/offline support.
- **Optional:** Audit log for admin actions; analytics dashboard; monetization (e.g. Razorpay); dark mode; export (PDF/CSV).

---

## Troubleshooting

| Issue | Check |
|-------|--------|
| API calls fail (CORS / connection) | Backend running; `CORS_ORIGIN` includes frontend origin; `VITE_API_URL` points to backend base URL including `/api`. |
| 401 on protected routes | Valid token in `Authorization: Bearer <token>`; token not expired; user still exists in DB. |
| OTP / email not sending | SendGrid: `SENDGRID_API_KEY` and `SENDGRID_FROM_EMAIL` set; SMTP: `EMAIL_USER` and `EMAIL_PASSWORD` set; check provider limits and spam. |
| AI quiz errors | `GEMINI_API_KEY` set; quota/rate limits for Gemini; subject/examStage match expected values. |
| DB errors | `MONGODB_URI` correct; network access (Atlas IP allowlist); Mongoose and Node versions compatible. |

---

## License

This project is licensed under the MIT License.

---

## Contact

For support or inquiries, please reach out to the development team.
