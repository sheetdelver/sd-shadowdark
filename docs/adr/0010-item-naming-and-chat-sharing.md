# ADR-0010: Optional item names and card sharing

**Status:** Completed — user accepted November 4, 2026
**Date:** 2026-11-04

---

## Decision

The user selected two small conveniences after the treasure-builder review:
unobtrusive name suggestions and sharing an owned item card to chat. These are
module additions using existing public SDK services. Core, compatibility floors
and release versions do not change.

### Naming

Use one dice button beside the existing treasure Name input. The three native
magic-item name tables supply an ordered suggestion, matching native 4.0.6's
`data/macros/generate-random-magic-item-name.js` composition. Show the suggestion
inline with Apply name and Dismiss. Rolling never changes the draft, invalidates
its review or posts to chat. Applying changes only the name and invalidates the
existing review through the normal draft updater. Manual and category-generated
names remain available. No extra modal, required section or three-part editor.

The catalog reports whether all three caller-readable sources exist. The server
resolves the exact sources again, rolls with the SDK, uses the existing table
resolver, and checks source/context freshness. Missing or ambiguous results
produce a local error; no replacement names or copied official rows are bundled.
Clear, source replacement and context refresh discard the optional suggestion.

### Share to chat

Add Share to chat with a chat icon to the existing owned-item card action area,
shared by both sheet views. Owners and GMs can explicitly post the current item
to public chat. The tooltip states the audience. Catalog previews and observer
cards have no sharing control. This selection does not add recipient picking or
interactive chat attacks, casting or resource controls.

The client sends only item ID and request identity. The server rechecks Actor
ownership, resolves current caller-readable dependencies, prepares the shared
card model and posts through `runtime.chat.card`. The snapshot contains the
current name, artwork, description, facts and effect summaries. It excludes
action callbacks, diagnostics, private source notes and alternate identities.
Unidentified items share their current description/name without mechanical facts
or effect summaries. This preserves existing native identification handling;
it does not introduce hidden-item authoring.

Source descriptions use the existing sanitized informational formatter. Sharing
does not roll dice, spend uses, cast, consume, equip or modify documents. A
caller/world/Actor-bound receipt precedes posting, so replay after a lost response
cannot post a duplicate. An unconfirmed result tells the user to inspect chat.
The UI prevents concurrent clicks and retires pending callbacks when its context
changes. Successful later deliberate shares are separate requests.

Native `ChatSD.showItemCard` renders the item and applies native roll-mode
visibility. This selected SheetDelver action explicitly shares publicly through
Core's existing chat presentation; it does not reproduce native interactive
message templates or invoke Foundry browser code.

## Presentation and verification

References: Treasure's existing input/dice rows and inline source actions;
ResourceDetailModal's existing paper card footer and SpellLossControl buttons.
The additions preserve those controls, typography, borders and responsive layout.
Use the native naming-table results as an independent composition oracle, real
module handlers with isolated documents/receipts, and mounted phone/desktop
consumers. Validate denied ownership, absent sources, duplicate/uncertain posts,
sanitized content, unchanged inventory and retired UI callbacks.

## Scope decisions retained

Potion mixing remains deferred as a separate optional procedure. Table/PDF import
remains deferred pending SDK storage/write capability investigation. Hidden-item
authoring was declined November3. None is part of this implementation or a
release blocker. ADR-0009's completed treasure-building scope remains intact.

## Verification — November4

- Native 4.0.6 naming-table composition passes against the existing pack fixtures;
  GM/source refusal and unchanged draft/inventory/library behavior are covered by
  the maintained treasure suite.
- Action-phase suite: 38/38 checks pass, including exact current content,
  sanitization/alternate-identity omission, owner denial, changed source/context,
  unchanged resources, and uncertain-post replay without a duplicate.
- Mounted action/card suite: 12/12 pass, including sharing at 390/1000px, observer
  omission, stable retry identity on local HTTP and retired pending callbacks.
- Mounted treasure flows pass at 390/1000px, including suggestion, dismiss/apply,
  retained original name and no library or Actor write while naming. Screenshots
  were inspected for the existing paper/input/button layout.
- Explicit module/UI/migration typing and module packaging pass. The isolated
  build initially needed its toolchain dependencies and a real module copy
  instead of a symlink to satisfy migration confinement; no application fix or
  security bypass was needed.
- The extracted archive's actual UI bundle, generated Tailwind and presentation
  stylesheet pass the maintained treasure browser workflows at 390/1000px,
  including the new suggestion/apply controls. Source card screenshots were
  inspected at both widths; native presentation was left to user review.

These are isolated source, browser and archive checks. No live Foundry chat was
posted and no live Actor was changed by these checks.

On November 4 the user confirmed the current work works as expected and requested
a checkpoint commit. Naming and card sharing are accepted. This user report is
separate from the isolated automated evidence above; no additional native run
is claimed.
