import test from 'node:test';
import assert from 'node:assert/strict';
import { hasPermission, normalizeRoleId, DEFAULT_RBAC_MATRIX } from '../core/editorial/RbacEngine.js';

test('RBAC - normalizeRoleId identifies ketua_editor and editor correctly', () => {
  assert.equal(normalizeRoleId('KETUA_EDITOR'), 'ketua_editor');
  assert.equal(normalizeRoleId('Chief Editor'), 'ketua_editor');
  assert.equal(normalizeRoleId('EDITOR'), 'editor');
  assert.equal(normalizeRoleId('Editor'), 'editor');
});

test('RBAC - hasPermission allows immutable admin (ketua_editor) all actions', () => {
  assert.equal(hasPermission(DEFAULT_RBAC_MATRIX, 'KETUA_EDITOR', 'publish'), true);
  assert.equal(hasPermission(DEFAULT_RBAC_MATRIX, 'KETUA_EDITOR', 'manageSettings'), true);
  assert.equal(hasPermission(DEFAULT_RBAC_MATRIX, 'KETUA_EDITOR', 'manageRbac'), true);
});

test('RBAC - hasPermission evaluates matrix permissions dynamically for editor role', () => {
  const customMatrix = [
    {
      roleId: 'editor',
      roleName: 'Editor',
      isImmutableAdmin: false,
      permissions: {
        viewAll: true,
        editOwn: true,
        editAll: false,
        publish: false,
        reject: false,
        assignSlot: false,
        manageSettings: false,
        manageRbac: false
      }
    }
  ];

  assert.equal(hasPermission(customMatrix, 'EDITOR', 'publish'), false);
  assert.equal(hasPermission(customMatrix, 'EDITOR', 'viewAll'), true);
});
