---
name: localization-testing
description: "Validate translated UI, locale formatting, directionality, and rendered text against translation resources and approved designs."
argument-hint: "Provide the app/build, target locales, translation resources, Figma reference, and supported test flows."
---

# Localization Testing

## When to Use
- Testing English, Spanish, French, German, or Japanese UI.
- Comparing translation resources, approved Figma copy, and rendered application UI.
- Finding missing/mixed/hardcoded text, clipping, RTL defects, or locale-formatting
  regressions.

## Inputs
- App/build, environment, locale, device/viewport, and test flow.
- Translation resources and fallback-language rules.
- Optional Figma file/node references and approved expected strings.

## Procedure
1. Build a source-of-truth string inventory from the translation files and
   approved Figma nodes. Record keys, locale, source text, translation, and
   provenance. Do not infer missing translations from machine translation.
2. Select the requested locale explicitly and execute the narrowest applicable
   flow. Capture the accessibility tree or native page source and visible UI
   text. Use OCR only when available and record its confidence; otherwise flag
   image-only text as unverified.
3. Compare resource keys, Figma text, and runtime text. Report missing
   translations, unexpected fallback, mixed languages, likely hardcoded copy,
   incorrect punctuation/casing, and untranslated CTA/error text.
4. Check constrained layouts for truncation, overlap, clipping, and expansion
   in French/German/Japanese. Check RTL direction, alignment, reading/focus
   order, and mirrored icons when an RTL locale is in scope.
5. Verify currency, dates, numbers, and separators against the selected locale
   and product requirements; test boundary values and timezone-sensitive dates.
   Save reports and captures only beneath dated `test-results/`.

## Output Contract
- Locale and platform/build matrix with tested screens/flows.
- String-key differences categorized as missing, mixed, fallback, hardcoded
  candidate, or expected platform variation.
- Layout, RTL, currency/date/number results and evidence paths.
- Coverage gaps and confidence; an unvisited screen is not a pass.

## Guardrails
- Do not classify valid brand/product terms or approved untranslated phrases as
  defects without checking product rules.
- Do not edit translation source, account data, or production app settings as
  part of a test run.
- Do not assert visual text coverage when OCR/accessibility extraction was not
  available.
- Validate all supported locale formats from explicit product requirements;
  never assume one country's currency/date convention is universal.
