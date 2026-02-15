'use client';

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export const ENTITY_TYPES = [
  'Person',
  'Organization',
  'Product',
  'CreativeWork',
  'Place',
  'Event',
  'AutonomousAgent',
  'CryptographicAccount',
  'Statement',
  'Attestation',
  'EvaluationMethod',
] as const;

type EntityType = (typeof ENTITY_TYPES)[number];

export type FideIdInputMode = 'fideId' | 'parts';

type FideIdSimpleValue = {
  mode: FideIdInputMode;
  fideId: string;
  entityType: EntityType;
  sourceType: EntityType;
  rawIdentifier: string;
};

export type StatementPartsValue = {
  subject: FideIdSimpleValue;
  predicate: FideIdSimpleValue;
  object: FideIdSimpleValue;
};

export type FideIdInputValue = FideIdSimpleValue & {
  statementParts?: StatementPartsValue;
};

type RawIdentifierType = 'text' | 'statement';

type Props = {
  value: FideIdInputValue;
  onChange: (value: FideIdInputValue) => void;
  onSubmit?: () => void;
  label?: string;
  fideIdPlaceholder?: string;
  rawIdentifierPlaceholder?: string;
  modes?: FideIdInputMode[];
  rawIdentifierType?: RawIdentifierType;
};

function LabelWithTooltip({ label, help }: { label: string; help: string }) {
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

function createStatementRawIdentifier(parts: StatementPartsValue): string {
  return JSON.stringify({
    o: parts.object.fideId.trim(),
    p: parts.predicate.fideId.trim(),
    s: parts.subject.fideId.trim(),
  });
}

function ensureStatementParts(value: FideIdInputValue): StatementPartsValue {
  if (value.statementParts) return value.statementParts;

  return {
    subject: createFideIdInputValue({ mode: 'parts', entityType: 'Person', sourceType: 'Product' }),
    predicate: createFideIdInputValue({ mode: 'parts', entityType: 'CreativeWork', sourceType: 'Product' }),
    object: createFideIdInputValue({ mode: 'parts', entityType: 'CreativeWork', sourceType: 'Product' }),
  };
}

export function FideIdInput({
  value,
  onChange,
  onSubmit,
  label,
  fideIdPlaceholder = 'did:fide:0x15...',
  rawIdentifierPlaceholder = 'https://x.com/alice',
  modes = ['parts', 'fideId'],
  rawIdentifierType = 'text',
}: Props) {
  const activeMode = modes.includes(value.mode) ? value.mode : modes[0] ?? 'fideId';
  const showModeTabs = modes.length > 1;
  const statementParts = rawIdentifierType === 'statement' ? ensureStatementParts(value) : undefined;

  function setMode(mode: FideIdInputMode) {
    onChange({ ...value, mode });
  }

  function setStatementParts(parts: StatementPartsValue) {
    onChange({
      ...value,
      statementParts: parts,
      rawIdentifier: createStatementRawIdentifier(parts),
    });
  }

  return (
    <div>
      {label && (
        <LabelWithTooltip
          label={label}
          help="Choose Fide ID mode: enter a full Fide ID directly, or derive one from entity/source/raw identifier parts."
        />
      )}

      {showModeTabs ? (
        <Tabs value={activeMode} onValueChange={(v) => setMode(v as FideIdInputMode)} className="w-full">
          <TabsList className="mb-2">
            {modes.includes('parts') && <TabsTrigger value="parts">Fide ID Parts</TabsTrigger>}
            {modes.includes('fideId') && <TabsTrigger value="fideId">Fide ID</TabsTrigger>}
          </TabsList>

          {modes.includes('parts') && (
            <TabsContent value="parts" className="mt-0">
              <div className="space-y-3">
                <div className={rawIdentifierType === 'statement' ? 'grid grid-cols-1 gap-2 sm:grid-cols-2' : 'grid grid-cols-1 gap-2 sm:grid-cols-3'}>
                  <div>
                    <LabelWithTooltip
                      label="Entity type"
                      help="Entity category encoded in the first Fide ID character."
                    />
                    <Combobox
                      items={[...ENTITY_TYPES]}
                      value={value.entityType}
                      onValueChange={(entityType) =>
                        onChange({ ...value, entityType: entityType as EntityType })
                      }
                    >
                      <ComboboxInput placeholder="Select entity type" />
                      <ComboboxContent>
                        <ComboboxEmpty>No items found.</ComboboxEmpty>
                        <ComboboxList>
                          {(item) => (
                            <ComboboxItem key={item} value={item}>
                              {item}
                            </ComboboxItem>
                          )}
                        </ComboboxList>
                      </ComboboxContent>
                    </Combobox>
                  </div>

                  <div>
                    <LabelWithTooltip
                      label="Source type"
                      help="Source category encoded in the second Fide ID character."
                    />
                    <Combobox
                      items={[...ENTITY_TYPES]}
                      value={value.sourceType}
                      onValueChange={(sourceType) =>
                        onChange({ ...value, sourceType: sourceType as EntityType })
                      }
                    >
                      <ComboboxInput placeholder="Select source type" />
                      <ComboboxContent>
                        <ComboboxEmpty>No items found.</ComboboxEmpty>
                        <ComboboxList>
                          {(item) => (
                            <ComboboxItem key={item} value={item}>
                              {item}
                            </ComboboxItem>
                          )}
                        </ComboboxList>
                      </ComboboxContent>
                    </Combobox>
                  </div>

                  {rawIdentifierType === 'text' && (
                    <div>
                      <LabelWithTooltip
                        label="Raw identifier"
                        help="Raw input string hashed with entity/source type to derive a Fide ID."
                      />
                      <input
                        type="text"
                        placeholder={rawIdentifierPlaceholder}
                        value={value.rawIdentifier}
                        onChange={(e) => onChange({ ...value, rawIdentifier: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && onSubmit?.()}
                        className="w-full rounded-md border border-fd-border bg-fd-background px-3 py-2 text-sm placeholder:text-fd-muted-foreground focus:outline-none focus:ring-2 focus:ring-fd-ring"
                      />
                    </div>
                  )}
                </div>

                {rawIdentifierType === 'statement' && statementParts && (
                  <div className="rounded-md border border-fd-border bg-fd-muted/20 p-3">
                    <LabelWithTooltip
                      label="Statement Raw Identifier"
                      help="Build the statement JSON from Subject, Predicate, and Object Fide IDs."
                    />
                    <div className="space-y-3">
                      <FideIdInput
                        label="Subject Fide ID"
                        value={statementParts.subject}
                        onChange={(subject) => setStatementParts({ ...statementParts, subject })}
                        onSubmit={onSubmit}
                        rawIdentifierType="text"
                        fideIdPlaceholder="did:fide:0x15..."
                      />

                      <FideIdInput
                        label="Predicate Fide ID"
                        value={statementParts.predicate}
                        onChange={(predicate) => setStatementParts({ ...statementParts, predicate })}
                        onSubmit={onSubmit}
                        rawIdentifierType="text"
                        fideIdPlaceholder="did:fide:0x65..."
                      />

                      <FideIdInput
                        label="Object Fide ID"
                        value={statementParts.object}
                        onChange={(object) => setStatementParts({ ...statementParts, object })}
                        onSubmit={onSubmit}
                        rawIdentifierType="text"
                        fideIdPlaceholder="did:fide:0x65..."
                      />
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          )}

          {modes.includes('fideId') && (
            <TabsContent value="fideId" className="mt-0">
              <input
                type="text"
                placeholder={fideIdPlaceholder}
                value={value.fideId}
                onChange={(e) => onChange({ ...value, fideId: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && onSubmit?.()}
                className="w-full rounded-md border border-fd-border bg-fd-background px-3 py-2 text-sm placeholder:text-fd-muted-foreground focus:outline-none focus:ring-2 focus:ring-fd-ring"
              />
            </TabsContent>
          )}
        </Tabs>
      ) : (
        <div>
          <input
            type="text"
            placeholder={fideIdPlaceholder}
            value={value.fideId}
            onChange={(e) => onChange({ ...value, fideId: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && onSubmit?.()}
            className="w-full rounded-md border border-fd-border bg-fd-background px-3 py-2 text-sm placeholder:text-fd-muted-foreground focus:outline-none focus:ring-2 focus:ring-fd-ring"
          />
        </div>
      )}
    </div>
  );
}

export function createFideIdInputValue(
  overrides?: Partial<FideIdInputValue>
): FideIdInputValue {
  return {
    mode: 'parts',
    fideId: '',
    entityType: 'Person',
    sourceType: 'Product',
    rawIdentifier: '',
    ...overrides,
  };
}
