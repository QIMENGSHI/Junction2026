import { transactionsByIds } from "@/lib/tools";

export const runtime = "nodejs";

/** The rows behind a card ("show transactions"). Goes to the screen only, never to the model.
 *  The SQL limits it to the demo customer, so ids from anyone else return nothing. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body.ids.filter((id): id is number => Number.isInteger(id)).slice(0, 5000) : [];
  if (ids.length === 0) return Response.json({ rows: [] });
  return Response.json({ rows: await transactionsByIds(ids) });
}
