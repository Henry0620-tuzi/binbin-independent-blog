const VIEW_STORAGE_PREFIX = "binbin-blog-views:";

function getViewCount(slug) {
  const raw = localStorage.getItem(VIEW_STORAGE_PREFIX + slug);
  return Number.parseInt(raw || "0", 10) || 0;
}

function setViewCount(slug, value) {
  localStorage.setItem(VIEW_STORAGE_PREFIX + slug, String(value));
}

function updateVisibleCounts() {
  document.querySelectorAll("[data-view-count]").forEach((element) => {
    const slug = element.getAttribute("data-view-slug");
    if (!slug) return;
    element.textContent = `浏览 ${getViewCount(slug)}`;
  });
}

function trackArticleView() {
  const tracker = document.querySelector("[data-view-track]");
  if (!tracker) return;
  const slug = tracker.getAttribute("data-view-track");
  if (!slug) return;

  const sessionKey = `${VIEW_STORAGE_PREFIX}${slug}:session`;
  if (sessionStorage.getItem(sessionKey) === "seen") {
    return;
  }

  const next = getViewCount(slug) + 1;
  setViewCount(slug, next);
  sessionStorage.setItem(sessionKey, "seen");
}

trackArticleView();
updateVisibleCounts();
