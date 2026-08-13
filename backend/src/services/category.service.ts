import mongoose from 'mongoose';
import type {
  CategoryArchiveInput,
  CategoryDto,
  CategoryStatus,
  CategoryTreeNode,
} from '@dsb/shared';
import { Category, type ICategory } from '../models/category.model';
import { Book } from '../models/book.model';

export class CategoryError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

function toDto(category: ICategory, bookCount?: number): CategoryDto {
  return {
    id: category._id.toString(),
    parentId: category.parentId?.toString() ?? null,
    ancestorIds: category.ancestorIds.map((id) => id.toString()),
    slug: category.slug,
    status: category.status,
    isVisible: category.isVisible,
    isFeatured: category.isFeatured,
    displayOrder: category.displayOrder,
    imageMediaId: category.imageMediaId?.toString(),
    iconMediaId: category.iconMediaId?.toString(),
    translations: category.translations,
    seo: category.seo,
    bookCount,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

async function computeAncestors(parentId: string | null): Promise<mongoose.Types.ObjectId[]> {
  if (!parentId) return [];
  const parent = await Category.findById(parentId);
  if (!parent) throw new CategoryError('PARENT_NOT_FOUND', 'Parent category not found');
  return [...parent.ancestorIds, parent._id];
}

async function wouldCreateCycle(categoryId: string, newParentId: string | null): Promise<boolean> {
  if (!newParentId) return false;
  if (categoryId === newParentId) return true;
  const parent = await Category.findById(newParentId);
  if (!parent) return false;
  return parent.ancestorIds.some((id) => id.toString() === categoryId);
}

async function updateDescendantAncestors(categoryId: string, ancestorIds: mongoose.Types.ObjectId[]) {
  const children = await Category.find({ parentId: categoryId });
  for (const child of children) {
    const newAncestors = [...ancestorIds, new mongoose.Types.ObjectId(categoryId)];
    child.ancestorIds = newAncestors;
    await child.save();
    await updateDescendantAncestors(child._id.toString(), newAncestors);
  }
}

export async function countBooksInCategory(categoryId: string): Promise<number> {
  return Book.countDocuments({ categoryIds: categoryId });
}

export async function listCategories(filters: {
  search?: string;
  status?: CategoryStatus;
  parentId?: string | null;
  publicOnly?: boolean;
}): Promise<CategoryDto[]> {
  const query: Record<string, unknown> = {};

  if (filters.publicOnly) {
    query.status = 'published';
    query.isVisible = true;
  } else if (filters.status) {
    query.status = filters.status;
  } else {
    query.status = { $ne: 'archived' };
  }

  if (filters.parentId === null) query.parentId = null;
  else if (filters.parentId) query.parentId = filters.parentId;

  if (filters.search) {
    query.$or = [
      { slug: { $regex: filters.search, $options: 'i' } },
      { 'translations.name': { $regex: filters.search, $options: 'i' } },
    ];
  }

  const categories = await Category.find(query).sort({ displayOrder: 1, createdAt: 1 });
  const counts = await Promise.all(
    categories.map((c) => countBooksInCategory(c._id.toString())),
  );
  return categories.map((c, i) => toDto(c, counts[i]));
}

export function buildCategoryTree(categories: CategoryDto[]): CategoryTreeNode[] {
  const map = new Map<string, CategoryTreeNode>();
  const roots: CategoryTreeNode[] = [];

  for (const cat of categories) {
    map.set(cat.id, { ...cat, children: [] });
  }

  for (const cat of categories) {
    const node = map.get(cat.id)!;
    if (cat.parentId && map.has(cat.parentId)) {
      map.get(cat.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (nodes: CategoryTreeNode[]) => {
    nodes.sort((a, b) => a.displayOrder - b.displayOrder);
    nodes.forEach((n) => sortNodes(n.children));
  };
  sortNodes(roots);
  return roots;
}

export async function getCategoryTree(publicOnly = false): Promise<CategoryTreeNode[]> {
  const flat = await listCategories({ publicOnly });
  return buildCategoryTree(flat);
}

export async function getCategoryById(id: string): Promise<CategoryDto | null> {
  const category = await Category.findById(id);
  if (!category) return null;
  const bookCount = await countBooksInCategory(id);
  return toDto(category, bookCount);
}

export async function getCategoryBySlug(slug: string, publicOnly = false): Promise<CategoryDto | null> {
  const query: Record<string, unknown> = { slug: slug.toLowerCase() };
  if (publicOnly) {
    query.status = 'published';
    query.isVisible = true;
  }
  const category = await Category.findOne(query);
  if (!category) return null;
  const bookCount = await countBooksInCategory(category._id.toString());
  return toDto(category, bookCount);
}

export async function createCategory(
  input: {
    parentId?: string | null;
    slug: string;
    status?: CategoryStatus;
    isVisible?: boolean;
    isFeatured?: boolean;
    displayOrder?: number;
    imageMediaId?: string;
    iconMediaId?: string;
    translations: ICategory['translations'];
    seo?: ICategory['seo'];
  },
  createdBy?: string,
): Promise<CategoryDto> {
  const existing = await Category.findOne({ slug: input.slug.toLowerCase() });
  if (existing) throw new CategoryError('SLUG_EXISTS', 'Category slug already exists');

  const parentId = input.parentId ?? null;
  const ancestorIds = parentId ? await computeAncestors(parentId) : [];

  const maxOrder = await Category.findOne({ parentId: parentId ?? null })
    .sort({ displayOrder: -1 })
    .select('displayOrder');
  const displayOrder = input.displayOrder ?? (maxOrder ? maxOrder.displayOrder + 1 : 0);

  const category = await Category.create({
    parentId,
    ancestorIds,
    slug: input.slug.toLowerCase(),
    status: input.status ?? 'draft',
    isVisible: input.isVisible ?? true,
    isFeatured: input.isFeatured ?? false,
    displayOrder,
    imageMediaId: input.imageMediaId,
    iconMediaId: input.iconMediaId,
    translations: input.translations,
    seo: input.seo ?? { indexable: true },
    createdBy,
  });

  return toDto(category, 0);
}

export async function updateCategory(
  id: string,
  input: Partial<{
    slug: string;
    status: CategoryStatus;
    isVisible: boolean;
    isFeatured: boolean;
    displayOrder: number;
    imageMediaId: string | null;
    iconMediaId: string | null;
    translations: ICategory['translations'];
    seo: ICategory['seo'];
  }>,
): Promise<CategoryDto> {
  const category = await Category.findById(id);
  if (!category) throw new CategoryError('NOT_FOUND', 'Category not found');

  if (input.slug && input.slug.toLowerCase() !== category.slug) {
    const existing = await Category.findOne({ slug: input.slug.toLowerCase() });
    if (existing) throw new CategoryError('SLUG_EXISTS', 'Category slug already exists');
    category.slug = input.slug.toLowerCase();
  }

  if (input.status !== undefined) category.status = input.status;
  if (input.isVisible !== undefined) category.isVisible = input.isVisible;
  if (input.isFeatured !== undefined) category.isFeatured = input.isFeatured;
  if (input.displayOrder !== undefined) category.displayOrder = input.displayOrder;
  if (input.imageMediaId !== undefined) {
    category.imageMediaId = input.imageMediaId
      ? new mongoose.Types.ObjectId(input.imageMediaId)
      : undefined;
  }
  if (input.iconMediaId !== undefined) {
    category.iconMediaId = input.iconMediaId
      ? new mongoose.Types.ObjectId(input.iconMediaId)
      : undefined;
  }
  if (input.translations) category.translations = input.translations;
  if (input.seo) category.seo = { ...category.seo, ...input.seo };

  await category.save();
  const bookCount = await countBooksInCategory(id);
  return toDto(category, bookCount);
}

export async function moveCategory(
  id: string,
  parentId: string | null,
  displayOrder?: number,
): Promise<CategoryDto> {
  const category = await Category.findById(id);
  if (!category) throw new CategoryError('NOT_FOUND', 'Category not found');

  if (await wouldCreateCycle(id, parentId)) {
    throw new CategoryError('CYCLE_DETECTED', 'Cannot move category under its own descendant');
  }

  const ancestorIds = parentId ? await computeAncestors(parentId) : [];
  category.parentId = parentId ? new mongoose.Types.ObjectId(parentId) : null;
  category.ancestorIds = ancestorIds;
  if (displayOrder !== undefined) category.displayOrder = displayOrder;

  await category.save();
  await updateDescendantAncestors(id, [...ancestorIds, category._id]);

  const bookCount = await countBooksInCategory(id);
  return toDto(category, bookCount);
}

export async function reorderCategories(
  items: Array<{ id: string; displayOrder: number; parentId?: string | null }>,
): Promise<void> {
  for (const item of items) {
    const category = await Category.findById(item.id);
    if (!category) continue;
    category.displayOrder = item.displayOrder;
    if (item.parentId !== undefined) {
      await moveCategory(item.id, item.parentId, item.displayOrder);
    } else {
      await category.save();
    }
  }
}

export async function archiveCategory(
  id: string,
  input: CategoryArchiveInput,
): Promise<CategoryDto> {
  const category = await Category.findById(id);
  if (!category) throw new CategoryError('NOT_FOUND', 'Category not found');

  const bookCount = await countBooksInCategory(id);
  const childCount = await Category.countDocuments({ parentId: id, status: { $ne: 'archived' } });

  if (childCount > 0) {
    throw new CategoryError('HAS_CHILDREN', 'Archive or move child categories first');
  }

  if (bookCount > 0) {
    if (input.action === 'cancel') {
      throw new CategoryError('HAS_BOOKS', `Category contains ${bookCount} books`);
    }
    if (input.action === 'move_books') {
      if (!input.targetCategoryId) {
        throw new CategoryError('TARGET_REQUIRED', 'Target category required to move books');
      }
      await Book.updateMany(
        { categoryIds: id },
        { $addToSet: { categoryIds: input.targetCategoryId }, $pull: { categoryIds: id } },
      );
    } else if (input.action === 'remove_assignments') {
      await Book.updateMany({ categoryIds: id }, { $pull: { categoryIds: id } });
    }
  }

  category.status = 'archived';
  category.isVisible = false;
  category.archivedAt = new Date();
  await category.save();

  return toDto(category, 0);
}

export function resolveCategoryName(
  category: CategoryDto,
  lang: string,
  fallbackLang = 'en',
): string {
  const match =
    category.translations.find((t) => t.languageCode === lang) ??
    category.translations.find((t) => t.languageCode === fallbackLang);
  return match?.name ?? category.translations[0]?.name ?? category.slug;
}
