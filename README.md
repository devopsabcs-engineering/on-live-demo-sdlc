# AI-SDLC practice

## Pinch design prototype

Open [`prototype/index.html`](prototype/index.html) directly in a browser. No package install,
build step, server or network connection is needed. Switch between English/French and
light/dark using the header controls.

Select a sample, change servings or units, edit/create a recipe, add ingredients to the shopping
list, tick/clear items, and open cook mode. Use left/right arrow keys to change cooking steps
and Escape to close the dialog. Recipes and shopping data are session-only; language and
theme preferences are remembered where browser storage permits.

This is a disposable **Plan-phase UX spike**, not the production application. It has no PWA,
wake lock, swipe navigation, durable recipe/list storage or JSON import/export.
See [design direction](docs/design.md) and [prototype review](docs/prototype-review.md).
The browser-review gate is **blocked** because Playwright MCP was unavailable in the authoring
session; static checks are not a substitute for browser evidence.
