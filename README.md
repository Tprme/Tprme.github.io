# 我的博客

个人博客，用来记录编程入门路上踩过的坑和一点学习笔记（主要是 C 语言和 Python）。

🌐 **https://Tprme.github.io**

## 关于这个仓库

这是博客的**源码**，不是最终网页。

我用 [Hexo](https://hexo.io/zh-cn/) 写文章（就是普通的 Markdown 文件），
推送到 GitHub 之后，GitHub Actions 会自动把 Markdown 转成网页并发布到
GitHub Pages。所以我只需要写 `.md` 文件，不用管网页是怎么生成的。

主题用的是 [LostStar](https://github.com/thatnghiep-dev/hexo-theme-loststar)。

## 怎么发一篇新文章

```bash
# 1. 新建文章
npx hexo new "文章标题"

# 2. 编辑 source/_posts/ 下新生成的文件，写完保存

# 3. 本地预览（浏览器打开 http://localhost:4000）
npm run server

# 4. 发布
git add .
git commit -m "新增文章"
git push
```

推送后等 1-2 分钟，网站会自动更新。

## 文章头部要写的东西

每篇文章开头都需要一段配置，大概长这样：

```markdown
---
title: 文章标题
date: 2026-09-10 20:00:00
categories:
  - 随笔
tags:
  - C
---

这里是摘要，首页只会显示这一段。

<!-- more -->

从这里开始是正文，首页不再显示。
```

这里填的 `categories` 和 `tags` 会出现在网站的分类页和标签页里。

**`<!-- more -->` 别忘了写**：不写的话首页会把整篇文章铺出来，而不是显示摘要 +「阅读全文」。

## 目录说明

```
source/_posts/       文章（Markdown）
source/about/        关于页
source/css/custom.css  自定义样式（覆盖主题默认样式）
_config.yml          站点配置（标题、网址、分类标签等）
themes/loststar/     主题
.github/workflows/   自动部署脚本
```

## 常用命令

```bash
npm run server   # 本地预览 http://localhost:4000
npm run build    # 生成静态网页到 public/
npm run clean    # 清掉缓存和 public/
```
