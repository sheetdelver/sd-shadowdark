# ADR-0014: Minimum native system versions

**Status:** Implemented — offline verification passed; operator acceptance pending
**Date:** 2026-11-26

---

## Decision

User selected minimum-only native system admission after Shadowdark 4.1.2 was
blocked by a tested-version ceiling. Replace the current <=4.0.6 restriction with
>=4.0.0. A test baseline remains evidence, not an upper admission bound.

Shadowdark retains the published 4.0.6 definitions unchanged. A 4.1.2 milestone admits >=4.0.0 and adds required forward checks for >4.0.6 with new step IDs. Both effect-key checks and pack checks remain mandatory. The light-display setting retains its 4.0.6 minimum.

Do not infer that all future native behavior has been verified. Actual data,
identity, access and operation checks continue to decide whether a request can
proceed. Core/SDK API ranges, module release version and declared minimum Core
requirements are unchanged. Historical acceptance records remain dated evidence;
this decision supersedes their native-version exclusion policy only.

## Verification and remaining work

Targeted minimum/newer-version and retained failure regressions are required.
Core ADR-0077 owns recovery messaging; this module uses public SDK contracts only.
No production probes, world writes or runtime service changes are authorized by
these tests. Broader feature qualification and operator acceptance are separate.

## Automated evidence (November 26)

Core’s actual world-setting/default resolver reproduced the original ceiling
using the unchanged manifest from Git, then admitted the updated declaration
at the baseline and newer versions while rejecting below-minimum versions.
Module boundary validation, packaging and explicit module TypeScript checks pass.
These are isolated offline checks, not operator/native runtime acceptance.

The historical 4.0.6 effect oracle passes 93/93. Migration-hook regression passes
20/20, including immutable historical definitions and the new forward steps.
The official [4.1.2 source](https://github.com/Muttley/foundryvtt-shadowdark/tree/a34db60066cc70e955d6af59e875a087b6c7dcb7)
provides a separate pinned CI qualification: all listed pack-effect keys retain
consumers, modern effect data parses, two Backstab awards stack, and the legacy
effect-key migration is byte-identical to 4.0.6. Both baselines stay in CI.

Running the old source-format oracle directly against 4.1.2 initially failed
seven checks: modern `system.changes`, predefined-effect `type`, changed template
keys and added roll consumers differ from that oracle’s assumptions. Do not
report that initial run as passing. The separate 4.1.2 test covers the admission
change; it does not redefine historical parity. Regenerated 4.1.2 key inventory
is tracked beside the retained 4.0.6 snapshot.

Full 4.1.2 feature parity remains unclaimed: new damage-advantage/exploding-damage
and HP-roll consumers, plus changed predefined spell/light effects, require
a separately selected behavior audit. No new presets or mechanics are silently
inferred in this compatibility fix. Production 4.1.2 was operator-reported; no
production socket, document write or native browser probe was performed.

## Release CI runner correction

The release PR passed contract, rule and TypeScript checks, but its browser setup
failed when `ubuntu-latest` selected Ubuntu26.04. Pinned Playwright1.56.1 does not
support that image. Validation now pins Ubuntu24.04, supported by the same
Playwright release; browser checks remain mandatory and no runtime dependency
or SDK/Core minimum changes.
