import { getLLMText } from '@/lib/source';

type LLMPage = {
  slugs?: string[];
  url?: string;
  data?: unknown;
};

function hasSlugPrefix(page: LLMPage, prefix: string[]) {
  if (prefix.length === 0) return true;
  const slugs = page.slugs ?? [];
  if (slugs.length < prefix.length) return false;
  return prefix.every((segment, index) => slugs[index] === segment);
}

function isInternalPage(page: LLMPage) {
  return page.url?.includes('.int') ?? false;
}

function stripTokenBloat(text: string) {
  return text
    .replace(/<SDKFunctionPage\s+data=\{\{[\s\S]*?\}\}\s*\/>/g, '')
    .replace(/^import\s+\{[^}]+\}\s+from\s+['"]fumadocs-ui[^'"]*['"];?\s*$/gm, '')
    .replace(
      /^import\s+\{[^}]+\}\s+from\s+['"]@\/components\/mdx\/smart-docs-card['"];?\s*$/gm,
      ''
    )
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

type Source = {
  getPages: () => LLMPage[];
};

export async function buildSectionLLMResponse(selectedSource: Source, subtree: string[]) {
  const pages = selectedSource
    .getPages()
    .filter((page) => hasSlugPrefix(page, subtree))
    .filter((page) => !isInternalPage(page))
    .filter((page) => {
      const data = page.data as { type?: string } | undefined;
      return data?.type !== 'openapi';
    });
  if (pages.length === 0) return new Response('Not found', { status: 404 });

  const scanned = await Promise.all(pages.map((page) => getLLMText(page as never)));
  const cleaned = scanned.map(stripTokenBloat).filter(Boolean);
  return new Response(cleaned.join('\n\n'));
}
