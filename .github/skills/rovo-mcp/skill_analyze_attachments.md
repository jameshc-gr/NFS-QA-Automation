Skill: Analyze Attachments (Vision + Heuristics)

Purpose: Given one or more attachments (screenshots, HTML, PDFs), run lightweight analysis and produce a UI summary useful for test authors and automation.

Capabilities:
- For PNG/JPEG screenshots: generate a short OCR/text summary and list visible elements via heuristics (use Appium MCP `appium_ai` when available).
- For HTML attachments: parse and extract key DOM IDs/classes and visible labels.
- For PDF attachments: extract text and screenshots of important pages.

Outputs:
- `uiSummary` (string) — short paragraph describing UI elements and notable visual cues.
- `suggestedLocators` ({strategy, selector, reason}[])
- `screenshots` — saved paths to cleaned screenshots for evidence.

Notes:
- Vision-based steps are optional and gated behind `AI_VISION_ENABLED` in Appium MCP. If disabled, produce best-effort text outputs.
