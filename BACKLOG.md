# ExpenseTracker — Feature Backlog

## Financial Model

```
Income  ──────────→  Money received
Borrowed  ────────→  Cash in (creates liability)
                     ↓
              Available Money
                     ↓
Expenses  ──────────→  Money spent
Credit Payments  ───→  Money out (reduces liability)
                     ↓
              Available Balance

Available = Income + Borrowed − Expenses − Credit Payments
Credit Owed = Borrowed − Credit Payments  (liability)
```

**Key distinction:** Borrowing 10,000 ETB increases your cash but creates a 10,000 ETB liability. It is NOT an expense. Credit payments (paying back) ARE money leaving.

---

## 🔴 Critical

- [x] **Financial calculation correctness** — Properly separate income, expenses, credit, and available balance
- [ ] **Data-loss protection** — Offline queue for failed API calls, local backup
- [ ] **API error handling** — Graceful error states, retry logic, user-friendly messages
- [ ] **Input validation** — Server-side and client-side validation for all forms

## 🟠 High

- [x] **Credit management** — Track who you owe, amount, due dates, creditor name, remaining balance
- [ ] **Plans / budgets** — Monthly plans with planned vs actual spending per category
- [ ] **Recurring transactions** — Rent, salary, subscriptions, loan payments auto-created
- [ ] **Categories** — User-editable categories, icons per category, category budgets
- [ ] **Dashboard** — Available balance, total expenses, outstanding credit, upcoming payments
- [ ] **Due-date reminders** — Warn before credit/plan payments are due
- [ ] **Credit edit** — Full edit support for credit entries (already partial)

## 🟡 Medium

- [ ] **Reports** — Monthly/weekly spending and category breakdown, exportable
- [ ] **Search & filters** — Date, category, credit, plan, amount range filters
- [ ] **Export** — Excel/CSV/PDF export of transactions and reports
- [ ] **Notifications** — Browser push notifications for due dates and budgets
- [ ] **Performance** — Pagination for large transaction lists, lazy loading
- [ ] **Mobile UX** — Better touch controls, swipe gestures, haptic feedback

## 🟢 Low

- [ ] **Multiple accounts** — Cash, bank, Telebirr, CBE Birr, etc. as separate accounts
- [ ] **Multi-currency** — ETB, USD, etc. with conversion rates
- [ ] **Authentication** — User accounts and private financial data (JWT or OAuth)
- [ ] **Data visualization** — More chart types (stacked bar, area, heatmap)
- [ ] **Offline-first** — Full PWA offline support with background sync

---

## Completed

### v2 — Financial Model & Credit Management (Current)
- ✅ Corrected financial model: Available = Income + Borrowed − Expenses − Payments
- ✅ Dashboard shows financial flow breakdown with clear separation
- ✅ Credit management: due dates, creditor names, overdue/upcoming warnings
- ✅ Credit edit support in CreditTab
- ✅ Assistant understands credit/owe/borrow questions
- ✅ Database migration for due_date and creditor columns

### v1 — Frontend UI Overhaul
- ✅ Inter font, expanded color system, rich dark mode
- ✅ framer-motion page transitions and micro-interactions
- ✅ Skeleton loaders for all data views
- ✅ Redesigned stat cards with gradient accents and icons
- ✅ Chat assistant with typing indicator and suggestion pills
- ✅ Improved forms with focus glow, animated toggles, save states
- ✅ Glassmorphism bottom nav with active indicator
- ✅ Empty states with friendly icons
