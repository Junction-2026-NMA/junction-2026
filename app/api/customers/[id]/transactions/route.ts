import { listTransactions, parseFilter } from "@/lib/finance/transactions";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const filter = parseFilter(new URL(req.url).searchParams);
  if (typeof filter === "string") return Response.json({ error: filter }, { status: 400 });
  const list = listTransactions(id, filter);
  if (!list) return Response.json({ error: "We could not find that customer." }, { status: 404 });
  return Response.json(list);
}
