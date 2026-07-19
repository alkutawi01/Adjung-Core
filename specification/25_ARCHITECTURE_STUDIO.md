# SPEC-025: Architecture Studio (Digital Twin & Single Source of Truth)

## 1. Purpose
The Architecture Studio is the conceptual blueprint and development control center for the Adjung platform. It serves as a live Digital Twin and the Single Source of Truth (SSoT) for platform topology, metadata schemas, lifecycle flows, and impact analysis. It is designed to bridge the gap between abstract design specifications, relational database schemas, and active user interface layers.

## 2. Philosophy & Principles
* **Specification-First:** The system architecture is guided by human-written specifications, not reverse-engineered from source code ASTs. Code is merely an implementation detail of the knowledge model.
* **Semantic Knowledge Mapping:** System nodes map concepts (e.g., *Publication*, *Author*, *RBAC*) and their relationship lines (e.g., *governed by*, *protected by*, *displayed in*) rather than physical file dependencies.
* **Transparency & Implication:** Modifying one concept has trace-effects. Every element in Adjung has a clear purpose, ownership, and side-effect mapping.
* **Living Documentation:** All architectural changes dynamically reflect specifications, and vice versa, minimizing documentation rot.

## 3. The Conceptual Knowledge Model

### 3.1 Entities
1. **Publication (Abstract Class)**
   * *Purpose:* Core document node of the repository.
   * *Subtypes:* `Note`, `Essay`, `Article`, `Notice`, `Editor's Note`.
   * *Governed by:* `Editorium`
   * *Authored in:* `Writing Desk`
2. **Author**
   * *Purpose:* Scholarly contributor and owner of private key identity.
   * *Has:* `Folio`, `Biography`
3. **Writing Desk**
   * *Purpose:* Authoring workspace for composing rich markdown or structured XML.
4. **Editorium**
   * *Purpose:* Editorial board workspace for platform configuration and discovery curations.
5. **Frontpage**
   * *Purpose:* Public discovery portal displaying curated lists and announcement banners.
6. **Folio**
   * *Purpose:* Chronological timeline and scholarly archive of a single Author.
7. **RBAC Policies (Access Control)**
   * *Purpose:* Access permission system mapping roles (Guest, Writer, Editor, Chief Editor) to operations.

### 3.2 Relation Matrix
* `Publication` ➔ *belongs to* ➔ `Author`
* `Publication` ➔ *edited by* ➔ `Writing Desk`
* `Publication` ➔ *governed by* ➔ `Editorium`
* `Publication` ➔ *displayed in* ➔ `Frontpage` / `Folio`
* `Publication` ➔ *protected by* ➔ `RBAC Policies`

## 4. The Presentation Matrix
A central reference blueprint mapping where and how each publication type is represented on the platform:

| Publication Type | Writing Desk | Publication Page | Frontpage | Folio | Biography | Search | Archive | PDF |
|---|---|---|---|---|---|---|---|---|
| **Note** | Full Text Canvas | Full Page View | Card | Compact Card | List Entry | Result | Yes | Yes |
| **Essay** | Full Text Canvas | Full Page View (Margins) | Featured Card | Featured Card | List Entry | Result | Yes | Yes |
| **Article** | Split Block Editor | Split Multi-Column View | Card | Grid Card | List Entry | Result | Yes | Yes |
| **Notice** | Rich Editor | Full Page Notification | Banner Header | No | No | Result | Yes | Yes |
| **Editor's Note** | Rich Editor | Editorial Column | Excerpt Highlight| No | No | Result | Yes | Yes |

## 5. Impact Analysis Protocol
When any architectural concept is updated or proposed for deletion, the studio triggers a simulation of the downstream components affected:
* **Biography Modification:** Impacts `Profile`, `Publication`, `Folio`, `Search`, `Metadata`, `Routes`, `API`, `Database`, `Permissions`.
* **Publication Modification:** Impacts `Folio`, `Writing Desk`, `Frontpage`, `Search Index`, `Citation Engine`, `Export module`.

## 6. Implementation & Roadmap
* **Phase 1 (Knowledge Model):** Concept definitions and relationship matrix established (Current).
* **Phase 2 (Visual Architecture):** Interactive semantic mapping using `@xyflow/react` nodes (Current).
* **Phase 3 (Impact Analysis):** Dynamic side-effect simulation and warning panels (Current).
* **Phase 4 (AI Design Assistant):** AI-guided design proposals based on current topology constraints.
* **Phase 5 (AI Code Generation):** Automated code patch outputs based on SSoT blueprints.
