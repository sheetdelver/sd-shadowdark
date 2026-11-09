# Module audits

## Current status — November 8, 2026

[Shadowdark 1.0.2](https://github.com/sheetdelver/sd-shadowdark/releases/tag/v1.0.2)
is published. The selected implementation and user-review gates below are complete.
Core minimum remains 0.22.3. Historical checkpoints retain their evidence and
limits; they are not a second active task queue.

## Completed scopes and evidence

| Record | Status |
| --- | --- |
| [Treasure review feedback](2026-11-08-treasure-review-feedback.md) | ADR-0013 completed; user accepted; released in 1.0.2. |
| [Production observations and creation/progression coverage](2026-11-08-observed-production-issues.md) | ADR-0012 completed; released in 1.0.1. |
| [1.0 readiness](2026-10-27-one-point-zero-readiness.md#release-closeout--november-8) | Selected scope accepted and released; CI and installed-smoke gates reconciled. |
| [GM treasure and item generation](2026-10-27-gm-treasure-generation.md) | ADR-0009 completed; naming/card sharing and Boon effects completed in ADR-0010/0011. |
| [Rest utility](2026-10-26-resting-workflow.md) | ADR-0006 completed, including user verification of wand spell-loss reset. |
| [Character Creator](2026-10-23-character-creator-workflow.md) | ADR-0005 completed; additional draft protection explicitly declined. |
| [Character base editor](../adr/0008-character-base-editor.md) | Completed and user verified on both sheets. |
| [Renown and ability-card controls](../adr/0007-renown-and-ability-card-controls.md) | Completed and user accepted. |
| [HUD sheet settings](../adr/0004-optional-hud-sheet-settings.md) | Completed and user accepted. |
| [Whole-UI presentation review](2026-10-20-presentation-regressions.md) | Completed under ADR-0003; user accepted presentation and controls. |
| [Spellcasting and native parity](2026-10-18-spellcasting-and-native-parity.md) | **Completed October19,2026.** Selected findings, corrective reviews and native A02-01–15 accepted; F01–F06 remain deferred. |
| [ADR-0002 validation](2026-10-18-adr-0002-validation.md) | Supporting checkpoints, archive identities, offline evidence and final UI-only delta. |
| [ADR-0002 native acceptance](2026-10-19-adr-0002-native-acceptance.md#v13-completion-and-final-closeout--october-19-2026) | Actual13.351/14.367 acceptance, final recovery-layout qualification and verified cleanup. |
| [Native alignment and resource cards](2026-10-15-native-alignment.md#final-native-v14-acceptance-and-closeout--october-18-2026) | Completed October18,2026. ADR-0001 acceptance; explicit deferrals and CG-4/6/8 qualifications retained. |
| [Core/SDK proposal](2026-10-16-core-sdk-world-data-proposal.md) | Historical; superseded by released Core0.19.2 contracts and completed module adoption. |

Completed records keep stable paths so historical evidence links remain valid.
No selected implementation/acceptance gate remains open in
[ADR-0002](../adr/0002-native-data-and-behavior-parity.md). Release preparation and
publication are separate operations. F01–F06 are not an active implementation
queue; their selection requires a new task. Historical pending paragraphs do not
reopen completed work or establish a new Core migration defect.
