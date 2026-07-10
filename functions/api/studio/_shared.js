const encoder = new TextEncoder();

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

export function getCookie(request, name) {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return "";
}

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

export async function createSession(secret) {
  const expires = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const nonce = crypto.randomUUID();
  const payload = `${expires}.${nonce}`;
  return `${payload}.${await hmac(payload, secret)}`;
}

export async function isAuthenticated(request, env) {
  if (!env.STUDIO_SESSION_SECRET) return false;
  const token = getCookie(request, "studio_session");
  const [expires, nonce, signature] = token.split(".");
  if (!expires || !nonce || !signature || Number(expires) < Date.now()) return false;
  const expected = await hmac(`${expires}.${nonce}`, env.STUDIO_SESSION_SECRET);
  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
  }
  return mismatch === 0;
}

export function sessionCookie(value, request, maxAge = 604800) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `studio_session=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

export function requireConfig(env, names) {
  const missing = names.filter((name) => !env[name]);
  if (missing.length) throw new Error(`缺少环境变量：${missing.join(", ")}`);
}

export function sanitizeSlug(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export function sanitizeFileName(value) {
  const parts = String(value || "image").split(".");
  const ext = parts.length > 1 ? parts.pop().toLowerCase() : "bin";
  const base = parts.join(".") || "image";
  return `${sanitizeSlug(base) || "image"}.${ext.replace(/[^a-z0-9]/g, "") || "bin"}`;
}

function singleLine(value, maxLength) {
  return String(value || "").replace(/[\r\n\u2028\u2029]+/g, " ").trim().slice(0, maxLength);
}

export function encodeBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

export async function githubRequest(env, path, options = {}) {
  requireConfig(env, ["GITHUB_TOKEN", "GITHUB_OWNER", "GITHUB_REPO"]);
  const response = await fetch(`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "binbin-writing-studio",
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `GitHub 请求失败（${response.status}）`);
  return data;
}

export async function putGithubFile(env, { path, content, message }) {
  const branch = env.GITHUB_BRANCH || "main";
  let sha;
  try {
    const existing = await githubRequest(env, `/contents/${encodeURI(path)}?ref=${encodeURIComponent(branch)}`);
    sha = existing.sha;
  } catch (error) {
    if (!String(error.message).includes("Not Found")) throw error;
  }

  return githubRequest(env, `/contents/${encodeURI(path)}`, {
    method: "PUT",
    body: JSON.stringify({
      message,
      content: typeof content === "string" ? encodeBase64(encoder.encode(content)) : encodeBase64(content),
      branch,
      ...(sha ? { sha } : {}),
    }),
  });
}

export function normalizeDraft(input) {
  const title = singleLine(input.title, 120);
  const slug = sanitizeSlug(input.slug || title);
  const description = singleLine(input.description, 240);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(input.date || "") ? input.date : new Date().toISOString().slice(0, 10);
  const tags = (Array.isArray(input.tags) ? input.tags : String(input.tags || "").split(","))
    .map((tag) => singleLine(tag, 30))
    .filter(Boolean)
    .slice(0, 12);
  const coverValue = singleLine(input.cover, 500);
  const cover = /^(?:https?:\/\/|\/)/i.test(coverValue) ? coverValue : "";
  const body = String(input.body || "").trim().slice(0, 200000);
  return { title, slug, description, date, tags, cover, body };
}

export function draftToMarkdown(draft) {
  const yamlValue = (value) => JSON.stringify(String(value));
  const tags = draft.tags.length ? `tags:\n${draft.tags.map((tag) => `  - ${yamlValue(tag)}`).join("\n")}` : "tags: []";
  const cover = draft.cover ? `\ncover: ${yamlValue(draft.cover)}` : "";
  return `---\ntitle: ${yamlValue(draft.title)}\ndescription: ${yamlValue(draft.description)}\ndate: ${draft.date}\n${tags}${cover}\n---\n\n${draft.body}\n`;
}

export async function authenticatedContext(context) {
  if (!(await isAuthenticated(context.request, context.env))) {
    return { error: json({ error: "登录已失效，请重新登录。" }, 401) };
  }
  return { ok: true };
}
