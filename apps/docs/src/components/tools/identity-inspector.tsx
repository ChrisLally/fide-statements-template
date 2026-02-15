'use client';

import { useState } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import {
  createFideIdInputValue,
  FideIdInput,
  type FideIdInputValue,
} from '@/components/forms/fide-id-input';

const API_BASE =
  typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:3001/fcp'
    : 'https://api.fide.work/fcp';

type ResolveResult = {
  identityResolved: {
    fideId: string;
    rawIdentifier: string;
    type: string;
    source: string;
  };
  identifiers: Array<{ fideId: string; rawIdentifier: string }>;
};

export function IdentityInspector() {
  const [input, setInput] = useState<FideIdInputValue>(
    createFideIdInputValue({ mode: 'parts', entityType: 'Person', sourceType: 'Product' })
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResolveResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleResolve() {
    if (input.mode === 'fideId' && !input.fideId.trim()) return;
    if (input.mode === 'parts' && !input.rawIdentifier.trim()) return;

    const body =
      input.mode === 'fideId'
        ? { fideId: input.fideId.trim() }
        : {
            entityType: input.entityType,
            sourceType: input.sourceType,
            rawIdentifier: input.rawIdentifier.trim(),
          };

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`${API_BASE}/v1/identity/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  const canResolve =
    input.mode === 'fideId' ? input.fideId.trim().length > 0 : input.rawIdentifier.trim().length > 0;

  return (
    <div className="my-6 rounded-lg border border-fd-border bg-fd-card p-4">
      <div className="space-y-3">
        <FideIdInput
          value={input}
          onChange={setInput}
          onSubmit={handleResolve}
          fideIdPlaceholder="did:fide:0x15..."
          rawIdentifierPlaceholder="https://x.com/alice"
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleResolve}
            disabled={loading || !canResolve}
            className={cn(buttonVariants(), 'px-4')}
          >
            {loading ? 'Resolving…' : 'Resolve'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 space-y-4">
          <div>
            <h4 className="mb-2 text-sm font-medium text-fd-foreground">
              Identity Resolved
            </h4>
            <div className="rounded-md border border-fd-border bg-fd-muted/30 p-3 font-mono text-xs">
              <div className="space-y-1">
                <div>
                  <span className="text-fd-muted-foreground">fideId:</span>{' '}
                  <code className="break-all">{result.identityResolved.fideId}</code>
                </div>
                <div>
                  <span className="text-fd-muted-foreground">rawIdentifier:</span>{' '}
                  {result.identityResolved.rawIdentifier}
                </div>
                <div>
                  <span className="text-fd-muted-foreground">type:</span>{' '}
                  {result.identityResolved.type}
                </div>
                <div>
                  <span className="text-fd-muted-foreground">source:</span>{' '}
                  {result.identityResolved.source}
                </div>
              </div>
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-medium text-fd-foreground">
              Identifiers ({result.identifiers.length})
            </h4>
            <ul className="space-y-2">
              {result.identifiers.map((id, i) => (
                <li
                  key={i}
                  className={cn(
                    'rounded-md border p-2 font-mono text-xs',
                    id.fideId === result.identityResolved.fideId
                      ? 'border-fd-primary/50 bg-fd-primary/5'
                      : 'border-fd-border bg-fd-muted/20'
                  )}
                >
                  <div className="break-all">{id.fideId}</div>
                  <div className="mt-1 text-fd-muted-foreground">
                    {id.rawIdentifier}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
