# NijiPanel Agent Instructions

Lightweight, agentless infrastructure control panel built with .NET 10 (C#) and React 19 (TypeScript/Tailwind/Vite).

## Commands & Workflows

### Frontend (`src/NijiPanel.Frontend`)
- Install deps: `npm --prefix src/NijiPanel.Frontend install`
- Typecheck & Build: `npm --prefix src/NijiPanel.Frontend run build` (runs `tsc && vite build`, outputs directly to `src/NijiPanel.Backend/wwwroot`)
- Dev server: `npm --prefix src/NijiPanel.Frontend run dev` (runs on `:3000`, proxies `/api` and `/ws` to `:5000`)

### Backend (`src/NijiPanel.Backend`)
- Build: `dotnet build src/NijiPanel.Backend/NijiPanel.Backend.csproj`
- Run: `dotnet run --project src/NijiPanel.Backend/NijiPanel.Backend.csproj` (defaults to `:5000` or `:8080`)
- Standalone Publish:
  ```bash
  dotnet publish src/NijiPanel.Backend/NijiPanel.Backend.csproj -c Release -r linux-x64 \
    --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true \
    -p:PublishTrimmed=false -o dist/linux-x64
  ```
  *Note:* Keep `-p:PublishTrimmed=false`; assembly trimming breaks SQLite, EF, and SSH.NET dynamic features.

### Documentation & Verification
- Docs preview (Docsify): `python3 -m http.server 3000 -d docs`
- Automated headless browser screenshots: `python3 take_all_screenshots.py` (requires running panel on `:8080` and Chrome CDP on `:9222`)

## Architecture & Toolchain Quirks

- **Embedded Frontend**: `NijiPanel.Backend.csproj` embeds `wwwroot\**\*` as `EmbeddedResource`. The backend serves either physical `wwwroot` or unpacks embedded assets (`EmbeddedAssetsManager.cs`). Always run `npm run build` in the frontend before rebuilding/publishing the backend if UI files changed.
- **Agentless SSH**: Target servers do not run any agents. All host interactions go through SSH.NET (`SshConnectionManager`) via password or SSH key (AES-256-GCM encrypted).
- **Centralized System Commands**: Never hardcode bash strings in C# services. All 56 system commands live in `src/NijiPanel.Backend/commands.json`, which seeds `command_templates` in SQLite. Access commands via `ICommandRegistry.GetCommand("Category.Name", params)`.
- **Database & State**: SQLite with WAL at `DATABASE_PATH` (default: `./data/servers.db` or `/data/nijipanel.db`). JWT secrets are persisted to `./data/jwt.key` if `JWT_SECRET` is unset.
- **Terminal WebSockets & Tmux**: WebSockets `/ws/terminal` and `/ws/docker-exec` attach to host-side `tmux` sessions. `TerminalSessionManager` retains a 256KB ring buffer to survive browser refreshes without process termination.

## Design System & UI Constraints (IBM Carbon 0px Rule)

- **Strict 0px Border-Radius**: All UI components (cards, buttons, inputs, modal dialogs, badges) must have sharp corners (`border-radius: 0px !important`). Do not use `rounded-*` classes (only exception: 1-2px circular LED status dots).
- **Palette Tokens**: Deep Carbon dark (`#000000`, `#0d0e12`), borders (`#282828`, `#212121`), Dorito Yellow accent (`#ffd100`), ribbon error red (`#f43f5e`).
- **Typography**: IBM Plex Sans / Inter for UI layout; JetBrains Mono for console, IP addresses, and metrics.

## Strict Rule: Documentation Synchronization (`docs/`)

Per `CONTRIBUTING.md` and `docs/CONTRIBUTING_DOCS.md`:
- Any change to REST endpoints, DTO models, `commands.json`, UI screens, or environment variables **must** be updated in `docs/` (`docs/api.md`, `docs/commands-registry.md`, `docs/design-system.md`, etc.) within the same commit/PR.

<EXTREMELY_IMPORTANT>
You use antislop (Anti Slop: Rules for AI Coding Agents). It is a filter, not a style guide: it stops generic AI slop in generated UI, copy, and code, without prescribing aesthetics.

For UI, copy, people, mobile layout, or code comments work, load the matching antislop skill before starting. Each skill is a folder in this plugin's skills/ directory (read its SKILL.md):
- Core filter, always on: skills/antislop/SKILL.md
- UI / visual: skills/antislop-ui/SKILL.md
- Copy & text: skills/antislop-copywriting/SKILL.md
- People: skills/antislop-human/SKILL.md
- Mobile / responsive: skills/antislop-layoutmobile/SKILL.md
- Code comments: skills/antislop-code/SKILL.md
Before starting, follow the core's "Two Usage Modes" section: explicit session instruction first, then global preference, then ask. For a resolved mode, announce `antislop active: <mode> (session override).` or `antislop active: <mode> (global preference).` once, using the actual mode and source. Ask only when no mode is resolved.
</EXTREMELY_IMPORTANT>
