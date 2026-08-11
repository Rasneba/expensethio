# Expense Tracker Web App

A full-stack expense tracker web app inspired by [MMAS Money Tracker](https://github.com/floranguyen0/mmas-money-tracker), built with Node.js, React, and Neon PostgreSQL.

## Tech Stack

- **Frontend**: React 19 + Vite + TypeScript
- **Backend**: Node.js + Express + TypeScript
- **Database**: Neon (serverless PostgreSQL)
- **Deploy**: Vercel (frontend + API)

## Project Structure

```
expense-tracker-web/
├── client/          # React frontend (Vite)
├── server/          # Express API
├── database/
│   └── schema.sql   # DB schema (run in Neon)
```

## Getting Started

### 1. Prerequisites

- Node.js 18+
- A free [Neon](https://neon.tech) account
- npm

### 2. Set up the database

1. Create a project in Neon and copy your connection string (it looks like `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`)
2. Open the **SQL editor** in Neon and paste/run the contents of `database/schema.sql`

### 3. Set up the backend

```bash
cd server
npm install
cp .env.example .env   # then edit .env with your Neon connection string
npm run dev            # API runs on http://localhost:3001
```

### 4. Set up the frontend

```bash
cd client
npm install
cp .env.example .env   # VITE_API_URL=http://localhost:3001/api for local dev
npm run dev            # app runs on http://localhost:3000
```

Or from the project root, run `npm install` then `npm run dev` to start both.

## Deploying

### Database → Neon
Already done during setup. Neon hosts your PostgreSQL for free.

### Backend → Vercel
1. Push your code to GitHub
2. In Vercel, **Import** the `server/` folder as a separate project
3. Set env vars: `DATABASE_URL`, `FRONTEND_URL` (your frontend URL)
4. Build command: `npm run build`, output dir: `.`
5. Deploy. Your API will be at `https://your-server.vercel.app/api/expenses`

### Frontend → Vercel
1. In Vercel, **Import** the `client/` folder as a separate project
2. Set env var: `VITE_API_URL=https://your-server.vercel.app/api`
3. Build command: `npm run build`, output dir: `dist`
4. Deploy

## API Endpoints

| Method | Endpoint              | Description            |
|--------|-----------------------|------------------------|
| GET    | `/api/expenses`       | List all expenses      |
| POST   | `/api/expenses`       | Create an expense      |
| PUT    | `/api/expenses/:id`   | Update an expense      |
| DELETE | `/api/expenses/:id`   | Delete an expense      |
| GET    | `/api/dashboard`      | Totals + category stats|

## Features

- Add/edit/delete expenses (amount, category, description, date)
- Dashboard with total spent, monthly total, and spending by category
- Responsive UI
- Serverless-ready (Neon + Vercel)
