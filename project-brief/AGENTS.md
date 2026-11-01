# Project Agent Instructions
Project folder: pi-monitor.
Existing root documentation to inspect: `../CLAUDE.md`, `../README.md`.

Status: Awaiting user interview. The workflow below is the requested starter policy; project-specific choices and commands remain pending.

## Before work

- Read this file before project changes.
- Read PRD.md in this folder before product changes, DESIGN_SYSTEM.md before UI changes, and ARCHITECTURE.md before structural, dependency, service, or data changes. Paths in this instruction refer to project-brief/ in the repository root.
- Preserve existing repository instructions, framework-generated blocks, components and documentation. Inspect source before proposing new tools or architecture.
- Complete the interview in order: PRD -> DESIGN_SYSTEM -> ARCHITECTURE -> AGENTS. Ask questions for ONE document, wait for answers, draft it, then move to the next. Do not invent user decisions or treat a scaffold as an approved brief.
- This documentation rollout is explicitly authorized before the interviews. Subsequent implementation depending on unanswered decisions requires those decisions first.

## Change workflow

- Use the established Notion personal-project task board. Create or select a task before each logical change, keep its status and validation current, and link related PRs.
- Keep unrelated work in separate tasks and PRs. For authorized publication, push a feature branch and open a PR targeting the integration branch; never push directly to main.
- Explain purpose, behavior, implementation, validation, risks, and task reference in each PR. Do not mark a task Done before its required acceptance and merge conditions are met.
- Reuse existing code and the approved design system. Handle loading, error and empty states where applicable. Keep behavior accessible and responsive when there is a UI.
- Keep secrets out of source and documentation. Validate inputs and enforce permissions. Do not assume a particular framework, database, or service.
- Update the affected brief and append its Timeline when approved decisions change. Keep facts separate from proposals.

## Project commands

Pending: inspect manifests and existing docs; confirm install, development, build, test and deployment commands. Do not invent scripts or run unreviewed installation commands.

## Interview questions — ask only after the first three documents

1. Which development/build/test commands and checks should be mandatory?
2. Which Notion project/task workflow, branch policy, and review/merge conditions should apply?
3. Which code conventions, documentation requirements, and existing instructions must be preserved?
4. Which security boundaries and operations need explicit approval?
5. Which unresolved decisions should block work, and which routine choices may Codex make?

## Timeline

- 2026-11-01: Created project agent workflow and interview scaffold.
