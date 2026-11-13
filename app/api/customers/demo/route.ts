import { DEMO_CUSTOMERS } from "@/lib/finance/data";

export async function GET() {
  return Response.json(DEMO_CUSTOMERS);
}
