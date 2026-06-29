import { getOrigin } from "@/lib/origin";
import { mcpResource } from "@/server/oauth";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export async function GET(req: Request) {
  const origin = getOrigin(req);
  return Response.json(
    {
      resource: mcpResource(origin),
      authorization_servers: [origin],
      scopes_supported: ["lolnote:read"],
      bearer_methods_supported: ["header"],
    },
    { headers: cors },
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}
