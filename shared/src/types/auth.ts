import type { ModuleKey, PermissionKey } from '../permissions';

export type AccessScope = 'own' | 'assigned' | 'team' | 'department' | 'all';

export type UserStatus = 'invited' | 'active' | 'suspended' | 'archived';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  status: UserStatus;
  roleSlugs: string[];
  permissions: PermissionKey[];
  moduleAccess: ModuleKey[];
  accessScope: AccessScope;
  preferredLanguage: string;
  timezone: string;
}

export interface LoginResponse {
  user: AuthUser;
  accessToken: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    requestId?: string;
  };
}

export interface ApiSuccess<T> {
  data: T;
  meta?: Record<string, unknown>;
}
