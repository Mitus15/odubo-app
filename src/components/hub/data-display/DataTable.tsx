'use client';

/**
 * The Hub - DataTable Component
 * Responsive table that becomes cards on mobile
 */

import React, { useState, useMemo } from 'react';
import type { Column, TableAction, PaginationState, SortState } from '@/lib/hub/types';

// =============================================================================
// TYPES
// =============================================================================

interface DataTableProps<T extends { id: string | number }> {
  data: T[];
  columns: Column<T>[];
  actions?: TableAction<T>[];
  isLoading?: boolean;
  emptyMessage?: string;
  emptyIcon?: string;

  // Pagination
  pagination?: PaginationState;
  onPageChange?: (page: number) => void;

  // Sorting
  sortable?: boolean;
  defaultSort?: SortState;
  onSortChange?: (sort: SortState) => void;

  // Selection
  selectable?: boolean;
  selectedIds?: (string | number)[];
  onSelectionChange?: (ids: (string | number)[]) => void;

  // Row click
  onRowClick?: (row: T) => void;

  // Mobile
  mobileBreakpoint?: number;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function DataTable<T extends { id: string | number }>({
  data,
  columns,
  actions,
  isLoading = false,
  emptyMessage = 'No data found',
  emptyIcon,
  pagination,
  onPageChange,
  sortable = false,
  defaultSort,
  onSortChange,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  onRowClick,
  mobileBreakpoint = 768,
}: DataTableProps<T>) {
  const [isMobile, setIsMobile] = useState(false);
  const [sort, setSort] = useState<SortState | undefined>(defaultSort);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | number | null>(null);

  // Detect mobile
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < mobileBreakpoint);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [mobileBreakpoint]);

  // Handle sort
  const handleSort = (columnKey: string) => {
    if (!sortable) return;

    const newSort: SortState = {
      column: columnKey,
      direction:
        sort?.column === columnKey && sort.direction === 'asc' ? 'desc' : 'asc',
    };
    setSort(newSort);
    onSortChange?.(newSort);
  };

  // Handle selection
  const handleSelectAll = () => {
    if (!selectable || !onSelectionChange) return;

    if (selectedIds.length === data.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(data.map((row) => row.id));
    }
  };

  const handleSelectRow = (id: string | number) => {
    if (!selectable || !onSelectionChange) return;

    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((i) => i !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  // Get visible columns (filter mobile-hidden on mobile)
  const visibleColumns = useMemo(() => {
    if (isMobile) {
      return columns.filter((col) => !col.mobileHidden);
    }
    return columns;
  }, [columns, isMobile]);

  // Get primary column for mobile card
  const primaryColumn = useMemo(() => {
    return columns.find((col) => col.mobilePrimary) || columns[0];
  }, [columns]);

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="hub-card h-20 animate-pulse bg-[var(--hub-bg-tertiary)]"
          />
        ))}
      </div>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div className="hub-card p-8 text-center">
        {emptyIcon && (
          <div className="w-16 h-16 rounded-full bg-[var(--hub-bg-tertiary)] flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">{emptyIcon}</span>
          </div>
        )}
        <p className="text-[var(--hub-text-muted)]">{emptyMessage}</p>
      </div>
    );
  }

  // Mobile card view
  if (isMobile) {
    return (
      <div className="space-y-3">
        {data.map((row) => (
          <div
            key={row.id}
            className={`hub-card p-4 ${
              onRowClick ? 'cursor-pointer active:bg-[var(--hub-bg-elevated)]' : ''
            } ${selectedIds.includes(row.id) ? 'ring-2 ring-[var(--hub-accent)]' : ''}`}
            onClick={() => onRowClick?.(row)}
          >
            <div className="flex items-start gap-3">
              {/* Selection checkbox */}
              {selectable && (
                <input
                  type="checkbox"
                  checked={selectedIds.includes(row.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    handleSelectRow(row.id);
                  }}
                  className="mt-1 w-5 h-5 rounded border-[var(--hub-border-default)] bg-[var(--hub-bg-tertiary)] text-[var(--hub-accent)]"
                />
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Primary field */}
                <div className="font-medium text-[var(--hub-text-primary)] mb-2">
                  {primaryColumn.render
                    ? primaryColumn.render(
                        row[primaryColumn.key as keyof T] as unknown,
                        row
                      )
                    : String(row[primaryColumn.key as keyof T] ?? '')}
                </div>

                {/* Secondary fields */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {visibleColumns
                    .filter((col) => col.key !== primaryColumn.key)
                    .slice(0, 4)
                    .map((col) => (
                      <div key={String(col.key)}>
                        <span className="text-[var(--hub-text-muted)]">{col.label}: </span>
                        <span className="text-[var(--hub-text-secondary)]">
                          {col.render
                            ? col.render(row[col.key as keyof T] as unknown, row)
                            : String(row[col.key as keyof T] ?? '—')}
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Actions menu */}
              {actions && actions.length > 0 && (
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActionMenuOpen(actionMenuOpen === row.id ? null : row.id);
                    }}
                    className="p-2 -mr-2 hub-btn-ghost rounded-lg"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-5 h-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z"
                      />
                    </svg>
                  </button>

                  {actionMenuOpen === row.id && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setActionMenuOpen(null)}
                      />
                      <div className="absolute right-0 top-full mt-1 z-20 bg-[var(--hub-bg-secondary)] border border-[var(--hub-border-default)] rounded-lg shadow-lg overflow-hidden min-w-[160px]">
                        {actions.map((action) => (
                          <button
                            key={action.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              action.onClick(row);
                              setActionMenuOpen(null);
                            }}
                            className={`w-full px-4 py-2.5 text-left text-sm hover:bg-[var(--hub-bg-tertiary)] ${
                              action.variant === 'destructive'
                                ? 'text-[var(--hub-error)]'
                                : 'text-[var(--hub-text-secondary)]'
                            }`}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Mobile pagination */}
        {pagination && (
          <MobilePagination
            pagination={pagination}
            onPageChange={onPageChange}
          />
        )}
      </div>
    );
  }

  // Desktop table view
  return (
    <div className="hub-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--hub-border-subtle)]">
              {selectable && (
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === data.length && data.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-[var(--hub-border-default)] bg-[var(--hub-bg-tertiary)] text-[var(--hub-accent)]"
                  />
                </th>
              )}
              {visibleColumns.map((col) => (
                <th
                  key={String(col.key)}
                  className={`px-4 py-3 text-left text-xs font-medium text-[var(--hub-text-muted)] uppercase tracking-wider ${
                    sortable && col.sortable !== false ? 'cursor-pointer hover:text-[var(--hub-text-secondary)]' : ''
                  } ${col.align === 'center' ? 'text-center' : ''} ${col.align === 'right' ? 'text-right' : ''}`}
                  style={{ width: col.width }}
                  onClick={() => col.sortable !== false && handleSort(String(col.key))}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {sortable && col.sortable !== false && sort?.column === col.key && (
                      <span>{sort.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              ))}
              {actions && actions.length > 0 && (
                <th className="w-16 px-4 py-3" />
              )}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr
                key={row.id}
                className={`border-b border-[var(--hub-border-subtle)] last:border-0 transition-colors ${
                  onRowClick ? 'cursor-pointer hover:bg-[var(--hub-bg-tertiary)]' : ''
                } ${selectedIds.includes(row.id) ? 'bg-[var(--hub-accent-muted)]/30' : ''}`}
                onClick={() => onRowClick?.(row)}
              >
                {selectable && (
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(row.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleSelectRow(row.id);
                      }}
                      className="w-4 h-4 rounded border-[var(--hub-border-default)] bg-[var(--hub-bg-tertiary)] text-[var(--hub-accent)]"
                    />
                  </td>
                )}
                {visibleColumns.map((col) => (
                  <td
                    key={String(col.key)}
                    className={`px-4 py-3 text-sm text-[var(--hub-text-secondary)] ${
                      col.align === 'center' ? 'text-center' : ''
                    } ${col.align === 'right' ? 'text-right' : ''}`}
                  >
                    {col.render
                      ? col.render(row[col.key as keyof T] as unknown, row)
                      : String(row[col.key as keyof T] ?? '—')}
                  </td>
                ))}
                {actions && actions.length > 0 && (
                  <td className="px-4 py-3">
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActionMenuOpen(actionMenuOpen === row.id ? null : row.id);
                        }}
                        className="p-1 hub-btn-ghost rounded"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="w-5 h-5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"
                          />
                        </svg>
                      </button>

                      {actionMenuOpen === row.id && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setActionMenuOpen(null)}
                          />
                          <div className="absolute right-0 top-full mt-1 z-20 bg-[var(--hub-bg-secondary)] border border-[var(--hub-border-default)] rounded-lg shadow-lg overflow-hidden min-w-[160px]">
                            {actions.map((action) => (
                              <button
                                key={action.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  action.onClick(row);
                                  setActionMenuOpen(null);
                                }}
                                className={`w-full px-4 py-2 text-left text-sm hover:bg-[var(--hub-bg-tertiary)] ${
                                  action.variant === 'destructive'
                                    ? 'text-[var(--hub-error)]'
                                    : 'text-[var(--hub-text-secondary)]'
                                }`}
                              >
                                {action.label}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Desktop pagination */}
      {pagination && (
        <div className="px-4 py-3 border-t border-[var(--hub-border-subtle)]">
          <DesktopPagination
            pagination={pagination}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
}

// =============================================================================
// PAGINATION COMPONENTS
// =============================================================================

function MobilePagination({
  pagination,
  onPageChange,
}: {
  pagination: PaginationState;
  onPageChange?: (page: number) => void;
}) {
  const totalPages = Math.ceil(pagination.total / pagination.pageSize);
  const hasMore = pagination.page < totalPages;

  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <p className="text-sm text-[var(--hub-text-muted)]">
        Showing {(pagination.page - 1) * pagination.pageSize + 1} -{' '}
        {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
        {pagination.total}
      </p>
      {hasMore && (
        <button
          onClick={() => onPageChange?.(pagination.page + 1)}
          className="hub-btn hub-btn-secondary w-full"
        >
          Load More
        </button>
      )}
    </div>
  );
}

function DesktopPagination({
  pagination,
  onPageChange,
}: {
  pagination: PaginationState;
  onPageChange?: (page: number) => void;
}) {
  const totalPages = Math.ceil(pagination.total / pagination.pageSize);

  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-[var(--hub-text-muted)]">
        Showing {(pagination.page - 1) * pagination.pageSize + 1} -{' '}
        {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
        {pagination.total}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange?.(pagination.page - 1)}
          disabled={pagination.page <= 1}
          className="hub-btn hub-btn-ghost px-2 disabled:opacity-50"
        >
          ←
        </button>
        <span className="text-sm text-[var(--hub-text-secondary)]">
          Page {pagination.page} of {totalPages}
        </span>
        <button
          onClick={() => onPageChange?.(pagination.page + 1)}
          disabled={pagination.page >= totalPages}
          className="hub-btn hub-btn-ghost px-2 disabled:opacity-50"
        >
          →
        </button>
      </div>
    </div>
  );
}
