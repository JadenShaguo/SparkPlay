# SparkPlay

SparkPlay is an AI-powered playable creation platform for content creators, marketing teams, and product prototypers. It turns a natural-language idea into a mobile-first mini game that can be played immediately, remixed through conversation, saved as immutable versions, and shared through fixed public links.

SparkPlay is not positioned as a code-generation demo. Its product goal is to create interactive content units that users can tap, drag, score, finish, restart, share, and fork into new works.

## Product Overview

SparkPlay provides an end-to-end loop for AI-generated playable content:

1. A creator describes the intended interaction, gameplay goal, and visual style.
2. SparkPlay generates a mobile-first HTML playable from the prompt and uploaded assets.
3. The result appears instantly inside a phone preview frame.
4. The creator can regenerate the same instruction or remix the current version with a natural-language edit.
5. Every generation, remix, import, and rollback creates an immutable version.
6. A fixed-version share link can be opened by anyone without logging in.
7. Viewers can remix from the shared play page and create their own forked work.

This makes each playable a reusable creative asset rather than a disposable output.

## Product Philosophy

SparkPlay is built on a simple idea: interactive content should be as easy to create, revise, and distribute as text or images.

Traditional mini-game production requires planning, visual design, front-end development, testing, and publishing. SparkPlay compresses that workflow into a conversational studio. Creators express intent first, then use playtesting and remix instructions to shape the result.

SparkPlay follows three product principles:

- **Playable first**: the output must be immediately interactive.
- **Remixable first**: creators should keep improving a version instead of starting over.
- **Shareable first**: generated works should naturally support links, forks, and secondary creation.

## Value Proposition

SparkPlay is positioned as AI playable creation infrastructure.

### For Content Creators

Creators can turn memes, challenges, short-video ideas, and interaction concepts into playable mini games for social engagement and creative testing.

### For Marketing Teams

Teams can quickly produce interactive campaign demos, brand mini games, lucky draws, quizzes, and lightweight engagement mechanics.

### For Product and Design Teams

Product managers and designers can express interaction concepts as playable prototypes rather than relying only on static mockups or written specs.

### For AI UGC Experiments

SparkPlay can be used to validate generation success rate, remix success rate, share opens, play starts, play completions, and remix conversion.

## Core Features

- Generate mobile-first mini games from a prompt.
- Upload image and audio assets as generation context.
- Preview generated HTML inside a sandboxed phone frame.
- Remix the current version with natural-language instructions.
- Regenerate the current instruction without overwriting previous versions.
- Open works in top-level game tabs and switch between them.
- Inspect generation progress and recent versions.
- Roll back by creating a new version from an older version.
- Create fixed-version public play links.
- Remix from shared play pages.
- Import external single-file HTML into the SparkPlay version system.
- Validate generated HTML and block external scripts, external styles, and network requests.

## Information Architecture

| Area | Purpose |
| --- | --- |
| `Create` | Main studio for prompts, assets, generation, preview, remix, process tracking, and version operations. |
| `Library` | Local work library. |
| `Templates` | Prompt templates for common gameplay patterns. |
| `Account` | Local asset and usage summary. |
| `Play` | Public fixed-version play page with remix entry. |

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
  |-- llm-provider.ts
  |-- playable-generator.ts
  |-- validation.ts
  |-- store.ts
  |
  v
Local data layer
  |
  |-- data/db.json
  |-- data/artifacts/*.html
```

## Key Concepts

- **Project**: a playable work that can be edited, versioned, shared, and remixed.
- **PlayableVersion**: an immutable version with its own HTML artifact, manifest, validation report, and lineage.
- **GenerationRun**: a generation task record that tracks mode, duration, output size, model, and validation result.
- **ShareLink**: a fixed public link bound to a specific project version.
- **Template**: a reusable prompt seed for common gameplay patterns.

## API Overview

| API | Method | Description |
| --- | --- | --- |
| `/api/generations` | `POST` | Generate a playable from prompt, mode, and assets. |
| `/api/generations/:id` | `GET` | Read generation status. |
| `/api/projects` | `GET` | List local projects and stats. |
| `/api/projects/:projectId` | `GET` | Read project, versions, and current HTML. |
| `/api/projects/:projectId/remix` | `POST` | Generate a remix version from the current version. |
| `/api/projects/:projectId/rollback` | `POST` | Create a rollback version from an older version. |
| `/api/share-links` | `POST` | Create a fixed-version share link. |
| `/api/share-links/:slug/remix` | `POST` | Fork from a shared play page. |
| `/api/import` | `POST` | Import external HTML as a SparkPlay version. |
| `/play/:slug` | `GET` | Open a public play page. |

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

Run checks:

```bash
npm run lint
npm run build
npm test
```

## Environment

SparkPlay can run without a model gateway by using the built-in deterministic generator. To connect a real model provider, see [ENVIRONMENT.md](./ENVIRONMENT.md).

Never commit real tokens, private keys, or internal gateway credentials.
