import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/http";
import { importHtml, readArtifact } from "@/lib/store";
import { validateHtml } from "@/lib/validation";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  projectId: z.string().optional(),
  title: z.string().min(1).default("导入作品"),
  html: z.string().min(20)
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const validationReport = validateHtml(body.html);
    const result = await importHtml({
      projectId: body.projectId,
      title: body.title,
      html: body.html,
      validationReport
    });
    const html = await readArtifact(result.version);
    return jsonOk({ ...result, html });
  } catch (error) {
    return jsonError(error);
  }
}
