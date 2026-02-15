import { getLLMText } from '@/lib/source';

type LLMPage = {
  slugs?: string[];
};

function hasSlugPrefix(page: LLMPage, prefix: string[]) {
  if (prefix.length === 0) return true;
  const slugs = page.slugs ?? [];
  if (slugs.length < prefix.length) return false;
  return prefix.every((segment, index) => slugs[index] === segment);
}

type Source = {
  getPages: () => LLMPage[];
};

export async function buildSectionLLMResponse(selectedSource: Source, subtree: string[]) {
  const pages = selectedSource.getPages().filter((page) => hasSlugPrefix(page, subtree));
  if (pages.length === 0) return new Response('Not found', { status: 404 });

  const scanned = await Promise.all(pages.map((page) => getLLMText(page as never)));
  return new Response(scanned.join('\n\n'));
}
