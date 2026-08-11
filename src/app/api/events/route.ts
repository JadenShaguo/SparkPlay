import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/http";
import { recordSharePlayComplete, recordSharePlayStart } from "@/lib/store";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  slug: z.string().min(1),
  type: z.enum(["playStart", "playComplete"])
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    if (body.type === "playStart") {
      await recordSharePlayStart(body.slug);
    } else {
      await recordSharePlayComplete(body.slug);
    }
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
