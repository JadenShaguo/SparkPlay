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
