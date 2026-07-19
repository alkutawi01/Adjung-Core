# ROUTING

Document ID: SPEC-005 Version: 1.0 (Draft) Status: Official Draft

Depends On: - SPEC-000 Adjung Constitution - SPEC-001 Product
Philosophy - SPEC-002 Architecture - SPEC-004 Navigation

# 1. Purpose

This document defines the routing philosophy and URL structure of
Adjung. Routes represent stable knowledge addresses rather than
implementation details.

# 2. Routing Philosophy

Every meaningful resource should have a permanent, human-readable URL.

URLs should remain stable over time to support citations, references,
and long-term preservation.

# 3. Route Categories

- Public Routes
- Authenticated Routes
- Author Workspace Routes
- Administration Routes
- System Routes

# 4. Core Resources

Primary routable resources include:

- User
- Biography
- Publication
- Note
- Essay
- Folio
- Collection
- Tag
- Search
- Editorium

# 5. Canonical URLs

Each resource must have a single canonical URL.

Alternative paths should redirect to the canonical address.

# 6. Route Design Principles

- Human-readable
- Predictable
- Consistent
- Permanent
- Technology-independent

# 7. Resource Relationships

Routes should reflect logical knowledge relationships rather than
database relationships.

# 8. Reserved Paths

System-reserved paths must never be assignable as usernames or
publication identifiers.

Examples include:

/admin /api /search /settings /login /register

# 9. Future Expansion

The routing model should allow future modules without breaking existing
URLs.

------------------------------------------------------------------------

End of Draft.

The final edition will define URI conventions, permalink policy, slug
standards, redirects, localization strategy, and routing governance.
