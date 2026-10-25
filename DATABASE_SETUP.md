# Connect BorrowBuddy (CCS OrgHub) to MySQL — Step by Step

Every task ends with a **✅ CHECKPOINT**. Do not move on until the checkpoint is true.
If a checkpoint fails, jump to **Troubleshooting** at the bottom.

**What changed in the project (so you can explain it in the defense)**

| File | What it does |
|---|---|
| `database/01_equipment_borrowing_system_db.sql` | Your original database (unchanged). |
| `database/02_orghub_migration.sql` | Adds the columns/tables OrgHub needs on top of your database. |
| `database/03_announcement_management.sql` | Adds announcement status, priority, pinning, scheduling, and attachment fields. |
| `data/schema.js` | Maps app field names to SQL columns (e.g. `name` → `users.full_name`). |
| `data/db.js` | Replaces the JSON file store. Same functions, but now reads/writes MySQL. |
| `data/seed.js` | Adds demo accounts/data only if they are missing (safe on every start). |
| `app.js` | Now waits for MySQL, loads data, seeds, then starts the server. |
| `routes/equipment.js` | Categories now come from the `categories` table. |
| `scripts/db-check.js` | `npm run db:check` verifies the database is wired correctly. |
| `.env.example` | Template for DB settings. The real `.env` is never committed. |

**How it works:** on start, `db.js` loads all tables into memory. Reads come from memory; every
create/update/delete is also written to MySQL immediately, in order. **MySQL is the permanent store.**
Because of this, none of the 11 route files had to be rewritten.

---

## PART A — Database

### Task 1 · Start MySQL (XAMPP)
1. Open **XAMPP Control Panel**.
2. Click **Start** next to **Apache** and **MySQL**.

✅ **CHECKPOINT 1:** Both rows turn green and MySQL shows port `3306`.
Open <http://localhost/phpmyadmin> — the phpMyAdmin page loads.

### Task 2 · Create the empty database
1. In phpMyAdmin click **New** (left sidebar).
2. Database name: `equipment_borrowing_system_db`
3. Collation: `utf8mb4_general_ci` → **Create**.

✅ **CHECKPOINT 2:** `equipment_borrowing_system_db` appears in the left sidebar (empty).

### Task 3 · Import YOUR original SQL
1. Click the database name → **Import** tab.
2. **Choose file** → `database/01_equipment_borrowing_system_db.sql` → **Import** (bottom).

✅ **CHECKPOINT 3:** Sidebar shows 4 tables: `borrow_requests`, `categories`, `equipment`, `users`.
Click `equipment` → **Browse**: you see Laptop A, Laptop B, Projector 1, HDMI Cable, Extension Cord.

### Task 4 · Run the migration (adds what OrgHub needs)
1. Still inside the database → **Import** tab.
2. Choose `database/02_orghub_migration.sql` → **Import**.
   *(Run it once only.)*

✅ **CHECKPOINT 4:** Green "Import has been successfully finished". Sidebar now shows **11 tables**:
`announcements, approvals, attendance, borrow_requests, categories, equipment, events, orgs, registrations, reports, users`.
Click `users` → **Structure**: it now has `course`, `org_id`, `active`, `updated_at`.
Click `users` → **Browse**: your Test Student's role is now `member`.
Click `equipment` → **Browse**: new columns `total`, `available`, `max_days` (Extension Cord has total 0).

### Task 4.1 · Enable announcement management
1. Still inside the database → **Import** tab.
2. Choose `database/03_announcement_management.sql` → **Import**.
   *(Run it once only, after Task 4.)*

✅ **CHECKPOINT 4.1:** The `announcements` table has `status`, `priority`, `pinned`, `publish_at`, `attachment_url`, and `archived_at`. Existing announcements remain live by default.

### Task 5 · (Recommended) Make a separate MySQL user
Using `root` with no password is fine on your own laptop, but a dedicated user is better practice.
phpMyAdmin → **SQL** tab → run:
```sql
CREATE USER 'orghub'@'localhost' IDENTIFIED BY 'ChooseAStrongPassword!';
GRANT ALL PRIVILEGES ON equipment_borrowing_system_db.* TO 'orghub'@'localhost';
FLUSH PRIVILEGES;
```
✅ **CHECKPOINT 5:** No error shown. (Skip this task if you'll use `root`; just remember your choice for Task 8.)

---

## PART B — Project

### Task 6 · Put the project in place
1. Unzip the updated `BorrowBuddy.zip`.
2. Open a terminal **inside the `BorrowBuddy` folder** (the one containing `app.js`).

✅ **CHECKPOINT 6:** `dir` (Windows) or `ls` (Mac/Linux) lists `app.js`, `package.json`, `database`, `data`.

### Task 7 · Install packages
```bash
npm install
```
This adds the two new packages (`mysql2`, `dotenv`) and updates `package-lock.json`.

✅ **CHECKPOINT 7:** No red `ERR!`. Then run `npm ls mysql2 dotenv` — both are listed with a version.

### Task 8 · Create your `.env`
1. Copy `.env.example` to a new file named `.env` (same folder).
2. Edit it:
```
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root                 # or orghub if you did Task 5
DB_PASSWORD=                 # empty for default XAMPP root; otherwise your password
DB_NAME=equipment_borrowing_system_db
SESSION_SECRET=any-long-random-text-here
PORT=3000
```
✅ **CHECKPOINT 8:** `.env` exists. Run `git status` — `.env` must **NOT** appear (it's in `.gitignore`).

### Task 9 · Verify the connection (changes nothing)
```bash
npm run db:check
```
✅ **CHECKPOINT 9:** Output starts with `OK  connected to "equipment_borrowing_system_db"`, shows `OK` for all 11 tables, and ends with
`All checks passed. You can run: npm start`.

### Task 10 · Start the app
```bash
npm start
```
✅ **CHECKPOINT 10:** Terminal shows, in this order:
```
[db] Connected to MySQL and loaded data.
CCS OrgHub running on http://localhost:3000
```
In phpMyAdmin: `orgs` has 2 rows, `events` has 2 rows, `users` has 6 rows (your 2 + 4 demo accounts).
`equipment` still has exactly your 5 items (the seed never touches a non-empty equipment table).

---

## PART C — Prove it works (do these before the showcase)

Demo accounts (all password `password123`): `admin@ccs.edu`, `adviser@ccs.edu`, `officer@ccs.edu`, `member@ccs.edu`.

### Task 11 · Authentication
| Try | Expected |
|---|---|
| Log in `member@ccs.edu` / wrong password | "Invalid email or password." |
| Log in with empty fields | Rejected, stays on login |
| Log out, then open `http://localhost:3000/equipment` | Redirected to login |
| Log in as member, open `/members` and `/borrowing/requests` | "Forbidden" (403) |

✅ **CHECKPOINT 11:** All four rows behave as expected.

### Task 12 · Borrowing workflow stored in MySQL
1. **member**: Equipments → pick *Laptop A* → fill form → submit.
2. phpMyAdmin → `borrow_requests` → Browse: new row, `status = Pending`, `code = BR-0001`.
3. **admin**: Borrowing Request → open it → **Approve**.
4. Refresh `borrow_requests`: `status = Approved`. Refresh `equipment`: Laptop A `available = 0`, `status = Unavailable`.
5. **admin**: mark **Returned**. Laptop A goes back to `available = 1`, request is `Returned`.

✅ **CHECKPOINT 12:** Every step is visible in phpMyAdmin. Also try invalid input (empty purpose, quantity 5, 30-day loan) — each shows an error and **no new row** appears.

### Task 13 · Other modules (one record each)
- **officer**: create an Event → row in `events`. Post an Announcement → row in `announcements`.
- **member**: register for the event → row in `registrations`.
- **officer**: Attendance → check in by School ID `12239942` → row in `attendance`.
- **officer**: mark event complete → submit Report → row in `reports`; submit an Approval → row in `approvals`.
- **adviser**: approve it → `approvals.status = approved`.
- **admin**: add Equipment → row in `equipment`.

✅ **CHECKPOINT 13:** Each action created/changed exactly one expected row.

### Task 14 · Persistence ("refresh must not lose data")
1. In the terminal press `Ctrl + C` (this waits for pending writes, then exits).
2. `npm start` again and log in again (sessions reset on restart — that's normal).
3. Check Events, Borrowing Records, Equipment, Announcements.

✅ **CHECKPOINT 14:** Everything you created in Tasks 12–13 is still there, and `orgs`/`events`/`users` row counts did **not** double.

---

## PART D — GitHub (matches the rubric)

### Task 15 · Commit on a feature branch, not `main`
```bash
git checkout -b feature/database
git add database data scripts routes/equipment.js app.js package.json package-lock.json .env.example .gitignore DATABASE_SETUP.md
git commit -m "feat: connect app to MySQL database"
git push -u origin feature/database
```
(Better: split into 2–3 commits, e.g. `feat: add database migration`, `refactor: replace JSON store with MySQL data layer`, `docs: add database setup guide`.)

✅ **CHECKPOINT 15:** On GitHub the branch `feature/database` exists, and **`.env` is not in the file list**.

### Task 16 · Pull Request + review
Open a PR from `feature/database`. Suggested description:
```
Closes #<issue number>
What: replaced JSON file store with MySQL (data/db.js, data/schema.js), added migration + seed.
Files: database/*, data/*, app.js, routes/equipment.js, package.json
How tested: npm run db:check; login/role tests; borrow flow; restart persistence.
```
A teammate must review it with real comments (check validation, secrets, SQL) before merging.

✅ **CHECKPOINT 16:** PR has ≥1 genuine review comment and is linked to an issue before merge.

### Task 17 · README additions (rubric requires these)
Add to `README.md`: **Database Setup** (Tasks 1–5), **Configuration** (`.env.example`), **User Accounts** (table above), **AI Assistance Disclosure** (this integration was AI-assisted — and you must be able to explain it), **License**.

✅ **CHECKPOINT 17:** A teammate can follow your README on a fresh PC and reach Checkpoint 10.

---

## Know these limits (they're fair game in the defense)
- **Edits made directly in phpMyAdmin don't show until you restart the app** (data is cached in memory).
- **Run only one copy of the server** against the database.
- If a write to MySQL fails, the terminal prints `[db] WRITE FAILED` with the SQL. Watch the terminal during demos.
- Login sessions are in memory, so everyone is logged out on restart.
- Deleting equipment also deletes its borrow history (your original foreign key is `ON DELETE CASCADE`).
- Demo password `password123` is for testing only — change it before real use.

## Troubleshooting
| Message | Cause → Fix |
|---|---|
| `ECONNREFUSED 127.0.0.1:3306` | MySQL not running → Task 1. Or different port → fix `DB_PORT`. |
| `ER_ACCESS_DENIED_ERROR` | Wrong `DB_USER`/`DB_PASSWORD` in `.env`. |
| `ER_BAD_DB_ERROR Unknown database` | Task 2 not done, or `DB_NAME` misspelled. |
| `ER_NO_SUCH_TABLE` / `Unknown column ...` | Migration (Task 4) not run. Run `npm run db:check` to see which table. |
| `Duplicate column name` / `Table already exists` | Migration was run twice. Drop the database, redo Tasks 2–4. |
| `Cannot find module 'mysql2'` | Task 7 not done: run `npm install`. |
| Original `admin@cspc.edu.ph` password unknown | Use `admin@ccs.edu`, or reset: `node -e "console.log(require('bcryptjs').hashSync('NewPass123',10))"` then in phpMyAdmin set that value in `users.password`, and restart the app. |
