# DEVELOPMENT ROADMAP

Document ID: SPEC-099 Version: 1.0 (Draft) Status: Official Draft  
Depends On: SPEC-000 (Adjung Constitution), SPEC-001 (Product Philosophy), SPEC-002 (Architecture)

## 1. Purpose

This document establishes the official step-by-step Development Roadmap for the Adjung platform. Starting from the current monolithic prototype, it maps the path to a production-ready, stable, and constitutionally-aligned knowledge publishing ecosystem.

---

## 2. Phase 1: Architectural Foundation & Monolith Decomposition

### Objective
Deconstruct the current 3,002-line `App.tsx` monolith into decoupled, single-responsibility domain modules, establish clean state management boundaries, and initialize the automated testing framework.

### Features
* **Component Extraction**: Separate UI layout code, the editor, the admin settings panel, and public lists into their own file structures under `src/components/` and `src/views/`.
* **State Management Layer**: Implement a clean React Context or lightweight global state store (e.g., Zustand) to eliminate 13-level prop drilling.
* **Module Boundary Isolation**: Restructure domains (Identity, Publication, Editorial, Knowledge, Discovery) so they communicate strictly via typed TypeScript interfaces rather than coupled inline state setters.
* **Dead Code Cleanup**: Delete unused skeletal imports (`FolioTimeline.tsx`, `WritingDesk.tsx`) to stabilize the compilation tree.
* **Unit Testing Setup**: Install and configure Vitest and React Testing Library to ensure a base test coverage gate for all core logical utilities.

### Dependencies
* None (starts directly from the current codebase)

### Estimated Complexity
* **High** (Significant architectural refactoring without breaking existing user flows)

### Rationale for Ordering
We cannot build database integrations, complex schemas, or custom routers inside a massive single-file monolith. Cleaning the code architecture is an absolute prerequisite to prevent permanent technical debt.

---

## 3. Phase 2: Stable Routing & Subdomain Topology

### Objective
Introduce stable, permanent, and human-readable URLs to fulfill the core constitutional promise of permanent scholarly addresses, separating the main ecosystem portal from author workspaces.

### Features
* **Routing Library Integration**: Integrate a robust routing library (e.g., TanStack Router or React Router).
* **Per-Author Subdomains**: Implement routing middleware to parse and map `username.Adjung.com` requests directly to that author's Folio and Biography views.
* **Portal and Site Separation**: Decouple the landing page/frontpage (`Adjung.com`) so it acts strictly as the discovery portal, separate from individual author domains.
* **Canonical URL Generation**: Dynamically generate permanent, citable canonical URLs for every Note, Essay, and Article.
* **Reserved Paths**: Protect system paths (`/admin`, `/api`, `/search`, `/settings`, `/login`, `/register`) to prevent authors from claiming them as usernames.

### Dependencies
* Phase 1 (Clean component architecture makes route mappings straightforward)

### Estimated Complexity
* **High** (Requires local subdomain proxy configurations and router integration)

### Rationale for Ordering
A citable knowledge repository requires permanent, unchangeable links. Designing database entries and index structures depends on the schema of these URLs; routing must therefore precede the storage transition.

---

## 4. Phase 3: Relational Storage & Backend Migration

### Objective
Migrate data persistence from unstable, size-limited browser `localStorage` to a secure, normalized, server-side relational database.

### Features
* **Database Selection & Setup**: Integrate a relational database (PostgreSQL or SQLite) to guarantee referential integrity.
* **API Development**: Transition the simulated Express mock endpoints in the codebase into a real server-side REST/GraphQL API.
* **Schema Normalization**: Implement the normalized entities (Users, Biography, Publication, Collections, References, and Editorial Records) with explicit foreign keys.
* **Cascade Deletion Policies**: Establish soft-delete and archival constraints to enforce long-term intellectual record preservation.
* **Secure Authentication**: Implement server-side session management (cookie/token-based) and hash passwords using BCrypt, replacing plaintext localStorage storage.

### Dependencies
* Phase 3 (API routes must match the new routing topology)

### Estimated Complexity
* **High** (Requires backend server configuration, database modeling, and secure authentication flows)

### Rationale for Ordering
Advanced publishing features (such as version history, reference cross-indexing, and editorial logs) are physically impossible to store cleanly in a 5MB local storage sandbox.

---

## 5. Phase 4: Scholarly Publication Model & Citations

### Objective
Upgrade the editor and publication metadata schemas to support structured scholarly formatting, version control, and formal citation management.

### Features
* **Rich Text Enhancements**: Extend the editor to support H2/H3 headings, lists, tables, and inline figure/image integration.
* **Version History Engine**: Save and expose incremental publication revisions, allowing readers to view previous editions of an Article or Essay.
* **Citation & Reference System**: Build an in-editor citation manager allowing authors to link inline tags to a structured bibliography.
* **Language Metadata**: Add explicit metadata to support multilingual tagging, enabling correct layout presentation (e.g., RTL for Arabic).
* **Autosave Implementation**: Enable debounced workspace autosaving to prevent author data loss.

### Dependencies
* Phase 3 (Version history, references, and rich text document storage require a real database)

### Estimated Complexity
* **Medium** (Focuses primarily on editor improvements and API extension)

### Rationale for Ordering
Before we can build an editorial review workflow or index content for discovery, the core publication object must support the structured elements (headings, citations, revisions) that editors review.

---

## 6. Phase 5: The Editorium & Access Control

### Objective
Fulfill SPEC-011 and SPEC-014 by implementing standard RBAC roles, access policies, and the complete editorial review workflow.

### Features
* **RBAC Realignment**: Define and enforce the missing `Reviewer` and `Moderator` roles in the access control layer.
* **Editorial Review Pipeline**: Implement the review dashboard where submissions pass from Author submission to Reviewer feedback, Author revision, Editor approval, and final publication.
* **Granular Access Policies**: Enforce `Private`, `Unlisted`, `Restricted`, and `Archived` visibility states on both Folios and Publications.
* **Per-Entry Editorial Log**: Store a permanent, read-only audit log detailing every review decision, revision request, and publication approval event.

### Dependencies
* Phase 4 (Requires fully versioned publications to attach review comments and track edits)

### Estimated Complexity
* **High** (Complex state machine for the submission pipeline combined with role-based restrictions)

### Rationale for Ordering
We must not index or search drafts or rejected works. The editorial gateway must be fully functional to dictate what content is legally "published" before we build the Discovery layer.

---

## 7. Phase 6: Semantic Indexing & Discovery Portal

### Objective
Deploy indexing and search technologies to make the platform's published work easily navigable and discoverable without relying on popularity metrics.

### Features
* **Full-Text Search Engine**: Implement an indexing search engine (e.g., Postgres Full-Text Search, Meilisearch) accessible from the Frontpage and directory views.
* **Topic Classification System**: Build a categorized taxonomy for organizing publications across the entire ecosystem.
* **Ecosystem Frontpage Completion**: Populate the portal with chronological recent publications, multi-item editorial selections, and topic-based discovery tags.
* **Scholarly Export & Interoperability**: Support XML, Markdown, and PDF schema serialization alongside machine-readable metadata headers (JSON-LD / Dublin Core) for academic indexing crawlers.

### Dependencies
* Phase 5 (The index must only crawl published works that have cleared the editorial workflow)

### Estimated Complexity
* **Medium** (Integration of search libraries and metadata formatters)

### Rationale for Ordering
Discovery and indexing rely on structured, versioned, and editorially validated content. Setting up the search engine earlier would index draft mock data that violates quality principles.

---

## 8. Phase 7: Context-Isolated AI Assistance

### Objective
Implement optional, human-in-the-loop AI utilities to assist authors, ensuring strict conformance to the AI constitutional rules (human authorship, zero auto-publishing, privacy boundaries).

### Features
* **Isolated Writing Assistant Panel**: Add an editor drawer that uses the Gemini API (`@google/genai`) to suggest grammar, style, translation, or outline enhancements.
* **Transparency Flagging**: Add an `aiAssisted` metadata field that displays a disclosure label on publications if AI assisted the workflow.
* **Privacy Isolation Boundaries**: Ensure that AI requests only contain context belonging to the currently authenticated author, preventing leakage of other authors' unpublished drafts.

### Dependencies
* Phase 4 (Needs editor rich text structure)
* Phase 5 (Needs RBAC governance rules)

### Estimated Complexity
* **Medium** (Mainly UI integration and API configuration)

### Rationale for Ordering
Per the Adjung Constitution, AI is an auxiliary tool, not a foundation. It must only be introduced once the core publishing, database, and permission systems are fully operational.

---

## 9. Development Governance Rules

To preserve long-term maintainability, the following principles must be enforced across all phases:

1. **Test-Driven Refactoring**: No refactoring of components may occur without writing corresponding regression tests first.
2. **Absolute Schema Decoupling**: Database schema alterations must be accompanied by versioned migrations.
3. **No Unstructured State**: Modifying global states must flow through designated state actions, never via direct prop-drilled setters.
4. **Accessibility First**: All new modals and interactive UI components must include ARIA roles (`role="dialog"`) and focus-trap compliance before pull requests can be approved.

---

End of Roadmap.
