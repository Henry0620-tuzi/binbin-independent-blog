import { authenticatedContext, draftToMarkdown, json, normalizeDraft, putGithubFile } from "./_shared.js";

export async function onRequestPost(context) {
  const auth = await authenticatedContext(context);
  if (auth.error) return auth.error;
  const draft = normalizeDraft(await context.request.json().catch(() => ({})));
  if (!draft.title || !draft.slug || !draft.description || !draft.body) {
    return json({ error: "标题、文章地址、摘要和正文不能为空。" }, 400);
  }

  const result = await putGithubFile(context.env, {
    path: `content/posts/${draft.slug}.md`,
    content: draftToMarkdown(draft),
    message: `Publish article: ${draft.title}`,
  });
  if (context.env.STUDIO_DRAFTS) await context.env.STUDIO_DRAFTS.delete("current");

  const siteUrl = String(context.env.SITE_URL || new URL(context.request.url).origin).replace(/\/$/, "");
  return json({
    published: true,
    commit: result.commit?.html_url || null,
    articleUrl: `${siteUrl}/posts/${encodeURIComponent(draft.slug)}/`,
  });
}
