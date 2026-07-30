export const DEFAULT_RBAC_MATRIX = [
  {
    roleId: 'ketua_editor',
    roleName: 'Ketua Editor',
    isImmutableAdmin: true,
    permissions: {
      viewAll: true,
      editOwn: true,
      editAll: true,
      publish: true,
      reject: true,
      assignSlot: true,
      manageSettings: true,
      manageRbac: true
    }
  },
  {
    roleId: 'editor',
    roleName: 'Editor',
    isImmutableAdmin: false,
    permissions: {
      viewAll: true,
      editOwn: true,
      editAll: false,
      publish: true,
      reject: false,
      assignSlot: false,
      manageSettings: false,
      manageRbac: false
    }
  }
];

export function normalizeRoleId(role) {
  const clean = String(role || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
  if (clean.includes('ketua') || clean.includes('chief')) return 'ketua_editor';
  if (clean.includes('editor')) return 'editor';
  return clean || 'ketua_editor';
}

export function hasPermission(matrix, role, permKey) {
  const roleId = normalizeRoleId(role);
  if (roleId === 'ketua_editor') {
    return true;
  }
  if (!matrix || !Array.isArray(matrix)) {
    const defaultRow = DEFAULT_RBAC_MATRIX.find(r => r.roleId === roleId);
    return defaultRow ? defaultRow.permissions[permKey] : true;
  }
  const row = matrix.find(r => r.roleId === roleId);
  if (!row) return true;
  return Boolean(row.permissions[permKey]);
}
