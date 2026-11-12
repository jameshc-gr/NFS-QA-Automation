---
name: figma-regression-testing
description: "Compare an approved Figma design and its text, components, layout, and tokens with controlled web or mobile UI evidence."
argument-hint: "Provide a Figma design URL with a file key and node ID, the app/build, and the target flow or screenshot."
---

# Figma Regression Testing

## When to Use
- Validating implementation against an approved Figma file or design-system update.
- Extracting expected UI copy, CTA labels, component variants, colors, spacing, or layout.
- Comparing a controlled application screenshot with a design reference.

## Inputs
- Figma design URL/file key and a concrete page/frame/node ID.
- Target platform, app build, locale, viewport/device, and flow state.
- Existing project folder for expected-state fixtures and evidence.

## Procedure
1. Confirm Figma MCP access and the exact design file/node. Read metadata first,
   then traverse pages, frames, components, and variants using returned node
   IDs. Keep a visited/unvisited list; mark the crawl partial if access,
   pagination, or tool limits prevent full coverage.
2. For each in-scope frame, capture node IDs and names, visible copy, CTA
   labels, UI    labels, validation/error messages, component variants, and available layout
   properties, including auto-layout direction, alignment, padding, gap, and
   resizing rules when returned. Use variable definitions for colors, spacing,
   typography, and other design tokens. Separate explicit design values from
   measurements inferred from geometry.
3. Save a versioned expected-state record in the existing project's
   `test-data/` area. Include design URL, file/node IDs, revision/date, locale,
   viewport, extracted strings/tokens, source confidence, and any omissions.
   Do not copy restricted/private design content outside approved storage.
4. Run the existing application flow at the matching locale and viewport.
   Prefer accessibility-tree/source text for exact strings; capture screenshots
   only to an explicit path under `test-results/<YYYY-MM-DD>/<project>/<run>/`.
5. Compare the same state and viewport with the repository's Playwright
   snapshot tooling or approved image comparator. Report missing/extra CTAs,
   text mismatches, colors, icons, alignment, spacing, and layout shifts with
   Figma node IDs and screenshot evidence. Do not silently update baselines.

## Output Contract
- Figma file and all visited/unvisited node IDs.
- Extracted strings, CTAs, labels, errors, variables, and layout values with
  source node references.
- Matched/mismatched/blocked result by frame and locale.
- Explicit screenshot and report paths under `test-results/`.
- Confidence and limitations; no claim of full crawl if any page or variant
  was inaccessible or unvisited.

## Guardrails
- Never use a guessed file key/node ID or claim completeness from one selected
  frame.
- Preserve approved design references and app evidence in their repository
  areas; do not place generated screenshots in `test-data/`.
- Do not replace expected design data or visual baselines without review.
- Treat Figma screenshots as references, not as the only source for accessible
  text or interaction behavior.
