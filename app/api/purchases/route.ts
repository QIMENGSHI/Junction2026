import { addPurchase, listPurchases, PurchaseError, resetPurchases } from "@/lib/purchases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "cache-control": "no-store" };

export async function GET() {
  try { return Response.json(await listPurchases(), { headers }); }
  catch { return Response.json({ error: "Couldn’t check live data. Try again." }, { status: 503, headers }); }
}

async function mutate(request: Request, reset: boolean) {
  // Only same-origin browser writes; the cloud token never reaches the client.
  // Next's local Node server normalizes request.url to localhost even for 127.0.0.1.
  // Host retains the actual browser destination (also on Vercel custom domains).
  const destination = new URL(request.url);
  const host = request.headers.get("host");
  if (host) destination.host = host;
  if (request.headers.get("origin") !== destination.origin) {
    return Response.json({ error: "Same-origin requests only." }, { status: 403, headers });
  }
  try {
    let input: unknown;
    if (!reset) {
      const body = await request.text();
      if (body.length > 2048) throw new PurchaseError("Purchase request is too large.", 413);
      try { input = JSON.parse(body); } catch { throw new PurchaseError("Send a valid JSON purchase."); }
    }
    const result = reset ? await resetPurchases() : await addPurchase(input);
    return Response.json(result, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof PurchaseError ? error.message : "Couldn’t update the demo. Try again." },
      { status: error instanceof PurchaseError ? error.status : 503, headers });
  }
}
export const POST = (request: Request) => mutate(request, false);
export const DELETE = (request: Request) => mutate(request, true);
