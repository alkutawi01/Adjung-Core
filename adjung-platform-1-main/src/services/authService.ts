import { db } from '../db/mockDb';
import { User, UserRole, RolePermissions, SystemSettings } from '../types';

// ==========================================
// 1. User Repository (Unified Lookup Engine)
// ==========================================
export class UserRepository {
  /**
   * Retrieves all users currently in the database.
   */
  static getAllUsers(): User[] {
    return db.getUsers();
  }

  /**
   * Resolves a user by their unique database ID.
   */
  static getUserById(id: string): User | undefined {
    return db.getUserById(id);
  }

  /**
   * Resolves a user by their username or email (case-insensitive, normalized).
   */
  static getUserByUsernameOrEmail(identifier: string): User | undefined {
    const normalized = identifier.trim().toLowerCase();
    return db.getUsers().find(u => 
      u.username.toLowerCase() === normalized || 
      u.email.toLowerCase() === normalized
    );
  }

  /**
   * Updates a user record in the database.
   */
  static updateUser(user: User): void {
    db.updateUser(user);
  }
}

// ==========================================
// 2. RBAC Service (Role-Based Access Control)
// ==========================================
export class RbacService {
  /**
   * Checks if a user has a specific permission based on their role and current system settings.
   */
  static hasPermission(user: User | null, permissionKey: keyof RolePermissions, systemSettings: SystemSettings): boolean {
    const role: UserRole = user ? user.role : 'Visitor';
    const permissions = systemSettings.rolePermissions?.[role];
    if (!permissions) return false;
    return permissions[permissionKey] ?? false;
  }
}

// ==========================================
// 3. Session Service (State Preservation & Audit)
// ==========================================
export class SessionService {
  private static SESSION_KEY = 'Adjung_session_user_id';

  /**
   * Starts a session by storing the user ID and user data.
   */
  static createSession(user: User, rememberMe: boolean = true): void {
    const storage = rememberMe ? localStorage : sessionStorage;
    const otherStorage = rememberMe ? sessionStorage : localStorage;
    
    otherStorage.removeItem(this.SESSION_KEY);
    otherStorage.removeItem('Adjung_session_user_data');

    storage.setItem(this.SESSION_KEY, user.id);
    storage.setItem('Adjung_session_user_data', JSON.stringify(user));
  }

  /**
   * Ends the session in both storages.
   */
  static destroySession(): void {
    localStorage.removeItem(this.SESSION_KEY);
    localStorage.removeItem('Adjung_session_user_data');
    sessionStorage.removeItem(this.SESSION_KEY);
    sessionStorage.removeItem('Adjung_session_user_data');
  }

  /**
   * Retrieves and automatically audits the current session.
   */
  static validateAndRetrieveSession(): User | null {
    const userId = localStorage.getItem(this.SESSION_KEY) || sessionStorage.getItem(this.SESSION_KEY);
    if (!userId) return null;

    const cachedUserStr = localStorage.getItem('Adjung_session_user_data') || sessionStorage.getItem('Adjung_session_user_data');
    if (cachedUserStr) {
      try {
        const cachedUser = JSON.parse(cachedUserStr);
        if (cachedUser.suspended) {
          this.destroySession();
          return null;
        }
        return cachedUser;
      } catch (e) {
        this.destroySession();
        return null;
      }
    }
    return null;
  }
}

// ==========================================
// 4. Authentication Service (Pipeline Implementation)
// ==========================================
export type AuthErrorType = 'UserNotFound' | 'IncorrectPassword' | 'AccountSuspended';

export class AuthError extends Error {
  constructor(public type: AuthErrorType, message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export class AuthService {
  /**
   * Standard sign-in pipeline calling Express backend.
   */
  static async signIn(usernameOrEmailInput: string, passwordInput: string, rememberMe: boolean = true): Promise<User> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        usernameOrEmail: usernameOrEmailInput,
        password: passwordInput
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new AuthError(data.error || 'UserNotFound', data.message || 'Authentication failed.');
    }

    SessionService.createSession(data.user, rememberMe);
    return data.user;
  }

  /**
   * Sign-in via Fast-Login Preset.
   */
  static async signInWithPreset(username: string): Promise<User> {
    return this.signIn(username, 'password', true);
  }

  /**
   * Reset password method.
   */
  static async resetPassword(email: string, newPasswordInput: string): Promise<void> {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        password: newPasswordInput
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Password reset failed.');
    }
  }

  /**
   * Sign-out helper.
   */
  static signOut(): void {
    SessionService.destroySession();
  }
}
