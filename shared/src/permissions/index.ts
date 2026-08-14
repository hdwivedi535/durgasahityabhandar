export const MODULES = [
  'books',
  'categories',
  'media',
  'customers',
  'enquiries',
  'communication',
  'macros',
  'automations',
  'website',
  'users',
  'roles',
  'reports',
  'settings',
] as const;

export type ModuleKey = (typeof MODULES)[number];

export const ACTIONS = {
  books: ['view', 'create', 'edit', 'archive', 'delete', 'publish', 'change_visibility'],
  categories: ['view', 'create', 'edit', 'reorder', 'publish', 'hide', 'archive', 'delete'],
  media: ['view', 'upload', 'edit', 'archive', 'delete'],
  customers: ['view', 'create', 'edit', 'merge', 'archive', 'delete'],
  enquiries: [
    'view',
    'create',
    'edit',
    'assign',
    'reassign',
    'reply',
    'internal_note',
    'change_status',
    'change_priority',
    'close',
    'reopen',
    'delete',
    'generate_ai',
  ],
  communication: ['view', 'send_email', 'send_whatsapp', 'retry', 'manage_templates'],
  macros: ['view', 'create', 'edit', 'delete', 'execute'],
  automations: ['view', 'create', 'edit', 'enable_disable', 'delete'],
  website: ['view', 'edit', 'publish', 'unpublish'],
  users: ['view', 'create', 'edit', 'disable', 'delete'],
  roles: ['view', 'create', 'edit', 'delete', 'assign_permissions'],
  reports: ['view', 'export'],
  settings: ['view', 'edit'],
} as const satisfies Record<ModuleKey, readonly string[]>;

export type ActionKey<M extends ModuleKey> = (typeof ACTIONS)[M][number];
export type PermissionKey = {
  [M in ModuleKey]: `${M}.${(typeof ACTIONS)[M][number]}`;
}[ModuleKey];

export const ALL_PERMISSIONS: PermissionKey[] = MODULES.flatMap((module) =>
  ACTIONS[module].map((action) => `${module}.${action}` as PermissionKey),
);

export const DEFAULT_ROLES = {
  SUPER_ADMIN: 'super-admin',
  ADMINISTRATOR: 'administrator',
  CRM_MANAGER: 'crm-manager',
  CRM_AGENT: 'crm-agent',
  VIEWER: 'viewer',
} as const;

export function permissionKey(module: ModuleKey, action: string): PermissionKey {
  return `${module}.${action}` as PermissionKey;
}
