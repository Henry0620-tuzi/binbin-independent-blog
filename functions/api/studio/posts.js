import {
  authenticatedContext,
  deleteGithubFile,
  githubRequest,
  json,
  putGithubFile,
  sanitizeSlug,
} from "./_shared.js";

const decoder = new TextDecoder();

function decodeGithubContent(value) {
  const binary = atob(String(value || "").replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return decoder.decode(bytes);
}

function validSlug(value) {
  const slug = String(value || "").trim();
  return slug && sanitizeSlug(slug) === slug ? slug : "";
}

function parsePost(markdown, fallbackSlug) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const meta = {};
  if (match) {
    for (const line of match[1].split(/\r?\n/)) {
      const separator = line.indexOf(":");
      if (separator === -1 || /^\s/.test(line)) continue;
      meta[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
    }
  }
  const unquote = (value) => {
    const text = String(value || "").trim();
    if (text.startsWith('"') && text.endsWith('"')) {
      try { return JSON.parse(text); } catch { return text.slice(1, -1); }
    }
    return text;
  };
  return {
    slug: fallbackSlug,
    title: unquote(meta.title) || fallbackSlug,
    description: unquote(meta.description),
    date: unquote(meta.date),
    published: unquote(meta.published || "true").toLowerCase() !== "false",
  };
}

function setPublished(markdown, published) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) throw new Error("文章缺少 frontmatter，无法修改公开状态。");
  const newline = markdown.includes("\r\n") ? "\r\n" : "\n";
  const lines = match[1].split(/\r?\n/);
  const index = lines.findIndex((line) => /^published\s*:/.test(line));
  if (index >= 0) lines[index] = `published: ${published}`;
  else lines.push(`published: ${published}`);
  return markdown.replace(match[0], `---${newline}${lines.join(newline)}${newline}---`);
}

async function getPostFile(env, slug) {
  const branch = env.GITHUB_BRANCH || "main";
  return githubRequest(env, `/contents/${encodeURI(`content/posts/${slug}.md`)}?ref=${encodeURIComponent(branch)}`);
}

export async function onRequestGet(context) {
  const auth = await authenticatedContext(context);
  if (auth.error) return auth.error;
  const branch = context.env.GITHUB_BRANCH || "main";
  const entries = await githubRequest(
    context.env,
    `/contents/content/posts?ref=${encodeURIComponent(branch)}`,
  );
  const files = Array.isArray(entries)
    ? entries.filter((entry) => entry.type === "file" && entry.name.endsWith(".md"))
    : [];
  const posts = await Promise.all(files.map(async (entry) => {
    const file = await githubRequest(context.env, `/contents/${encodeURI(entry.path)}?ref=${encodeURIComponent(branch)}`);
    return parsePost(decodeGithubContent(file.content), entry.name.slice(0, -3));
  }));
  posts.sort((a, b) => String(b.date).localeCompare(String(a.date)) || a.title.localeCompare(b.title, "zh-CN"));
  return json({ posts });
}

export async function onRequestPatch(context) {
  const auth = await authenticatedContext(context);
  if (auth.error) return auth.error;
  const input = await context.request.json().catch(() => ({}));
  const slug = validSlug(input.slug);
  if (!slug || typeof input.published !== "boolean") {
    return json({ error: "文章地址或公开状态无效。" }, 400);
  }
  const file = await getPostFile(context.env, slug);
  const markdown = setPublished(decodeGithubContent(file.content), input.published);
  const result = await putGithubFile(context.env, {
    path: `content/posts/${slug}.md`,
    content: markdown,
    message: `${input.published ? "Publish" : "Hide"} article: ${slug}`,
  });
  return json({ updated: true, slug, published: input.published, commit: result.commit?.html_url || null });
}

export async function onRequestDelete(context) {
  const auth = await authenticatedContext(context);
  if (auth.error) return auth.error;
  const input = await context.request.json().catch(() => ({}));
  const slug = validSlug(input.slug);
  if (!slug) return json({ error: "文章地址无效。" }, 400);
  const result = await deleteGithubFile(context.env, {
    path: `content/posts/${slug}.md`,
    message: `Delete article: ${slug}`,
  });
  return json({ deleted: true, slug, commit: result.commit?.html_url || null });
}
