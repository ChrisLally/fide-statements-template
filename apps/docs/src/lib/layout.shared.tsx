import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { DocsLogo } from '@/components/docs-layout/docs-logo';

// fill this with your actual GitHub info, for example:
export const gitConfig = {
  user: 'fide-work',
  repo: 'fcp',
  branch: 'main',
};

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <DocsLogo label="Docs" />,
    },
    links: [
      {
        text: 'Workspace',
        url: '/workspace',
        active: 'nested-url',
      },
      {
        text: 'Graph',
        url: '/graph',
        active: 'nested-url',
      },
      {
        text: 'Gateway',
        url: '/gateway',
        active: 'nested-url',
      },
      {
        text: 'FCP',
        url: '/fcp',
        active: 'nested-url',
      },
    ],
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
