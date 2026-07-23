# Design QA

- Source visual truth: `/Users/tati/Downloads/homework_helper_interactive_prototype_v28.html`
- Implementation screenshots:
  - `qa-stage-1.png`
  - `qa-stage-2.png`
  - `qa-stage-3.png`
- Viewport: 390 × 844 CSS px
- Density normalization: source is an HTML/CSS reference rather than a raster image; implementation screenshots are 390 × 844 px at browser density 1.
- State: instruction, one example together, independent continuation.

## Full-view comparison evidence

The implementation carries over the reference flow and hierarchy:

1. “Убедитесь, что ребёнок понял задание”
2. “Разберите вместе один пример”
3. “Ребёнок продолжает самостоятельно”

The reference’s parent prompt pattern is preserved with a clear action label, a separate child-facing phrase, progressive help, and a persistent final memo. The existing product’s mobile navigation, task context, palette, and controls were preserved rather than importing the reference’s desktop chat shell.

## Focused comparison evidence

- Typography: headings remain the dominant element, child-facing phrases use regular weight, and small action labels are visually distinct.
- Spacing and layout: each screen has one main action region, one content focus, and persistent bottom actions without overlap at 390 × 844.
- Colors and tokens: existing blue/navy/soft-blue tokens are preserved; hints use the established warm support color.
- Image and icon quality: existing Phosphor icons are reused; no placeholder or newly drawn visual assets were introduced.
- Copy: stage titles match the reference logic. The child reads the recognized instruction, the parent guides only the first item, and the child continues without entering answers into the service.

## Interaction checks

- Stage 1 → “Ребёнок понял” → Stage 2.
- Stage 2 → “Получилось” → “Ребёнок продолжит сам” → Stage 3.
- Progressive help actions remain available.
- No answer-entry or answer-choice controls are present.
- Browser console warnings/errors checked: none.

## Findings

No actionable P0/P1/P2 issues found in the three tested flow states.

## Comparison history

- Initial implementation exposed an optional second jointly solved item, which contradicted the selected product logic.
- Fix: removed that branch and guaranteed the flow transfers responsibility after exactly one first item.
- Post-fix evidence: `qa-stage-2.png` and `qa-stage-3.png`.

## Follow-up polish

- P3: validate the same three screens with several long real OCR instructions after deployment.

final result: passed
