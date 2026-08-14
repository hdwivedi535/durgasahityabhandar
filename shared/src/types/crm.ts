import type { LeadScoreDto } from './ai';

export type EnquirySource = 'website' | 'manual';

export type EnquiryMessageType = 'customer' | 'agent' | 'internal_note';

export type EnquiryMessageChannel = 'website' | 'crm';

export type CrmConfigKind = 'enquiryStatus' | 'enquiryPriority';

export interface CustomerLocation {
  city?: string;
  state?: string;
  address?: string;
}

export interface CustomerStats {
  totalEnquiries: number;
  openEnquiries: number;
}

export interface CustomerDto {
  id: string;
  customerNumber: string;
  businessName: string;
  contactName: string;
  country: string;
  phone: string;
  phoneNormalized: string;
  email?: string;
  emailNormalized?: string;
  preferredLanguage: string;
  location: CustomerLocation;
  tags: string[];
  stats: CustomerStats;
  needsReview: boolean;
  mergedIntoId?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerEventDto {
  id: string;
  customerId: string;
  eventType: string;
  actorId?: string;
  actorName?: string;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface CustomerMatch {
  customer: CustomerDto;
  score: number;
  reasons: string[];
}

export interface CrmConfigDto {
  id: string;
  kind: CrmConfigKind;
  slug: string;
  name: string;
  color: string;
  displayOrder: number;
  isActive: boolean;
  isPublic: boolean;
  isTerminal: boolean;
  publicLabel?: string;
}

export interface EnquiryDto {
  id: string;
  enquiryNumber: string;
  customerId: string;
  customer?: CustomerDto;
  source: EnquirySource;
  statusId: string;
  status?: CrmConfigDto;
  priorityId: string;
  priority?: CrmConfigDto;
  assignedUserId?: string;
  assignedUserName?: string;
  contactName: string;
  company: string;
  country: string;
  phone: string;
  phoneNormalized: string;
  email?: string;
  emailNormalized?: string;
  message: string;
  interestedBookIds: string[];
  interestedCategoryIds: string[];
  requirementText?: string;
  subject: string;
  nextFollowUpAt?: string;
  needsReview: boolean;
  tags: string[];
  isArchived: boolean;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
  leadScore?: LeadScoreDto;
}

export interface EnquiryMessageDto {
  id: string;
  enquiryId: string;
  type: EnquiryMessageType;
  channel: EnquiryMessageChannel;
  content: string;
  authorId?: string;
  authorName: string;
  createdAt: string;
}

export interface EnquiryEventDto {
  id: string;
  enquiryId: string;
  eventType: string;
  actorId?: string;
  actorName?: string;
  data: Record<string, unknown>;
  createdAt: string;
}

export type TimelineItem =
  | { kind: 'message'; item: EnquiryMessageDto }
  | { kind: 'event'; item: EnquiryEventDto };

export interface EnquiryDetailDto extends EnquiryDto {
  timeline: TimelineItem[];
}

export interface CustomerDetailDto extends CustomerDto {
  timeline: CustomerEventDto[];
  recentEnquiries: EnquiryDto[];
}

export interface CustomerListResult {
  items: CustomerDto[];
  total: number;
}

export interface EnquiryListResult {
  items: EnquiryDto[];
  total: number;
}

export interface EnquiryDashboardCounts {
  byStatus: Array<{ statusId: string; slug: string; name: string; count: number }>;
  unassigned: number;
  needsReview: number;
  followUpsDue: number;
}

export interface PublicEnquiryResult {
  enquiryNumber: string;
  needsReview: boolean;
}

export interface UserOptionDto {
  id: string;
  name: string;
}
