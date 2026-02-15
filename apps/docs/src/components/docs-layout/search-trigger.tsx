'use client';


import { Search } from 'lucide-react';
import { useSearchContext } from 'fumadocs-ui/contexts/search';

interface SearchTriggerProps {
    className?: string;
}

export function SearchTrigger({ className }: SearchTriggerProps) {
    const { setOpenSearch } = useSearchContext();

    return (
        <button
            type="button"
            className={`inline-flex items-center gap-2 rounded-full border bg-fd-secondary/50 px-4 py-2 text-sm text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground ${className || ''}`}
            onClick={() => setOpenSearch(true)}
        >
            <Search className="size-4" />
            Search documentation...
            <span className="ml-auto text-xs">⌘K</span>
        </button>
    );
}
