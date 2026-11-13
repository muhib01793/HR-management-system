# HR Management System

A web application for managing employees and departments, with secure login, role-based access,
search, filters, CSV export and a live dashboard. **Many companies can use one installation:** each company
registers with its own email, becomes its own admin, and only ever sees its own data.

**Stack:** React 18 + Vite · Node.js + Express · PostgreSQL · JWT authentication

---

## Features

- **Multi-company:** a company clicks **Register your company**, enters its name and its own email, and gets a private workspace with default departments. Two companies never see each other's employees, departments, users or activity log, and may even use the same department names and employee emails

- **Dashboard** with live headcount, active employees, new joiners and a department breakdown (all calculated in the database, so numbers stay correct at any size)
- **Employees:** add, edit, view, delete, search, filter by department/status, sort, pagination, **CSV export**
- **Departments:** list with headcount, add, rename, delete (admin only, and only when empty)
- **Users & roles:** Admins create HR accounts, change roles, reset passwords
- **My account:** every user can change their own password (this signs them out of all other devices)
- **Activity log (admins):** who added, changed, deleted or exported what, plus sign-ins and failed sign-ins
- **Security:** hashed passwords, login rate-limiting, secure HTTP headers, strict content policy, input validation, no data sent to outside websites
- **Responsive:** works on desktop, tablet and phone
- **Tests:** API tests (real PostgreSQL), frontend tests, optional browser end-to-end tests

## Roles

| Action | Admin | HR staff |
|---|:---:|:---:|
| View dashboard, employees, departments | ✅ | ✅ |
| Add / edit employees, export CSV | ✅ | ✅ |
| Add / rename departments | ✅ | ✅ |
| **Delete departments** (when empty) | ✅ | ❌ |
| **View activity log** | ✅ | ❌ |
| **Delete employees** | ✅ | ❌ (mark them *inactive* instead) |
| **Manage users** (create, roles, reset passwords, delete) | ✅ | ❌ |
| Change own password | ✅ | ✅ |

The person who registers a company becomes that company's **Admin** and adds their own HR staff under **Users**.
The system always keeps at least one admin per company, and an admin cannot delete their own account.

---

## 1. Run it on your computer (development)

**You need:** [Node.js 18+](https://nodejs.org) and [PostgreSQL 14+](https://www.postgresql.org/download/).

**a) Create the database** (once):

```sql
CREATE DATABASE hr_management;
```

**b) Configure the backend**

```bash
cd backend
copy .env.example .env        # Windows  (macOS/Linux: cp .env.example .env)
```

Open `backend/.env` and fill in your PostgreSQL password (`DB_PASSWORD`), your port (`DB_PORT`, usually `5432`),
and your database name (`DB_NAME`). `ADMIN_EMAIL` / `ADMIN_PASSWORD` are optional: leave them empty and companies register on the website.
Set `SEED_DEMO_DATA=true` if you want 14 fictional employees to try things out.

> ⚠️ If any value contains the `#` character, wrap it in double quotes: `ADMIN_PASSWORD="My#Pass123"`.
> Otherwise everything after `#` is silently ignored.

**c) Install and start** (from the project root, two terminals)

```bash
npm run setup          # installs backend + frontend (once)
npm run dev:backend    # terminal 1 -> API on http://localhost:5000
npm run dev:frontend   # terminal 2 -> app on http://localhost:5173
```

Open <http://localhost:5173> and click **Register your company** to create your workspace with your own email.
(Or fill `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env` and that first company is created for you on start.)

---

## 2. Deploy for the whole company (production)

Staff open one web address in their browser. Install nothing on their computers.
Pick **one** of these on a server or an always-on office PC.

### Option A — Docker (recommended)

Needs [Docker](https://www.docker.com/products/docker-desktop/) only. It starts PostgreSQL and the app together.

```bash
cp .env.example .env           # Windows: copy .env.example .env
# edit .env: set DB_PASSWORD, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
docker compose up -d --build
```

Open `http://<server-address>:5000`. Data is stored in a Docker volume and survives restarts and updates.

Update to a new version: replace the project files, then run `docker compose up -d --build`.

### Option B — Without Docker

```bash
npm run setup
npm run build                  # builds the frontend; the backend serves it automatically
```

In `backend/.env` set `NODE_ENV=production`, a strong `JWT_SECRET`, and your database details, then:

```bash
npm start                      # everything is now on http://localhost:5000
```

To keep it running after you close the window or restart the PC, use [PM2](https://pm2.keymetrics.io/):

```bash
npm install -g pm2
pm2 start backend/server.js --name hr-system
pm2 save
```

### Strongly recommended: HTTPS

Passwords and salaries travel over your network. Put the app behind HTTPS, for example with
[Caddy](https://caddyserver.com) (automatic certificates):

```
hr.yourcompany.com {
    reverse_proxy localhost:5000
}
```

Then set `TRUST_PROXY=1` so rate-limiting sees real client addresses.

---

## 3. Settings reference (`backend/.env`, or the root `.env` for Docker)

| Variable | Required | Description |
|---|:---:|---|
| `NODE_ENV` | | `development` (default) or `production` |
| `PORT` | | Server port (default `5000`) |
| `DB_HOST` `DB_PORT` `DB_NAME` `DB_USER` `DB_PASSWORD` | ✅ | PostgreSQL connection |
| `DB_SSL` | | `true` for managed databases that require SSL |
| `JWT_SECRET` | ✅ in production | 32+ random characters. The server **refuses to start** in production with a missing or weak one |
| `JWT_EXPIRES_IN` | | Login lifetime (default `8h`) |
| `ALLOW_REGISTRATION` | | `true` (default): any company can register on the website. `false`: single-company install, no public sign-up |
| `COMPANY_NAME` `ADMIN_NAME` `ADMIN_EMAIL` `ADMIN_PASSWORD` | optional | Creates a first company and admin when there are no users yet. **Required** when `ALLOW_REGISTRATION=false` |
| `SEED_DEMO_DATA` | | `true` loads 14 fictional employees, only if there are none |
| `CORS_ORIGIN` | | Only needed if the frontend is hosted on a different domain |
| `TRUST_PROXY` | | `1` when behind nginx/Caddy/a load balancer |

Generate a secret: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

---

## 4. Backups (do this regularly!)

**Docker:**

```bash
sh scripts/backup.sh                 # macOS / Linux
.\scripts\backup.ps1                 # Windows PowerShell
```

Backups are saved in `backups/`. Copy them somewhere safe, off the server. To restore into a **new, empty** database:

```bash
docker compose cp backups/hr-XXXX.sql db:/tmp/restore.sql
docker compose exec -T db psql -U hr -d hr_management -f /tmp/restore.sql
```

**Without Docker:** `pg_dump -U postgres -d hr_management -f backup.sql`

---

## 5. Upgrading from v1

Your existing PostgreSQL data is kept. On first start the app adds a `role` column and makes all current users **admins**, so nobody is locked out.

1. Copy your old `backend/.env` values (`DB_*`) into the new `backend/.env`.
2. Add a new strong `JWT_SECRET`.
3. **Change your database password**, and the admin password (`admin123` was shown on the old login page).
4. Start the app, sign in, and create HR accounts under **Users**.

What changed: roles and user management, change-password, login rate-limiting and security headers, CSV export,
a server-side dashboard (the old one showed wrong totals above 50 employees), join dates that pre-fill correctly when editing,
no more demo credentials on the login page, and avatars drawn locally instead of loading from an outside website
(which leaked employee names).

---

## 5b. Upgrading from v2.0 / v2.1 to v2.2 (multi-company)

Nothing to do by hand. On first start the app adds the companies table and moves **all your existing users,
departments and employees into one company**, named after `COMPANY_NAME` (default "My Company"; set it in `.env`
before the first start, or rename it later under **My account**). Nothing is lost and nobody is locked out.
Other companies can then register on the website.

Department names and employee emails are now unique **per company** instead of for the whole database.

## 6. Troubleshooting

| Problem | Fix |
|---|---|
| `password authentication failed` | Wrong `DB_PASSWORD`/`DB_USER` in `.env`. If the password contains `#`, put it in double quotes |
| `ECONNREFUSED` / cannot connect to database | PostgreSQL isn't running, or `DB_PORT` is wrong (default is `5432`) |
| `database "hr_management" does not exist` | Run `CREATE DATABASE hr_management;` once |
| `No users exist yet and website registration is turned off` | You set `ALLOW_REGISTRATION=false`: fill in `ADMIN_EMAIL` and `ADMIN_PASSWORD` (8+ characters) in `.env` |
| `EADDRINUSE ... port 5000` | An old backend is still running. Press `Ctrl + C` in its terminal, or on Windows: `netstat -ano \| findstr :5000` then `taskkill /PID <number> /F` |
| `password authentication failed` | `DB_PASSWORD`, `DB_USER` or `DB_PORT` in `backend/.env` do not match the PostgreSQL server you are running (check each installed version's port) |
| `JWT_SECRET is missing or weak` | Production needs a random secret of 32+ characters (see above) |
| `Port 5173 is already in use` | Another project is running there. Stop it, or run `npm --prefix frontend run dev -- --port 5174` |
| Login says "Too many login attempts" | Wait 15 minutes. Limit is 10 failed attempts per IP |
| Someone forgot their password | An admin opens **Users → Reset password** |
| The only admin forgot their password | Update it directly in the database, or create another admin first |

---

## 7. Tests

```bash
npm test                         # backend + frontend
```

Backend tests need PostgreSQL and use a **separate** database (`hr_management_test`, or `DB_NAME_TEST`), so real data is never touched.
Create it once: `CREATE DATABASE hr_management_test;`

Browser end-to-end tests (optional): start backend and frontend with `SEED_DEMO_DATA=true`, then

```bash
cd frontend
npx playwright install
E2E_EMAIL=admin@yourcompany.com E2E_PASSWORD=yourpassword npm run test:e2e
```

---

## 8. Project structure

```
├── backend/
│   ├── server.js            Express app (security headers, rate limits, serves the frontend)
│   ├── config.js            Reads and validates settings
│   ├── db.js                PostgreSQL schema, safe upgrades, first-run seeding
│   ├── middleware/auth.js   Login check + role check
│   ├── routes/              auth (login, register) · company · users · employees · departments · dashboard · audit
│   ├── utils/audit.js       Writes the activity log
│   ├── utils/validators.js
│   ├── seed/demo-data.json  Fictional sample data (opt-in)
│   └── tests/               API tests (Jest + Supertest)
├── frontend/
│   ├── src/pages/           Login, Register, Dashboard, Employees, EmployeeForm, Departments, Users, Activity, Account
│   ├── src/components/      Layout, Sidebar, Header, Avatar, Modal, ...
│   ├── src/utils/           Date/money formatting, validation rules
│   └── e2e/                 Playwright browser tests
├── Dockerfile · docker-compose.yml
├── scripts/                 backup.sh · backup.ps1
└── .github/workflows/ci.yml Automatic tests on every push
```

## 9. API overview

All `/api` routes except `login` and `health` need `Authorization: Bearer <token>`.

| Method | Route | Who |
|---|---|---|
| `GET` | `/api/health` | public |
| `GET` | `/api/auth/config` | public (is registration open?) |
| `POST` | `/api/auth/register` | public (rate-limited): creates a company + its first admin |
| `POST` | `/api/auth/login` | public (rate-limited) |
| `GET/PUT` | `/api/company` | any user / admin (rename) |
| `GET` | `/api/auth/me` · `POST /api/auth/change-password` | any user |
| `GET` | `/api/dashboard` | any user |
| `GET/POST` | `/api/employees` · `GET/PUT /api/employees/:id` | any user |
| `GET` | `/api/employees/export` (CSV) | any user |
| `DELETE` | `/api/employees/:id` | admin |
| `GET/POST/PUT` | `/api/departments` · `/api/departments/:id` | any user |
| `DELETE` | `/api/departments/:id` | admin |
| `GET` | `/api/audit` (`entity`, `page`, `limit`) | admin |
| `GET/POST/PUT/DELETE` | `/api/users` | admin |

List endpoint options: `search`, `department`, `status`, `sort`, `order`, `page`, `limit` (max 50).

## 10. Security notes

- Never commit `.env`; it is already in `.gitignore`. Keep database and JWT secrets private.
- Login tokens live in the browser's local storage, protected by a strict content-security policy and no third-party scripts. Sessions expire after 8 hours.
- Salaries are visible to every signed-in user. If only some staff should see them, ask your developer to add a permission for it.
- Every query is limited to the signed-in user's company (`company_id`), and the API tests check that one company cannot read, change or delete another company's data. Keep it that way when you add features.
- Sign-up is open to anyone who can reach the website (rate-limited to 10 per hour per address). For a private company install, set `ALLOW_REGISTRATION=false`.
- Emails are **not verified** and no emails are sent yet, so a company admin who forgets the password must be reset by the person running the server (database). Email verification and password-reset by email are sensible next steps (they need an email service).
- Admins can review every change of their own company under **Activity log**. Changing or resetting a password signs that person out of all devices.
- There is no two-factor login yet; it is a sensible next step for a larger company.
