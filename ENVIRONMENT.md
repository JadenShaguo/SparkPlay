# SparkPlay 环境依赖与配置

本文档说明运行 SparkPlay 需要的基础依赖、可选模型网关配置、本地数据目录和安全注意事项。

## 基础依赖

建议使用以下环境：

```text
Node.js 20 或更高版本
npm 10 或更高版本
macOS / Linux / Windows 均可运行
```

安装依赖：

```bash
npm install
```

启动开发服务：

```bash
npm run dev
```

默认地址：

```text
http://localhost:3000
```

## 必要配置

SparkPlay 没有强制必填的环境变量。未配置模型网关时，系统会使用内置 deterministic generator，仍然可以完成生成、预览、Remix、版本、回滚和分享流程。

## 可选模型网关配置

如果需要接入真实模型生成，请在根目录创建 `.env.local`：

```bash
cp .env.example .env.local
```

推荐配置项：

```env
SPARKPLAY_LLM_BASE_URL=http://your-model-gateway/v1
SPARKPLAY_LLM_MODEL=gpt-5.5
SPARKPLAY_LLM_REASONING_EFFORT=medium
SPARKPLAY_LLM_TIMEOUT_MS=120000
SPARKPLAY_LLM_MAX_OUTPUT_TOKENS=12000
SPARKPLAY_LLM_API_KEY=replace-with-your-api-key
```

配置说明：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `SPARKPLAY_LLM_BASE_URL` | 使用模型网关时必填 | Responses API 兼容网关地址，通常以 `/v1` 结尾。 |
| `SPARKPLAY_LLM_MODEL` | 使用模型网关时必填 | 用于生成 playable 的模型名称。 |
| `SPARKPLAY_LLM_REASONING_EFFORT` | 可选 | 推理强度。建议本地生成使用 `medium`，复杂生成可改为 `high`。 |
| `SPARKPLAY_LLM_TIMEOUT_MS` | 可选 | 服务端等待模型响应的超时时间，默认 `120000`。 |
| `SPARKPLAY_LLM_MAX_OUTPUT_TOKENS` | 可选 | 模型最大输出 token 数，默认 `12000`。 |
| `SPARKPLAY_LLM_API_KEY` | 使用模型网关时必填 | 模型网关访问密钥。不要提交到代码仓库。 |

## 本机复用 Codex 配置

本地开发时，如果你的机器已经有可用的 Codex provider 配置，可以临时复用其中的 `base_url`、`model` 和 bearer token：

```env
SPARKPLAY_LLM_CONFIG_SOURCE=codex
SPARKPLAY_CODEX_CONFIG_PATH=/Users/your-name/.codex/config.toml
SPARKPLAY_LLM_REASONING_EFFORT=medium
```

这个模式只适合本机调试。生产环境应使用独立的项目密钥和部署环境变量。

## 模型请求稳定性建议

完整 playable 生成通常会输出较长的 HTML、CSS 和 JavaScript，因此比普通问答请求更容易接近网关超时。

建议：

- 本地联调优先使用 `SPARKPLAY_LLM_REASONING_EFFORT=medium`。
- 复杂玩法需要更高质量时再切换到 `high`。
- 如果网关经常 504，可以适当提高 `SPARKPLAY_LLM_TIMEOUT_MS`，或降低 `SPARKPLAY_LLM_MAX_OUTPUT_TOKENS`。
- 如果只需要验证产品闭环，可以暂时移除模型密钥，让系统使用内置生成器。

## 可选 GitHub OAuth 登录

SparkPlay 支持使用 GitHub OAuth 作为真实账号登录方式。该能力只用于账号验证和作品归属，不会自动创建 GitHub 仓库，也不会把作品同步到用户 GitHub。

需要在 GitHub 创建 OAuth App，并配置 callback URL：

```text
http://localhost:3000/api/auth/github/callback
```

生产环境需要替换成线上域名，例如：

```text
https://your-domain.com/api/auth/github/callback
```

本地 `.env.local` 示例：

```env
SPARKPLAY_PUBLIC_APP_URL=http://localhost:3000
SPARKPLAY_AUTH_SECRET=replace-with-a-long-random-string
SPARKPLAY_GITHUB_CLIENT_ID=replace-with-your-github-oauth-client-id
SPARKPLAY_GITHUB_CLIENT_SECRET=replace-with-your-github-oauth-client-secret
```

说明：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `SPARKPLAY_PUBLIC_APP_URL` | 使用 OAuth 时必填 | SparkPlay 对外访问地址，用于拼接 GitHub callback URL。 |
| `SPARKPLAY_AUTH_SECRET` | 使用 OAuth 时必填 | 服务端签名 session cookie 的随机字符串。生产环境必须使用强随机值。 |
| `SPARKPLAY_GITHUB_CLIENT_ID` | 使用 OAuth 时必填 | GitHub OAuth App 的 Client ID。 |
| `SPARKPLAY_GITHUB_CLIENT_SECRET` | 使用 OAuth 时必填 | GitHub OAuth App 的 Client Secret，只能放本地 `.env.local` 或部署环境变量。 |

行为说明：

- 未登录用户可以打开公开分享页试玩。
- 未登录用户点击分享页 Remix，会先跳转 GitHub 登录，登录完成后回到原分享页。
- 登录用户点击 Remix 后，系统会 fork 固定版本到自己的 SparkPlay 账户。
- SparkPlay 不保存 GitHub access token，只保存映射后的用户身份。

## 本地数据目录

运行过程中会生成：

```text
data/db.json
data/artifacts/*.html
```

说明：

- `data/db.json` 保存项目、版本、会话、分享链接等元数据。
- `data/artifacts/*.html` 保存每个版本对应的不可变 HTML artifact。
- `data` 是本地运行数据目录，默认不应提交到代码仓库。

## 可选 Postgres / Prisma 数据层

SparkPlay 当前默认使用本地 JSON adapter，便于快速启动和演示。产品化部署时可以切换到 Postgres，当前仓库已经提供 Prisma schema、Postgres runtime adapter 和本地 JSON 导入脚本。

需要配置：

```env
DATABASE_URL=postgresql://user:password@localhost:5432/sparkplay?schema=public
SPARKPLAY_DATA_ADAPTER=local-json
```

说明：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | 使用 Postgres/Prisma 时必填 | Postgres 连接串，只能写在本地 `.env.local` 或部署平台服务端环境变量中。 |
| `SPARKPLAY_DATA_ADAPTER` | 可选 | 当前默认 `local-json`。设置为 `postgres` 后运行时会通过 Prisma 读写 Postgres。 |

初始化 Prisma client：

```bash
npm run prisma:generate
```

将 schema 推到开发数据库：

```bash
npm run db:push
```

把当前本地 `data/db.json` 导入 Postgres：

```bash
npm run db:import-local
```

也可以指定导入文件：

```bash
node scripts/import-local-json-to-prisma.mjs /absolute/path/to/db.json
```

注意：

- HTML artifact 目前仍保存在 `data/artifacts`，schema 中预留了 `artifactKey`，用于后续接入 S3-compatible object storage。
- `manifest`、`validationReport`、`tokenUsage`、`remixOf` 等复杂字段先以 JSON 迁移，避免过早拆表影响迭代速度。
- 真实数据库连接串属于敏感信息，不要提交到 GitHub。
- 如果切到 `SPARKPLAY_DATA_ADAPTER=postgres` 但缺少 `DATABASE_URL`，服务会直接报出明确配置错误。
- 需要回退本地模式时，将 `SPARKPLAY_DATA_ADAPTER` 改回 `local-json` 或移除该变量即可。

## 可选 Redis / BullMQ 任务队列

SparkPlay 默认使用 in-process queue，适合本地开发和单进程演示。生产化部署时建议切换到 BullMQ，让 Web 服务只负责创建任务，独立 Worker 负责模型生成、校验、保存版本。

本地默认配置：

```env
SPARKPLAY_QUEUE_ADAPTER=in-process
```

切换到 BullMQ：

```env
SPARKPLAY_QUEUE_ADAPTER=bullmq
REDIS_URL=redis://localhost:6379
SPARKPLAY_WORKER_CONCURRENCY=2
```

启动 Web：

```bash
npm run dev
```

启动生成 Worker：

```bash
npm run worker:generation
```

说明：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `SPARKPLAY_QUEUE_ADAPTER` | 可选 | `in-process` 或 `bullmq`。默认 `in-process`。 |
| `REDIS_URL` | 使用 BullMQ 时必填 | Redis 连接串。只能放 `.env.local` 或部署环境变量。 |
| `SPARKPLAY_WORKER_CONCURRENCY` | 可选 | 单个 Worker 并发处理任务数，默认 `2`。 |

注意：

- 如果设置 `SPARKPLAY_QUEUE_ADAPTER=bullmq` 但缺少 `REDIS_URL`，API 会在创建 run 前直接报出明确配置错误，避免留下卡住的 queued run。
- BullMQ 模式下必须至少启动一个 `worker:generation`，否则任务会停留在 queued 状态。
- 回退本地模式时，将 `SPARKPLAY_QUEUE_ADAPTER` 改回 `in-process` 或移除该变量。

## 可选 Playwright Smoke / Thumbnail

SparkPlay 会为每个生成版本写入 `smokeReport` 和缩略图。默认不开启真实浏览器 smoke，此时会生成 fallback SVG thumbnail，并把 smoke 状态标记为 `skipped`。生产化生成质量验证建议开启 Playwright smoke。

安装 Chromium：

```bash
npm run smoke:install
```

开启 smoke：

```env
SPARKPLAY_SMOKE_ENABLED=true
```

说明：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `SPARKPLAY_SMOKE_ENABLED` | 可选 | `true` 时生成/Remix 会使用 Playwright Chromium 做移动端渲染、交互、console error 和截图检查。默认关闭。 |

注意：

- 开启 smoke 后，如果页面不可见、没有交互元素、console error 或 smoke 失败，版本不会被保存。
- 未开启 smoke 时仍会生成 fallback thumbnail，保证作品库和分享页后续有可用缩略图字段。
- Playwright 浏览器二进制不要提交到 GitHub。

## 环境文件管理

建议保留：

```text
.env.example
```

不要提交：

```text
.env
.env.local
.env.*.local
```

## 安全注意事项

- 不要提交 `.env.local`。
- 不要把真实 token、私钥、网关密钥写入 README、测试文件或前端代码。
- 对公网部署时，应在服务端环境变量中配置模型密钥。
- 生成的 HTML 会经过基础静态校验，默认阻止外部脚本、外部样式和网络请求。

## 代码仓库脱敏规则

推送到代码仓库时，只应提交源码、文档、测试和 `.env.example`。

必须保持忽略：

```text
.env
.env.local
.env.*.local
data
.next
node_modules
*.log
```

提交前建议检查：

```bash
git check-ignore .env.local data .next node_modules
git status --short
```

如果需要配置真实模型网关密钥，请只写入本地 `.env.local` 或部署平台的服务端环境变量，不要写入任何会被 git 跟踪的文件。
