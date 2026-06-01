# CloudBase CLI / DevOps 部署说明

你提供的文档 `https://docs.cloudbase.net/hosting/cli-devops` 主要讲的是静态网站托管的 CLI/CI/CD。我们的项目是 Next.js 动态应用，包含登录、数据库、API 路由和 AI 请求，所以不要用静态托管命令：

```bash
tcb hosting deploy ./dist
```

这个命令只适合纯静态页面。当前项目应该走 Web 应用托管或 CloudBase Run 云托管。

## 本机已经完成

已安装 CloudBase CLI：

```bash
npm install -g @cloudbase/cli
```

已验证命令可用：

```bash
tcb --version
```

已新增 GitHub Actions 工作流：

```text
.github/workflows/cloudbase-run-deploy.yml
```

这个工作流默认只支持手动触发，避免密钥没配好时每次 push 都失败。

## GitHub Secrets 需要你手动添加

进入 GitHub 仓库：

```text
sxj-ai / english-long-sentence-trainer
```

打开：

```text
Settings -> Secrets and variables -> Actions -> New repository secret
```

添加三个 Secret：

```text
TENCENTCLOUD_SECRET_ID
TENCENTCLOUD_SECRET_KEY
TCB_ENV_ID
```

其中：

- `TENCENTCLOUD_SECRET_ID`：腾讯云访问密钥 SecretId
- `TENCENTCLOUD_SECRET_KEY`：腾讯云访问密钥 SecretKey
- `TCB_ENV_ID`：CloudBase 环境 ID，例如 `english-trainer-xxxx`

如果你想改服务名，可以在 GitHub 的 Variables 里添加：

```text
TCB_SERVICE_NAME=english-long-sentence-trainer
```

不填也可以，工作流默认用 `english-long-sentence-trainer`。

## 腾讯云访问密钥在哪里创建

进入腾讯云控制台：

```text
右上角头像 -> 访问管理 -> 访问密钥 -> API 密钥管理
```

创建密钥后，只把密钥填到 GitHub Secrets，不要写进 `.env`，也不要发到聊天里。

## 手动触发部署

GitHub 仓库页面：

```text
Actions -> Deploy to CloudBase Run -> Run workflow
```

选择 `main` 分支后运行。

工作流会执行：

```bash
tcb login --apiKeyId ... --apiKey ...
tcb -e ... -r ap-shanghai cloudrun deploy --serviceName english-long-sentence-trainer --port 3000 --source . --force
```

它会使用仓库里的 `Dockerfile` 来构建并部署 Next.js standalone 容器。

## 第一次成功后开启 push 自动部署

第一次手动部署成功后，打开：

```text
.github/workflows/cloudbase-run-deploy.yml
```

把下面注释取消：

```yaml
# push:
#   branches:
#     - main
```

改成：

```yaml
push:
  branches:
    - main
```

以后每次执行：

```bash
git push origin main
```

GitHub Actions 就会自动部署到 CloudBase Run。

## 仍然需要在 CloudBase 配置的运行时环境变量

CloudBase Run 服务里需要配置和 Vercel 类似的运行时环境变量：

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

如果先继续用本机 Sub2API + ngrok，`SUB2API_BASE_URL` 必须填当前 ngrok 的 HTTPS 地址。

## 推荐顺序

1. 先用腾讯云控制台的 Web 应用托管页面导入 GitHub 仓库跑通。
2. 如果控制台部署不稳定，再用本工作流部署 CloudBase Run 容器。
3. 第一次用手动触发，确认成功后再打开 push 自动部署。
4. 主网站跑通后，再考虑把 Neon 换成腾讯云或阿里云 PostgreSQL。
