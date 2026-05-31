# Vercel + Neon + Sub2API 部署清单

## 当前架构

```text
用户浏览器
  -> Vercel 上的英语长难句项目
  -> Neon PostgreSQL
  -> ngrok 公网地址
  -> 本机 Docker Sub2API
  -> 模型接口
```

## 本机必须保持运行

只要 `SUB2API_BASE_URL` 使用 ngrok 地址，AI 功能就依赖本机服务：

- Docker Desktop 正在运行
- `sub2api`、`sub2api-postgres`、`sub2api-redis` 都是 healthy
- ngrok 窗口没有关闭
- 电脑没有关机、睡眠、断网

## 本地启动顺序

```powershell
cd "c:\Users\86134\Desktop\订阅反代api\sub2api-local"
docker compose up -d
docker compose ps
```

```powershell
cd C:\tools\ngrok
.\ngrok.exe http 8080
```

复制 ngrok 显示的 HTTPS 地址，填入主项目和 Vercel 的 `SUB2API_BASE_URL`。

```powershell
cd "c:\Users\86134\Desktop\订阅反代api\英语长难句分析项目"
npm run dev
```

## Vercel 环境变量

在 Vercel Project Settings -> Environment Variables 配置：

```env
DATABASE_URL=Neon 连接字符串
AUTH_SECRET=正式环境长随机字符串
ADMIN_USERNAME=管理员用户名
ADMIN_PASSWORD=管理员强密码
ADMIN_DISPLAY_NAME=系统管理员
SUB2API_BASE_URL=ngrok 或 VPS 的公网地址
SUB2API_API_KEY=Sub2API 后台创建的 API Key
SUB2API_MODEL=Sub2API 可用模型名
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_API_KEY=可选备用 key
DEEPSEEK_MODEL=deepseek-v4-flash
AI_TIMEOUT_MS=30000
```

`SUB2API_BASE_URL` 只填 origin，例如：

```env
https://example.ngrok-free.dev
```

不要加 `/v1`。

## Vercel 构建

仓库已包含 `vercel.json`：

```json
{
  "buildCommand": "npm run db:generate && npm run build",
  "framework": "nextjs"
}
```

## 数据库初始化

首次连接 Neon 后执行：

```powershell
npm run db:generate
npm run db:push
npm run db:seed
npm run db:import-vocab
```

`db:import-vocab` 可重复执行。

## 后续迁移到云服务器

如果以后购买 VPS，把 `sub2api-local` 迁移到服务器并运行 `docker compose up -d`，然后把 Vercel 的 `SUB2API_BASE_URL` 从 ngrok 地址改成 VPS 域名或 IP 即可。
