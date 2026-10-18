# Paper Trails · chenyu23

个人论文阅读博客，基于 [Fuwari](https://github.com/saicaca/fuwari)。

- 本地项目：D:\Projects\paper-trails
- GitHub：https://github.com/chen23yu/chen23yu.github.io
- 博客地址：https://chen23yu.github.io/
- 写作与运行说明：[START-HERE.md](START-HERE.md)

## 写新文章

使用 Node.js 22 和 pnpm 9.14.4：

```powershell
pnpm install --frozen-lockfile
pnpm new-post my-first-paper
pnpm dev
```

文章位于 src/content/posts，默认草稿。完成后将 draft 改为 false，提交并推送到 main，GitHub Actions 会自动构建发布。每次推送后，可在仓库 Actions 页面检查部署结果。

已迁移旧博客的 9 篇文章与 40 张配图，原始日期保留。旧版完整备份位于 D:\Projects\paper-trails-old-blog-backup.zip。
