# 考研英语长难句训练系统

一个基于 Next.js 的考研英语长难句学习与练习 MVP。文章数据来自本地 JSON，学习进度保存在浏览器本地。

## 本地运行

```bash
npm install
npm run dev
```

## 数据校验

```bash
npm run validate:data
```

## 静态构建

```bash
npm run build
```

构建完成后会生成 `out/` 文件夹，可以部署到 Netlify、Cloudflare Pages 等静态网站平台。

## 推荐部署方式

推荐使用 GitHub + Netlify：

1. 将本项目推送到 GitHub。
2. 在 Netlify 中选择 `Add new site` -> `Import an existing project`。
3. 连接 GitHub 仓库。
4. Netlify 会读取 `netlify.toml`，自动使用 `npm run build` 构建，并发布 `out/`。
5. 以后每次向 GitHub push，Netlify 都会自动重新部署。
