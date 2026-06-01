# CloudBase Webify / 国内部署清单

这份清单用于把主应用从 Vercel + Neon 迁移到更适合国内访问的组合。当前 Sub2API 可以继续使用本机 Docker + ngrok，后面再迁移到轻量服务器。

## 推荐架构

| 模块 | 现在 | 国内方案 |
| --- | --- | --- |
| 主网站 | Vercel | CloudBase Webify 或 CloudBase 容器应用 |
| 数据库 | Neon PostgreSQL | 腾讯云 PostgreSQL / 阿里云 RDS PostgreSQL |
| AI 网关 | 本机 Sub2API + ngrok | 先保留本机；正式上线再放轻量服务器 |
| 代码更新 | GitHub push 自动部署 | CloudBase 绑定 GitHub main 分支自动部署 |

## 仓库里已经准备好的内容

- `vercel.json`：继续保留 Vercel 部署能力。
- `Dockerfile`：用于 CloudBase 容器应用或其他国内容器平台。
- `.dockerignore`：避免把 `.env`、`node_modules`、`.next` 和本地聊天记录打进镜像。
- `next.config.mjs`：默认仍按普通 Next.js 构建；设置 `NEXT_OUTPUT_MODE=standalone` 时输出容器可运行版本。

## 方案 A：CloudBase Webify 直接部署 Next.js

如果 Webify 创建项目时可以选择 Next.js 框架，先走这个方案。

1. 进入 CloudBase Webify，选择从 Git 仓库导入。
2. 选择仓库：`sxj-ai/english-long-sentence-trainer`。
3. 分支选择：`main`。
4. 框架选择：`Next.js`。
5. 构建命令：

```bash
npm run db:generate && npm run build
```

6. 安装命令：

```bash
npm install
```

7. 输出目录如果必须填写，优先保持平台识别的 Next.js 默认值，不要手动填 `out`。
8. 添加环境变量，至少包括：

```env
DATABASE_URL=
AUTH_SECRET=
ADMIN_USERNAME=
ADMIN_PASSWORD=
ADMIN_DISPLAY_NAME=
SUB2API_BASE_URL=
SUB2API_API_KEY=
SUB2API_MODEL=
DEEPSEEK_BASE_URL=
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=
AI_TIMEOUT_MS=30000
DATABASE_POOL_MAX=3
DATABASE_CONNECTION_TIMEOUT_MS=15000
DATABASE_IDLE_TIMEOUT_MS=10000
```

9. 部署成功后，打开 Webify 给的默认域名测试登录、文章页面、AI 问答。

## 方案 B：CloudBase 容器部署

如果 Webify 的 Next.js 预设构建失败，或者 SSR/API 路由表现不稳定，改用容器方案。

1. 在 CloudBase / 腾讯云容器应用里选择从 Git 仓库构建。
2. 仓库选择：`sxj-ai/english-long-sentence-trainer`。
3. Dockerfile 路径：`Dockerfile`。
4. 服务端口：`3000`。
5. 运行时环境变量填同方案 A。
6. 构建参数如果平台要求填写，可以填：

```env
DATABASE_URL=你的数据库连接字符串
AUTH_SECRET=任意足够长的随机字符串
```

注意：真正的生产密钥仍然要放在运行时环境变量里。构建参数只是为了让 Next.js 构建阶段能读取必要变量。

## 数据库从 Neon 换到国内 PostgreSQL

可选服务：

- 腾讯云云数据库 PostgreSQL
- 阿里云 RDS PostgreSQL
- 其他支持公网访问的 PostgreSQL

迁移步骤：

1. 创建 PostgreSQL 实例。
2. 创建数据库，例如 `english_sentence_trainer`。
3. 开启公网访问或配置同地域内网访问。
4. 设置白名单：先允许你的电脑 IP 和 CloudBase 出口 IP。
5. 拿到连接字符串，格式类似：

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
```

6. 本地临时把 `.env` 的 `DATABASE_URL` 改成国内数据库。
7. 执行：

```bash
npm run db:generate
npm run db:push
npm run db:seed
npm run db:import-vocab
```

8. 用管理员账号登录，重新创建老师和学生账号，或者把原 Neon 数据导出后导入新数据库。
9. 把 CloudBase 环境变量里的 `DATABASE_URL` 也改成国内数据库连接字符串。
10. 重新部署 CloudBase。

## Sub2API 先保留本机

当前可以继续这样跑：

```powershell
cd "c:\Users\86134\Desktop\订阅反代api\sub2api-local"
docker compose up -d
```

另开 PowerShell：

```powershell
cd "C:\tools\ngrok"
.\ngrok.exe http 8080
```

然后把 CloudBase 环境变量里的 `SUB2API_BASE_URL` 改成 ngrok 给出的 HTTPS 地址，例如：

```env
SUB2API_BASE_URL=https://xxxx.ngrok-free.dev
```

后面正式稳定上线时，再把 Sub2API 放到腾讯云轻量服务器或阿里云轻量服务器，并改成：

```env
SUB2API_BASE_URL=https://api.你的域名.com
```

## GitHub push 自动更新

CloudBase 绑定 GitHub 仓库后，一般会监听 `main` 分支。之后只要本地执行：

```bash
git push origin main
```

CloudBase 就会自动重新构建和部署。

## 当前最稳推进顺序

1. 先在 CloudBase 上用现有 Neon 数据库跑通主应用。
2. 跑通后再把数据库从 Neon 换到国内 PostgreSQL。
3. AI 网关暂时继续用本机 Sub2API + ngrok。
4. 最后再把 Sub2API 迁到轻量服务器。

这样每次只换一个关键部件，出了问题也容易定位。
