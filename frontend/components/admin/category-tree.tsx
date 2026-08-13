'use client';

import { useState } from 'react';
import type { CategoryDto, CategoryStatus, CategoryTreeNode } from '@dsb/shared';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const STATUS_COLORS: Record<CategoryStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  published: 'bg-green-100 text-green-800',
  hidden: 'bg-amber-100 text-amber-800',
  archived: 'bg-red-100 text-red-800',
};

interface CategoryTreeProps {
  nodes: CategoryTreeNode[];
  depth?: number;
  onEdit: (category: CategoryDto) => void;
  onAddChild: (parentId: string) => void;
  onPublish: (category: CategoryDto) => void;
  onHide: (category: CategoryDto) => void;
  onArchive: (category: CategoryDto) => void;
}

function CategoryNode({
  node,
  depth,
  onEdit,
  onAddChild,
  onPublish,
  onHide,
  onArchive,
}: {
  node: CategoryTreeNode;
  depth: number;
} & Omit<CategoryTreeProps, 'nodes'>) {
  const [expanded, setExpanded] = useState(depth < 2);
  const name = node.translations.find((t) => t.languageCode === 'en')?.name ?? node.slug;
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className={cn(
          'flex flex-wrap items-center gap-2 rounded-lg py-2 pr-2 hover:bg-accent/50',
        )}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-5 text-muted"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {hasChildren ? (expanded ? '▾' : '▸') : '•'}
        </button>
        <span className="flex-1 text-sm font-medium">{name}</span>
        <span className={cn('rounded px-2 py-0.5 text-xs', STATUS_COLORS[node.status])}>
          {node.status}
        </span>
        {node.isFeatured && (
          <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">Featured</span>
        )}
        {(node.bookCount ?? 0) > 0 && (
          <span className="text-xs text-muted">{node.bookCount} books</span>
        )}
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => onAddChild(node.id)}>
            + Child
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onEdit(node)}>
            Edit
          </Button>
          {node.status !== 'published' && (
            <Button size="sm" variant="ghost" onClick={() => onPublish(node)}>
              Publish
            </Button>
          )}
          {node.status === 'published' && (
            <Button size="sm" variant="ghost" onClick={() => onHide(node)}>
              Hide
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => onArchive(node)}>
            Archive
          </Button>
        </div>
      </div>
      {expanded &&
        node.children.map((child) => (
          <CategoryNode
            key={child.id}
            node={child}
            depth={depth + 1}
            onEdit={onEdit}
            onAddChild={onAddChild}
            onPublish={onPublish}
            onHide={onHide}
            onArchive={onArchive}
          />
        ))}
    </div>
  );
}

export function CategoryTree(props: CategoryTreeProps) {
  const { nodes, depth = 0, ...handlers } = props;
  return (
    <div className="divide-y divide-border">
      {nodes.map((node) => (
        <CategoryNode key={node.id} node={node} depth={depth} {...handlers} />
      ))}
    </div>
  );
}
