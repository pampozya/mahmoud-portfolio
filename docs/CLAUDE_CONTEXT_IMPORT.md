# Claude Context Import

Imported on 2026-05-19 from local project files. This is a sanitized working summary, not a full Claude conversation archive.

## What Was Found

- `.claude/settings.local.json` exists and contains a long permission/activity trail.
- No exported Claude chat transcript was found in the repository.
- `tracker/STARTING_PROMPT.md` contains a handoff prompt for continuing tracker work in Claude.
- The frontend includes a `ClaudeAssistant` admin widget backed by the portfolio API.

## Project Context From The Trail

- Main portfolio domain work has used `portfolio.lensmania.ae` and `lensmania.ae/portfolio`.
- Backend health and portfolio API checks target `https://lensmania-api.onrender.com/api`.
- Deployment history includes React builds, Hostinger SSH/rsync deploys, Render API checks, and CORS verification.
- Previous fixes touched large video upload behavior, Cloudinary/R2 upload paths, featured focal point fields, theme controls, and public hero/portfolio presentation.
- Side tools exist for pending-payment tracking, Cinemagic tracking, and finance tracking under `tracker/` and `finance/`.
- Finance work appears to connect to Google Sheets CSV export and `lensmania.ae/finance/api.php`.
- Photo-search work referenced local/external photo folders and generated thumbnail contact sheets/index pages.

## Notes For Future Assistants

- Treat `.claude/settings.local.json` as operational history and permission metadata, not source documentation.
- Do not paste secrets, auth tokens, SSH paths, or one-off API keys into user-facing docs.
- Prefer the repo scripts and existing deployment notes before inventing a new deploy path.
- The portfolio is a cinematic React app with admin tooling, video upload management, testimonials, client logos, analytics, and delivery/review portals.
