import { Card } from 'fumadocs-ui/components/card';
import { gatewaySource, source, workspaceSource } from '@/lib/source';
import { ComponentPropsWithoutRef } from 'react';

export function SmartDocsCard({ href, title, description, icon, ...props }: { href: string } & ComponentPropsWithoutRef<typeof Card>) {
  const parts = href ? href.split('/').filter(Boolean) : [];
  const isInternalDocsLink = parts[0] === 'docs';

  if (!isInternalDocsLink) {
    console.warn(`SmartDocsCard: Expected internal docs href to start with /docs/. Received: ${href}`);
    return (
      <Card
        title={title ?? 'Documentation Link'}
        description={description}
        href={href}
        icon={icon}
        {...props}
      />
    );
  }

  const segments = parts.slice(1);

  let page;

  if (segments[0] === 'gateway') {
    page = gatewaySource.getPage(segments.slice(1));
  } else if (segments[0] === 'workspace') {
    page = workspaceSource.getPage(segments.slice(1));
  } else if (segments[0] === 'fcp') {
    page = source.getPage(segments.slice(1));
  } else {
    page = source.getPage(segments);
  }

  if (!page) {
    console.warn(`SmartDocsCard: Could not find page for href: ${href} (segments: ${JSON.stringify(segments)})`);
    return (
      <Card
        title={title ?? "Page Not Found"}
        description={description ?? `Could not resolve link: ${href}`}
        href={href}
        icon={icon}
        {...props}
      />
    );
  }

  return (
    <Card
      title={title ?? page.data.title}
      description={description ?? page.data.description}
      href={page.url}
      icon={icon}
      {...props}
    />
  );
}
