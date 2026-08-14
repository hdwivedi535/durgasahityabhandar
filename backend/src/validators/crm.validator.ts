import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const optionalEmail = z.preprocess(
  (v) => (v === '' || v == null ? undefined : v),
  z.string().email().optional(),
);

export const publicEnquirySchema = z.object({
  contactName: z.string().min(1).max(120),
  company: z.string().min(1).max(200),
  country: z.string().length(2).optional(),
  phone: z.string().min(5).max(30),
  email: optionalEmail,
  message: z.string().min(1).max(8000),
  interestedBookIds: z.array(objectId).optional(),
  interestedCategoryIds: z.array(objectId).optional(),
  requirementText: z.string().max(4000).optional(),
});

export const adminCustomerCreateSchema = z.object({
  businessName: z.string().min(1).max(200),
  contactName: z.string().min(1).max(120),
  country: z.string().length(2).optional(),
  phone: z.string().min(5).max(30),
  email: optionalEmail,
  preferredLanguage: z.string().min(2).max(5).optional(),
  location: z
    .object({
      city: z.string().max(80).optional(),
      state: z.string().max(80).optional(),
      address: z.string().max(300).optional(),
    })
    .optional(),
  tags: z.array(z.string().max(40)).optional(),
  forceCreate: z.boolean().optional(),
});

export const adminCustomerUpdateSchema = adminCustomerCreateSchema
  .omit({ forceCreate: true })
  .partial();

export const matchQuerySchema = z.object({
  phone: z.string().min(5).max(30),
  country: z.string().length(2).optional(),
  email: optionalEmail,
});

export const mergeSchema = z.object({
  sourceCustomerId: objectId,
});

export const adminEnquiryCreateSchema = z.object({
  customerId: objectId.optional(),
  forceCreate: z.boolean().optional(),
  contactName: z.string().min(1).max(120),
  company: z.string().min(1).max(200),
  country: z.string().length(2).optional(),
  phone: z.string().min(5).max(30),
  email: optionalEmail,
  message: z.string().min(1).max(8000),
  interestedBookIds: z.array(objectId).optional(),
  interestedCategoryIds: z.array(objectId).optional(),
  requirementText: z.string().max(4000).optional(),
  subject: z.string().max(200).optional(),
  assignedUserId: objectId.optional(),
  priorityId: objectId.optional(),
  nextFollowUpAt: z.string().min(1).optional(),
});

export const enquiryListQuerySchema = z.object({
  q: z.string().optional(),
  statusId: objectId.optional(),
  source: z.enum(['website', 'manual']).optional(),
  customerId: objectId.optional(),
  assignedUserId: z.string().optional(),
  needsReview: z.enum(['true', 'false']).optional(),
  followUpDue: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const customerListQuerySchema = z.object({
  q: z.string().optional(),
  needsReview: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const statusSchema = z.object({ statusId: objectId });
export const prioritySchema = z.object({ priorityId: objectId });
export const assignSchema = z.object({ userId: objectId.nullable() });
export const followUpSchema = z.object({ nextFollowUpAt: z.string().min(1).nullable() });
export const messageSchema = z.object({
  type: z.enum(['agent', 'internal_note']),
  content: z.string().min(1).max(8000),
});
export const enquiryUpdateSchema = z.object({
  subject: z.string().min(1).max(200).optional(),
  interestedBookIds: z.array(objectId).optional(),
  interestedCategoryIds: z.array(objectId).optional(),
  requirementText: z.string().max(4000).optional(),
  tags: z.array(z.string().max(40)).optional(),
});
