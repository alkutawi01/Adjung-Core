# PUBLICATION MODEL

Document ID: SPEC-007  
Version: 1.1 (Draft)  
Status: Official Draft

Depends On: - SPEC-000 Adjung Constitution - SPEC-001 Product
Philosophy - SPEC-002 Architecture - SPEC-006 Identity System

# 1. Purpose

This document defines the official publication model of Adjung.

A publication is the fundamental knowledge object of the platform.

# 2. Publication Philosophy

Publishing is the act of creating durable knowledge.

Every publication should remain citable, attributable, and preservable.

# 3. Official Publication Types

Adjung officially recognises three publication types:

- Note
- Essay
- Article

No additional publication type shall be introduced without a formal
architectural decision.

## Note

A concise publication intended for ideas, reflections, observations,
annotations, or short knowledge sharing.

## Essay

A structured long-form publication intended for thoughtful discussion,
argument, analysis, or storytelling. Essays prioritise readability and
writing flexibility.

## Article

A formal publication intended for academic, technical, professional, or
research-oriented writing. Articles may require stricter structure,
section headings, references, citations, and editorial review.

# 4. Publication Lifecycle

States include:

- Draft
- Private
- Scheduled
- Published
- Updated
- Archived
- Withdrawn

# 5. Authorship

Every publication has one primary author.

Future versions may support multiple contributors while preserving
explicit attribution.

# 6. Versioning

Published works maintain revision history.

Readers should always be able to distinguish between editions.

# 7. Metadata

Every publication contains metadata including:

- Title
- Author
- Publication Date
- Last Updated
- Language
- Tags
- References
- Citation Information

# 8. Ownership

Authors retain ownership of their intellectual work subject to platform
governance and preservation policies.

# 9. Citation

Every publication shall have a permanent identifier and canonical URL.

# 11. Presentation Specifications (Universal Rendering Architecture)

To decouple content storage from presentation rendering contexts, Adjung utilizes a layered rendering architecture. Every publication type (Note, Essay, Article) is governed by an explicit `PresentationSpec` that defines its layout, typography, spacing, and visibility rules across all presentation contexts.

```
+-------------------------------------------------------------+
|                        CONTENT LAYER                        |
|   (Canonical Entry: Note, Essay, Article - Markdown/XML)   |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
|                     PRESENTATION LAYER                      |
| (Concrete Specifications: noteSpec, essaySpec, articleSpec) |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
|                       RENDERING LAYER                       |
|   (Production components: EntryRenderer, BiographyView)     |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
|                    APPLICATION CONTEXTS                     |
|  (Publication Canvas, Folio Card, Frontpage, Search Result) |
+-------------------------------------------------------------+
```

### 11.1 Note Specification (`noteSpec`)
* **Typography**: Serif body font (`font-serif`), distinct from standard interlinear notes.
* **Canvas Spacing**: Max-width `max-w-2xl` with a compact margins (`py-8 px-4 md:px-8`).
* **Visibility Rules**: 
  - `showTitle`: `false` (Canvas hides title to enforce compact note layout).
  - `showSignatureClosure`: `false` (Disable large formal signature stamp block).
  - `showNoteFooter`: `true` (Enable inline signature footer).
  - `showCitations`: `true`

### 11.2 Essay Specification (`essaySpec`)
* **Typography**: Serif body font with large signature scribble stamp style.
* **Canvas Spacing**: Max-width `max-w-3xl` with standard margins (`py-10 px-4 md:px-8`).
* **Visibility Rules**:
  - `showTitle`: `true`
  - `showSignatureClosure`: `true`
  - `showNoteFooter`: `false`

### 11.3 Article Specification (`articleSpec`)
* **Typography**: Serif body font with scholarly margins.
* **Canvas Spacing**: Max-width `max-w-4xl` with extra padding (`py-10 px-4 md:px-12`).
* **Visibility Rules**:
  - `showTitle`: `true`
  - `showSignatureClosure`: `true`
  - `showNoteFooter`: `false`
  - `showCitations`: `true`
  - `showFootnotes`: `true`

------------------------------------------------------------------------

End of Draft.

This version supersedes the previous skeleton by introducing the Layered Universal Rendering Architecture and official Presentation Specifications for Note, Essay, and Article archetypes.
