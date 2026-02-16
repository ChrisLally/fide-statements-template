import type { SourceStatementBatchRef } from '../types.js';

export function toRawContentUrl(ref: SourceStatementBatchRef): string {
  const encodedPath = ref.path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `https://raw.githubusercontent.com/${ref.repo}/${ref.sha}/${encodedPath}`;
}

export async function fetchStatementBatchJsonlFromGitHub(ref: SourceStatementBatchRef): Promise<string> {
  const url = toRawContentUrl(ref);
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'fide-indexer/0.1',
      Accept: 'text/plain',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub fetch failed (${response.status}) for ${ref.repo}@${ref.sha}:${ref.path}`);
  }

  return response.text();
}
