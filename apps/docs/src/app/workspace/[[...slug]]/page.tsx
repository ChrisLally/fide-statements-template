import { workspaceSource, getWorkspacePageImage } from '@/lib/source';
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/notebook/page';
import { notFound } from 'next/navigation';
import { getMDXComponents } from '@/mdx-components';
import type { Metadata } from 'next';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import { LLMCopyButton, ViewOptions } from '@/components/ai/page-actions';
import { gitConfig } from '@/lib/layout.shared';
import { APIPage } from '@/components/api-page';

export default async function Page(props: PageProps<'/workspace/[[...slug]]'>) {
  const params = await props.params;
  const page = workspaceSource.getPage(params.slug);
  if (!page) notFound();

  // Handle OpenAPI pages
  if (page.data.type === 'openapi') {
    return (
      <DocsPage toc={page.data.toc} full tableOfContent={{ style: 'clerk' }}>
        <h1 className="text-[1.75em] font-semibold">{page.data.title}</h1>
        <DocsBody>
          <APIPage {...page.data.getAPIPageProps()} />
        </DocsBody>
      </DocsPage>
    );
  }

  // Handle regular MDX pages
  const MDX = page.data.body;
  const markdownUrl = `/docs${page.url}.mdx`;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full} tableOfContent={{ style: 'clerk' }}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription className="mb-0">{page.data.description}</DocsDescription>
      <div className="flex flex-row gap-2 items-center border-b pb-6">
        <LLMCopyButton markdownUrl={markdownUrl} />
        <ViewOptions
          markdownUrl={markdownUrl}
          // update it to match your repo
          githubUrl={`https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}/content/docs/${page.path}`}
        />
      </div>
      <DocsBody>
        <MDX
          components={getMDXComponents({
            // this allows you to link to other pages with relative file paths
            a: createRelativeLink(workspaceSource, page),
          })}
        />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return workspaceSource.generateParams();
}

export async function generateMetadata(props: PageProps<'/workspace/[[...slug]]'>): Promise<Metadata> {
  const params = await props.params;
  const page = workspaceSource.getPage(params.slug);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
    openGraph: {
      images: getWorkspacePageImage(page).url,
    },
  };
}
