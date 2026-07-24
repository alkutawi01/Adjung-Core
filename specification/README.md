# Adjung Specification

> ⚠️ **ARCHIVED — WRONG PROJECT. DO NOT USE FOR ADJUNG BRIEF / ADJUNG CORE WORK.**
>
> This folder describes **"Adjung Platform"** — a separate, unrelated scholarly-publishing
> product (author Folios, Biographies, personal sites, citation management, Reviewer/Editor
> RBAC). It was copied into this repository by accident in the initial commit, alongside a
> full duplicate codebase (`adjung-platform-1-main/`, since removed) that implemented it.
>
> **This repository is Adjung Core / Adjung Brief** — an internal newsroom editorial
> curation tool (public bento-grid frontpage + Editorium admin console). It is a different
> product with different domain concepts. None of these documents (Folio, Biography, Writing
> Desk, citation styles, scholarly RBAC, etc.) describe anything that exists or should be
> built here.
>
> For the real architecture, rules, and conventions of this project, read
> [`CLAUDE.md`](../CLAUDE.md) and [`.agents/AGENTS.md`](../.agents/AGENTS.md) at the repo
> root instead. If you are an AI agent working on this codebase: **ignore everything below
> this notice.**

---

Welcome to the official specification repository for **Adjung**.

This directory is the single source of truth for the design,
architecture, principles, and governance of the Adjung platform.

## Purpose

The specification exists to:

- Define the vision and philosophy of Adjung.
- Document architectural decisions.
- Provide implementation guidance.
- Maintain consistency across the platform.
- Preserve long-term product knowledge.

## Directory Structure

``` text
specification/
├── README.md
├── 00_ADJUNG_CONSTITUTION.md
├── 01_PRODUCT_PHILOSOPHY.md
├── ...
├── 22_AI_RULES.md
├── adr/
├── appendix/
└── diagrams/
```

## Reading Order

Read the documents in numerical order.

1.  Constitution
2.  Product Philosophy
3.  Architecture
4.  Domain Architecture
5.  Navigation
6.  Routing
7.  Identity System
8.  Publication Model
9.  Writing Desk
10. Folio
11. Biography
12. Editorium
13. Index
14. Frontpage
15. RBAC
16. Access Policy
17. XML Schema
18. Metadata
19. Database Model
20. UI System
21. Editorial Style
22. Terminology
23. AI Rules

## Specification Rules

- The Constitution has the highest authority.
- Product philosophy guides all design decisions.
- Architecture guides implementation.
- Source code must conform to the specification.
- Architectural changes should be documented through ADRs.

## Versioning

Current Status:

Adjung Official Specification v1.0 (Skeleton)

Future versions will progressively expand each specification without
changing its core intent.

------------------------------------------------------------------------

Copyright © Adjung Project
