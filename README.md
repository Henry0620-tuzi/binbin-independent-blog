# 彬彬的独立博客

一个零依赖的中文独立文章站，包含静态文章生成、Cloudflare 私人写作后台、GitHub 自动提交和自动部署。

## 已实现功能

- Markdown 文章与标签页生成
- 私人后台服务端登录
- Cloudflare KV 云端草稿
- 实时 Markdown 预览
- 封面和正文图片上传
- 一键提交文章到 GitHub
- Cloudflare Pages 自动部署
- GitHub 提交后由 Cloudflare Pages 自动更新正式网站

## 本地启动

```bash
npm run build
npm run dev
```

打开 `http://localhost:4321`。静态页面可以本地预览，但 `/api/studio/*` 服务端接口需要 Cloudflare Pages Functions 环境。

## 文章格式

文章保存在 `content/posts/`：

```md
---
title: 我的第一篇文章
description: 一句话摘要
date: 2026-07-10
tags:
  - 随笔
  - 技术
cover: /uploads/covers/example.webp
---

这里写正文。

![正文图片](/uploads/posts/example.webp)
```

## Cloudflare Pages 正式部署

正式 Cloudflare Pages 项目为 `binbin-independent-blog-pages`。不要使用 `wenzhang.pages.dev`，该地址目前属于另一个“文章爬取工具”项目。

连接仓库 `Henry0620-tuzi/binbin-independent-blog`，配置：

```txt
Production branch: main
Framework preset: None
Build command: npm run build
Build output directory: dist
Root directory: 留空
```

不要在 Cloudflare 设置 `SITE_BASE_PATH=/binbin-independent-blog/`，Cloudflare 使用根路径 `/`。

### 必填环境变量

```txt
SITE_URL=https://binbin-independent-blog-pages.pages.dev
STUDIO_PASSWORD=你的后台登录口令
STUDIO_SESSION_SECRET=至少32位的随机字符串
GITHUB_TOKEN=GitHub Fine-grained Personal Access Token
GITHUB_OWNER=Henry0620-tuzi
GITHUB_REPO=binbin-independent-blog
GITHUB_BRANCH=main
```

GitHub Token 仅授权仓库 `Henry0620-tuzi/binbin-independent-blog`，权限至少包含：

- Contents: Read and write
- Metadata: Read

### KV 草稿绑定

当前使用的 KV namespace 是 `binbin-studio-drafts`，在 Pages 项目中绑定为：

```txt
Variable name: STUDIO_DRAFTS
KV namespace: binbin-studio-drafts
```

保存变量和 KV 后，重新部署一次。

## 后台发布流程

打开：

```txt
https://binbin-independent-blog-pages.pages.dev/studio/
```

1. 输入 `STUDIO_PASSWORD`
2. 在线写标题、摘要、日期、标签和正文
3. 点击“保存草稿”写入 Cloudflare KV
4. 上传封面或正文图片，图片会提交到 `public/uploads/`
5. 点击“一键发布”
6. 后台提交 `content/posts/<slug>.md` 到 GitHub `main`
7. Cloudflare Pages 自动部署新版本
8. Cloudflare Pages 自动构建并更新正式网站

## GitHub Pages 镜像

当前公开镜像：

`https://henry0620-tuzi.github.io/binbin-independent-blog/`

GitHub Pages 保留为静态镜像，但不会运行安全后台，也不再作为自动发布目标。请使用 Cloudflare Pages 正式网站和后台。

## 安全说明

- 后台口令和 GitHub Token 只存 Cloudflare 环境变量
- 登录使用签名的 HttpOnly、SameSite Cookie
- 同一 IP 连续登录失败 5 次后会暂时锁定 15 分钟
- 浏览器源码中不再包含后台口令
- 图片限制为 JPG、PNG、WebP、GIF，单张最多 5 MB
- 不要把 `.dev.vars`、Token 或真实口令提交到 GitHub
