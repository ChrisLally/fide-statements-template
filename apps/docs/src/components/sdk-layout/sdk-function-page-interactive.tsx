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
    functionName,
    functionDescription,
    index,
    total,
}: {
    signature: SignatureData;
    functionName: string;
    functionDescription: string;
    index: number;
    total: number;
}) {
    const [paramValues, setParamValues] = useState<Record<string, ParamValue>>(() => {
        const initial: Record<string, ParamValue> = {};
        for (const param of signature.parameters) {
            initial[param.name] = param.example ?? getDefaultValue(param);
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
    value,
    onChange,
}: {
    param: ParameterData;
    value: ParamValue;
    onChange: (value: ParamValue) => void;
}) {
    const isGeneratedEnum = param.options && param.options.length > 0;
    const isInlineEnum = !isGeneratedEnum && /^"[^"]*"(\s*\|\s*"[^"]*")+$/.test(param.type);

    const isEnum = isGeneratedEnum || isInlineEnum;
    const enumValues = isGeneratedEnum
        ? param.options!
        : isInlineEnum
            ? param.type.split('|').map((v) => v.trim().replace(/^"|"$/g, ''))
            : [];

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
                <input
                    type="text"
                    value={String(value ?? '')}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={getPlaceholder(param)}
                    className="w-full rounded border border-fd-border bg-fd-background px-2 py-1.5 text-sm font-mono mt-2"
                />
            )}
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

function parseParamValue(value: ParamValue, type: string): unknown {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return undefined;

        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
                return JSON.parse(trimmed);
            } catch {
                return trimmed;
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
