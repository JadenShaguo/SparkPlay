# SparkPlay 登录配置说明

这份文档用于说明如何配置 GitHub OAuth 登录。它是说明文档，不会被项目自动读取。

真正运行时，请把文档中的最小配置复制到项目根目录的 `.env.local`。不要把 `.env.local`、真实 `Client Secret`、真实 `SPARKPLAY_AUTH_SECRET` 提交到 GitHub。

不配置 GitHub OAuth 时，SparkPlay 仍然可以使用游客 / demo 模式；配置后才支持真实 GitHub 登录和多人 Remix 归属。

## 最小配置

复制下面内容到 `.env.local`，再把占位值替换成你自己的真实值：

```env
SPARKPLAY_PUBLIC_APP_URL=http://localhost:3000
SPARKPLAY_AUTH_SECRET=replace-with-a-long-random-string
SPARKPLAY_GITHUB_CLIENT_ID=replace-with-your-github-oauth-client-id
SPARKPLAY_GITHUB_CLIENT_SECRET=replace-with-your-github-oauth-client-secret
```

## 配置项说明

### `SPARKPLAY_PUBLIC_APP_URL`

作用：SparkPlay 对外访问地址，用于拼接 GitHub OAuth 的回调地址。

本地开发：

```env
SPARKPLAY_PUBLIC_APP_URL=http://localhost:3000
```

线上部署后改成真实域名，例如：

```env
SPARKPLAY_PUBLIC_APP_URL=https://sparkplay.example.com
```

### `SPARKPLAY_AUTH_SECRET`

作用：给 SparkPlay 登录 session cookie 做服务端签名。

它不是 GitHub 给你的值，而是 SparkPlay 自己使用的随机密钥。

生成方式：

```bash
openssl rand -base64 32
```

把输出结果填到 `.env.local`：

```env
SPARKPLAY_AUTH_SECRET=这里填写生成出来的随机字符串
```

注意：生产环境必须使用强随机字符串，不要使用示例占位值。

### `SPARKPLAY_GITHUB_CLIENT_ID`

作用：GitHub OAuth App 的公开应用标识。

获取方式：

1. 打开 GitHub。
2. 点击右上角头像。
3. 进入 `Settings`。
4. 进入 `Developer settings`。
5. 进入 `OAuth Apps`。
6. 点击 `New OAuth App` 或 `Register a new application`。
7. 创建完成后，在应用详情页复制 `Client ID`。

填写到 `.env.local`：

```env
SPARKPLAY_GITHUB_CLIENT_ID=GitHub OAuth App 的 Client ID
```

### `SPARKPLAY_GITHUB_CLIENT_SECRET`

作用：GitHub OAuth App 的服务端密钥，用于在回调阶段把 `code` 换成 GitHub access token。

SparkPlay 当前只用它读取 GitHub 用户身份，不会申请仓库写权限，也不会自动同步作品到 GitHub。

获取方式：

1. 进入刚刚创建的 GitHub OAuth App 详情页。
2. 找到 `Client secrets`。
3. 点击 `Generate a new client secret`。
4. 复制生成的 secret。

填写到 `.env.local`：

```env
SPARKPLAY_GITHUB_CLIENT_SECRET=GitHub OAuth App 的 Client Secret
```

注意：Client Secret 只显示一次或有限次数，生成后请立刻复制保存到本地 `.env.local`。

## GitHub OAuth App 页面填写

本地开发时：

```text
Application name:
SparkPlay

Homepage URL:
http://localhost:3000

Authorization callback URL:
http://localhost:3000/api/auth/github/callback
```

线上部署后：

```text
Homepage URL:
https://你的线上域名

Authorization callback URL:
https://你的线上域名/api/auth/github/callback
```

GitHub OAuth App 的 callback URL 必须和 SparkPlay 实际使用的回调地址一致。

如果：

```env
SPARKPLAY_PUBLIC_APP_URL=http://localhost:3000
```

那么 callback URL 就应该是：

```text
http://localhost:3000/api/auth/github/callback
```

## 安全注意事项

- `LOGIN_CONFIG_GUIDE.md` 可以提交到 GitHub，因为这里只放说明和占位符。
- `.env.local` 不能提交到 GitHub。
- `SPARKPLAY_GITHUB_CLIENT_SECRET` 不能写进 README、代码、截图或公开 issue。
- `SPARKPLAY_AUTH_SECRET` 不能使用简单字符串，建议用 `openssl rand -base64 32` 生成。
- GitHub OAuth 只用于登录身份验证，不会自动把作品同步到 GitHub 仓库。
