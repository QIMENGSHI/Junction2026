# Kori — three-minute demo

## One-line pitch

Kori turns a bank statement into three understandable baskets and one trustworthy weekly number—then lets the customer inspect every euro behind it.

## Stage flow

**0:00–0:25 — The problem**

“A balance is not a budget. Customers can see what they have, but not what is already spoken for. Kori separates regular bills, irregular necessities and everyday choices.”

**0:25–0:55 — Home**

Open Home. Point to **€467.40 safe to spend this week**. Say: “This already protects the customer’s bills, irregular-cost buffer and €2,000 savings goal until payday.”

Open **How I calculated this**. Show the balance, housing, normal running costs, irregular buffer and savings goal. Tap a line to reveal the real transactions behind it.

With MotherDuck enabled, tap **Simulate a purchase → Dinner → Add purchase**.
“A €150 dinner changes this week's allowance from €467.40 to €397.40.” A second
visible device follows within five seconds. Reset before continuing the original
stage flow, or use `npm run purchase -- reset` from the laptop.

**0:55–1:30 — A precise question**

Open Coach and ask: **“How much did I spend on taxis last month?”**

The number card shows **€207.65** and three rides in September. Open the rides. Say: “The model chose a tool; fixed SQL produced the number and its evidence.”

**1:30–2:05 — Where the money goes**

Ask: **“Where does my money really go?”**

Show the three basket bars, then the everyday breakdown. Point out that restaurants lead everyday spending at **€540.34 a month**.

On Home, the same question is one tap: tap **Everyday spending** and the baskets card turns
over to September's categories, one color each: Transportation **€364.14**, Lifestyle
**€352.87**, Entertainment **€352.68**, Restaurants **€133.87** (together the front's
€1,203.56). Tap the card to turn it back.

**2:05–2:35 — Turn insight into action**

Ask: **“What if I cut dining out by 20%?”**

Move the slider. At 20%, the verified result is **€108.07 a month** and **€1,296.82 a year**. Every slider step is precomputed by SQL; the browser only displays it.

On Home, the **Try it** stack holds three what-if cards ranked by how far the
spending sits above normal: **Restaurants** (€343.93 a month above people your age),
**Entertainment** (€299.71 above) and **Taxi** (€207.65 this month against a usual
€16.12). Swipe, or tap the arrows at the screen's edges, to bring another card to the front. In Coach,
**“What else could I cut?”** shows the same stack.

Live variant: **Simulate a purchase → Taxi → 200 → Add purchase**. The stack re-ranks
and Taxi jumps to the front: €407.65 this month, €391.53 above normal. Reset afterwards.

**2:35–2:50 — Personal context**

Ask: **“Is that normal for my age?”** The benchmark card shows restaurants at **2.8×** the age-group average and the **98th percentile**.

**2:50–3:00 — Close**

“Kori does not sell a product or shame the customer. It makes their own money legible, verifiable and actionable.”

## Prepared questions

1. How much did I spend on taxis last month?
2. Where does my money really go?
3. How much can I spend this week?
4. What if I cut dining out by 20%?
5. Is that normal for my age?
6. What kind of spender am I?

The Finnish toggle exposes equivalent Finnish prompts. With no Anthropic key, these questions use the credit-free router and the same production SQL tools. The router also answers a typed **“What else could I cut?”** (*“Mitä muuta voisin vähentää?”*) with the Try-it stack, and **“What if I cut taxis by 30%?”** with a taxi what-if card.

## Backup recording checklist

1. Use a 390 × 844 phone viewport, light mode, and start on Home.
   For the live version, run `npm run purchase -- reset` and verify €467.40 first.
2. Restart the app immediately before recording so the DuckDB connection is warm.
3. Record the stage flow above in one take; target 2:40–2:50.
4. Keep the no-key demo active for deterministic timing.
5. Export 1080p H.264 and verify that card text remains readable on a projector.
6. Keep one local copy and one cloud copy; also export a 30-second silent loop of Home → calculation → taxi card.

The actual recording is intentionally not automated: it should include the presenter’s final voiceover and timing.
