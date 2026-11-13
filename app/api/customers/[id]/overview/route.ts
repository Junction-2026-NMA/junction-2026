import { buildOverview } from "@/lib/finance/overview";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const overview = buildOverview(id);
  if (!overview) return Response.json({ error: "We could not find that customer." }, { status: 404 });
  return Response.json(overview);
}
