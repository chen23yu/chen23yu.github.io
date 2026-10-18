# Paper Trails · chenyu23

这是用官方 [Fuwari](https://github.com/saicaca/fuwari) 模板搭建的静态个人博客。保留原模板的 MIT 许可证；新文章尚未设定公开复用许可。

## 本地预览

安装 Node.js 22 和 pnpm 9.14.4，在本目录执行：

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

打开终端显示的本地地址。开发模式下搜索不可用；查看真实搜索效果需先构建，再预览：

```powershell
pnpm build
pnpm preview
```

## 写第一篇论文解读

```powershell
pnpm new-post my-first-paper
```

编辑 `src/content/posts/my-first-paper.md`，填写标题、日期、摘要、标签、分类和正文。该命令从 `templates/paper-review.md` 复制模板，默认 `draft: true`，不会公开。写完后改为 `draft: false`，重新构建并部署。

原博客的 9 篇文章及配图已迁入此项目，并保留原始日期。图片可放在 `public/images/`，正文用 `![图注](/images/文件名.png)` 引用；若使用 GitHub 项目子路径，图片链接需加上仓库路径。

行内公式用 `$x_i$`，独立公式用两行 `$$` 包住，代码块用三个反引号和语言名称。一级页面标题由文章标题自动生成，正文建议从二级标题 `##` 开始。

## 修改外观

- `src/config.ts`：站名、简介、导航、头像、主题色、横幅。
- `src/content/spec/about.md`：关于页面。
- `public/images/paper-landscape.svg`：首页横幅。
- `public/images/avatar.svg`：头像。
- `public/favicon.svg`：浏览器图标。

## 部署到自己的 GitHub Pages

已提供 `.github/workflows/deploy-pages.yml`，本地 origin 指向 `https://github.com/chen23yu/chen23yu.github.io.git`。已完成 GitHub CLI 账户授权，可提交并推送到 main 触发发布。

1. 在 GitHub 新建公开仓库，建议命名为 `chen23yu.github.io`（已存在，复用当前仓库）。其他仓库名称也可使用。
2. 将这个项目的源码提交到仓库的 `main` 分支，不需要提交 `node_modules`、`dist`、`.astro` 或 `.sites-runtime`。
3. 仓库 Settings → Pages → Source 选择 GitHub Actions。
4. 推送后，Actions 会构建并部署。工作流从 GitHub 获取正确的站点地址和子路径。
5. 如果以后绑定自定义域名，请同步更新 `astro.config.mjs` 中的站点地址；也可通过 `SITE_URL` 环境变量覆盖。

当前 `astro.config.mjs` 默认地址为 `https://chen23yu.github.io/`。GitHub Pages 工作流也会从仓库获取正式地址。D 盘项目已移除 Sites 专用身份文件。

此前的私有 Sites 预览保持独立。此项目通过 GitHub Actions 发布，正式地址为 https://chen23yu.github.io/。

## 检查

```powershell
pnpm check
pnpm build
```

构建会生成页面、RSS、站点地图和 Pagefind 搜索索引。
