# AGENT GUIDE

This document defines how AI agents must operate within this project.
All rules are strict unless explicitly overridden by the user.

---

## 1. Project Overview

- Project: Desktop Music/Video Player
- Platform: Electron (desktop app)
- Goal: A modern, customizable media player with dynamic UI pages driven by user configuration

---

## 2. Tech Stack

- Desktop Framework: Electron
- Frontend: React
- Backend: Node.js (Electron main process)
- Language: TypeScript (assumed; follow if present)
- UI Styling: (follow existing setup; do not introduce new systems)

---

## 3. Core Principles

### 3.1 Full-Stack Feature Rule (CRITICAL)

Every feature must include:

- UI implementation (React)
- Backend logic (Electron/Node)
- Communication layer (IPC or equivalent)

DO NOT implement frontend-only or backend-only features unless explicitly instructed.

---

### 3.2 Dependency Control (STRICT)

- NEVER install or add new dependencies automatically
- NEVER modify `package.json` without explicit user approval
- If a dependency is needed:
  1. Explain why
  2. Suggest the package
  3. WAIT for confirmation

Violating this rule is a critical failure.

---

### 3.3 Scope Control

- Only modify files directly related to the task
- Do NOT refactor unrelated code
- Do NOT restructure the project unless explicitly asked

---

## 4. Architecture Guidelines

### 4.1 Separation of Concerns

- UI (React): presentation only
- Backend (Electron/Node): logic, file system, media handling
- Communication: handled via IPC layer

Business logic must NOT live inside React components.

---

### 4.2 IPC Communication

All UI ↔ backend interactions must:

- Use a clear, consistent IPC pattern
- Be typed (if TypeScript is used)
- Be centralized (avoid scattered IPC calls)

---

### 4.3 Config-Driven UI (IMPORTANT)

- UI pages will eventually be dynamically rendered from user configuration
- Components must be:
  - modular
  - reusable
  - decoupled from hardcoded routing

Avoid tightly coupling UI to fixed page structures.

---

## 5. UI/UX Requirements

### 5.1 Design

- Modern UI is required
- Default theme: DARK
- Clean, minimal, media-focused design

### 5.2 Component Rules (Very important)

- Prefer functional components
- Keep components small and reusable
- Avoid deeply nested structures

---

## 6. Coding Conventions

### Do

- Follow existing patterns in the codebase
- Use descriptive names
- Keep functions focused and small
- Reuse existing utilities and services

### Don’t

- Do NOT introduce new libraries
- Do NOT over-engineer abstractions
- Do NOT rewrite working code unnecessarily

---

## 7. File Structure (Follow Existing)

Typical expectations:

- `/ui` or `/renderer` → React frontend
- `/main` → Electron backend
- `/services` → shared logic / API layer
- `/ipc` → communication handlers

Do not change structure unless instructed.

---

## 8. How to Handle Tasks

### Step 1: Understand

- Analyze the request
- Identify UI + backend requirements

### Step 2: Plan (for non-trivial tasks)

Provide:

- Files to modify
- Approach
- Any assumptions

### Step 3: Implement

- Keep changes minimal
- Follow existing patterns
- Ensure UI + backend integration

---

## 9. Output Expectations

- Clean, readable, maintainable code
- No unnecessary comments
- No placeholder logic unless requested
- Fully working feature (UI + backend)

---

## 10. When You Need a Dependency

You MUST respond like this:

> This feature would benefit from [package name] because [reason].
> Do you want me to proceed with adding it?

Then STOP.

---

## 11. When Uncertain

- Ask for clarification
- Do NOT guess
- Do NOT invent requirements

---

## 12. Anti-Patterns to Avoid

- UI calling backend logic directly without IPC
- Hardcoded UI pages that cannot be made dynamic
- Adding state management libraries without approval
- Large, monolithic components
- Silent dependency installation

---

## 13. Preferred Behavior

- Be conservative with changes
- Be explicit with assumptions
- Prioritize consistency over cleverness

## 14. current project overview

- `pages` refer to the tabs of the app like `genres`, `artists`, `albums`, `playlists` that each are responsible to show specific type of things
- `config` refers to a json file saved in the appdata directory. it is responsible to save configs that are editable by user. These fields are not all neccessarilly editable currently by user but later on it will be defined.
- `cache` of the songs refers to a cache that is saved from all of the files of the library directories that is responsible to save their data so on startup, the `pages` data are loaded and user don't have to wait. though syncing and updating this cache will be done on startup asynchronously.