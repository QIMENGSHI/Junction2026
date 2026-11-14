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

`npm run check` covers the SQL-backed tool layer, the scripted Claude tool loop, privacy boundaries, and every no-key demo question. `/dev` is a card gallery backed by the real tools.

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

- `/` — Home: safe-to-spend, three baskets, and the what-if slider.
- `/chat` — Coach: streaming tool-driven chat.
- `/dev` — internal gallery for checking every card without a model.

## Deploy

Deploy the `kori/` directory as the Vercel project root. The database and native DuckDB runtime are included by `next.config.ts`; the traced production functions are below Vercel’s 250 MB uncompressed function limit on the current pinned dependencies.

Set `ANTHROPIC_API_KEY` in the deployment only if open-ended chat is required. Without it, the six-question demo remains fully functional. Keep the project on the Node.js runtime—DuckDB cannot run in an Edge function.

See [DEMO.md](DEMO.md) for the three-minute pitch and recording runbook.
