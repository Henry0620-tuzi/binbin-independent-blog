const api = {
  session: "/api/studio/session",
  login: "/api/studio/login",
  logout: "/api/studio/logout",
  draft: "/api/studio/draft",
  upload: "/api/studio/upload",
  publish: "/api/studio/publish",
  posts: "/api/studio/posts",
};

const elements = {
  title: document.getElementById("studio-title"),
  slug: document.getElementById("studio-slug"),
  description: document.getElementById("studio-description"),
  date: document.getElementById("studio-date"),
  tags: document.getElementById("studio-tags"),
  published: document.getElementById("studio-published"),
  cover: document.getElementById("studio-cover"),
  body: document.getElementById("studio-body"),
  previewTitle: document.getElementById("preview-title"),
  previewDescription: document.getElementById("preview-description"),
  previewDate: document.getElementById("preview-date"),
  previewTags: document.getElementById("preview-tags"),
  previewCover: document.getElementById("preview-cover"),
  previewBody: document.getElementById("preview-body"),
  copy: document.getElementById("copy-markdown"),
  download: document.getElementById("download-markdown"),
  save: document.getElementById("save-draft"),
  publish: document.getElementById("publish-post"),
  coverUpload: document.getElementById("cover-upload"),
  bodyUpload: document.getElementById("body-upload"),
  gate: document.getElementById("admin-gate"),
  shell: document.getElementById("studio-shell"),
  password: document.getElementById("gate-password"),
  enter: document.getElementById("gate-enter"),
  logout: document.getElementById("studio-logout"),
  gateStatus: document.getElementById("gate-status"),
  status: document.getElementById("studio-status"),
  postsStatus: document.getElementById("posts-status"),
  postList: document.getElementById("studio-post-list"),
  refreshPosts: document.getElementById("refresh-posts"),
};

let slugWasEdited = false;
let requestInProgress = false;

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "") || "new-post";
}

function renderInline(text) {
  const tokens = [];
  const reserve = (html) => {
    const token = `@@STUDIO_HTML_${tokens.length}@@`;
    tokens.push(html);
    return token;
  };

  let source = String(text).replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, url) => {
    if (!/^(?:https?:\/\/|\/)/i.test(url)) return alt;
    return reserve(`<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" loading="lazy" />`);
  });

  source = source.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
    if (!/^(?:https?:\/\/|mailto:|\/|#)/i.test(url)) return label;
    return reserve(`<a href="${escapeHtml(url)}">${escapeHtml(label)}</a>`);
  });

  let html = escapeHtml(source);
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  tokens.forEach((value, index) => {
    html = html.replace(`@@STUDIO_HTML_${index}@@`, value);
  });
  return html;
}

function renderMarkdown(markdown) {
  const lines = String(markdown).split("\n");
  const html = [];
  let inList = false;
  let inCode = false;
  let codeBuffer = [];
  let paragraph = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!inList) return;
    html.push("</ul>");
    inList = false;
  };
  const flushCode = () => {
    if (!inCode) return;
    html.push(`<pre><code>${escapeHtml(codeBuffer.join("\n"))}</code></pre>`);
    inCode = false;
    codeBuffer = [];
  };

  for (const line of lines) {
    if (line.startsWith("```")) {
      flushParagraph();
      flushList();
      if (inCode) flushCode();
      else inCode = true;
      continue;
    }
    if (inCode) {
      codeBuffer.push(line);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    if (line.startsWith("## ")) {
      flushParagraph();
      flushList();
      html.push(`<h2>${renderInline(line.slice(3).trim())}</h2>`);
      continue;
    }
    if (line.startsWith("### ")) {
      flushParagraph();
      flushList();
      html.push(`<h3>${renderInline(line.slice(4).trim())}</h3>`);
      continue;
    }
    if (line.startsWith("> ")) {
      flushParagraph();
      flushList();
      html.push(`<blockquote><p>${renderInline(line.slice(2).trim())}</p></blockquote>`);
      continue;
    }
    if (line.startsWith("- ")) {
      flushParagraph();
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${renderInline(line.slice(2).trim())}</li>`);
      continue;
    }
    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();
  flushCode();
  return html.join("\n");
}

function today() {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Shanghai",
  }).format(new Date());
}

function formatDate(value) {
  if (!value) return "未设置日期";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Shanghai",
  }).format(new Date(`${value}T00:00:00+08:00`));
}

function getDraft() {
  return {
    title: elements.title.value.trim(),
    slug: slugify(elements.slug.value || elements.title.value),
    description: elements.description.value.trim(),
    date: elements.date.value || today(),
    tags: elements.tags.value.split(",").map((tag) => tag.trim()).filter(Boolean),
    published: elements.published.value !== "false",
    cover: elements.cover.value.trim(),
    body: elements.body.value.trim(),
  };
}

function buildMarkdown() {
  const draft = getDraft();
  const yamlValue = (value) => JSON.stringify(String(value));
  const tagsBlock = draft.tags.length
    ? `tags:\n${draft.tags.map((tag) => `  - ${JSON.stringify(tag)}`).join("\n")}`
    : "tags: []";
  const coverLine = draft.cover ? `\ncover: ${JSON.stringify(draft.cover)}` : "";
  return [
    "---",
    `title: ${yamlValue(draft.title || "未命名文章")}`,
    `description: ${yamlValue(draft.description || "请填写摘要")}`,
    `date: ${draft.date}`,
    `published: ${draft.published}`,
    `${tagsBlock}${coverLine}`,
    "---",
    "",
    draft.body,
    "",
  ].join("\n");
}

function applyDraft(draft = {}) {
  elements.title.value = draft.title || "我的新文章";
  elements.slug.value = draft.slug || slugify(elements.title.value);
  elements.description.value = draft.description || "用一句话说明这篇文章写什么。";
  elements.date.value = draft.date || today();
  elements.tags.value = Array.isArray(draft.tags) ? draft.tags.join(", ") : (draft.tags || "随笔, 想法");
  elements.published.value = draft.published === false ? "false" : "true";
  elements.cover.value = draft.cover || "";
  elements.body.value = draft.body || "## 从这里开始写\n\n你可以直接在网页里开始写作。";
  slugWasEdited = Boolean(draft.slug);
  updatePublishButton();
  updatePreview();
}

function updatePublishButton() {
  elements.publish.textContent = elements.published.value === "false" ? "保存为隐藏文章" : "一键发布";
}

function updatePreview() {
  if (!slugWasEdited) elements.slug.value = slugify(elements.title.value);
  const draft = getDraft();
  elements.previewTitle.textContent = draft.title || "未命名文章";
  elements.previewDescription.textContent = draft.description || "请填写摘要";
  elements.previewDate.textContent = formatDate(draft.date);
  elements.previewTags.textContent = draft.tags.join(" / ") || "未分类";
  elements.previewBody.innerHTML = renderMarkdown(draft.body);
  if (draft.cover) {
    elements.previewCover.src = draft.cover;
    elements.previewCover.hidden = false;
  } else {
    elements.previewCover.removeAttribute("src");
    elements.previewCover.hidden = true;
  }
}

function setStatus(message, type = "info") {
  elements.status.textContent = message;
  elements.status.dataset.type = type;
}

function setGateStatus(message, type = "info") {
  elements.gateStatus.textContent = message;
  elements.gateStatus.dataset.type = type;
}

function setPostsStatus(message, type = "info") {
  elements.postsStatus.textContent = message;
  elements.postsStatus.dataset.type = type;
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: options.body instanceof FormData ? options.headers : { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  let data = {};
  try {
    data = await response.json();
  } catch {
    data = { error: `服务器返回了无法解析的响应（${response.status}）` };
  }
  if (!response.ok) throw new Error(data.error || `请求失败（${response.status}）`);
  return data;
}

async function loadDraft() {
  try {
    const data = await request(api.draft);
    if (data.draft) {
      applyDraft(data.draft);
      setStatus(`已读取云端草稿${data.updatedAt ? ` · ${new Date(data.updatedAt).toLocaleString("zh-CN")}` : ""}`);
    } else {
      applyDraft({ date: today() });
      setStatus("还没有云端草稿，可以直接开始写作。");
    }
  } catch (error) {
    applyDraft({ date: today() });
    setStatus(error.message, "error");
  }
}

async function unlockStudio() {
  elements.gate.style.display = "none";
  elements.shell.classList.remove("is-locked");
  await Promise.all([loadDraft(), loadPosts()]);
}

function createPostButton(label, className, handler) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.addEventListener("click", handler);
  return button;
}

function renderPosts(posts) {
  elements.postList.replaceChildren();
  if (!posts.length) {
    const empty = document.createElement("p");
    empty.className = "studio-empty";
    empty.textContent = "还没有文章。";
    elements.postList.appendChild(empty);
    return;
  }

  for (const post of posts) {
    const card = document.createElement("article");
    card.className = "studio-post-card";

    const content = document.createElement("div");
    content.className = "studio-post-content";
    const heading = document.createElement("div");
    heading.className = "studio-post-title-row";
    const title = document.createElement("h3");
    title.textContent = post.title;
    const badge = document.createElement("span");
    badge.className = `studio-post-badge ${post.published ? "is-public" : "is-hidden"}`;
    badge.textContent = post.published ? "公开" : "隐藏";
    heading.append(title, badge);
    const meta = document.createElement("p");
    meta.className = "studio-post-meta";
    meta.textContent = `${post.date || "未设置日期"} · ${post.slug}`;
    content.append(heading, meta);
    if (post.description) {
      const description = document.createElement("p");
      description.className = "studio-post-description";
      description.textContent = post.description;
      content.appendChild(description);
    }

    const actions = document.createElement("div");
    actions.className = "studio-post-actions";
    const toggle = createPostButton(
      post.published ? "隐藏" : "公开",
      "button button-secondary button-small",
      () => changePostVisibility(post, toggle),
    );
    const remove = createPostButton(
      "删除",
      "button button-danger button-small",
      () => deletePost(post, remove),
    );
    actions.append(toggle, remove);
    card.append(content, actions);
    elements.postList.appendChild(card);
  }
}

async function loadPosts() {
  elements.refreshPosts.disabled = true;
  setPostsStatus("正在读取文章列表…");
  try {
    const data = await request(api.posts);
    renderPosts(Array.isArray(data.posts) ? data.posts : []);
    setPostsStatus(`共 ${data.posts?.length || 0} 篇文章。`);
  } catch (error) {
    setPostsStatus(error.message, "error");
  } finally {
    elements.refreshPosts.disabled = false;
  }
}

async function changePostVisibility(post, button) {
  const nextPublished = !post.published;
  const action = nextPublished ? "公开" : "隐藏";
  if (!window.confirm(`确定${action}《${post.title}》吗？网站会在重新部署后更新。`)) return;
  button.disabled = true;
  setPostsStatus(`正在${action}《${post.title}》…`);
  try {
    await request(api.posts, {
      method: "PATCH",
      body: JSON.stringify({ slug: post.slug, published: nextPublished }),
    });
    await loadPosts();
    setPostsStatus(`《${post.title}》已${action}，网站通常会在 1–3 分钟内更新。`, "success");
  } catch (error) {
    setPostsStatus(error.message, "error");
    button.disabled = false;
  }
}

async function deletePost(post, button) {
  if (!window.confirm(`确定永久删除《${post.title}》吗？\n\n文章源文件会从 GitHub 删除，此操作不能在后台撤销。`)) return;
  button.disabled = true;
  setPostsStatus(`正在删除《${post.title}》…`);
  try {
    await request(api.posts, { method: "DELETE", body: JSON.stringify({ slug: post.slug }) });
    await loadPosts();
    setPostsStatus(`《${post.title}》已删除，网站通常会在 1–3 分钟内更新。`, "success");
  } catch (error) {
    setPostsStatus(error.message, "error");
    button.disabled = false;
  }
}

async function checkSession() {
  try {
    const data = await request(api.session);
    if (data.authenticated) {
      await unlockStudio();
      return;
    }
    setGateStatus("请输入后台口令。");
  } catch (error) {
    setGateStatus(`${error.message}。请确认网站已部署到 Cloudflare Pages。`, "error");
  }
}

async function login() {
  if (requestInProgress) return;
  requestInProgress = true;
  elements.enter.disabled = true;
  setGateStatus("正在验证…");
  try {
    await request(api.login, { method: "POST", body: JSON.stringify({ password: elements.password.value }) });
    elements.password.value = "";
    await unlockStudio();
  } catch (error) {
    setGateStatus(error.message, "error");
  } finally {
    requestInProgress = false;
    elements.enter.disabled = false;
  }
}

async function saveDraft() {
  setStatus("正在保存草稿…");
  try {
    const data = await request(api.draft, { method: "PUT", body: JSON.stringify(getDraft()) });
    setStatus(`草稿已保存 · ${new Date(data.updatedAt).toLocaleString("zh-CN")}`, "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function uploadFiles(files, kind) {
  if (!files.length) return;
  setStatus(`正在上传 ${files.length} 张图片…`);
  try {
    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", kind);
      const data = await request(api.upload, { method: "POST", body: formData });
      if (kind === "cover") {
        elements.cover.value = data.url;
      } else {
        const markdown = `\n![${file.name.replace(/\.[^.]+$/, "")}](${data.url})\n`;
        const start = elements.body.selectionStart ?? elements.body.value.length;
        elements.body.setRangeText(markdown, start, elements.body.selectionEnd ?? start, "end");
      }
    }
    updatePreview();
    setStatus("图片已上传并插入文章。", "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    elements.coverUpload.value = "";
    elements.bodyUpload.value = "";
  }
}

async function publishPost() {
  const draft = getDraft();
  if (!draft.title || !draft.description || !draft.body) {
    setStatus("请先填写标题、摘要和正文。", "error");
    return;
  }
  const action = draft.published ? "公开发布" : "保存为隐藏文章";
  if (!window.confirm(`确定${action}《${draft.title}》吗？提交后会触发网站自动部署。`)) return;

  elements.publish.disabled = true;
  setStatus("正在提交 GitHub…");
  try {
    const data = await request(api.publish, { method: "POST", body: JSON.stringify(draft) });
    setStatus(
      draft.published
        ? "发布提交成功，网站通常会在 1–3 分钟内更新。"
        : "隐藏文章已保存到 GitHub，不会出现在公开网站。",
      "success",
    );
    if (data.articleUrl) {
      const link = document.createElement("a");
      link.href = data.articleUrl;
      link.textContent = "打开文章";
      link.target = "_blank";
      link.rel = "noreferrer";
      elements.status.append(" ", link);
    }
    await loadPosts();
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    elements.publish.disabled = false;
  }
}

function downloadMarkdown() {
  const blob = new Blob([buildMarkdown()], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${getDraft().slug}.md`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

[elements.title, elements.description, elements.date, elements.tags, elements.cover, elements.body].forEach((element) => {
  element.addEventListener("input", updatePreview);
});
elements.slug.addEventListener("input", () => {
  slugWasEdited = true;
  elements.slug.value = slugify(elements.slug.value);
});
elements.published.addEventListener("change", updatePublishButton);
elements.enter.addEventListener("click", login);
elements.password.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    login();
  }
});
elements.logout.addEventListener("click", async () => {
  await request(api.logout, { method: "POST", body: "{}" }).catch(() => {});
  window.location.reload();
});
elements.save.addEventListener("click", saveDraft);
elements.publish.addEventListener("click", publishPost);
elements.refreshPosts.addEventListener("click", loadPosts);
elements.coverUpload.addEventListener("change", () => uploadFiles([...elements.coverUpload.files], "cover"));
elements.bodyUpload.addEventListener("change", () => uploadFiles([...elements.bodyUpload.files], "body"));
elements.copy.addEventListener("click", async () => {
  await navigator.clipboard.writeText(buildMarkdown());
  setStatus("Markdown 已复制。", "success");
});
elements.download.addEventListener("click", downloadMarkdown);

elements.date.value = today();
updatePublishButton();
updatePreview();
checkSession();
