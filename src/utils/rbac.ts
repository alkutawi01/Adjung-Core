export {
  DEFAULT_RBAC_MATRIX,
  normalizeRoleId,
  hasPermission
} from '../../core/editorial/RbacEngine.js';

export interface RbacPermissions {
  viewAll: boolean;
  editOwn: boolean;
  editAll: boolean;
  publish: boolean;
  reject: boolean;
  assignSlot: boolean;
  manageSettings: boolean;
  manageRbac: boolean;
}

export interface RbacMatrixRow {
  roleId: string;
  roleName: string;
  isImmutableAdmin: boolean;
  permissions: RbacPermissions;
}
