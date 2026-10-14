'use client';

import { Category } from '@/lib/pos/types';
import { Package, Grid } from 'lucide-react';

interface CategoriesSidebarProps {
  categories: Category[];
  activeCategory: string;
  onCategoryChange: (categoryId: string) => void;
}

export function CategoriesSidebar({
  categories,
  activeCategory,
  onCategoryChange,
}: CategoriesSidebarProps) {
  return (
    <div className="flex w-24 flex-col gap-2 border-r border-border bg-white dark:bg-zinc-900 p-2 overflow-y-auto custom-scrollbar">
      {categories.map((category) => {
        const isActive = activeCategory === category.id;
        const Icon = category.id === 'all' ? Grid : Package;
        return (
          <button
            key={category.id}
            onClick={() => onCategoryChange(category.id)}
            className={`flex flex-col items-center justify-center gap-1.5 rounded-xl py-4 px-1 transition-all group relative ${
              isActive
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none'
                : 'bg-slate-50 dark:bg-zinc-800/50 text-muted-foreground hover:bg-slate-100 dark:hover:bg-zinc-800'
            }`}
            title={category.name}
          >
            <Icon className={`h-5 w-5 shrink-0 transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-105'}`} />
            <span className={`text-[9px] text-center font-bold uppercase tracking-widest leading-tight w-full truncate px-1 transition-colors ${isActive ? 'text-white' : 'text-muted-foreground'}`}>
              {category.name}
            </span>
            {isActive && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-r-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}
