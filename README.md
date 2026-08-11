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
npm run dev            # app runs on http://localhost:3000
```

> No `.env` needed for the frontend — it calls `/api`, which Vite proxies to the API in development.

Or from the project root, run `npm install` then `npm run dev` to start both.

## Deploying

### Database → Neon
Already done during setup. Neon hosts your PostgreSQL for free.

### API → Vercel (project 1)

1. Push your code to GitHub
2. In Vercel, click **Add New → Project** and import your repo
3. Set **Root Directory** to `server`
4. In **Environment Variables**, add `DATABASE_URL` = your Neon connection string
5. Click **Deploy**. Your API is live at `https://your-api.vercel.app/api/expenses`

> The `server/vercel.json` tells Vercel to run the Express app via `@vercel/node` — no build step needed.

### Frontend → Vercel (project 2)

1. In Vercel, click **Add New → Project** and import your repo
2. Set **Root Directory** to `client`
3. Vercel auto-detects Vite. In **Environment Variables**, add:
   - `VITE_API_URL` = `https://your-api.vercel.app/api`
4. Click **Deploy**. Your app is live at `https://your-app.vercel.app`

### Local development
```bash
npm install   # root installs all workspaces
npm run dev   # starts API (3001) + frontend (3000) together
```

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
