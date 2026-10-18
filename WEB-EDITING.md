# 在网页上更新 Paper Trails

## 推荐入口：Pages CMS

打开 https://app.pagescms.org/，用 chen23yu 的 GitHub 账户登录。

首次使用时，按页面提示安装 Pages CMS 的 GitHub App。在仓库选择中使用 **Only select repositories**，只选择 **chen23yu.github.io**。安装与授权需由你在 GitHub 页面确认；它将能够读取和修改这个仓库中的博客内容。

授权后，在 Pages CMS 中选择 **chen23yu / chen23yu.github.io / main**。仓库根目录已配置 `.pages.yml`，不需要自行编写配置。

## 修改已有文章

进入“论文与博客”，点击文章，修改标题、摘要、标签或正文后保存。保存会提交到 GitHub，触发自动构建。通常需要等待一两分钟；最终以仓库 Actions 显示成功为准。

## 写新文章

1. 在“论文与博客”中新建文章。
2. 填标题、日期、摘要、分类、标签和正文。
3. 文件名建议填简短英文，如 `my-first-paper.md`；创建后尽量保持不变，以免文章网址改变。
4. 默认开启“草稿”，暂不出现在博客中。准备发布时关闭“草稿”，再保存。

注意：仓库是公开的，草稿开关只控制博客展示，GitHub 上的草稿源文件仍然公开。

## 正文与图片

正文采用网页 Markdown 编辑器，保留公式和代码的原始写法：

```markdown
## 核心想法

这是我的解读。行内公式：$x_i$。

$$
y = \sum_{i=1}^{n} w_i x_i
$$

![示意图](/images/uploads/example.png)
```

可在 Pages CMS 的媒体库上传图片，再复制图片链接到正文。文章封面可直接用“封面图片”字段选择。封面及上传图片都保存在仓库的 `public/images/uploads`，网站地址使用 `/images/uploads/...`。

## 现在就能用的备用入口：GitHub 网页编辑器

文章目录：https://github.com/chen23yu/chen23yu.github.io/tree/main/src/content/posts

修改文章：打开文件 → 点击铅笔 → 修改 → Commit changes → 提交到 main。新建文章：目录中 Add file → Create new file，复制 `templates/paper-review.md` 的内容，填写元数据与正文，发布时改成 `draft: false`。

## 网页写作后，本地如何同步

网页保存会先更新 GitHub，不会自动改动 D 盘副本。下一次在本地编辑之前，在 `D:\Projects\paper-trails` 执行 `git pull --ff-only`。如果本地已经有未提交修改，先保留这些改动再处理同步，避免覆盖。

## 查看发布结果

网站：https://chen23yu.github.io/

部署记录：https://github.com/chen23yu/chen23yu.github.io/actions/workflows/deploy-pages.yml

官方说明：https://pagescms.org/docs/quick-start/
