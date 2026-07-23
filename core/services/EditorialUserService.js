/**
 * EditorialUserService.js - Internal Newsroom Staff & RBAC Management Service
 * 
 * Manages Adjung Brief internal editorial staff profiles and enforces role-based
 * access controls (CHIEF_EDITOR, MANAGING_EDITOR, SENIOR_EDITOR, DESK_EDITOR, EDITORIAL_ASSISTANT, TECH_ADMIN).
 * 
 * NOTE: Adjung Brief does NOT share Adjung Platform user models (No Public Users/Writers).
 */

const EDITORIAL_ROLES = {
  CHIEF_EDITOR: {
    code: 'CHIEF_EDITOR',
    name: 'Ketua Editor',
    level: 100,
    permissions: ['ALL_PERMISSIONS', 'OVERRIDE_SLOTS', 'ASSIGN_SLOT_GOVERNANCE', 'MANAGE_RULES', 'MANAGE_USERS']
  },
  MANAGING_EDITOR: {
    code: 'MANAGING_EDITOR',
    name: 'Editor Pengurusan',
    level: 90,
    permissions: ['OVERRIDE_SLOTS', 'MANAGE_EDITIONS', 'APPROVE_CONTENT', 'MANAGE_RULES', 'MANAGE_SOURCES']
  },
  SENIOR_EDITOR: {
    code: 'SENIOR_EDITOR',
    name: 'Editor Kanan',
    level: 80,
    permissions: ['MANAGE_ASSIGNED_SLOTS', 'APPROVE_CONTENT', 'EDIT_CONTENT', 'MANAGE_SOURCES']
  },
  DESK_EDITOR: {
    code: 'DESK_EDITOR',
    name: 'Editor Desk',
    level: 70,
    permissions: ['MANAGE_DESK_CONTENT', 'APPROVE_DESK_CONTENT', 'EDIT_DESK_CONTENT']
  },
  EDITORIAL_ASSISTANT: {
    code: 'EDITORIAL_ASSISTANT',
    name: 'Pembantu Editorial',
    level: 50,
    permissions: ['REVIEW_QUEUE_SUBMIT', 'EDIT_CONTENT_DRAFT']
  },
  TECH_ADMIN: {
    code: 'TECH_ADMIN',
    name: 'Pentadbir Sistem',
    level: 100,
    permissions: ['MANAGE_SYSTEM_INFRASTRUCTURE', 'MANAGE_USERS', 'MANAGE_RULES']
  }
};

// Default system seed user for initial internal newsroom operation
const SYSTEM_CHIEF_EDITOR = {
  id: 'usr_editor_chief',
  username: 'chief_editor',
  fullName: 'Chief Editor Izzat',
  email: 'chief.editor@adjung.my',
  roleCode: 'CHIEF_EDITOR',
  role: EDITORIAL_ROLES.CHIEF_EDITOR,
  enabled: 1
};

class EditorialUserService {
  constructor(db) {
    this.db = db;
  }

  getRoles() {
    return EDITORIAL_ROLES;
  }

  getStaffById(userId) {
    if (!userId || userId === 'usr_editor_chief') {
      return SYSTEM_CHIEF_EDITOR;
    }
    try {
      const user = this.db.prepare('SELECT * FROM editorial_users WHERE id = ?').get(userId);
      if (!user) return SYSTEM_CHIEF_EDITOR;

      return {
        ...user,
        role: EDITORIAL_ROLES[user.roleCode] || EDITORIAL_ROLES.EDITOR
      };
    } catch (err) {
      return SYSTEM_CHIEF_EDITOR;
    }
  }

  hasPermission(userId, requiredPermission) {
    const staff = this.getStaffById(userId);
    if (!staff || !staff.role) return false;

    const perms = staff.role.permissions || [];
    return perms.includes('ALL_PERMISSIONS') || perms.includes(requiredPermission);
  }

  createRbacMiddleware(requiredPermission) {
    return (req, res, next) => {
      const staffId = req.headers['x-editorial-staff-id'] || 'usr_editor_chief';
      if (!this.hasPermission(staffId, requiredPermission)) {
        return res.status(403).json({
          error: 'ACCESS_DENIED',
          message: `Staf editorial (${staffId}) tidak mempunyai kebenaran: ${requiredPermission}`
        });
      }
      req.editorialStaff = this.getStaffById(staffId);
      next();
    };
  }
}

export {
  EDITORIAL_ROLES,
  SYSTEM_CHIEF_EDITOR,
  EditorialUserService
};
