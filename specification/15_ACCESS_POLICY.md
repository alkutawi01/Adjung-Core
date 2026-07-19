# ACCESS POLICY

Document ID: SPEC-015 Version: 1.0 (Draft) Status: Official Draft

Depends On: - SPEC-000 Adjung Constitution - SPEC-006 Identity System -
SPEC-007 Publication Model - SPEC-014 RBAC

# 1. Purpose

This document defines how access to resources is controlled throughout
Adjung.

It complements the RBAC specification by defining resource visibility,
sharing rules, and access decisions.

# 2. Philosophy

Knowledge should be open by default whenever appropriate, while
respecting author intent, privacy, security, and legal obligations.

# 3. Visibility Levels

Supported visibility levels include:

- Public
- Unlisted
- Private
- Restricted
- Archived

Each level has clearly defined access rules.

# 4. Access Principles

- Explicit access is preferred over implicit access.
- Authors control visibility unless governance policies require
  otherwise.
- Access decisions must be predictable and consistent.

# 5. Protected Resources

Protected resources may include:

- Draft publications
- Private Folios
- Editorial records
- Account settings
- Administrative interfaces

# 6. Sharing

Resources may be shared through:

- Public links
- Unlisted links
- Role-based access
- Institutional access (future)

# 7. Access Evaluation

Access decisions should consider:

- Resource visibility
- User authentication
- User role
- Ownership
- Policy exceptions

# 8. Security Principles

- Deny by default where appropriate.
- Minimise unnecessary exposure.
- Record critical access events when required.

# 9. Future Expansion

Future capabilities may include:

- Time-limited access
- Team workspaces
- Organization policies
- External collaborators
- Fine-grained permissions

------------------------------------------------------------------------

End of Draft.

The final edition will define authorization flows, policy precedence,
resource matrices, exception handling, audit requirements, and
integration with RBAC and Identity.
