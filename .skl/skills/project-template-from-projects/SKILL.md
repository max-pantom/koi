---
name: project-template-from-projects
description: Create a reusable starter template by scanning a user's existing projects folder and inferring their common stacks, conventions, scripts, folder layouts, dependencies, naming patterns, setup habits, and agent/GitHub workflows. Use when a user asks to make a project template, starter kit, boilerplate, scaffold, new-project standard, reusable GitHub template, or repo template based on how they usually build projects; also use when they ask to package or publish that template to GitHub so it can be cloned later.
---

# Project Template From Projects

## Goal

Create a reusable starter template from the user's own project patterns. The template should feel like the user's normal way of starting a new idea, not a generic boilerplate.

## Operating Principles

- Ask for the projects folder if it is not obvious.
- Inspect patterns, not private content.
- Prefer repeated conventions over one-off experiments.
- Create the template outside existing projects unless the user names a destination.
- Make the template runnable and easy to rename.
- Offer GitHub publishing, but never commit, create a repo, or push without explicit confirmation.

## Safety Rules

Do not read, copy, or include:

```txt
.env
.env.local
secrets
credentials
API keys
private databases
uploads
outputs
node_modules
.next
dist
build
.venv
coverage
cache folders
large generated assets
```

Use `.env.example` with placeholder values instead of real secrets.

## Workflow

### 1. Locate Projects

If the user does not specify a root, ask:

```txt
Which folder should I scan for your projects?
```

Common examples:

```txt
~/Projects
~/Code
~/Desktop/code
~/Developer
```

### 2. Inventory Projects

Scan one level of project folders first. Only go deeper when the user has a nested workspace or monorepo.

Look for signal files:

```txt
package.json
pnpm-lock.yaml
yarn.lock
package-lock.json
bun.lockb
next.config.js
next.config.mjs
next.config.ts
vite.config.js
vite.config.ts
tsconfig.json
tailwind.config.js
tailwind.config.ts
postcss.config.js
eslint.config.js
eslint.config.mjs
biome.json
pyproject.toml
Cargo.toml
go.mod
README.md
.env.example
AGENTS.md
CLAUDE.md
```

Useful shell scan:

```bash
find "$PROJECTS_ROOT" -maxdepth 2 -type f \
  \( -name package.json -o -name pyproject.toml -o -name Cargo.toml -o -name go.mod \
  -o -name README.md -o -name 'next.config.*' -o -name 'vite.config.*' \
  -o -name tsconfig.json -o -name '.env.example' -o -name AGENTS.md -o -name CLAUDE.md \)
```

For JavaScript/TypeScript projects, inspect representative `package.json` files for:

```txt
dependencies
devDependencies
scripts
packageManager
```

Infer package manager:

```txt
pnpm-lock.yaml    -> pnpm
yarn.lock         -> yarn
bun.lockb         -> bun
package-lock.json -> npm
```

Infer framework:

```txt
next.config.* or dependency "next" -> Next.js
vite.config.* or dependency "vite" -> Vite
dependency "react" -> React
tailwind config or dependency "tailwindcss" -> Tailwind
pyproject.toml -> Python
go.mod -> Go
Cargo.toml -> Rust
```

### 3. Summarize Patterns

Before creating files, tell the user what you found:

```txt
I found mostly:
- Next.js + React + TypeScript
- npm/pnpm
- app/ or src/ app structure
- Tailwind or global CSS
- scripts: dev, build, lint, typecheck
- README + .env.example
```

If there are multiple strong clusters, ask which template to create:

```txt
I see both Next.js apps and Vite apps. Should the template be Next.js, Vite, or both?
```

### 4. Choose Template Scope

Default to one focused starter template. Make multiple templates only if the user asks or if the project patterns are clearly split.

Good template scopes:

```txt
next-app-template
vite-react-template
python-cli-template
go-service-template
fullstack-app-template
agent-ready-next-template
```

### 5. Create Template

Recommended structure:

```txt
template-name/
  README.md
  .gitignore
  .env.example
  package.json or equivalent manifest
  tsconfig.json or language config
  app/ or src/
  public/ if needed
  AGENTS.md if useful
```

For Next.js-heavy users:

- Build an actual first screen, not a marketing-only landing page, unless requested.
- Keep the UI minimal but polished.
- Include `app/`, `components/`, and `lib/` only if the user's projects commonly use them.
- Follow the user's package manager and script style.

For Vite-heavy users:

- Include `src/`, `index.html`, `vite.config.*`, and minimal app components.
- Keep the app runnable with `dev` and `build`.

For Python/Go/Rust:

- Preserve normal manifest and CLI/service layout.
- Include a minimal runnable entry point.
- Include test/lint only if common in the user's projects.

### 6. Template Content Rules

Use generic names:

```txt
{{PROJECT_NAME}}
{{PROJECT_DESCRIPTION}}
{{APP_NAME}}
```

Or use a neutral starter name like:

```txt
new-project
starter
template-app
```

Do not copy project-specific:

```txt
brand names
customer names
internal API URLs
private copy
private assets
database files
production credentials
```

### 7. README Requirements

Include a short README with:

```txt
# Template Name

## Use
git clone <repo-url> my-new-project
cd my-new-project

## Setup
install command
copy .env.example .env.local

## Development
dev command

## Build
build command

## Rename Checklist
- update package/app name
- update README
- update env values
- replace placeholder UI copy
```

### 8. Validate

Run practical checks:

```txt
install dependencies
typecheck
lint
build
test if available
```

For frontend templates, start the dev server when possible and verify the first screen renders.

If a check cannot run, explain why.

## GitHub Publishing Option

After the template is created and validated, ask:

```txt
Do you want me to put this template on GitHub so you can clone it later?
```

If yes, confirm:

```txt
repo name
owner/user/org
visibility: private or public
default branch
whether it should be marked as a GitHub template repository
```

Then:

1. Initialize git only inside the new template folder.
2. Create a clear first commit.
3. Create the GitHub repo using the available GitHub tool or `gh`.
4. Push the default branch.
5. Return clone/use commands.

Example final commands to show:

```bash
git clone <repo-url> my-new-project
cd my-new-project
npm install
npm run dev
```

Never publish to GitHub without explicit confirmation.

## Final Response

Report:

```txt
template path
patterns detected
files created
commands run
checks passed/failed
GitHub URL if published
next suggested use command
```
