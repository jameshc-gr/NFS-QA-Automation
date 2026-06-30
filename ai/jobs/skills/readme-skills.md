# Skill Authoring Guide

Skills are compact, reusable operating procedures for recurring tasks.

## Naming

- Folder: `ai/agents/skills/<skill-name>/`
- File: `SKILL.md`

## Required Sections

- Frontmatter (`name`, `description`, `argument-hint`)
- When to Use
- Inputs
- Procedure
- Output Contract
- Guardrails

## Quality Checklist

- Procedure has 3-6 concrete steps
- Output contract is specific and testable
- No repo paths to deprecated locations
- Keeps operations narrow by default
- Uses repo-relative paths (for example `tests/projects/...`, `test-data/...`) without leading `/`

## Template

Use [ai/agents/skills/SKILL_TEMPLATE.md](ai/agents/skills/SKILL_TEMPLATE.md).
