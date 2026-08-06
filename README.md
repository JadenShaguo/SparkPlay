# SparkPlay

SparkPlay 是一个面向内容创作者、营销创意团队和产品原型团队的 AI 互动小游戏创作平台。它把一句自然语言描述转化为一个可以立即试玩、继续 Remix、保存版本并公开分享的移动端 playable。

SparkPlay 的重点不是让用户看到“AI 写了一段代码”，而是让用户得到一个真正可以互动的内容单元：有目标、有操作、有反馈、有计分或进度、有结束态，也能被他人打开后继续二创。它把小游戏、互动广告、社交传播玩法和 AI UGC 内容生产整合进一个 Web-first 创作工作台。

## 产品介绍

SparkPlay 提供从创意输入到公开试玩的完整闭环：

1. 创作者在工作台输入想要生成的互动内容、玩法目标和视觉风格。
2. 系统根据 prompt 和上传素材生成一个移动端优先的 HTML playable。
3. 生成结果立即出现在手机框中，用户可以直接试玩。
4. 如果结果不满意，可以点击重新生成，或通过 Remix 输入框用自然语言修改当前版本。
5. 每一次生成、Remix、导入和回滚都会创建独立版本。
6. 用户可以创建固定版本分享链接，让他人在未登录状态下打开试玩。
7. 他人可以从分享页一键 Remix，生成自己的分叉版本。

这个闭环让 playable 不再只是一次性产物，而是可以被持续修改、传播和复用的创意资产。

## 产品理念

SparkPlay 的产品理念是：让互动内容像文字和图片一样容易被创作、修改和分发。

传统互动小游戏制作通常需要策划、视觉设计、前端开发、调试和发布等多个环节。SparkPlay 把这些环节压缩到一个对话式工作台中，让创作者先表达意图，再通过试玩和 Remix 逐步接近理想结果。

SparkPlay 认为一个好的 AI playable 平台应该具备三点：

- **可玩优先**：生成结果必须能被立即体验，而不是停留在代码或静态页面。
- **可改优先**：创作者不需要重新开始，可以基于当前版本继续对话修改。
- **可传播优先**：作品应该天然支持分享、分叉和二次创作。

## 价值定位

SparkPlay 定位为 AI playable 创作基础设施，面向以下价值场景：

### 内容创作者

创作者可以把一个短视频梗、一个互动挑战、一个小游戏点子快速变成 playable，用于粉丝互动、社媒传播或创意测试。

### 营销与增长团队

团队可以快速制作互动广告 Demo、活动页小游戏、抽奖挑战、答题玩法和品牌互动小组件，用更低成本验证用户参与度。

### 产品与设计团队

产品经理和设计师可以用 SparkPlay 快速表达玩法想法，生成可点击、可试玩的原型，减少只靠文字描述和静态图沟通的成本。

### AI UGC 平台实验

SparkPlay 可以作为 AI UGC playable 的基础平台，用来验证生成成功率、Remix 成功率、分享打开率、试玩完成率和二创转化率。

## 核心功能

### 一句话生成

用户输入对玩法、目标、视觉风格和交互方式的描述，系统生成完整 HTML playable。生成作品默认移动端优先，适合在手机框、移动浏览器和分享页中体验。

### 素材上传

创作台支持上传图片和音频素材。素材会作为生成上下文参与模型生成，也会记录在作品 manifest 中，方便版本追踪和 Remix 延续。

### 手机框实时预览

生成结果会在中央手机框中运行。手机框使用 sandboxed iframe 预览生成 HTML，既贴近最终移动端体验，也隔离生成内容对宿主页面的影响。

### 对话式 Remix

用户可以在手机下方输入修改指令，例如“把背景换成星空”“节奏再快一点”“结算页更适合截图分享”。系统会基于当前版本生成新的 Remix 版本。

### 重新生成

当用户对当前指令生成的结果不满意时，可以点击重新生成。系统会按当前指令再次生成一个新版本，旧版本不会被覆盖。

### 游戏标签页

用户可以把当前作品打开到页面顶部的游戏标签页中，在多个作品或版本之间快速切换，方便横向比较不同生成结果。

### 生成过程面板

手机右侧展示生成过程，包括接收指令、生成小游戏、安全校验、写入版本和预览就绪。面板也展示最近版本，并提供回滚入口。

### 版本管理

SparkPlay 使用不可变版本机制。每次生成、Remix、导入或回滚都会创建新的 version，旧版本不会被覆盖。分享链接绑定固定版本，后续修改不会影响已经分享出去的链接。

### 分享与二创

分享页可以在未登录状态下打开试玩。公开作品页面提供 Remix 入口，他人可以基于当前分享版本创建自己的分叉作品。

### HTML 导入

用户可以导入外部工具生成的单文件 HTML，把它纳入 SparkPlay 的预览、版本、回滚和分享体系。

### 安全校验

生成 HTML 会经过基础静态校验，默认阻止外部脚本、外部样式、`fetch`、`XMLHttpRequest`、`WebSocket`、`sendBeacon` 和 `@import` 等能力，降低公开预览和分享时的风险。

## 页面与信息架构

SparkPlay 当前包含以下核心页面：

| 页面 | 说明 |
| --- | --- |
| `Create` | 主创作台，包含 prompt 输入、素材上传、生成模式、手机预览、Remix、生成过程和版本操作。 |
| `Library` | 本地作品库，展示已经创建的作品并支持重新打开。 |
| `Templates` | 模板库，提供常见玩法模板作为 prompt 起点。 |
| `Account` | 本地资产统计，包括作品数、版本数、分享数和 Remix 数。 |
| `Play` | 公网试玩页，用于打开固定版本分享链接并触发 Remix。 |

## 生成模式

创作台提供多种生成入口：

| 模式 | 说明 |
| --- | --- |
| 直接生成 | 根据当前 prompt 直接生成 playable。 |
| 先计划 | 先按计划组织玩法，再生成结果。 |
| 追问后计划 | 适合需求不清晰时先补充设定。 |
| 分阶段 | 适合更复杂的玩法生成流程。 |

不同模式会记录到生成任务和版本中，便于后续分析生成效果。

## 技术架构

SparkPlay 使用 Next.js + React + TypeScript 构建，前后端在同一 Web 项目中实现。

```text
浏览器
  |
  |  创建 / Remix / 分享 / 回滚
  v
Next.js App Router
  |
  |-- React 创作台
  |-- Route Handlers API
  |-- sandboxed iframe 预览
  |
  v
应用服务层
  |
  |-- workflows.ts          生成与 Remix 编排
  |-- llm-provider.ts       模型网关适配
  |-- playable-generator.ts 内置生成器
  |-- validation.ts         HTML 安全校验
  |-- store.ts              本地数据存储
  |
  v
本地数据层
  |
  |-- data/db.json
  |-- data/artifacts/*.html
```

## 目录结构

```text
src/app
  API 路由、页面入口、分享页和全局样式

src/components
  SparkPlay Studio 主创作台组件

src/lib
  生成工作流、模型网关、内置生成器、版本存储和 HTML 校验

src/types
  Project、PlayableVersion、GenerationRun、Template 等领域类型

data
  本地运行数据目录，保存元数据和 HTML artifact

README.md
  中文项目说明

README.en.md
  英文项目说明

ENVIRONMENT.md
  环境依赖与配置说明
```

## 核心数据概念

### Project

作品实体，代表一个可持续编辑和分享的 playable 项目。Project 记录标题、描述、可见性、当前版本和根版本。

### PlayableVersion

不可变版本实体。每个版本都有独立 HTML artifact、manifest、校验报告、来源类型和父版本关系。

### GenerationRun

生成任务记录。用于追踪生成模式、耗时、输出大小、校验失败数、修复次数和模型信息。

### SessionMessage

对话消息记录，用于表达创作和 Remix 过程中的上下文。

### ShareLink

分享链接实体。每个分享链接绑定固定 project 和 version，保证公开链接不会被后续编辑影响。

### Template

玩法模板实体。模板用于快速填充 prompt，并引导用户生成常见互动玩法。

## API 概览

| API | 方法 | 说明 |
| --- | --- | --- |
| `/api/generations` | `POST` | 根据 prompt、模式和素材生成 playable。 |
| `/api/generations/:id` | `GET` | 查询生成任务状态。 |
| `/api/projects` | `GET` | 获取本地作品列表与统计。 |
| `/api/projects/:projectId` | `GET` | 获取项目、版本列表和当前 HTML。 |
| `/api/projects/:projectId/remix` | `POST` | 基于当前版本生成 Remix 新版本。 |
| `/api/projects/:projectId/rollback` | `POST` | 基于历史版本创建回滚版本。 |
| `/api/projects/:projectId/versions` | `GET` | 获取项目版本列表。 |
| `/api/share-links` | `POST` | 创建固定版本分享链接。 |
| `/api/share-links/:slug/remix` | `POST` | 从分享页 fork 到创作台。 |
| `/api/import` | `POST` | 导入外部 HTML 为 SparkPlay 版本。 |
| `/play/:slug` | `GET` | 打开公开试玩页。 |

## Artifact 合约

每个生成结果由两部分组成：

- **HTML artifact**：完整单文件 HTML，保存在 `data/artifacts/*.html`，内容不可变。
- **Manifest metadata**：标题、描述、分类、标签、控制方式、素材引用、来源 prompt、Remix 关系和安全状态。

HTML artifact 和 manifest 分离，便于版本追踪、审核、分享和后续迁移到对象存储。

## 模型与生成策略

SparkPlay 支持两种生成方式：

### 内置生成器

未配置模型网关时，系统使用内置 deterministic generator。它可以稳定生成本地可试玩 Demo，用于跑通创作、预览、Remix、版本和分享闭环。

### 模型网关

配置模型网关后，SparkPlay 会请求 Responses API 兼容接口生成完整 HTML 和 manifest。模型输出会经过结构解析和 HTML 安全校验。遇到上游 504 时，系统会给出明确错误提示，并尝试降低 reasoning effort 进行重试。

## 安全边界

SparkPlay 默认把生成内容视为不可信内容，因此采用以下限制：

- 预览运行在 `sandbox="allow-scripts"` iframe 中。
- 生成 HTML 不允许外部 script。
- 生成 HTML 不允许外部 CSS 和 `@import`。
- 生成 HTML 不允许 `fetch`、`XMLHttpRequest`、`WebSocket` 和 `sendBeacon`。
- 分享链接绑定固定版本，避免后续编辑影响已公开内容。
- 本地密钥只应通过环境变量配置，不应写入前端代码或文档。

## 本地运行

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

运行质量检查：

```bash
npm run lint
npm run build
npm test
```

## 环境配置

SparkPlay 不强制要求模型密钥。需要接入真实模型网关时，请参考 [ENVIRONMENT.md](./ENVIRONMENT.md)。

请不要提交 `.env.local`、真实 token、私钥或内部网关凭据。

## 本地数据

运行时会生成：

```text
data/db.json
data/artifacts/*.html
```

`data` 目录是本地开发数据目录，默认不提交到代码仓库。需要重置本地数据时，可以在停止服务后清理该目录。

## 适合的作品类型

SparkPlay 适合生成：

- 点击挑战类小游戏
- 反应速度测试
- 选择题与答题互动
- 抽卡、抽奖和收集玩法
- 轻量经营和养成原型
- 互动营销 Demo
- 社媒传播小游戏
- 教育科普互动卡片

## 设计原则

SparkPlay 的界面遵循以下原则：

- 创作台即主界面，不使用营销式落地页作为首屏。
- 手机预览始终是视觉中心，帮助用户关注 playable 本身。
- Remix 输入靠近手机预览，降低“试玩后修改”的操作距离。
- 生成过程放在右侧，帮助用户理解当前任务状态。
- 版本与回滚不打断创作主路径，但随时可用。

## 开发说明

项目使用 TypeScript 类型约束领域模型，核心业务逻辑集中在 `src/lib`：

- `workflows.ts` 负责编排生成与 Remix。
- `llm-provider.ts` 负责模型网关请求、超时和错误处理。
- `playable-generator.ts` 提供无模型配置时的内置生成能力。
- `validation.ts` 负责 HTML 安全校验。
- `store.ts` 负责本地 JSON 数据和 artifact 文件读写。

在修改生成、版本、分享或安全校验逻辑后，建议至少运行：

```bash
npm run lint
npm test
```
