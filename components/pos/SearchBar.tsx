'use client';

import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder?: string;
}

export function SearchBar({
  value,
  onChange,
  onClear,
  placeholder = 'Search products...',
}: SearchBarProps) {
  return (
    <div className="flex gap-2 w-full">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          data-pos-search-input="true"
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          className="pl-10 bg-white border-2 border-primary focus:border-primary text-foreground placeholder:text-muted-foreground"
        />
      </div>
      {value && (
        <Button
          variant="outline"
          size="sm"
          onClick={onClear}
          className="px-3"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
