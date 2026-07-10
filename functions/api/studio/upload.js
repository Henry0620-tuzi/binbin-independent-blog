import { authenticatedContext, json, putGithubFile, sanitizeFileName } from "./_shared.js";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function onRequestPost(context) {
  const auth = await authenticatedContext(context);
  if (auth.error) return auth.error;
  const form = await context.request.formData();
  const file = form.get("file");
  const kind = form.get("kind") === "cover" ? "covers" : "posts";
  if (!(file instanceof File)) return json({ error: "没有收到图片文件。" }, 400);
  if (!allowedTypes.has(file.type)) return json({ error: "仅支持 JPG、PNG、WebP 和 GIF。" }, 400);
  if (file.size > 5 * 1024 * 1024) return json({ error: "单张图片不能超过 5 MB。" }, 400);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = `public/uploads/${kind}/${stamp}-${sanitizeFileName(file.name)}`;
  await putGithubFile(context.env, {
    path,
    content: new Uint8Array(await file.arrayBuffer()),
    message: `Upload ${kind === "covers" ? "cover" : "article image"}: ${file.name}`,
  });
  return json({ uploaded: true, url: `/${path.replace(/^public\//, "")}`, path });
}
