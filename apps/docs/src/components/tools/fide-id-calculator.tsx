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

type CalculateResult = { fideId: string };
type ParseResult = {
  fideId: string;
  entityType: string;
  sourceType: string;
  fingerprint: string;
  typeChar: string;
  sourceChar: string;
};

export function FideIdCalculator() {
  const [input, setInput] = useState<FideIdInputValue>(
    createFideIdInputValue({ mode: 'parts', entityType: 'Person', sourceType: 'Product' })
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calculateResult, setCalculateResult] = useState<CalculateResult | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);

  async function handleRun() {
    if (input.mode === 'fideId' && !input.fideId.trim()) return;
    if (input.mode === 'parts' && !input.rawIdentifier.trim()) return;

    setLoading(true);
    setError(null);
    setParseResult(null);
    setCalculateResult(null);

    try {
      if (input.mode === 'parts') {
        const res = await fetch(`${API_BASE}/v1/fide-id/calculate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entityType: input.entityType,
            sourceType: input.sourceType,
            rawIdentifier: input.rawIdentifier.trim(),
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(`${data.code ?? 'ERROR'}: ${data.error ?? `HTTP ${res.status}`}`);
          return;
        }

        setCalculateResult(data);
        return;
      }

      const res = await fetch(`${API_BASE}/v1/fide-id/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fideId: input.fideId.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(`${data.code ?? 'ERROR'}: ${data.error ?? `HTTP ${res.status}`}`);
        return;
      }

      setParseResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  const canRun =
    input.mode === 'fideId' ? input.fideId.trim().length > 0 : input.rawIdentifier.trim().length > 0;

  return (
    <div className="my-6 rounded-lg border border-fd-border bg-fd-card p-4">
      <div className="space-y-3">
        <FideIdInput
          value={input}
          onChange={setInput}
          onSubmit={handleRun}
          fideIdPlaceholder="did:fide:0x15..."
          rawIdentifierPlaceholder="https://x.com/alice"
        />

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleRun}
            disabled={loading || !canRun}
            className={cn(buttonVariants(), 'px-4')}
          >
            {loading ? (input.mode === 'parts' ? 'Calculating…' : 'Parsing…') : input.mode === 'parts' ? 'Calculate' : 'Parse'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {calculateResult && (
        <div className="mt-4 rounded-md border border-fd-border bg-fd-muted/30 p-3 font-mono text-xs">
          <span className="text-fd-muted-foreground">fideId:</span>{' '}
          <code className="break-all">{calculateResult.fideId}</code>
        </div>
      )}

      {parseResult && (
        <div className="mt-4 rounded-md border border-fd-border bg-fd-muted/30 p-3 font-mono text-xs">
          <div className="space-y-1">
            <div>
              <span className="text-fd-muted-foreground">fideId:</span>{' '}
              <code className="break-all">{parseResult.fideId}</code>
            </div>
            <div>
              <span className="text-fd-muted-foreground">entityType:</span>{' '}
              {parseResult.entityType}
            </div>
            <div>
              <span className="text-fd-muted-foreground">sourceType:</span>{' '}
              {parseResult.sourceType}
            </div>
            <div>
              <span className="text-fd-muted-foreground">fingerprint:</span>{' '}
              {parseResult.fingerprint}
            </div>
            <div>
              <span className="text-fd-muted-foreground">typeChar:</span>{' '}
              {parseResult.typeChar}
            </div>
            <div>
              <span className="text-fd-muted-foreground">sourceChar:</span>{' '}
              {parseResult.sourceChar}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
