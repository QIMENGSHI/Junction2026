# Kori

Kori is a mobile-first personal economic trainer for the Junction 2026 S-Bank challenge. It turns one customer’s transactions into three baskets and one weekly number: what is safe to spend.

## Run it

Requirements: Node.js 22+ and the checked-in `db/kori.duckdb`.

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`. With no API key, Kori automatically runs the six prepared demo questions through a deterministic phrase-to-tool router. It still uses the real DuckDB tools; it does not contain canned numbers.

For open-ended chat, create `.env.local`:

```text
ANTHROPIC_API_KEY=your_key_here
```

Optional settings:

```text
KORI_CUSTOMER=CUST04414
KORI_EFFORT=low
KORI_DEMO_MODE=auto
KORI_HISTORY_SECRET=a-long-random-value
```

`KORI_DEMO_MODE=on` forces the prepared demo even when a key exists. `auto` uses it when no key is present and falls back for a prepared question if the live model is unavailable. `off` always requires Claude. Conversation history is an expiring, server-signed token; a funded deployment uses the Anthropic key for signing unless `KORI_HISTORY_SECRET` is set.

## Verify it

```bash
npm run check
npm run build
```

`npm run check` covers the SQL-backed tool layer, the scripted Claude tool loop, privacy boundaries, demo follow-ups, and purchase-driven Try-it ranking/reset. `/dev` is a card gallery backed by the real tools.

To rebuild the database from the original files in `../Data/`:

```bash
python3 -m pip install -r requirements.txt
python3 scripts/build_db.py
```

The Python build runs the database integrity and SQL-tool suites. Never modify the source files in `../Data/`.

## Architecture and privacy boundary

- Fixed DuckDB table macros do every calculation. The LLM never does arithmetic.
- The server chooses the customer; tool arguments are bound SQL values.
- Cards receive figures plus supporting transaction IDs.
- The model receives compact aggregates and labels, never IDs or transaction rows.
- `/api/transactions` resolves IDs only for the selected customer.
- Home is model-free and reads the verified tools directly.

Main routes:

- `/` — Home: safe-to-spend, three baskets, and the Try-it stack: three swipeable what-if cards for the everyday spending furthest above normal (`suggest_cuts`).
- `/chat` — Coach: streaming tool-driven chat.
- `/dev` — internal gallery for checking every card without a model.

## Deploy

Deploy the `kori/` directory as the Vercel project root. The database and native DuckDB runtime are included by `next.config.ts`; the traced production functions are below Vercel’s 250 MB uncompressed function limit on the current pinned dependencies.

Set `ANTHROPIC_API_KEY` in the deployment only if open-ended chat is required. Without it, the six-question demo remains fully functional. Keep the project on the Node.js runtime—DuckDB cannot run in an Edge function.

See [DEMO.md](DEMO.md) for the three-minute pitch and recording runbook.

## Live data with MotherDuck

The original DuckDB file remains the offline seed. Set `MOTHERDUCK_TOKEN` and
`KORI_MD_DATABASE=kori` in `.env.local` to use a shared, writable MotherDuck database.
Keep the token server-only. Choose a MotherDuck organization in AWS `eu-central-1`;
Vercel functions are configured for `fra1`. Confirm the challenge's data terms permit
uploading the dataset before running the upload script.

On Vercel, DuckDB is initialized in memory with `/tmp` directories before installing
and loading the MotherDuck extension, then attaching the hosted database. Direct
`md:` initialization tries to resolve an unset home directory too early in this
runtime. The initialized instance is cached per process; every query connection
explicitly selects the hosted catalog before running SQL.

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python scripts/push_motherduck.py
npm run spike:motherduck
```

The upload refuses to overwrite an existing database. `--replace` explicitly replaces
the whole hosted database, including simulated purchases. All current SQL macros are
installed after copying and the 17 integrity checks run against the hosted copy.
No upload happens during build or deployment.

Add the same `MOTHERDUCK_TOKEN` and `KORI_MD_DATABASE` to Vercel's Preview and Production
environment variables and redeploy once to activate the connection. Validate a Preview
deployment before promoting it: the Home simulation button must appear, a €150 dinner
must change €467.40 to €397.40, and a second browser must follow within five seconds
while visible. The local spike logs connection/query times and refuses to pass if
fallback is active; it does not substitute for verifying the actual Vercel runtime.

After activation, data changes need no redeploy:

```bash
npm run purchase -- dinner          # €150, or use dinner 250.50 for a custom amount
npm run purchase -- taxi 45
npm run purchase -- groceries 80
npm run purchase -- dentist 480
npm run purchase -- list
npm run purchase -- reset
```

Home has the same preset/amount controls, polls every five seconds while visible,
and refreshes on returning to the tab. All seven tools read the customer's own spending
live. The peer cohort averages remain the original verified baseline. Previously
rendered chat answers are historical; ask a new question for current figures.

Home's baskets use the current demo month, including each new purchase in full; their
transaction lists cover that same month. The Try-it stack re-ranks after each purchase:
ideas above the age-band average cut from the 24-month average, jumps above the usual
month cut from this month. Each card shows its basis, why it was picked and the
matching simulated-purchase count. After editing `sql/tools.sql`, reinstall the hosted
macros with `python scripts/push_motherduck.py --tools-only` (keeps data and purchases).
Tool installation is transactional: validation failure rolls back the definitions.
Each stack is read in one SQL statement so its ranking and sliders use the same data snapshot.
Historical chat charts explicitly label monthly averages, show the full period total when expanded,
and expose any cent difference from rounding. Bar lengths match the printed shares.

Simulation rows have `merchant_id='SIMULATED'`. Reset deletes only those rows for
the server-selected customer and restores the original balance chain. Amounts are
€1–€5,000, at most 20 rows. Transactions update a revision row before inserting,
so competing application instances conflict and retry rather than reuse a balance.
The simulator is a shared hackathon demo: anyone who can access the app can change
or reset this demo customer's simulated purchases. It is not a production banking
write interface.

If MotherDuck initialization fails, Kori falls back to the bundled read-only data
for that server process and hides the simulator. A failure after connection succeeds
is surfaced rather than silently redirecting a write. Home no longer uses a static
build-time snapshot. The SQL remains fixed and raw rows never go to Claude.

For manual inspection, use MotherDuck's SQL editor:

```sql
USE kori;
SELECT * FROM safe_to_spend('CUST04414');
SELECT * FROM transactions
WHERE customer_id='CUST04414' AND merchant_id='SIMULATED'
ORDER BY tx_id DESC;
```

Use the purchase command for inserts; it maintains the balance, labels, basket, row
cap and revision together. Editing an old transaction directly does not repair later
stored balances. Do not open a second local writer while a server owns a local file.

`npm run try:simulate` copies the seed to a temporary writable file and tests purchases,
reset, validation, balances, all affected tools, concurrent requests and the cap.
It never writes to the seed or MotherDuck.
