# AGENTS.md

## Cursor Cloud specific instructions

### Overview

This is a static HTML/CSS/JS chat application ("Points-of-mess"). It has no build step, no package manager, and no external dependencies. The application consists of a single `index.html` file.

### Running the application

Serve the project root with any static HTTP server:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080/index.html` in a browser.

### Lint / Test / Build

- **Lint**: No linter is configured. For HTML validation, you can use `npx htmlhint index.html` (not pre-installed).
- **Tests**: No automated test suite exists.
- **Build**: No build step required — the app is served directly as static HTML.

### Notes

- The chat application is entirely client-side (no backend server needed).
- Bot replies are generated locally using simple keyword matching; no network requests are made.
- The app stores conversation state in memory only — refreshing the page resets the chat.
