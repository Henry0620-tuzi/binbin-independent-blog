import { authenticatedContext, json, normalizeDraft } from "./_shared.js";

export async function onRequestGet(context) {
  const auth = await authenticatedContext(context);
  if (auth.error) return auth.error;
  if (!context.env.STUDIO_DRAFTS) return json({ error: "尚未绑定 STUDIO_DRAFTS KV。" }, 503);
  const record = await context.env.STUDIO_DRAFTS.get("current", "json");
  return json(record || { draft: null });
}

export async function onRequestPut(context) {
  const auth = await authenticatedContext(context);
  if (auth.error) return auth.error;
  if (!context.env.STUDIO_DRAFTS) return json({ error: "尚未绑定 STUDIO_DRAFTS KV。" }, 503);
  const draft = normalizeDraft(await context.request.json().catch(() => ({})));
  const updatedAt = new Date().toISOString();
  await context.env.STUDIO_DRAFTS.put("current", JSON.stringify({ draft, updatedAt }));
  return json({ saved: true, updatedAt });
}
