# ADR-0004: Optional HUD sheet-view settings panel

Status: Implemented and isolated-verified; operator review pending
Date: 2026-10-23

## Scope and decision

The user approved exposing the existing Single page/Tabbed sheet preference in
Core's HUD Settings modal on `fix/restore-module-presentation`. This is a narrow
pilot of Core ADR0072, separate from ADR0003's remaining presentation review.
It adds no game setting, native Setting write or rules change.

`module/ui.tsx` registers one optional `settingsTabs` entry. The module ships
`SheetSettings` with semantic text and controls. Core owns panel styling as well
as the tab button, modal, loading/error/retry, SDK context and accessibility.
The tab label is Shadowdark; its stable ID remains sheet.
The immediate-save panel checks its lifecycle signal before writing, reports read/
write errors inline and supplies Reset sheet view. It never replaces Core's modal.

The preference continues using **`shadowdark_view_mode`**, shared by worlds and
accounts in the same browser/site. Its `simple` default selects the Single page
sheet; `advanced` selects the Tabbed sheet. `sheet-view-preference.ts` shares a
reactive snapshot between the actual `ShadowdarkSheet` consumer, its existing
view button and the settings panel. Storage succeeds before publication; failures
keep the prior mode. Reset removes this key only. There is no migration to Core's
world/module settings namespace and no new `info.json.settings` declaration.

Core SDK3.7/UI3.5 introduces settings tabs. This enhancement retains the existing
sheet button on older Core. A structurally typed registration and lifecycle props
compile against the existing released SDK; Core floor0.20.0, module API1.7/UI3.3,
workflow pins and module0.9.6 remain unchanged. Essential adoption would require
the supporting Core publication and separately selected compatibility changes.

## Verification

Explicit module typing and isolated `module:check` pass. The actual packager builds
the pilot in a disposable copied data directory. The archive's `dist/ui.js`, scoped
presentation CSS and compiled Tailwind are mounted using the actual Core settings
host/SurfaceHost and actual archived Actor page, with controlled SDK providers.
The fixture performs no server/native writes. It covers:

- Settings changes update the real sheet; the sheet button updates the panel.
- Reopening and a full browser reload preserve the mode.
- Reset removes only this preference, preserving SDK/other browser keys.
- Denied storage keeps the displayed prior value and presents an error.
- Different world/account identities retain the original site-wide preference.
- Keyboard selection and320px dark/light Core chrome (initial paper styling
  superseded by the operator correction below).

Reproduce from a configured Core checkout, using external browser tooling:

```sh
node --import tsx data/local/modules/shadowdark/src/tests/settings-panel.browser.mjs --archive=/absolute/path/shadowdark-0.9.6.tgz
```

Set `PLAYWRIGHT_MODULE` to the external Playwright module and `CHROME` to the
browser executable when needed. `SHADOWDARK_CORE` can select the toolchain.
The current packager emits one ESM UI file with deferred panel initialization;
it does not emit a separate network chunk. Source dynamic import and packaged
initialization/mount behavior are distinct checks.

Operator acceptance remains pending. These are controlled archive/consumer checks,
not a live/native Foundry test or blanket acceptance of ADR0003. No release version,
floor or workflow change follows from this pilot.

## Operator correction — Core-themed settings

The user rejected the initial paper-styled panel and generic Sheet tab label.
Core ADR0072 R72-02 removes module CSS scope for settings and automatically themes
semantic controls. The pilot now supplies unstyled semantic content, no settings
CSS, and the tab label Shadowdark. Core suppresses the single-tab group caption.
The preference key, scope, live sheet consumer and reset behavior are unchanged.
Earlier white-panel screenshot evidence is historical and does not accept the
corrected appearance. Packaged verification must compare controls to Core's
active theme with the normal module sheet CSS also loaded.

The rebuilt archived pilot passes these corrected theme assertions and all existing
preference/reset/lifecycle checks; dark/light 320px screenshots were visually
inspected. Operator recheck remains pending.

## Checkpoint — October 23

The user requested committing the pilot together with the supporting Core work.
The final panel uses Core presentation and the Shadowdark tab label. Core R72-03
caches panel definitions across tab visits/reopenings while creating fresh mount
state; this module continues reading the live shared sheet preference. Core
publication and final operator review remain separate. Module version0.9.6,
Core floor0.20.0, existing API floors and older sheet entry point are unchanged.
