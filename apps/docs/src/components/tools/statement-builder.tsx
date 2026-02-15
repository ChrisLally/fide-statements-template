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

type StatementResult = {
  statementFideId: string;
};

export function StatementBuilder() {
  const [subjectInput, setSubjectInput] = useState<FideIdInputValue>(
    createFideIdInputValue({
      mode: 'parts',
      entityType: 'Person',
      sourceType: 'Product',
    })
  );
  const [predicateInput, setPredicateInput] = useState<FideIdInputValue>(
    createFideIdInputValue({
      mode: 'parts',
      entityType: 'CreativeWork',
      sourceType: 'Product',
    })
  );
  const [objectInput, setObjectInput] = useState<FideIdInputValue>(
    createFideIdInputValue({
      mode: 'parts',
      entityType: 'CreativeWork',
      sourceType: 'Product',
    })
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StatementResult | null>(null);

  async function resolveToFideId(input: FideIdInputValue): Promise<string> {
    if (input.mode === 'fideId') {
      const fid = input.fideId.trim();
      if (!fid) {
        throw new Error('Missing Fide ID input');
      }
      return fid;
    }

    const rawIdentifier = input.rawIdentifier.trim();
    if (!rawIdentifier) {
      throw new Error('Missing raw identifier in Fide ID Parts');
    }

    const res = await fetch(`${API_BASE}/v1/fide-id/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entityType: input.entityType,
        sourceType: input.sourceType,
        rawIdentifier,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(`${data.code ?? 'ERROR'}: ${data.error ?? `HTTP ${res.status}`}`);
    }

    return data.fideId;
  }

  async function handleBuild() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const [subjectFideId, predicateFideId, objectFideId] = await Promise.all([
        resolveToFideId(subjectInput),
        resolveToFideId(predicateInput),
        resolveToFideId(objectInput),
      ]);

      const res = await fetch(`${API_BASE}/v1/fide-id/statement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectFideId,
          predicateFideId,
          objectFideId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(`${data.code ?? 'ERROR'}: ${data.error ?? `HTTP ${res.status}`}`);
        return;
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  const subjectReady =
    subjectInput.mode === 'fideId'
      ? subjectInput.fideId.trim().length > 0
      : subjectInput.rawIdentifier.trim().length > 0;
  const predicateReady =
    predicateInput.mode === 'fideId'
      ? predicateInput.fideId.trim().length > 0
      : predicateInput.rawIdentifier.trim().length > 0;
  const objectReady =
    objectInput.mode === 'fideId'
      ? objectInput.fideId.trim().length > 0
      : objectInput.rawIdentifier.trim().length > 0;

  return (
    <div className="my-6 rounded-lg border border-fd-border bg-fd-card p-4">
      <div className="space-y-4">
        <FideIdInput
          label="Subject"
          value={subjectInput}
          onChange={setSubjectInput}
          onSubmit={handleBuild}
          fideIdPlaceholder="did:fide:0x15..."
          rawIdentifierPlaceholder="https://x.com/alice"
        />

        <FideIdInput
          label="Predicate"
          value={predicateInput}
          onChange={setPredicateInput}
          onSubmit={handleBuild}
          fideIdPlaceholder="did:fide:0x65..."
          rawIdentifierPlaceholder="schema:name"
        />

        <FideIdInput
          label="Object"
          value={objectInput}
          onChange={setObjectInput}
          onSubmit={handleBuild}
          fideIdPlaceholder="did:fide:0x65..."
          rawIdentifierPlaceholder="Alice"
        />

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleBuild}
            disabled={loading || !subjectReady || !predicateReady || !objectReady}
            className={cn(buttonVariants(), 'px-4')}
          >
            {loading ? 'Building…' : 'Build Statement ID'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-md border border-fd-border bg-fd-muted/30 p-3 font-mono text-xs">
          <span className="text-fd-muted-foreground">statementFideId:</span>{' '}
          <code className="break-all">{result.statementFideId}</code>
        </div>
      )}
    </div>
  );
}
