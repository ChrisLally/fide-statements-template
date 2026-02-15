'use client';

import { useState } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  createFideIdInputValue,
  FideIdInput,
  type FideIdInputValue,
} from '@/components/forms/fide-id-input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';

const API_BASE =
  typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:3001/fcp'
    : 'https://api.fide.work/fcp';

type VerifyResponse = {
  valid: boolean;
};

function FieldLabel({ label, help }: { label: string; help: string }) {
  return (
    <div className="mb-1 text-xs font-medium text-fd-muted-foreground">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help underline decoration-dotted underline-offset-2">
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6}>
          {help}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export function AttestationVerifier() {
  const [statementInput, setStatementInput] = useState<FideIdInputValue>(
    createFideIdInputValue({
      mode: 'parts',
      entityType: 'Statement',
      sourceType: 'Statement',
    })
  );
  const [method, setMethod] = useState<'ed25519' | 'eip712' | 'eip191'>('ed25519');
  const [publicKeyOrAddress, setPublicKeyOrAddress] = useState('');
  const [proofMode, setProofMode] = useState<'fields' | 'json'>('fields');
  const [proofHash, setProofHash] = useState(
    '5278508e42f65b08ad7259f4b7709f02a5f645fa3ad4db328f4f0887acde5f40'
  );
  const [proofPosition, setProofPosition] = useState<'left' | 'right'>('left');
  const [proofInput, setProofInput] = useState(
    '[{"hash":"5278508e42f65b08ad7259f4b7709f02a5f645fa3ad4db328f4f0887acde5f40","position":"left"}]'
  );
  const [attestationMode, setAttestationMode] = useState<'fields' | 'json'>('fields');
  const [attestationM, setAttestationM] = useState<'ed25519' | 'eip712' | 'eip191'>(
    'ed25519'
  );
  const [attestationU, setAttestationU] = useState('ed25519::abc123');
  const [attestationR, setAttestationR] = useState(
    '62724d7c07c7e9148f5aca9340c97844a1b8c5e8d8e8e8e8e8e8e8e8e8e8e8e8'
  );
  const [attestationS, setAttestationS] = useState('base64-or-hex-signature');
  const [attestationInput, setAttestationInput] = useState(
    '{"m":"ed25519","u":"ed25519::abc123","r":"62724d7c07c7e9148f5aca9340c97844a1b8c5e8d8e8e8e8e8e8e8e8e8e8e8e8","s":"base64-or-hex-signature"}'
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyResponse | null>(null);

  async function resolveStatementFideId(input: FideIdInputValue): Promise<string> {
    if (input.mode === 'fideId') {
      const fideId = input.fideId.trim();
      if (!fideId) {
        throw new Error('Statement Fide ID is required');
      }
      return fideId;
    }

    const rawIdentifier = input.rawIdentifier.trim();
    if (!rawIdentifier) {
      throw new Error('Raw identifier is required in Fide ID Parts mode');
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

  async function handleVerify() {
    if (!publicKeyOrAddress.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const statementFideId = await resolveStatementFideId(statementInput);
      let parsedProof: unknown;
      let parsedAttestation: unknown;

      if (proofMode === 'fields') {
        parsedProof = [{ hash: proofHash.trim(), position: proofPosition }];
      } else {
        try {
          parsedProof = JSON.parse(proofInput);
        } catch {
          setError('Proof must be valid JSON');
          return;
        }
      }

      if (attestationMode === 'fields') {
        parsedAttestation = {
          m: attestationM,
          u: attestationU.trim(),
          r: attestationR.trim(),
          s: attestationS.trim(),
        };
      } else {
        try {
          parsedAttestation = JSON.parse(attestationInput);
        } catch {
          setError('attestationData must be valid JSON');
          return;
        }
      }

      const res = await fetch(`${API_BASE}/v1/attestations/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          statementFideId: statementFideId.trim(),
          proof: parsedProof,
          attestationData: parsedAttestation,
          method,
          publicKeyOrAddress: publicKeyOrAddress.trim(),
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

  return (
    <div className="my-6 rounded-lg border border-fd-border bg-fd-card p-4">
      <div className="space-y-3">
        <div>
          <FideIdInput
            label="Statement Fide ID"
            value={statementInput}
            onChange={setStatementInput}
            onSubmit={handleVerify}
            fideIdPlaceholder="did:fide:0x00..."
            rawIdentifierType="statement"
          />
        </div>

        <div>
          <FieldLabel
            label="Method"
            help="Signature scheme used by this attestation."
          />
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as 'ed25519' | 'eip712' | 'eip191')}
            className="w-full rounded-md border border-fd-border bg-fd-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-fd-ring"
          >
            <option value="ed25519">ed25519</option>
            <option value="eip712">eip712</option>
            <option value="eip191">eip191</option>
          </select>
        </div>

        <div>
          <FieldLabel
            label="Public key or address"
            help="Use a 32-byte Ed25519 public key (hex/base64) for ed25519, or an EVM address for eip712/eip191."
          />
          <input
            type="text"
            placeholder={
              method === 'ed25519'
                ? '0x... (32-byte hex) or base64'
                : '0x... (EVM address)'
            }
            value={publicKeyOrAddress}
            onChange={(e) => setPublicKeyOrAddress(e.target.value)}
            className="w-full rounded-md border border-fd-border bg-fd-background px-3 py-2 text-sm placeholder:text-fd-muted-foreground focus:outline-none focus:ring-2 focus:ring-fd-ring"
          />
        </div>

        <div>
          <FieldLabel
            label="Proof"
            help="Merkle proof path for this statement."
          />
          <Tabs
            value={proofMode}
            onValueChange={(v) => {
              const next = v as 'fields' | 'json';
              setProofMode(next);
              if (next === 'json') {
                setProofInput(
                  JSON.stringify(
                    [{ hash: proofHash.trim(), position: proofPosition }],
                    null,
                    2
                  )
                );
              }
            }}
            className="w-full"
          >
            <TabsList className="mb-2">
              <TabsTrigger value="fields">Fields</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
            </TabsList>
            <TabsContent value="fields" className="mt-0 space-y-2">
              <FieldLabel
                label="Sibling hash"
                help="Neighbor hash at this Merkle level."
              />
              <input
                type="text"
                placeholder="Sibling hash"
                value={proofHash}
                onChange={(e) => setProofHash(e.target.value)}
                className="w-full rounded-md border border-fd-border bg-fd-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-fd-ring"
              />
              <FieldLabel
                label="Position"
                help="Whether the sibling hash is left or right of the current hash when recomputing the path."
              />
              <select
                value={proofPosition}
                onChange={(e) => setProofPosition(e.target.value as 'left' | 'right')}
                className="w-full rounded-md border border-fd-border bg-fd-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-fd-ring"
              >
                <option value="left">left</option>
                <option value="right">right</option>
              </select>
            </TabsContent>
            <TabsContent value="json" className="mt-0">
              <textarea
                value={proofInput}
                onChange={(e) => setProofInput(e.target.value)}
                rows={4}
                className="w-full rounded-md border border-fd-border bg-fd-background px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-fd-ring"
              />
            </TabsContent>
          </Tabs>
        </div>

        <div>
          <FieldLabel
            label="attestationData"
            help="Attestation payload containing method, user, Merkle root, and signature."
          />
          <Tabs
            value={attestationMode}
            onValueChange={(v) => {
              const next = v as 'fields' | 'json';
              setAttestationMode(next);
              if (next === 'json') {
                setAttestationInput(
                  JSON.stringify(
                    {
                      m: attestationM,
                      u: attestationU.trim(),
                      r: attestationR.trim(),
                      s: attestationS.trim(),
                    },
                    null,
                    2
                  )
                );
              }
            }}
            className="w-full"
          >
            <TabsList className="mb-2">
              <TabsTrigger value="fields">Fields</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
            </TabsList>
            <TabsContent value="fields" className="mt-0 space-y-2">
              <FieldLabel
                label="Method (m)"
                help="Signing method recorded inside attestationData."
              />
              <select
                value={attestationM}
                onChange={(e) =>
                  setAttestationM(e.target.value as 'ed25519' | 'eip712' | 'eip191')
                }
                className="w-full rounded-md border border-fd-border bg-fd-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-fd-ring"
              >
                <option value="ed25519">ed25519</option>
                <option value="eip712">eip712</option>
                <option value="eip191">eip191</option>
              </select>
              <FieldLabel
                label="User (u)"
                help="Signer identity string (usually CAIP-10 style)."
              />
              <input
                type="text"
                placeholder="u"
                value={attestationU}
                onChange={(e) => setAttestationU(e.target.value)}
                className="w-full rounded-md border border-fd-border bg-fd-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-fd-ring"
              />
              <FieldLabel
                label="Merkle root (r)"
                help="Merkle commitment that the signature covers."
              />
              <input
                type="text"
                placeholder="r"
                value={attestationR}
                onChange={(e) => setAttestationR(e.target.value)}
                className="w-full rounded-md border border-fd-border bg-fd-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-fd-ring"
              />
              <FieldLabel
                label="Signature (s)"
                help="Signature bytes over the Merkle root."
              />
              <input
                type="text"
                placeholder="s"
                value={attestationS}
                onChange={(e) => setAttestationS(e.target.value)}
                className="w-full rounded-md border border-fd-border bg-fd-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-fd-ring"
              />
            </TabsContent>
            <TabsContent value="json" className="mt-0">
              <textarea
                value={attestationInput}
                onChange={(e) => setAttestationInput(e.target.value)}
                rows={6}
                className="w-full rounded-md border border-fd-border bg-fd-background px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-fd-ring"
              />
            </TabsContent>
          </Tabs>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleVerify}
            disabled={
              loading ||
              !publicKeyOrAddress.trim() ||
              (statementInput.mode === 'fideId'
                ? !statementInput.fideId.trim()
                : !statementInput.rawIdentifier.trim())
            }
            className={cn(buttonVariants(), 'px-4')}
          >
            {loading ? 'Verifying…' : 'Verify'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {result && (
        <div
          className={cn(
            'mt-4 rounded-md border px-3 py-2 text-sm',
            result.valid
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
          )}
        >
          valid: <span className="font-mono">{String(result.valid)}</span>
        </div>
      )}
    </div>
  );
}
