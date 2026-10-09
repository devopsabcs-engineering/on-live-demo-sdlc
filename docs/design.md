# Pinch: design direction

Source: `specs/idea.md`. This is the first, bounded Plan step, not a PRD or technical spec.

## Intent and assumptions

Help home cooks adjust a recipe, read it with floury hands, and take the ingredients shopping.
The primary entry point is a ready-to-scale sample, not a blank form. Assume US customary
volume units for this spike; never imply that cups can become grams without ingredient density.
English and French are equally complete experiences. User-entered recipes are not automatically
translated. The prototype is disposable and must visibly say so.

## Direction and alternatives

Choose a **kitchen workbench**: recipe library above a recipe card, a prominent servings dial,
and a shopping checklist beside it. A wizard would make first entry easier but bury repeat
scaling. A mobile-only stack would simplify layout but waste desktop space. The workbench
keeps quantities and shopping visible together, stacking them on phones.

The signature is a measuring-label servings dial next to the ingredient quantities, rather
than a promotional hero. The recipe, not marketing, is the first thing to see. Avoid decorative
photography and remote fonts; the kitchen should feel calm, local, and immediately usable.

## Tokens

Adapt Theme Factory's Botanical Garden to a restrained **Enamel and parsley** palette:

| Role | Light | Dark |
|---|---|---|
| Canvas | `#edf2ef` | `#14231d` |
| Card | `#ffffff` | `#20352b` |
| Main text | `#172b21` | `#eff6ee` |
| Secondary text | `#455d50` | `#bdcec2` |
| Action | `#285c3a` | `#c9e6af` |
| Action text | `#ffffff` | `#14231d` |
| Borders | `#718779` | `#829888` |

Theme Factory fern green (`#4a7c59`) informs the palette; marigold (`#f9a620`) is a decorative
measuring-label accent, not body text. DejaVu Serif/Georgia for recipe names and DejaVu
Sans/system sans for controls, with tabular numerals for quantities. Use system fallbacks
instead of downloading fonts. Spacing: 8/16/24/32 px; rounded cards, minimum 44 px controls.

## Wireframe

```text
Desktop
[ Pinch / recipe scaler                         language | theme ]
[ Prototype notice                                                ]
[ Recipe library: pancakes | soup | salad | new recipe              ]
[ Recipe card / edit                        ][ Shopping checklist  ]
[ Servings [-] [ 4 ] [+]   metric/imperial    ][ Add / clear checked ]
[ Ingredient quantity | name                ][ checkbox | item     ]
[ Steps / start cooking                     ][ empty-state hint    ]

Phone (360 px)
[ Brand / language / theme ]
[ Prototype notice         ]
[ Library, wrapping cards  ]
[ Recipe / servings / units]
[ Ingredients / steps      ]
[ Shopping checklist      ]
```

## Critical journeys and states

1. **Scale:** select one of three bilingual samples, adjust servings, see quantities update
   without losing the recipe. Permit 1-24 servings in this spike; reject invalid values visibly.
   Units toggle mass and volume independently; counts and unknown units remain unchanged.
   Whole numbers, decimals, fractions and mixed fractions can be previewed. Grams/millilitres
   round to whole units; other quantities use friendly quarters where accurate.
2. **Enter:** open a labeled editor, type title, base servings, ingredients and steps, then
   save a session-only recipe. Cancel leaves the recipe untouched. Empty required fields and
   invalid servings show actionable feedback. Unparsed lines stay visible without invented
   quantities. Numbered steps lose only their leading number. User content is text, never HTML.
3. **Cook:** open a modal, read one large step, navigate with previous/next or left/right keys.
   Boundary buttons are disabled. Escape/close restores focus. Swipe, fullscreen and real
   wake-lock support are later production work; explicitly state the screen may sleep.
4. **Shop:** add the current scaled recipe, merge identical ingredient names and displayed
   units, tick items, clear checked. Show an inviting empty state. Plain-text lines remain plain
   text. The spike's list and recipes reset on reload; do not pretend otherwise.
5. **Language/theme:** switch EN/FR and light/dark without resetting servings, units, recipe,
   or checklist. Set document `lang` and use French decimal commas. Remember preferences
   when storage is available, and show a localized warning when it is not.

No asynchronous work is needed: there is no artificial loading state. There is no telemetry,
account, runtime network request, or server dependency.

## Accessibility and responsive acceptance

- Semantic headings, named controls, explicit form labels, keyboard-visible focus and a skip link.
- A native modal dialog contains focus; opening/closing preserves the previous context.
- Text and control colors must meet AA: 4.5:1 for normal text; 3:1 for large text/control boundaries.
- Status/error messages use a polite live region; do not announce the entire recipe on scaling.
- Layout must fit 360, 768 and 1440 px without horizontal scrolling; controls wrap.
- Reduced motion is respected; the spike does not require animations or pointer gestures.
- All UI, samples, dynamic labels and feedback have EN and FR strings. User-authored text
  remains verbatim. Language/theme changes also update an open editor or cook dialog.

## Bounded prototype acceptance and review

The clickable spike covers the five journeys above, three bilingual samples and both themes.
Review design for complete flows, edge states, tokens, accessibility and explicit scope limits.
Browser verification must exercise each journey in EN/light and FR/dark, test all three widths,
capture screenshots, inspect focus/labels/contrast, and collect console errors.

Production parsing/conversion edge cases, persistent recipe/list storage, JSON import/export,
clear-all-data, PWA/offline installation, wake lock/swipes, Vite/TypeScript, automated catalog
build gate, unit/e2e tooling and GitHub Pages remain outside this step. No PRD, architecture,
production build, security sign-off or deployment is produced here.
