import {
  ACTIONS,
  ALL_PERMISSIONS,
  DEFAULT_ROLES,
  MODULES,
  type ModuleKey,
} from '@dsb/shared';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { Permission, Role, User } from '../models/user.model';
import { hashPassword } from '../utils/password';

async function seedPermissions() {
  for (const module of MODULES) {
    for (const action of ACTIONS[module as ModuleKey]) {
      const key = `${module}.${action}`;
      await Permission.findOneAndUpdate(
        { key },
        {
          module,
          action,
          key,
          description: `${action} ${module}`,
        },
        { upsert: true, new: true },
      );
    }
  }
  return Permission.find({});
}

async function seedRoles(allPermissions: Awaited<ReturnType<typeof seedPermissions>>) {
  const allIds = allPermissions.map((p) => p._id);

  const superAdmin = await Role.findOneAndUpdate(
    { slug: DEFAULT_ROLES.SUPER_ADMIN },
    {
      name: 'Super Admin',
      slug: DEFAULT_ROLES.SUPER_ADMIN,
      description: 'Full platform access',
      isSystem: true,
      isActive: true,
      permissionIds: allIds,
      moduleAccess: [...MODULES],
    },
    { upsert: true, new: true },
  );

  const viewerPerms = allPermissions.filter((p) => p.action === 'view').map((p) => p._id);

  await Role.findOneAndUpdate(
    { slug: DEFAULT_ROLES.VIEWER },
    {
      name: 'Viewer',
      slug: DEFAULT_ROLES.VIEWER,
      description: 'Read-only access',
      isSystem: true,
      isActive: true,
      permissionIds: viewerPerms,
      moduleAccess: [...MODULES],
    },
    { upsert: true, new: true },
  );

  return superAdmin;
}

async function seedSuperAdmin(superAdminRole: Awaited<ReturnType<typeof seedRoles>>) {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@dsb.local';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123456';

  const existing = await User.findOne({ email });

  if (existing) {
    existing.passwordHash = await hashPassword(password);
    await existing.save();
    console.log(`Super admin password updated: ${email}`);
    return;
  }

  const passwordHash = await hashPassword(password);
  await User.create({
    email,
    passwordHash,
    name: 'Super Admin',
    status: 'active',
    roleIds: [superAdminRole._id],
    accessScope: 'all',
    preferredLanguage: 'en',
    timezone: 'Asia/Kolkata',
  });

  console.log(`Super admin created: ${email}`);
  console.log(`Temporary password: ${password}`);
}

async function main() {
  console.log('Seeding database...');
  await connectDatabase();

  const permissions = await seedPermissions();
  console.log(`Permissions: ${permissions.length} (expected ${ALL_PERMISSIONS.length})`);

  const superAdminRole = await seedRoles(permissions);
  await seedSuperAdmin(superAdminRole);

  console.log('Seed complete.');
  await disconnectDatabase();
}

main().catch(async (err) => {
  console.error(err);
  await disconnectDatabase();
  process.exit(1);
});
