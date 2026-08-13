import {
  ALL_PERMISSIONS,
  DEFAULT_ROLES,
  MODULES,
  type ModuleKey,
  type PermissionKey,
} from '@dsb/shared';
import mongoose, { Schema, type Document, type Types } from 'mongoose';
import type { AccessScope, UserStatus } from '@dsb/shared';

export interface IPermission extends Document {
  module: ModuleKey;
  action: string;
  key: PermissionKey;
  description: string;
}

const permissionSchema = new Schema<IPermission>(
  {
    module: { type: String, required: true, enum: MODULES },
    action: { type: String, required: true },
    key: { type: String, required: true, unique: true },
    description: { type: String, default: '' },
  },
  { timestamps: true },
);

export interface IRole extends Document {
  name: string;
  slug: string;
  description: string;
  isSystem: boolean;
  isActive: boolean;
  permissionIds: Types.ObjectId[];
  moduleAccess: ModuleKey[];
  createdBy?: Types.ObjectId;
}

const roleSchema = new Schema<IRole>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, default: '' },
    isSystem: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    permissionIds: [{ type: Schema.Types.ObjectId, ref: 'Permission' }],
    moduleAccess: [{ type: String, enum: MODULES }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  name: string;
  phone?: string;
  status: UserStatus;
  roleIds: Types.ObjectId[];
  teamIds: Types.ObjectId[];
  department?: string;
  accessScope: AccessScope;
  preferredLanguage: string;
  timezone: string;
  createdBy?: Types.ObjectId;
  lastLoginAt?: Date;
  refreshTokenHash?: string;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String },
    status: {
      type: String,
      enum: ['invited', 'active', 'suspended', 'archived'],
      default: 'active',
    },
    roleIds: [{ type: Schema.Types.ObjectId, ref: 'Role' }],
    teamIds: [{ type: Schema.Types.ObjectId, ref: 'Team' }],
    department: { type: String },
    accessScope: {
      type: String,
      enum: ['own', 'assigned', 'team', 'department', 'all'],
      default: 'all',
    },
    preferredLanguage: { type: String, default: 'en' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    lastLoginAt: { type: Date },
    refreshTokenHash: { type: String },
  },
  { timestamps: true },
);

userSchema.index({ status: 1 });

export const Permission = mongoose.model<IPermission>('Permission', permissionSchema);
export const Role = mongoose.model<IRole>('Role', roleSchema);
export const User = mongoose.model<IUser>('User', userSchema);

export { ALL_PERMISSIONS, DEFAULT_ROLES };
