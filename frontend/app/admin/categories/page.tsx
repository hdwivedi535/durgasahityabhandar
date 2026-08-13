'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CategoryDto, CategoryTreeNode } from '@dsb/shared';
import { useAuth } from '@/lib/auth-context';
import { apiFetchWithToken } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { CategoryForm } from '@/components/admin/category-form';
import { CategoryTree } from '@/components/admin/category-tree';

export default function AdminCategoriesPage() {
  const { accessToken } = useAuth();
  const [tree, setTree] = useState<CategoryTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CategoryDto | null>(null);
  const [parentForNew, setParentForNew] = useState<string | null>(null);

  const loadTree = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiFetchWithToken<CategoryTreeNode[]>(
        '/admin/categories?tree=true',
        accessToken,
      );
      setTree(data);
    } catch {
      setError('Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  function handleCreateChild(parentId: string | null) {
    setEditing(null);
    setParentForNew(parentId);
    setShowForm(true);
  }

  function handleEdit(category: CategoryDto) {
    setEditing(category);
    setParentForNew(category.parentId);
    setShowForm(true);
  }

  async function handleArchive(category: CategoryDto) {
    if (!accessToken) return;
    const bookCount = category.bookCount ?? 0;
    if (bookCount > 0) {
      const action = window.confirm(
        `This category contains ${bookCount} book(s). Remove category assignments from those books?`,
      );
      if (!action) return;
      await apiFetchWithToken(`/admin/categories/${category.id}/archive`, accessToken, {
        method: 'POST',
        body: JSON.stringify({ action: 'remove_assignments' }),
      });
    } else {
      if (!window.confirm(`Archive "${category.translations[0]?.name}"?`)) return;
      await apiFetchWithToken(`/admin/categories/${category.id}/archive`, accessToken, {
        method: 'POST',
        body: JSON.stringify({ action: 'remove_assignments' }),
      });
    }
    await loadTree();
  }

  async function handlePublish(category: CategoryDto) {
    if (!accessToken) return;
    await apiFetchWithToken(`/admin/categories/${category.id}/publish`, accessToken, {
      method: 'POST',
    });
    await loadTree();
  }

  async function handleHide(category: CategoryDto) {
    if (!accessToken) return;
    await apiFetchWithToken(`/admin/categories/${category.id}/hide`, accessToken, {
      method: 'POST',
    });
    await loadTree();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Categories</h1>
          <p className="mt-1 text-sm text-muted">
            Manage hierarchical book categories — fully admin controlled
          </p>
        </div>
        <Button onClick={() => handleCreateChild(null)}>Add Root Category</Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <h2 className="font-medium">Category Tree</h2>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : tree.length === 0 ? (
              <p className="text-sm text-muted">No categories yet. Create your first category.</p>
            ) : (
              <CategoryTree
                nodes={tree}
                onEdit={handleEdit}
                onAddChild={handleCreateChild}
                onPublish={handlePublish}
                onHide={handleHide}
                onArchive={handleArchive}
              />
            )}
          </CardContent>
        </Card>

        {showForm && accessToken && (
          <Card>
            <CardHeader>
              <h2 className="font-medium">{editing ? 'Edit Category' : 'New Category'}</h2>
            </CardHeader>
            <CardContent>
              <CategoryForm
                accessToken={accessToken}
                category={editing}
                parentId={parentForNew}
                onSuccess={() => {
                  setShowForm(false);
                  setEditing(null);
                  loadTree();
                }}
                onCancel={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
