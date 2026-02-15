'use client';

import { usePathname } from 'next/navigation';
import { SidebarTabsDropdown } from 'fumadocs-ui/components/sidebar/tabs/dropdown';
import { LayoutDashboard, BookOpen, Code } from 'lucide-react';

export function DocsToggles() {
    const pathname = usePathname();

    // 1. Section Toggle
    const sectionOptions = [
        {
            title: 'Workspace',
            url: '/docs/workspace',
            description: 'Product documentation',
            icon: <LayoutDashboard className="size-4" />
        },
        {
            title: 'Guides',
            url: '/docs/guides',
            urls: new Set(['/docs/guides', '/docs/guides/v1']),
            description: 'Step-by-step guides',
            icon: <BookOpen className="size-4" />
        },
        {
            title: 'Fide Context Protocol',
            url: '/docs/fcp/',
            description: 'Fide Context Protocol',
            icon: <LayoutDashboard className="size-4" />
        },
        {
            title: 'Developers',
            url: '/docs/developers',
            description: 'Technical references',
            icon: <Code className="size-4" />
        },
    ];

    // 2. Version Toggle
    const isGuides = pathname.startsWith('/docs/guides');

    const versionOptions = [
        { title: 'v2 (Latest)', url: '/docs/guides' },
        { title: 'v1 (Legacy)', url: '/docs/guides/v1' },
    ];

    return (
        <div className="flex flex-col gap-2">
            <SidebarTabsDropdown options={sectionOptions} />
            {isGuides && (
                <SidebarTabsDropdown
                    options={versionOptions}
                    placeholder="Select Version"
                />
            )}
        </div>
    );
}
