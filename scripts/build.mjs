import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const contentDir = path.join(root, "content", "posts");
const distDir = path.join(root, "dist");
const postsDir = path.join(distDir, "posts");
const tagsDir = path.join(distDir, "tags");
const templateCssPath = path.join(root, "templates", "site.css");

const site = {
  title: "你的独立写作站",
  description: "一个可以自由发布文章、长期沉淀内容的个人独立网站。",
  author: "你的名字",
  role: "独立写作者",
  bio: "把文章、思考和项目都放在自己的地盘上，不依赖平台分发。",
  location: "中国 / 线上",
  email: "hello@example.com",
  links: [
    { label: "首页", href: "/" },
    { label: "关于", href: "/about/" },
    { label: "分类", href: "/tags/" },
  ],
  highlights: [
    { label: "写作", value: "Markdown" },
    { label: "部署", value: "静态站" },
    { label: "发布", value: "自由可控" },
  ],
};

async function ensureCleanDir(dir) {
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);

  if (!match) {
    throw new Error("文章缺少 frontmatter");
  }

  const metaBlock = match[1];
  const body = match[2].trim();
  const meta = {};
  let currentKey = null;

  for (const line of metaBlock.split("\n")) {
    const trimmedEnd = line.trimEnd();
    const trimmed = trimmedEnd.trim();

    if (!trimmed) {
      continue;
    }

    if (currentKey && trimmed.startsWith("- ")) {
      if (!Array.isArray(meta[currentKey])) {
        meta[currentKey] = [];
      }
      meta[currentKey].push(trimmed.slice(2).trim());
      continue;
    }

    const separatorIndex = trimmed.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    currentKey = key;

    if (value) {
      meta[key] = value;
      continue;
    }

    meta[key] = [];
  }

  return { meta, body };
}

function renderInline(text) {
  let html = escapeHtml(text);
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return html;
}

function renderMarkdown(markdown) {
  const lines = markdown.split("\n");
  const html = [];
  let inList = false;
  let inCode = false;
  let codeBuffer = [];
  let paragraph = [];

  function flushParagraph() {
    if (paragraph.length === 0) {
      return;
    }
    html.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
    paragraph = [];
  }

  function flushList() {
    if (!inList) {
      return;
    }
    html.push("</ul>");
    inList = false;
  }

  function flushCode() {
    if (!inCode) {
      return;
    }
    html.push(`<pre><code>${escapeHtml(codeBuffer.join("\n"))}</code></pre>`);
    inCode = false;
    codeBuffer = [];
  }

  for (const line of lines) {
    if (line.startsWith("```")) {
      flushParagraph();
      flushList();
      if (inCode) {
        flushCode();
      } else {
        inCode = true;
      }
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

function formatDate(input) {
  const date = new Date(input);
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Shanghai",
  }).format(date);
}

function createLayout({ title, description, content }) {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Manrope:wght@400;500;700;800&family=Noto+Serif+SC:wght@500;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/site.css" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    <div class="page-shell">
      <div class="page-glow page-glow-left"></div>
      <div class="page-glow page-glow-right"></div>
      <main class="site-frame">
        <header class="topbar">
          <a class="brand" href="/">
            <span class="brand-mark">${escapeHtml(site.author.slice(0, 2))}</span>
            <span class="brand-copy">
              <strong>${escapeHtml(site.author)}</strong>
              <small>${escapeHtml(site.role)}</small>
            </span>
          </a>
          <nav class="topnav" aria-label="主导航">
            ${site.links
              .map((link) => `<a href="${link.href}">${escapeHtml(link.label)}</a>`)
              .join("")}
          </nav>
        </header>
        ${content}
        <footer class="site-footer">
          <p>${escapeHtml(site.bio)}</p>
          <p>联系我：<a href="mailto:${escapeHtml(site.email)}">${escapeHtml(site.email)}</a></p>
        </footer>
      </main>
    </div>
  </body>
</html>`;
}

async function loadPosts() {
  const entries = await fs.readdir(contentDir, { withFileTypes: true });
  const posts = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) {
      continue;
    }

    const fullPath = path.join(contentDir, entry.name);
    const raw = await fs.readFile(fullPath, "utf8");
    const { meta, body } = parseFrontmatter(raw);
    const title = meta.title;
    const description = meta.description;
    const date = meta.date;
    const tags = Array.isArray(meta.tags)
      ? meta.tags.map((tag) => String(tag).trim()).filter(Boolean)
      : String(meta.tags || "")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean);
    const slug = slugify(path.basename(entry.name, ".md"));

    if (!title || !description || !date) {
      throw new Error(`${entry.name} 缺少 title/description/date`);
    }

    posts.push({
      slug,
      title,
      description,
      date,
      tags,
      bodyHtml: renderMarkdown(body),
    });
  }

  return posts.sort((a, b) => new Date(b.date).valueOf() - new Date(a.date).valueOf());
}

function groupTags(posts) {
  const map = new Map();

  for (const post of posts) {
    for (const tag of post.tags) {
      const normalized = tag.trim();
      if (!normalized) continue;
      if (!map.has(normalized)) {
        map.set(normalized, []);
      }
      map.get(normalized).push(post);
    }
  }

  return [...map.entries()]
    .map(([tag, items]) => ({
      tag,
      slug: slugify(tag),
      count: items.length,
      posts: items.sort((a, b) => new Date(b.date).valueOf() - new Date(a.date).valueOf()),
    }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "zh-CN"));
}

function renderHome(posts) {
  const featured = posts[0];
  const cards = posts
    .map(
      (post) => `<a class="post-card" href="/posts/${post.slug}/">
  <div class="post-card-meta">
    <time datetime="${escapeHtml(post.date)}">${formatDate(post.date)}</time>
    ${post.tags.length > 0 ? `<span>${escapeHtml(post.tags.join(" / "))}</span>` : ""}
  </div>
  <h3>${escapeHtml(post.title)}</h3>
  <p>${escapeHtml(post.description)}</p>
</a>`
    )
    .join("\n");

  return createLayout({
    title: site.title,
    description: site.description,
    content: `<section class="hero">
  <div class="hero-copy-block">
    <p class="eyebrow">Independent Publishing</p>
    <h1>把文章发在你自己的地盘上。</h1>
    <p class="hero-copy">
      ${escapeHtml(site.bio)}
    </p>
    <div class="hero-actions">
      <a class="button button-primary" href="#posts">查看文章</a>
      <a class="button button-secondary" href="/about/">认识我</a>
    </div>
  </div>
  <aside class="hero-panel">
    <div class="hero-avatar">${escapeHtml(site.author.slice(0, 2))}</div>
    <dl class="hero-stats">
      ${site.highlights
        .map(
          (item) => `<div>
            <dt>${escapeHtml(item.label)}</dt>
            <dd>${escapeHtml(item.value)}</dd>
          </div>`
        )
        .join("")}
    </dl>
    <p class="hero-location">${escapeHtml(site.location)}</p>
  </aside>
</section>

<section class="info-grid">
  <article class="info-card">
    <h2>怎么发文</h2>
    <p>在 <code>content/posts/</code> 新建一个 <code>.md</code> 文件，填写标题、日期和正文即可。</p>
  </article>
  <article class="info-card">
    <h2>为什么适合你</h2>
    <p>内容是静态生成的，速度快、维护轻、部署便宜，而且你随时能接入自己的域名。</p>
  </article>
  <article class="info-card">
    <h2>后续可扩展</h2>
    <p>以后我们还可以继续加评论、搜索、订阅、后台编辑器，甚至会员系统。</p>
  </article>
</section>

<section class="featured-card">
  <p class="eyebrow">Featured</p>
  <h2>${escapeHtml(featured?.title || "暂时还没有文章")}</h2>
  <p>${escapeHtml(featured?.description || "等你发布第一篇文章后，这里会自动成为重点推荐。")}</p>
  ${featured ? `<a class="featured-link" href="/posts/${featured.slug}/">阅读最新文章</a>` : ""}
</section>

<section class="posts-section" id="posts">
  <div class="section-heading">
    <p class="eyebrow">Latest Essays</p>
    <h2>最近发布</h2>
  </div>
  <div class="post-list">
    ${cards}
  </div>
</section>`,
  });
}

function renderPost(post) {
  return createLayout({
    title: `${post.title} | 你的独立写作站`,
    description: post.description,
    content: `<article class="article-shell">
  <a class="back-link" href="/">返回首页</a>
  <header class="article-header">
    <p class="eyebrow">Essay</p>
    <h1>${escapeHtml(post.title)}</h1>
    <p class="article-description">${escapeHtml(post.description)}</p>
    <div class="article-meta">
      <time datetime="${escapeHtml(post.date)}">${formatDate(post.date)}</time>
      ${post.tags.length > 0 ? `<span>${escapeHtml(post.tags.join(" / "))}</span>` : ""}
    </div>
  </header>
  <div class="article-content">
    ${post.bodyHtml}
  </div>
</article>`,
  });
}

function renderAbout(posts, tags) {
  return createLayout({
    title: `关于 | ${site.title}`,
    description: `${site.author} 的个人介绍、写作方向与联系方式。`,
    content: `<section class="page-hero">
  <p class="eyebrow">About</p>
  <h1>关于我</h1>
  <p class="hero-copy">${escapeHtml(site.bio)}</p>
</section>

<section class="about-grid">
  <article class="about-card about-profile">
    <div class="hero-avatar hero-avatar-large">${escapeHtml(site.author.slice(0, 2))}</div>
    <h2>${escapeHtml(site.author)}</h2>
    <p>${escapeHtml(site.role)}</p>
    <p>${escapeHtml(site.location)}</p>
    <a class="featured-link" href="mailto:${escapeHtml(site.email)}">${escapeHtml(site.email)}</a>
  </article>
  <article class="about-card">
    <h2>写作方向</h2>
    <p>记录想法、项目、学习笔记，以及任何值得长期保存的内容。</p>
  </article>
  <article class="about-card">
    <h2>网站内容</h2>
    <p>当前共有 ${posts.length} 篇文章，${tags.length} 个标签，适合持续更新和长期沉淀。</p>
  </article>
</section>

<section class="timeline">
  <div class="section-heading">
    <p class="eyebrow">Now</p>
    <h2>我在做什么</h2>
  </div>
  <div class="timeline-card">
    <p>我正在把这个站做成一个稳定、简洁、能长期写下去的个人发布空间。</p>
    <p>接下来可以继续加：RSS、搜索、订阅、评论或更完整的 CMS。</p>
  </div>
</section>`,
  });
}

function renderTagsIndex(tags) {
  const items = tags
    .map(
      (tag) => `<a class="tag-card" href="/tags/${tag.slug}/">
  <strong>${escapeHtml(tag.tag)}</strong>
  <span>${tag.count} 篇文章</span>
</a>`
    )
    .join("\n");

  return createLayout({
    title: `分类 | ${site.title}`,
    description: "按标签查看所有文章。",
    content: `<section class="page-hero">
  <p class="eyebrow">Categories</p>
  <h1>分类</h1>
  <p class="hero-copy">你可以把内容按主题聚合，方便别人快速找到自己关心的文章。</p>
</section>

<section class="tag-grid">
  ${items || `<p class="empty-state">还没有标签。</p>`}
</section>`,
  });
}

function renderTagPage(tag) {
  const cards = tag.posts
    .map(
      (post) => `<a class="post-card" href="/posts/${post.slug}/">
  <div class="post-card-meta">
    <time datetime="${escapeHtml(post.date)}">${formatDate(post.date)}</time>
  </div>
  <h3>${escapeHtml(post.title)}</h3>
  <p>${escapeHtml(post.description)}</p>
</a>`
    )
    .join("\n");

  return createLayout({
    title: `${tag.tag} | ${site.title}`,
    description: `${tag.tag} 标签下的文章列表。`,
    content: `<section class="page-hero">
  <p class="eyebrow">Tag</p>
  <h1>${escapeHtml(tag.tag)}</h1>
  <p class="hero-copy">这里收集了 ${tag.count} 篇相关内容。</p>
</section>

<section class="posts-section">
  <div class="post-list">
    ${cards}
  </div>
</section>`,
  });
}

async function main() {
  await ensureCleanDir(distDir);
  await fs.mkdir(postsDir, { recursive: true });
  await fs.mkdir(tagsDir, { recursive: true });
  const css = await fs.readFile(templateCssPath, "utf8");
  await fs.writeFile(path.join(distDir, "site.css"), css, "utf8");

  const posts = await loadPosts();
  const tags = groupTags(posts);
  await fs.writeFile(path.join(distDir, "index.html"), renderHome(posts), "utf8");
  const aboutDir = path.join(distDir, "about");
  await fs.mkdir(aboutDir, { recursive: true });
  await fs.writeFile(path.join(aboutDir, "index.html"), renderAbout(posts, tags), "utf8");

  const tagsIndexDir = path.join(tagsDir);
  await fs.mkdir(tagsIndexDir, { recursive: true });
  await fs.writeFile(path.join(tagsIndexDir, "index.html"), renderTagsIndex(tags), "utf8");

  for (const post of posts) {
    const postPath = path.join(postsDir, post.slug);
    await fs.mkdir(postPath, { recursive: true });
    await fs.writeFile(path.join(postPath, "index.html"), renderPost(post), "utf8");
  }

  for (const tag of tags) {
    const tagPath = path.join(tagsDir, tag.slug);
    await fs.mkdir(tagPath, { recursive: true });
    await fs.writeFile(path.join(tagPath, "index.html"), renderTagPage(tag), "utf8");
  }

  console.log(`Built ${posts.length} post(s) and ${tags.length} tag page(s) into ${distDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
