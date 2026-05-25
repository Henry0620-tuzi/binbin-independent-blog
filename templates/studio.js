const titleInput = document.getElementById("studio-title");
const descriptionInput = document.getElementById("studio-description");
const tagsInput = document.getElementById("studio-tags");
const bodyInput = document.getElementById("studio-body");
const previewTitle = document.getElementById("preview-title");
const previewDescription = document.getElementById("preview-description");
const previewTags = document.getElementById("preview-tags");
const previewBody = document.getElementById("preview-body");
const copyButton = document.getElementById("copy-markdown");
const downloadButton = document.getElementById("download-markdown");
const gate = document.getElementById("admin-gate");
const studioShell = document.getElementById("studio-shell");
const gatePassword = document.getElementById("gate-password");
const gateEnter = document.getElementById("gate-enter");
const STUDIO_PASSWORD = "binbin2026";
const STUDIO_STORAGE_KEY = "binbin-studio-unlocked";

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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
    if (paragraph.length === 0) return;
    html.push("<p>" + renderInline(paragraph.join(" ")) + "</p>");
    paragraph = [];
  }

  function flushList() {
    if (!inList) return;
    html.push("</ul>");
    inList = false;
  }

  function flushCode() {
    if (!inCode) return;
    html.push("<pre><code>" + escapeHtml(codeBuffer.join("\n")) + "</code></pre>");
    inCode = false;
    codeBuffer = [];
  }

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
      html.push("<h2>" + renderInline(line.slice(3).trim()) + "</h2>");
      continue;
    }

    if (line.startsWith("### ")) {
      flushParagraph();
      flushList();
      html.push("<h3>" + renderInline(line.slice(4).trim()) + "</h3>");
      continue;
    }

    if (line.startsWith("- ")) {
      flushParagraph();
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push("<li>" + renderInline(line.slice(2).trim()) + "</li>");
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();
  flushCode();

  return html.join("\n");
}

function slugify(value) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "") || "new-post"
  );
}

function buildMarkdown() {
  const title = titleInput.value.trim() || "未命名文章";
  const description = descriptionInput.value.trim() || "请填写摘要";
  const tags = tagsInput.value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const today = new Date().toISOString().slice(0, 10);
  const tagsBlock = tags.length > 0
    ? "tags:\n" + tags.map((tag) => "  - " + tag).join("\n")
    : "tags: []";

  return [
    "---",
    "title: " + title,
    "description: " + description,
    "date: " + today,
    tagsBlock,
    "---",
    "",
    bodyInput.value.trim(),
    "",
  ].join("\n");
}

function updatePreview() {
  previewTitle.textContent = titleInput.value.trim() || "未命名文章";
  previewDescription.textContent = descriptionInput.value.trim() || "请填写摘要";
  previewTags.textContent = tagsInput.value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .join(" / ") || "未分类";
  previewBody.innerHTML = renderMarkdown(bodyInput.value);
}

[titleInput, descriptionInput, tagsInput, bodyInput].forEach((element) => {
  element.addEventListener("input", updatePreview);
});

function unlockStudio(remember = true) {
  gate.style.display = "none";
  studioShell.classList.remove("is-locked");
  if (remember) {
    localStorage.setItem(STUDIO_STORAGE_KEY, "yes");
  }
}

function handleGate() {
  if (localStorage.getItem(STUDIO_STORAGE_KEY) === "yes") {
    unlockStudio(false);
    return;
  }

  gateEnter.addEventListener("click", () => {
    if (gatePassword.value === STUDIO_PASSWORD) {
      unlockStudio(true);
      return;
    }
    gatePassword.value = "";
    gatePassword.placeholder = "口令不对，请重试";
  });

  gatePassword.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      gateEnter.click();
    }
  });
}

copyButton.addEventListener("click", async () => {
  const content = buildMarkdown();
  await navigator.clipboard.writeText(content);
  copyButton.textContent = "已复制";
  setTimeout(() => {
    copyButton.textContent = "复制 Markdown";
  }, 1200);
});

downloadButton.addEventListener("click", () => {
  const content = buildMarkdown();
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = slugify(titleInput.value) + ".md";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
});

handleGate();
updatePreview();
