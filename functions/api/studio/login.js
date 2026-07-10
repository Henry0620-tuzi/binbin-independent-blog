import { createSession, json, sessionCookie } from "./_shared.js";

export async function onRequestPost({ request, env }) {
  if (!env.STUDIO_PASSWORD || !env.STUDIO_SESSION_SECRET) {
    return json({ error: "后台尚未配置，请先设置 Cloudflare 环境变量。" }, 503);
  }
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const attemptKey = `login-attempt:${ip}`;
  const attempts = env.STUDIO_DRAFTS ? Number(await env.STUDIO_DRAFTS.get(attemptKey) || 0) : 0;
  if (attempts >= 5) {
    return json({ error: "登录尝试过多，请 15 分钟后再试。" }, 429);
  }
  const body = await request.json().catch(() => ({}));
  if (String(body.password || "") !== env.STUDIO_PASSWORD) {
    if (env.STUDIO_DRAFTS) {
      await env.STUDIO_DRAFTS.put(attemptKey, String(attempts + 1), { expirationTtl: 900 });
    }
    return json({ error: "后台口令不正确。" }, 401);
  }
  if (env.STUDIO_DRAFTS) await env.STUDIO_DRAFTS.delete(attemptKey);
  const token = await createSession(env.STUDIO_SESSION_SECRET);
  return json({ authenticated: true }, 200, { "set-cookie": sessionCookie(token, request) });
}
