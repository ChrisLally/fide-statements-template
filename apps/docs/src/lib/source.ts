import { docs, gateway, graph, tools, workspace } from 'fumadocs-mdx:collections/server';
import { type InferPageType, loader, multiple } from 'fumadocs-core/source';
import { lucideIconsPlugin } from 'fumadocs-core/source/lucide-icons';
import { openapiPlugin, openapiSource } from 'fumadocs-openapi/server';
import { openapi } from './openapi';

// See https://fumadocs.dev/docs/headless/source-api for more info
export const source = loader(
  multiple({
    docs: docs.toFumadocsSource(),
    openapi: await openapiSource(openapi, {
      baseDir: 'api',
      per: 'operation',
      name(output) {
        const route = 'path' in output.item ? output.item.path : output.item.name;
        const routePath = this.routePathToFilePath(route);
        const segments = routePath.split('/').filter(Boolean);
        if (segments[0] === 'fcp') segments.shift();
        const base = segments.join('/') || 'index';
        const method = 'method' in output.item ? output.item.method : null;
        return method ? `${base}-${method.toLowerCase()}` : base;
      },
    }),
  }),
  {
    baseUrl: '/fcp',
    plugins: [lucideIconsPlugin(), openapiPlugin()],
  }
);

export const toolsSource = loader({
  source: tools.toFumadocsSource(),
  baseUrl: '/tools',
  plugins: [lucideIconsPlugin()],
});

export const gatewaySource = loader({
  source: multiple({
    docs: gateway.toFumadocsSource(),
    openapi: await openapiSource(openapi, {
      baseDir: 'api',
      per: 'operation',
      name(output) {
        const route = 'path' in output.item ? output.item.path : output.item.name;
        const routePath = this.routePathToFilePath(route);
        const segments = routePath.split('/').filter(Boolean);
        if (segments[0] === 'gateway') segments.shift();
        const base = segments.join('/') || 'index';
        const method = 'method' in output.item ? output.item.method : null;
        return method ? `${base}-${method.toLowerCase()}` : base;
      },
    }),
  }),
  baseUrl: '/gateway',
  plugins: [lucideIconsPlugin(), openapiPlugin()],
});

export const workspaceSource = loader({
  source: multiple({
    docs: workspace.toFumadocsSource(),
    openapi: await openapiSource(openapi, {
      baseDir: 'api',
      per: 'operation',
      name(output) {
        const route = 'path' in output.item ? output.item.path : output.item.name;
        const routePath = this.routePathToFilePath(route);
        const segments = routePath.split('/').filter(Boolean);
        if (segments[0] === 'workspace') segments.shift();
        const base = segments.join('/') || 'index';
        const method = 'method' in output.item ? output.item.method : null;
        return method ? `${base}-${method.toLowerCase()}` : base;
      },
    }),
  }),
  baseUrl: '/workspace',
  plugins: [lucideIconsPlugin(), openapiPlugin()],
});

export const graphSource = loader({
  source: multiple({
    docs: graph.toFumadocsSource(),
    openapi: await openapiSource(openapi, {
      baseDir: 'api',
      per: 'operation',
      name(output) {
        const route = 'path' in output.item ? output.item.path : output.item.name;
        const routePath = this.routePathToFilePath(route);
        const segments = routePath.split('/').filter(Boolean);
        if (segments[0] === 'graph') segments.shift();
        const base = segments.join('/') || 'index';
        const method = 'method' in output.item ? output.item.method : null;
        return method ? `${base}-${method.toLowerCase()}` : base;
      },
    }),
  }),
  baseUrl: '/graph',
  plugins: [lucideIconsPlugin(), openapiPlugin()],
});

export function getPageImage(page: InferPageType<typeof source>) {
  const segments = [...page.slugs, 'image.png'];

  return {
    segments,
    url: `/og/docs/${segments.join('/')}`,
  };
}

export function getGatewayPageImage(page: InferPageType<typeof gatewaySource>) {
  const segments = [...page.slugs, 'image.png'];

  return {
    segments,
    url: `/og/docs/${segments.join('/')}`,
  };
}

export function getWorkspacePageImage(page: InferPageType<typeof workspaceSource>) {
  const segments = [...page.slugs, 'image.png'];

  return {
    segments,
    url: `/og/docs/${segments.join('/')}`,
  };
}

export function getGraphPageImage(page: InferPageType<typeof graphSource>) {
  const segments = [...page.slugs, 'image.png'];

  return {
    segments,
    url: `/og/docs/${segments.join('/')}`,
  };
}

type LLMTextPage = {
  url?: string;
  data: {
    title?: string;
    type?: string;
    getSchema?: () => { bundled: unknown };
    getText?: (mode: 'processed' | 'raw') => Promise<string>;
  };
};

export async function getLLMText(page: LLMTextPage) {
  if (page.data.type === 'openapi' && page.data.getSchema) {
    // Return the stringified OpenAPI schema for LLM
    return JSON.stringify(page.data.getSchema().bundled, null, 2);
  }

  const processed = page.data.getText ? await page.data.getText('processed') : '';
  const title = page.data.title ?? 'Untitled';
  const url = page.url ? ` (${page.url})` : '';

  return `# ${title}${url}

${processed}`;
}
