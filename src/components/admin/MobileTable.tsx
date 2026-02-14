import { ReactNode } from 'react';

export interface ColumnDef<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
  className?: string;
}

interface MobileTableProps<T> {
  items: T[];
  columns: ColumnDef<T>[];
  mobileCardRender: (item: T) => ReactNode;
  emptyMessage?: string;
  className?: string;
}

export function MobileTable<T extends { id?: string | number }>({
  items,
  columns,
  mobileCardRender,
  emptyMessage = 'No items found',
  className = ''
}: MobileTableProps<T>) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-[#b2a491]">
        {emptyMessage}
      </div>
    );
  }

  return (
    <>
      {/* Mobile: Card view */}
      <div className="md:hidden space-y-3">
        {items.map((item, index) => (
          <div key={item.id || index}>
            {mobileCardRender(item)}
          </div>
        ))}
      </div>

      {/* Desktop: Table */}
      <div className={`hidden md:block overflow-x-auto ${className}`}>
        <table className="w-full text-left text-sm">
          <thead className="bg-[#302927]/40 text-[#b2a491] border-b border-[#502d26]/30">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={`p-4 font-medium ${col.className || ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#502d26]/30">
            {items.map((item, index) => (
              <tr
                key={item.id || index}
                className="hover:bg-[#302927]/20 transition-colors"
              >
                {columns.map((col) => (
                  <td key={col.key} className={`p-4 ${col.className || ''}`}>
                    {col.render(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
