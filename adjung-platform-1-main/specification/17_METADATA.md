# METADATA

Document ID: SPEC-017 Version: 1.0 (Draft) Status: Official Draft

Depends On: - SPEC-007 Publication Model - SPEC-012 Index - SPEC-016 XML
Schema

# 1. Purpose

This document defines the metadata model used throughout Adjung.

Metadata provides structured descriptive information that enables
discovery, citation, preservation, interoperability, and long-term
management of knowledge resources.

# 2. Philosophy

Metadata exists to describe knowledge, not to decorate it.

Every metadata element should have a clear purpose.

# 3. Objectives

The metadata system shall:

- Improve discoverability.
- Support citation.
- Enable indexing.
- Facilitate interoperability.
- Preserve long-term context.

# 4. Core Metadata

Common metadata includes:

- Identifier
- Title
- Subtitle
- Author
- Language
- Publication Date
- Last Updated
- Keywords
- Tags
- Abstract
- License

# 5. Extended Metadata

Optional metadata may include:

- DOI or external identifiers
- ORCID
- Institution
- Geographic coverage
- Time period
- Related works

# 6. Metadata Principles

- Consistent
- Machine-readable
- Human-readable
- Extensible
- Backward compatible

# 7. Single Source of Truth (SSoT) Metadata Architecture

Adjung strictly maintains that the Database/XML content serves as the Single Source of Truth (SSoT) for all metadata attributes. For example, a `Note` archetype may have a `title` property populated in the database. 

However, rendering contexts must select and apply metadata attributes according to their presentation specifications without duplicating, altering, or omitting fields in the database schema:

```
                  +--------------------------------+
                  |         DATABASE SSoT          |
                  |  - Note: { id, title: "..." }  |
                  +--------------------------------+
                                  |
                                  | (Read same canonical entry)
                                  v
           +---------------------------------------------+
           |           PRESENTATION LAYER SPECS          |
           |   Determines canvas visibility policies     |
           +---------------------------------------------+
             /                     |                   \
            /                      |                    \
           v                       v                     v
  +-----------------+     +-----------------+     +-----------------+
  |   Publication   |     |    Frontpage    |     |  Search Result  |
  |  `showTitle: F` |     |  `showTitle: T` |     |  `showTitle: T` |
  | (Hidden canvas) |     |  (Teaser card)  |     | (Results index) |
  +-----------------+     +-----------------+     +-----------------+
```

### 7.1 Metadata Rendering Decoupling
To prevent architectural drift:
1. **Canvas View**: The main document reading canvas applies `PresentationSpec.visibility` constraints (e.g. hiding the title for a `Note` to preserve an intimate reading experience).
2. **Directory / Index Views**: List directories, search results, and feed cards must render identifying properties (e.g. title) to facilitate discovery.
3. **No Context-Specific Hacks**: Components must never hardcode structural exclusions (e.g. `!isNote && title`). Instead, they must query `activeSpec.visibility` or the respective Presentation Spec parameters.

------------------------------------------------------------------------

End of Draft.

The final edition defines metadata schemas, validation rules, inheritance, interoperability mappings, and integration with the Presentation Layer and XML Schema configurations.
