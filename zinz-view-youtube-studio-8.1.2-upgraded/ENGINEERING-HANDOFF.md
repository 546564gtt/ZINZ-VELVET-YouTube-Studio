# ZINZ / VELVET 8.1.2 — Engineering handoff

## Source snapshot

- Source: user-provided `zinz-view-youtube-studio-8.1.0(2).zip`.
- Working baseline: 8.1.1 stability patch generated in this session.
- Evidence: local source inspection and dependency-free Node regression checks. No live Zen/Chrome browser session was available, so browser behavior remains unverified.

## Goal

Improve the extension's reliability and maintainability without removing existing YouTube / YouTube Music customization, color profiles, effects, or UI flows.

## This patch

- **P-01 / C-01 — Reject malformed scene frames atomically.** Non-finite pixel channel values must not enter statistics or temporal history.
- **P-02 / C-01 — Handle resolution changes safely.** Pixel-by-pixel motion comparisons require matching dimensions; a resolution change resets only incompatible motion history.
- **P-03 / C-02 — Keep a repeatable regression gate.** Tests cover invalid frames, recovery after rejected input, resolution changes, and finite statistics.

## Acceptance checks

- `node tests/analysis.test.js` passes.
- Every `.js` file passes `node --check`.
- `manifest.json` parses as JSON and its declared files exist.
- The ZIP contains `manifest.json` at its root and extracts without an extra nested directory.

## Next engineering sequence

1. Map every UI control to its storage key and runtime consumer; add tests for save/load and slider-to-effect wiring.
2. Review storage migrations, profile import/export validation, and rollback behavior for malformed JSON.
3. Profile GPU/CPU work in a real browser before optimizing; preserve current output as a baseline and measure frame-time impact.
4. Run browser acceptance tests on YouTube and YouTube Music, including SPA navigation, video start-up, popup closure, and DRM-protected content behavior.
5. Only release after the above checks are observed in the target browser.

## Exclusions and unknowns

This patch does not claim a complete UI redesign, prove every selector is wired, benchmark performance, or verify compatibility with the current Zen release. Those require additional targeted implementation and browser testing.

## Completion ledger

| Item | Status | Evidence | Remaining action |
|---|---|---|---|
| Scene-analysis hardening | Implemented in source | Regression tests | Review with live video frames |
| JavaScript syntax / manifest / archive checks | Pending final packaging | Run before delivery | Resolve any failures |
| Browser acceptance | Not run | No browser runtime evidence | Test unpacked extension in Zen |

[Explore Plan & Ship in Codelit](https://codelit.io/plan-and-ship)
