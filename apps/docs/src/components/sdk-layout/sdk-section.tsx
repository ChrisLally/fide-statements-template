import { cn } from '@/lib/cn';
import { Children, isValidElement, type ComponentPropsWithoutRef, type ReactNode } from 'react';

export interface SDKSectionProps extends Omit<ComponentPropsWithoutRef<'section'>, 'title' | 'children'> {
  title: ReactNode;
  description?: ReactNode;
  codeTitle?: ReactNode;
  children: ReactNode;
}

function isPreNode(node: ReactNode): boolean {
  return isValidElement(node) && typeof node.type === 'string' && node.type === 'pre';
}

export function SDKSection({
  title,
  description,
  codeTitle = 'TypeScript',
  className,
  children,
  ...props
}: SDKSectionProps) {
  const nodes = Children.toArray(children);
  const codeNodeIndex = nodes.findIndex(isPreNode);
  const codeNode = codeNodeIndex >= 0 ? nodes[codeNodeIndex] : null;
  const contentNodes = codeNodeIndex >= 0 ? nodes.filter((_, index) => index !== codeNodeIndex) : nodes;

  return (
    <section className={cn('not-prose my-10 @container', className)} {...props}>
      <div className="flex flex-col gap-x-6 gap-y-4 @4xl:flex-row @4xl:items-start">
        <div className="min-w-0 flex-1 rounded-xl border bg-fd-card px-5 py-4 text-fd-card-foreground">
          <div className="mb-4">
            <h3 className="text-base font-semibold tracking-tight">{title}</h3>
            {description ? <div className="mt-1 text-sm text-fd-muted-foreground">{description}</div> : null}
          </div>

          <div className="space-y-4 text-sm leading-6">{contentNodes}</div>
        </div>

        {codeNode ? (
          <aside className="@4xl:sticky @4xl:top-[calc(var(--fd-docs-row-1,2rem)+1rem)] @4xl:w-[400px]">
            <div className="overflow-hidden rounded-xl border bg-fd-card text-fd-card-foreground">
              <div className="border-b px-4 py-2 text-xs font-medium uppercase tracking-wide text-fd-muted-foreground">
                {codeTitle}
              </div>
              <div className="max-h-[36rem] overflow-auto px-4 py-3 [&_pre]:m-0 [&_pre]:max-h-none [&_pre]:overflow-visible">
                {codeNode}
              </div>
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  );
}
