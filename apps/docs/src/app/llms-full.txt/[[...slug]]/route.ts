import { gatewaySource, source, toolsSource, workspaceSource } from '@/lib/source';
import { buildSectionLLMResponse } from '@/lib/llms-full';

export const revalidate = false;

const sectionSources = {
  fcp: source,
  gateway: gatewaySource,
  workspace: workspaceSource,
  tools: toolsSource,
} as const;

export async function GET(
  _req: Request,
  { params }: RouteContext<'/llms-full.txt/[[...slug]]'>
) {
  const { slug } = await params;
  const parts = slug ?? [];

  if (parts.length === 0) {
    const scan = [
      ...source.getPages(),
      ...gatewaySource.getPages(),
      ...workspaceSource.getPages(),
      ...toolsSource.getPages(),
    ];
    return buildSectionLLMResponse(
      {
        getPages: () => scan,
      },
      []
    );
  }

  const [section, ...subtree] = parts;
  const selectedSource = sectionSources[section as keyof typeof sectionSources];
  if (!selectedSource) return new Response('Not found', { status: 404 });

  return buildSectionLLMResponse(selectedSource, subtree);
}
