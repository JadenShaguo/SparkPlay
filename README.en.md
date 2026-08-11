# SparkPlay

SparkPlay is a Web-first AI playable creation platform for content creators, marketing teams, and product prototypers. It turns a natural-language idea into a mobile-first interactive mini game that can be played immediately, remixed through conversation, saved as immutable versions, and shared through fixed public links.

SparkPlay is not designed to showcase "AI wrote some code." Its goal is to produce real interactive content units: each playable should have a goal, controls, feedback, score or progress, an end state, and a restart path. Viewers should be able to open a shared version, play it without logging in, and remix it into their own fork.

## Product Overview

SparkPlay provides an end-to-end loop for AI-generated playable content:

1. A creator describes the interaction, gameplay goal, and visual style.
2. SparkPlay creates a generation run and produces a mobile-first HTML playable from the prompt, mode, and uploaded assets.
3. The result appears inside a phone preview frame, with generation stages shown beside it.
4. The creator can regenerate the same instruction or remix the current version with a natural-language edit.
5. Every generation, remix, import, and rollback creates an immutable version.
6. A creator can create a fixed-version share link.
7. Anyone can open the shared play page without logging in.
8. Viewers can remix from the share page and create their own forked work.

This turns each playable from a disposable output into a reusable creative asset.

## Product Philosophy

SparkPlay is built on a simple belief: interactive content should be as easy to create, revise, and distribute as text or images.

Traditional mini-game production requires planning, visual design, front-end development, testing, and publishing. SparkPlay compresses that workflow into a conversational studio. Creators express intent first, then use playtesting and remix instructions to shape the result.

SparkPlay follows three product principles:

- **Playable first**: the output must be immediately interactive.
- **Remixable first**: creators should keep improving a version instead of starting over.
- **Shareable first**: generated works should naturally support links, forks, and secondary creation.

## Value Proposition

SparkPlay is positioned as AI playable creation infrastructure.

### Content Creators

Creators can turn memes, short-video ideas, challenges, and game concepts into playable mini games for fan interaction, social distribution, and creative testing.

### Marketing and Growth Teams

Teams can quickly produce interactive campaign demos, brand mini games, lucky draws, quizzes, and lightweight engagement mechanics.

### Product and Design Teams

Product managers and designers can express interaction concepts as playable prototypes instead of relying only on static mockups or written specs.

### AI UGC Experiments

SparkPlay can be used to validate first-generation success rate, remix success rate, share opens, play starts, play completions, and remix conversion.

## Core Features

### Prompt-to-Playable Generation

Creators describe gameplay, goals, visual style, and interactions. SparkPlay generates a complete mobile-first HTML playable.

### Asset Upload

The studio supports image and audio uploads. Assets are used as generation context and recorded in the version manifest.

### Phone Preview

Generated HTML runs inside a sandboxed iframe in a phone frame. This keeps the preview close to the final mobile experience while isolating generated content from the host page.

### Conversational Remix

Creators can enter edit instructions such as "change the background to a starry sky" or "make the scoring faster." SparkPlay generates a new remix version from the current playable.

### Regeneration

If the creator is not satisfied with the current result, regeneration creates a new version from the current instruction without overwriting previous versions.

### Game Tabs

Creators can open generated works into top-level game tabs and switch between multiple works or versions for comparison.

### Generation Process Panel

The right-side panel shows the generation stages: receiving the instruction, generating the mini game, validating safety, persisting the version, and preparing the preview. It also shows recent versions and rollback actions.

### Async Generation Runs

Generation and remix requests create `GenerationRun` records. The frontend polls run status, which prevents long model calls from blocking the web request and keeps the previous preview available when a run fails.

### Version Management

SparkPlay uses immutable versions. Every generation, remix, import, and rollback creates a new version. Share links bind to fixed versions, so later edits never change an already shared link.

### Sharing and Forking

Shared play pages can be opened without logging in. Viewers can remix from a shared fixed version and create their own fork.

### Discover and Public Profiles

The `Discover` page lists public playables and supports latest, most remixed, and most played sorting. Public user profiles show a creator's public works, share opens, and remix data.

### GitHub Login

SparkPlay supports GitHub OAuth as an account identity layer. GitHub login is used only for identity; SparkPlay does not sync works to GitHub repositories and does not request repository write permissions.

For local development, clicking "Use GitHub Login" in the account page opens a configuration modal if OAuth is not configured. The user can enter GitHub OAuth parameters, and SparkPlay writes them to the local `.env.local` file. That file is ignored by Git by default.

### HTML Import

Creators can import external single-file HTML into SparkPlay and use the same preview, versioning, rollback, and sharing flow.

### Showcase Demo Works

The project includes a demo seed script that generates polished mobile playable examples for the library and discover page, including memory cards, star tapping, runner, personality quiz, survival story, balloon party, pixel treasure, and rhythm stage.

### HTML Safety Validation

Generated HTML is statically validated. SparkPlay blocks external scripts, external styles, `@import`, `fetch`, `XMLHttpRequest`, `WebSocket`, and `sendBeacon`.

## Information Architecture

| Area | Purpose |
| --- | --- |
| `Create` | Main studio for prompts, assets, generation modes, phone preview, remix, process tracking, and version operations. |
| `Library` | Current user's work library. |
| `Templates` | Prompt templates for common gameplay patterns. |
| `Account` | User identity, local asset statistics, and GitHub login entry. |
| `Play` | Public fixed-version play page with remix entry. |
| `Discover` | Public playable discovery page. |
| `Profile` | Public creator profile page. |
| `Lineage` | Remix lineage page for sources and descendants. |

## Generation Modes

| Mode | Purpose |
| --- | --- |
| Direct | Generate directly from the current prompt. |
| Plan Once | Plan the playable before producing the final result. |
| Clarify then Plan | Ask for missing details before planning and generation. |
| Staged | Suitable for more complex generation flows. |

The selected mode is recorded in generation runs and versions for later analysis.

## Technical Architecture

SparkPlay uses Next.js, React, and TypeScript in a Web-first architecture.

```text
Browser
  |
  |  Create / Remix / Share / Rollback
  v
Next.js App Router
  |
  |-- React studio
  |-- Route Handlers API
  |-- sandboxed iframe preview
  |
  v
Application services
  |
  |-- workflows.ts
  |-- generation-queue.ts
  |-- llm-provider.ts
  |-- playable-generator.ts
  |-- playable-contract.ts
  |-- validation.ts
  |-- auth.ts
  |-- store.ts
  |-- storage-adapter.ts
  |
  v
Data and artifact layer
  |
  |-- local-json: data/db.json
  |-- artifacts: data/artifacts/*.html
  |-- thumbnails: data/thumbnails/*
  |-- postgres/prisma: optional production data layer
```

## Directory Structure

```text
src/app
  API routes, pages, share page, discover page, public profiles, and global styles

src/components
  SparkPlay Studio, public project cards, and play page client components

src/lib
  Workflows, generation queue, model gateway, built-in generator, auth, storage, thumbnails, and HTML validation

src/types
  Domain types such as Project, PlayableVersion, GenerationRun, ShareLink, and Template

prisma
  Postgres schema for the optional production data layer

scripts
  Secret scan, demo seed, and local JSON to Prisma import scripts

data
  Local runtime data, ignored by Git

ENVIRONMENT.md
  Environment dependencies and configuration guide
```

## Key Concepts

### Project

A playable work that can be edited, versioned, shared, and remixed.

### PlayableVersion

An immutable version with its own HTML artifact, manifest, validation report, source type, and parent version relationship.

### GenerationRun

A generation task record used to track status, mode, duration, output size, validation failures, repair count, and model information.

### SessionMessage

A conversation message associated with creation and remix context.

### ShareLink

A fixed public link bound to a specific project and version.

### RemixLineage

A lineage record that connects a forked work to the original fixed version.

### AnalyticsEvent

A lightweight event record for share opens, play starts, play completions, and remix clicks.

### Template

A reusable prompt seed for common gameplay patterns.

## API Overview

| API | Method | Description |
| --- | --- | --- |
| `/api/generations` | `POST` | Create a generation run from prompt, mode, and assets. |
| `/api/generations/:id` | `GET` | Read generation status and result. |
| `/api/projects` | `GET` | List current user's projects and stats. |
| `/api/projects/:projectId` | `GET` | Read project, versions, and current HTML. |
| `/api/projects/:projectId/remix` | `POST` | Create a remix generation run from the current version. |
| `/api/projects/:projectId/rollback` | `POST` | Create a rollback version from an older version. |
| `/api/projects/:projectId/versions` | `GET` | List project versions. |
| `/api/projects/:projectId/publish` | `POST` | Publish a work as public or unlisted. |
| `/api/projects/:projectId/unpublish` | `POST` | Make a work private again. |
| `/api/projects/:projectId/lineage` | `GET` | Read remix sources and descendants. |
| `/api/share-links` | `POST` | Create a fixed-version share link. |
| `/api/share-links/:slug/remix` | `POST` | Fork from a shared play page. |
| `/api/public/projects` | `GET` | List public projects. |
| `/api/users/:userId/profile` | `GET` | Read a public creator profile. |
| `/api/events` | `POST` | Record share page play and remix events. |
| `/api/auth/github/start` | `GET` | Start GitHub OAuth login. |
| `/api/auth/github/callback` | `GET` | Complete GitHub OAuth login and set the session. |
| `/api/local-config/github-oauth` | `GET/POST` | Local development helper for GitHub OAuth config. |
| `/api/import` | `POST` | Import external HTML as a SparkPlay version. |
| `/play/:slug` | `GET` | Open a public fixed-version play page. |

## Artifact Contract

Each generated result consists of two parts:

- **HTML artifact**: a complete single-file HTML document stored as an immutable artifact.
- **Manifest metadata**: title, description, category, tags, controls, asset references, source prompt, remix relationship, thumbnail, and safety status.

Separating artifacts from metadata makes version tracking, moderation, sharing, and later object-storage migration easier.

## Model and Generation Strategy

### Built-in Generator

When no model gateway is configured, SparkPlay uses a deterministic local generator. It is useful for validating the create-preview-remix-version-share loop without external credentials.

### Model Gateway

When a model gateway is configured, SparkPlay calls a Responses API compatible endpoint to generate HTML and manifest data. The output is parsed and validated before persistence. Upstream timeout and gateway errors are surfaced as readable generation errors.

### Codex Config Reuse

Local development can optionally reuse model gateway settings from the local Codex configuration. This is intended only for local debugging. Production deployments should use explicit server-side environment variables.

## Security Boundaries

SparkPlay treats generated HTML as untrusted content:

- Preview runs in a `sandbox="allow-scripts"` iframe.
- External scripts are blocked.
- External CSS and `@import` are blocked.
- `fetch`, `XMLHttpRequest`, `WebSocket`, and `sendBeacon` are blocked.
- Share links bind to fixed versions.
- Real secrets belong only in local environment files or server-side environment variables.
- `.env.local`, `data/`, `.next/`, and `node_modules/` are ignored by Git.
- `npm run secret:scan` scans staged files for real tokens, internal gateway hosts, and sensitive env files.

## Local Development

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Default URL:

```text
http://localhost:3000
```

Seed polished local demo works:

```bash
npm run demo:seed
```

Run checks:

```bash
npm run lint
npm run build
npm test
```

## Environment

SparkPlay can run without a model gateway by using the built-in deterministic generator. To connect a real model provider, database, queue, storage, or GitHub login, see [ENVIRONMENT.md](./ENVIRONMENT.md).

Never commit real tokens, private keys, `.env.local`, internal gateway credentials, local runtime data, or generated build output.

### Local GitHub OAuth Configuration

There are two local configuration options:

1. Open the account page, click "Use GitHub Login", fill in the modal, and save. SparkPlay writes the values to `.env.local`.
2. Manually edit `.env.local` and set `SPARKPLAY_PUBLIC_APP_URL`, `SPARKPLAY_AUTH_SECRET`, `SPARKPLAY_GITHUB_CLIENT_ID`, and `SPARKPLAY_GITHUB_CLIENT_SECRET`.

The GitHub OAuth callback URL should be:

```text
http://localhost:3000/api/auth/github/callback
```

If login still fails after saving the config, restart the dev server so Next.js reloads `.env.local`.
