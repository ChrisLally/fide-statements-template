/**
 * SDK INTERACTIVE PLAYGROUND COMPONENT
 * 
 * Provides a reactive, two-column interactive playground for dynamic SDK documentation.
 * 
 * FEATURES:
 * - Reactive Execution: Automatically runs SDK functions as parameters change.
 * - Sticky Panels: Keeps code examples and results visible during scroll.
 * - Smart Inputs: Uses Combobox for enums/unions and smart placeholders for types.
 * - Dynamic Offset: Measures #nd-subnav height to ensure pixel-perfect sticky positioning.
 * 
 * DATA FLOW:
 * generate-sdk-reference.ts (Static Build) -> MDX (Content) -> SDKFunctionPage (Layout) -> THIS COMPONENT
 */

'use client';

import { useState, useEffect } from 'react';
import { Callout } from 'fumadocs-ui/components/callout';
import { TypeTable } from 'fumadocs-ui/components/type-table';
import JSON5 from 'json5';
import { PackageManagerTabs } from '@/components/mdx/package-manager-tabs';
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@/components/ui/combobox";
import {
    CodeBlock,
    Pre,
    CodeBlockTab,
    CodeBlockTabs,
    CodeBlockTabsList,
    CodeBlockTabsTrigger,
} from 'fumadocs-ui/components/codeblock';
import type { SDKFunctionPageData, ParameterData, SignatureData, ConstantData, ReferencedType } from './sdk-function-page-types';

// Import the entire SDK so we can call functions dynamically
import * as FCP from '@fide.work/fcp';

type ParamValue = string | number | boolean | object | null;

export function SDKFunctionPageInteractive({ data }: { data: SDKFunctionPageData }) {
    const needsViemCallout = data.section === 'Signing' || data.section === 'Attestation';

    return (
        <>
            {needsViemCallout && (
                <Callout type="info" title="Optional Peer Dependency">
                    EIP-712 and EIP-191 flows require <code>viem</code>. Ed25519 works without it.
                    <PackageManagerTabs packageName="viem" />
                </Callout>
            )}

            {data.signatures.map((sig, i) => (
                <InteractiveSignatureSection
                    key={i}
                    signature={sig}
                    referencedTypes={sig.referencedTypes ?? data.referencedTypes ?? []}
                    functionName={data.name}
                    functionDescription={data.description}
                    index={i}
                    total={data.signatures.length}
                />
            ))}

            {data.constants && data.constants.length > 0 && (
                <ConstantSection constants={data.constants} />
            )}

            {data.referencedTypes && data.referencedTypes.length > 0 && (
                <TypeDefinitionsSection types={data.referencedTypes} />
            )}
        </>
    );
}

function InteractiveSignatureSection({
    signature,
    referencedTypes,
    functionName,
    functionDescription,
    index,
    total,
}: {
    signature: SignatureData;
    referencedTypes: ReferencedType[];
    functionName: string;
    functionDescription: string;
    index: number;
    total: number;
}) {
    const [paramValues, setParamValues] = useState<Record<string, ParamValue>>(() => {
        const initial: Record<string, ParamValue> = {};
        for (const param of signature.parameters) {
            initial[param.name] = getInitialParamValue(param);
        }
        return initial;
    });
    const [result, setResult] = useState<{ value: unknown; error?: string } | null>(null);
    const [loading, setLoading] = useState(false);

    const showSignatureDescription =
        Boolean(signature.description) &&
        (total > 1 || !functionDescription || signature.description !== functionDescription);

    const usageCode = generateUsageExample(functionName, signature, paramValues);

    useEffect(() => {
        let isMounted = true;
        const runSDKFunction = async () => {
            setLoading(true);
            try {
                const fn = (FCP as any)[functionName];
                if (typeof fn !== 'function') return;

                const args = signature.parameters.map((param) => {
                    const value = paramValues[param.name];
                    // Fallback to example/default if actual value is empty
                    const finalValue = (value === undefined || value === null || (typeof value === 'string' && value.trim() === ''))
                        ? (param.example ?? getDefaultValue(param))
                        : value;
                    return parseParamValue(finalValue, param.type);
                });

                const output = await Promise.resolve(fn(...args));
                if (isMounted) setResult({ value: output });
            } catch (err) {
                if (isMounted) {
                    setResult({
                        value: null,
                        error: err instanceof Error ? err.message : String(err),
                    });
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        runSDKFunction();
        return () => { isMounted = false; };
    }, [functionName, signature, paramValues]);

    function handleParamChange(paramName: string, newValue: ParamValue) {
        setParamValues({ ...paramValues, [paramName]: newValue });
    }

    const [headerHeight, setHeaderHeight] = useState('0px');

    useEffect(() => {
        const updateHeight = () => {
            const header = document.getElementById('nd-subnav');
            if (header) {
                const rect = header.getBoundingClientRect();
                setHeaderHeight(`${rect.height}px`);
            }
        };

        updateHeight();
        window.addEventListener('resize', updateHeight);
        return () => window.removeEventListener('resize', updateHeight);
    }, []);

    return (
        <div className="not-prose my-10 @container">
            {/* Two-column layout matching OpenAPI style */}
            <div className="flex flex-col gap-x-6 gap-y-4 @4xl:flex-row @4xl:items-start">
                {/* Left column: Interactive playground + type definitions */}
                <div className="min-w-0 flex-1">
                    {signature.infoCallout && (
                        <Callout type="info" title={signature.infoCallout.title} className="mb-4">
                            {signature.infoCallout.body || undefined}
                        </Callout>
                    )}

                    {showSignatureDescription && (
                        <div className="mb-4 text-sm text-fd-muted-foreground">
                            {signature.description}
                        </div>
                    )}

                    {/* Playground Header */}
                    <div className="flex flex-row items-center gap-2.5 p-3 rounded-xl border bg-fd-card text-fd-card-foreground mb-4">
                        <span className="font-mono text-xs font-semibold text-fd-primary">
                            {functionName}({signature.parameters.map((p) => p.name).join(', ')})
                        </span>
                        {loading && (
                            <span className="ml-auto text-xs text-fd-muted-foreground animate-pulse">
                                Calculating…
                            </span>
                        )}
                    </div>

                    {/* Parameters Section */}
                    {signature.parameters.length > 0 && (
                        <>
                            <h3 className="text-sm font-semibold mt-6 mb-3">Parameters</h3>
                            <div className="space-y-3">
                                {signature.parameters.map((param) => (
                                    <ParamInput
                                        key={param.name}
                                        param={param}
                                        typeIndex={buildReferencedTypeIndex(referencedTypes)}
                                        value={paramValues[param.name]}
                                        onChange={(val) => handleParamChange(param.name, val)}
                                    />
                                ))}
                            </div>
                        </>
                    )}

                    {/* Returns section moved back here */}
                    <div className="mt-10">
                        <h3 className="text-sm font-semibold mb-3">Returns</h3>
                        <ReturnBlock returnType={signature.returnType} returnDescription={signature.returnDescription} />
                    </div>
                </div>

                {/* Right column: Interactive Sandbox (sticky) */}
                <div
                    className="@4xl:sticky @4xl:w-[400px] flex flex-col gap-y-4"
                    style={{ top: `calc(var(--fd-docs-row-1, 0px) + ${headerHeight} + 1rem)` }}
                >
                    {/* Usage Block */}
                    <CodeBlockTabs defaultValue="ts">
                        <CodeBlockTabsList>
                            <CodeBlockTabsTrigger value="ts">TypeScript</CodeBlockTabsTrigger>
                        </CodeBlockTabsList>
                        <CodeBlockTab value="ts">
                            <CodeBlock allowCopy keepBackground={false} className="border-0 m-0 rounded-none bg-transparent">
                                <Pre className="ml-4">
                                    <code className="language-ts">{usageCode}</code>
                                </Pre>
                            </CodeBlock>
                        </CodeBlockTab>
                    </CodeBlockTabs>

                    {/* Result Block */}
                    {result && (
                        <CodeBlockTabs defaultValue="result">
                            <CodeBlockTabsList>
                                <CodeBlockTabsTrigger value="result">Result</CodeBlockTabsTrigger>
                            </CodeBlockTabsList>
                            <CodeBlockTab value="result">
                                <CodeBlock allowCopy keepBackground={false} className="border-0 m-0 rounded-none bg-transparent">
                                    <Pre className="max-h-[400px] ml-4">
                                        <code className={typeof result.value === 'string' ? '' : 'language-json'}>
                                            {typeof result.value === 'string'
                                                ? result.value
                                                : JSON.stringify(result.value, null, 2)}
                                        </code>
                                    </Pre>
                                </CodeBlock>
                            </CodeBlockTab>
                        </CodeBlockTabs>
                    )}

                    {/* Error Display */}
                    {result?.error && (
                        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400 font-mono whitespace-pre-wrap">
                            <strong>Error:</strong> {result.error}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function ParamInput({
    param,
    typeIndex,
    value,
    onChange,
}: {
    param: ParameterData;
    typeIndex: Map<string, ReferencedType>;
    value: ParamValue;
    onChange: (value: ParamValue) => void;
}) {
    const isGeneratedEnum = param.options && param.options.length > 0;
    const isInlineEnum = !isGeneratedEnum && /^"[^"]*"(\s*\|\s*"[^"]*")+$/.test(param.type);
    const isStructured = isStructuredType(param.type);
    const [structuredMode, setStructuredMode] = useState<'form' | 'json'>('form');

    const isEnum = isGeneratedEnum || isInlineEnum;
    const enumValues = isGeneratedEnum
        ? param.options!
        : isInlineEnum
            ? param.type.split('|').map((v) => v.trim().replace(/^"|"$/g, ''))
            : [];
    const structuredValue = toStructuredObject(value, param.type);
    const rootEntries = resolveTypeEntries(param.type, typeIndex);
    const canUseForm = isStructured && Boolean(rootEntries);

    return (
        <div className="rounded-md border border-fd-border bg-fd-background p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold">{param.name}</span>
                        <span className="text-xs text-fd-muted-foreground font-mono">{param.type}</span>
                        {!param.optional && (
                            <span className="text-xs text-red-500">*</span>
                        )}
                    </div>
                    {param.description && (
                        <div className="text-xs text-fd-muted-foreground mt-1">
                            {param.description}
                        </div>
                    )}
                </div>
            </div>

            {isEnum ? (
                <div className="relative mt-2">
                    <Combobox
                        items={enumValues}
                        value={String(value ?? '')}
                        onValueChange={(val) => onChange(val as string)}
                    >
                        <ComboboxInput
                            placeholder="Select value..."
                            className="bg-fd-background"
                        />
                        <ComboboxContent className="z-[100] min-w-[var(--anchor-width)]">
                            <ComboboxEmpty>No items found.</ComboboxEmpty>
                            <ComboboxList>
                                {(enumVal) => (
                                    <ComboboxItem key={enumVal} value={enumVal}>
                                        {enumVal}
                                    </ComboboxItem>
                                )}
                            </ComboboxList>
                        </ComboboxContent>
                    </Combobox>
                </div>
            ) : (
                isStructured ? (
                    <>
                        {canUseForm && (
                            <div className="mt-2 mb-2 flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setStructuredMode('form')}
                                    className={`px-2 py-1 text-xs rounded border ${structuredMode === 'form' ? 'bg-fd-accent border-fd-border' : 'border-fd-border text-fd-muted-foreground'}`}
                                >
                                    Form
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setStructuredMode('json')}
                                    className={`px-2 py-1 text-xs rounded border ${structuredMode === 'json' ? 'bg-fd-accent border-fd-border' : 'border-fd-border text-fd-muted-foreground'}`}
                                >
                                    JSON
                                </button>
                            </div>
                        )}
                        {!canUseForm || structuredMode === 'json' ? (
                            <textarea
                                value={stringifyParamValueForEditor(value)}
                                onChange={(e) => onChange(e.target.value)}
                                placeholder={getPlaceholder(param)}
                                rows={8}
                                spellCheck={false}
                                className="w-full rounded border border-fd-border bg-fd-background px-2 py-1.5 text-sm font-mono mt-2 resize-y"
                            />
                        ) : structuredValue && rootEntries ? (
                            <StructuredSchemaEditor
                                value={structuredValue}
                                entries={rootEntries}
                                typeIndex={typeIndex}
                                onChange={(next) => onChange(next)}
                            />
                        ) : (
                            <div className="mt-2 text-xs text-fd-muted-foreground">
                                Invalid structured input. Switch to JSON mode to fix parse errors.
                            </div>
                        )}
                    </>
                ) : (
                    <input
                        type="text"
                        value={String(value ?? '')}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={getPlaceholder(param)}
                        className="w-full rounded border border-fd-border bg-fd-background px-2 py-1.5 text-sm font-mono mt-2"
                    />
                )
            )}
            {isFideIdLikeType(param.type) && typeof value === 'string' && value.trim() !== '' && !isValidFideIdValue(value) && (
                <div className="mt-1 text-xs text-red-500">
                    Invalid Fide ID format. Expected <code>did:fide:0x</code> + 40 hex chars.
                </div>
            )}
        </div>
    );
}

function StructuredSchemaEditor({
    value,
    entries,
    typeIndex,
    onChange,
}: {
    value: Record<string, unknown>;
    entries: Record<string, { description: string; type: string; required: boolean }>;
    typeIndex: Map<string, ReferencedType>;
    onChange: (value: Record<string, unknown>) => void;
}) {
    return (
        <div className="mt-2 space-y-2">
            {Object.entries(entries).map(([key, schema]) => {
                const current = value[key];
                const nestedEntries = resolveTypeEntries(schema.type, typeIndex);
                if (nestedEntries) {
                    const nestedValue =
                        current && typeof current === 'object' && !Array.isArray(current)
                            ? (current as Record<string, unknown>)
                            : {};
                    return (
                        <div key={key} className="rounded border border-fd-border p-2">
                            <div className="text-xs font-mono font-semibold mb-2">
                                {key} {schema.required ? <span className="text-red-500">*</span> : null}
                            </div>
                            {schema.description ? (
                                <div className="text-xs text-fd-muted-foreground mb-2">{schema.description}</div>
                            ) : null}
                            <StructuredSchemaEditor
                                value={nestedValue}
                                entries={nestedEntries}
                                typeIndex={typeIndex}
                                onChange={(nextNested) => {
                                    onChange({
                                        ...value,
                                        [key]: nextNested,
                                    });
                                }}
                            />
                        </div>
                    );
                }

                const unionOptions = resolveUnionOptions(schema.type, typeIndex);
                if (unionOptions.length > 0) {
                    return (
                        <div key={key}>
                            <div className="text-xs font-mono mb-1">
                                {key} {schema.required ? <span className="text-red-500">*</span> : null}
                            </div>
                            <Combobox
                                items={unionOptions}
                                value={String(current ?? '')}
                                onValueChange={(val) => {
                                    onChange({
                                        ...value,
                                        [key]: val,
                                    });
                                }}
                            >
                                <ComboboxInput
                                    placeholder="Select value..."
                                    className="bg-fd-background"
                                />
                                <ComboboxContent className="z-[100] min-w-[var(--anchor-width)]">
                                    <ComboboxEmpty>No items found.</ComboboxEmpty>
                                    <ComboboxList>
                                        {(enumVal) => (
                                            <ComboboxItem key={enumVal} value={enumVal}>
                                                {enumVal}
                                            </ComboboxItem>
                                        )}
                                    </ComboboxList>
                                </ComboboxContent>
                            </Combobox>
                        </div>
                    );
                }

                if (Array.isArray(current)) {
                    return (
                        <div key={key}>
                            <div className="text-xs font-mono mb-1">
                                {key} {schema.required ? <span className="text-red-500">*</span> : null}
                            </div>
                            <textarea
                                value={JSON.stringify(current, null, 2)}
                                rows={4}
                                spellCheck={false}
                                onChange={(e) => {
                                    try {
                                        const parsed = JSON5.parse(e.target.value);
                                        if (Array.isArray(parsed)) {
                                            onChange({
                                                ...value,
                                                [key]: parsed,
                                            });
                                        }
                                    } catch {
                                        // Keep user typing without forcing parse errors.
                                    }
                                }}
                                className="w-full rounded border border-fd-border bg-fd-background px-2 py-1.5 text-sm font-mono resize-y"
                            />
                        </div>
                    );
                }

                const inputValue = current === null || current === undefined ? '' : String(current);
                return (
                    <div key={key}>
                        <div className="text-xs font-mono mb-1">
                            {key} {schema.required ? <span className="text-red-500">*</span> : null}
                        </div>
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => {
                                onChange({
                                    ...value,
                                    [key]: coerceByType(e.target.value, schema.type, current),
                                });
                            }}
                            className="w-full rounded border border-fd-border bg-fd-background px-2 py-1.5 text-sm font-mono"
                        />
                        {isFideIdLikeType(schema.type) && inputValue.trim() !== '' && !isValidFideIdValue(inputValue) && (
                            <div className="mt-1 text-xs text-red-500">
                                Invalid Fide ID format. Expected <code>did:fide:0x</code> + 40 hex chars.
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function ReturnBlock({ returnType, returnDescription }: { returnType: string; returnDescription: string }) {
    const typeObj = {
        'Type': {
            description: returnDescription || '',
            type: returnType,
            required: true,
        },
    };

    return <TypeTable type={typeObj} />;
}

function ConstantSection({ constants }: { constants: ConstantData[] }) {
    if (constants.length === 0) return null;

    return (
        <>
            <hr className="my-8" />
            <h2 className="text-xl font-semibold mb-4">Related Constants</h2>
            {constants.map((constant) => (
                <div key={constant.name} id={constant.name.toLowerCase()} className="mb-6">
                    <h3 className="text-lg font-semibold mb-2">
                        <code>{constant.name}</code>
                    </h3>
                    {constant.description && <p className="text-sm text-fd-muted-foreground mb-3">{constant.description}</p>}
                    <div className="rounded-lg border bg-fd-card p-4 mb-3">
                        <pre className="text-xs overflow-x-auto"><code className="language-ts">{`export const ${constant.name}: ${constant.typeText}`}</code></pre>
                    </div>
                    {constant.typeTableEntries && (
                        <TypeTable type={constant.typeTableEntries} />
                    )}
                </div>
            ))}
        </>
    );
}

function TypeDefinitionsSection({ types }: { types: ReferencedType[] }) {
    if (types.length === 0) return null;

    return (
        <>
            <hr className="my-10" />
            <h2 className="text-xl font-semibold mb-6">Type Definitions</h2>
            <div className="space-y-10">
                {types.map((type) => (
                    <div key={type.name} id={type.name.toLowerCase()}>
                        <h3 className="text-lg font-mono font-semibold mb-3 flex items-center gap-3">
                            <span>
                                <span className="text-fd-muted-foreground font-normal">type</span> {type.name}
                            </span>
                            {type.docsUrl && (
                                <a
                                    href={type.docsUrl}
                                    className="text-xs font-sans font-medium text-fd-primary hover:underline"
                                >
                                    Related docs
                                </a>
                            )}
                        </h3>
                        {type.description && <p className="text-sm text-fd-muted-foreground mb-4">{type.description}</p>}

                        <div className="rounded-xl border bg-fd-card p-4 mb-4 overflow-x-auto">
                            <pre className="text-xs font-mono"><code className="language-ts">{type.type}</code></pre>
                        </div>

                        {type.entries && (
                            <div>
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-fd-muted-foreground mb-2">Properties</h4>
                                <TypeTable type={type.entries} />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </>
    );
}

interface CodeBlockPanelProps {
    code: string;
    title?: string;
    language?: string;
    error?: string;
}

function CodeBlockPanel({ code, title = 'TypeScript', language = 'ts', error }: CodeBlockPanelProps) {
    if (error) {
        return (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-red-500/30 bg-red-500/5">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-red-600 dark:text-red-400">{title}</span>
                </div>
                <div className="p-4 text-sm text-red-600 dark:text-red-400 font-mono whitespace-pre-wrap">
                    <strong>Error:</strong> {error}
                </div>
            </div>
        );
    }

    return (
        <CodeBlock
            allowCopy
            keepBackground={false}
            className="not-prose"
        >
            <Pre className="max-h-[400px]">
                <code className={`language-${language}`}>{code}</code>
            </Pre>
        </CodeBlock>
    );
}

// ============================================================================
// Helpers
// ============================================================================

function getDefaultValue(param: ParameterData): ParamValue {
    if (param.example) return param.example;
    const t = param.type;
    if (/\bboolean\b/.test(t)) return false;
    if (/\bnumber\b/.test(t)) return 0;
    if (/\[\]$/.test(t) || /\bArray</.test(t)) return '[]';
    if (/\{/.test(t) || /Record</.test(t)) return '{}';
    return '';
}

function getInitialParamValue(param: ParameterData): ParamValue {
    const raw = param.example ?? getDefaultValue(param);
    if (isStructuredType(param.type)) {
        return parseParamValue(raw, param.type) as ParamValue;
    }
    return raw;
}

function getPlaceholder(param: ParameterData): string {
    if (param.example) return `Example: ${param.example}`;
    const t = param.type;
    const n = param.name;
    if (/fideid|fideId|_id$/i.test(n)) return 'did:fide:0x...';
    if (/\bboolean\b/.test(t)) return 'true or false';
    if (/\bnumber\b/.test(t)) return '123';
    if (/\[\]$/.test(t) || /\bArray</.test(t)) return '["item1", "item2"]';
    if (/\{/.test(t) || /Record</.test(t)) return '{"key": "value"}';
    return `Enter ${n}`;
}

function isStructuredType(type: string): boolean {
    if (isFideIdLikeType(type)) return false;
    return (
        /\[\]$/.test(type) ||
        /\bArray</.test(type) ||
        /\{/.test(type) ||
        /\bRecord</.test(type) ||
        /^[A-Z][A-Za-z0-9_]*$/.test(type)
    );
}

function toStructuredObject(value: ParamValue, type: string): Record<string, unknown> | null {
    const parsed = parseParamValue(value, type);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
    }
    return null;
}

function buildReferencedTypeIndex(types: ReferencedType[]): Map<string, ReferencedType> {
    return new Map(types.map((t) => [t.name, t]));
}

function resolveTypeEntries(
    type: string,
    typeIndex: Map<string, ReferencedType>
): Record<string, { description: string; type: string; required: boolean }> | undefined {
    const named = typeIndex.get(type)?.entries;
    if (named) return named;
    return parseInlineObjectEntries(type);
}

function parseInlineObjectEntries(
    type: string
): Record<string, { description: string; type: string; required: boolean }> | undefined {
    const trimmed = type.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return undefined;
    const body = trimmed.slice(1, -1).trim();
    if (!body) return {};
    const fields = body.split(';').map((part) => part.trim()).filter(Boolean);
    const result: Record<string, { description: string; type: string; required: boolean }> = {};
    for (const field of fields) {
        const match = field.match(/^([A-Za-z_$][A-Za-z0-9_$]*)(\??):\s*(.+)$/);
        if (!match) continue;
        const [, name, opt, fieldType] = match;
        result[name] = {
            description: '',
            type: fieldType.trim(),
            required: opt !== '?',
        };
    }
    return Object.keys(result).length > 0 ? result : undefined;
}

function parseStringLiteralUnion(type: string): string[] {
  const matches = [...type.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  if (matches.length === 0) return [];
  const unionLike = /^"[^"]+"(\s*\|\s*"[^"]+")*$/.test(type.trim());
  return unionLike ? [...new Set(matches)] : [];
}

function isFideIdLikeType(type: string): boolean {
    return type === 'FideId' || /did:fide:0x/.test(type);
}

function isValidFideIdValue(value: string): boolean {
    return /^did:fide:0x[0-9a-f]{40}$/i.test(value.trim());
}

function resolveUnionOptions(type: string, typeIndex: Map<string, ReferencedType>): string[] {
    const inline = parseStringLiteralUnion(type);
    if (inline.length > 0) return inline;

    const referenced = typeIndex.get(type);
    if (!referenced) return [];
    return parseStringLiteralUnion(referenced.type);
}

function stringifyParamValueForEditor(value: ParamValue): string {
    if (typeof value === 'string') return value;
    if (value === null || value === undefined) return '';
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}

function parseParamValue(value: ParamValue, type: string): unknown {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return undefined;

        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
                return JSON.parse(trimmed);
            } catch {
                try {
                    // Accept JS-style object literals from @paramDefault and manual input
                    // (e.g. unquoted keys, single quotes, trailing commas).
                    return JSON5.parse(trimmed);
                } catch {
                    return trimmed;
                }
            }
        }

        if (trimmed === 'true') return true;
        if (trimmed === 'false') return false;

        if (/\bnumber\b/.test(type) && /^-?\d+(\.\d+)?$/.test(trimmed)) {
            return Number(trimmed);
        }

        return trimmed;
    }

    return value;
}

function coerceByType(nextRaw: string, declaredType: string, previousValue: unknown): unknown {
    if (typeof previousValue === 'boolean') {
        if (nextRaw.toLowerCase() === 'true') return true;
        if (nextRaw.toLowerCase() === 'false') return false;
    }
    if (typeof previousValue === 'number' || /\bnumber\b/.test(declaredType)) {
        const n = Number(nextRaw);
        if (!Number.isNaN(n)) return n;
    }
    if (previousValue === null && nextRaw.trim().toLowerCase() === 'null') return null;
    return nextRaw;
}

function generateUsageExample(
    functionName: string,
    signature: SignatureData,
    values: Record<string, ParamValue>
): string {
    const importStatement = `import { ${functionName} } from '@fide.work/fcp';\n\n`;

    const args = signature.parameters.map((param) => {
        const value = values[param.name];
        if (value === null || value === undefined || value === '') {
            return getDefaultValue(param);
        }
        if (typeof value === 'string') {
            if (value.trim().startsWith('{') || value.trim().startsWith('[')) {
                return value.trim();
            }
            return `'${value}'`;
        }
        return JSON.stringify(value);
    });

    const call =
        args.length === 0
            ? `${functionName}()`
            : args.length === 1
                ? `${functionName}(${args[0]})`
                : `${functionName}(\n${args.map((arg) => `  ${arg}`).join(',\n')}\n)`;

    const isPromise = /^Promise<[\s\S]+>$/.test(signature.returnType.trim());
    const usageCode = isPromise ? `const result = await ${call};` : `const result = ${call};`;

    return importStatement + usageCode;
}
