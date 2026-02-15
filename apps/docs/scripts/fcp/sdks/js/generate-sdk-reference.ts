/**
 * SDK REFERENCE GENERATOR SCRIPT
 * 
 * Automates documentation generation by parsing the @fide.work/fcp SDK library source code.
 * 
 * HOW IT WORKS:
 * 1. Uses TypeScript Compiler API to walk the SDK entry points.
 * 2. Extracts JSDoc descriptions, @example code, and custom @infoCallout tags.
 * 3. Smart Extraction: Automatically resolves literal unions (enums) to provide dropdown options in documentation.
 * 4. Param Defaults: Reads custom @paramDefault tags to pre-populate playground inputs.
 * 5. Emits MDX files to content/fcp/sdks/js/ that reference the <SDKFunctionPage> component.
 * 
 * To run: `pnpm run sdk:generate` (from apps/docs).
 */

import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// ============================================================================
// TYPES
// ============================================================================

type ExportItem = {
  name: string;
  source: string;
};

type ParameterData = {
  name: string;
  type: string;
  optional: boolean;
  description: string;
  example?: string;
  options?: string[];
};

type SignatureData = {
  description: string;
  parameters: ParameterData[];
  returnType: string;
  returnDescription: string;
  exampleCode?: string;
  infoCallout?: { title: string; body: string };
  referencedTypes: ReferencedType[];
};

type ExportDetails = {
  kind: string;
  description: string;
  signatures: SignatureData[];
  typeText?: string;
};

type ConstantData = {
  name: string;
  description: string;
  typeText: string;
  typeTableEntries?: Record<string, { description: string; type: string; required: boolean }>;
};

type ReferencedType = {
  name: string;
  description: string;
  type: string;
  docsUrl?: string;
  entries?: Record<string, { description: string; type: string; required: boolean }>;
};

type SDKFunctionPageData = {
  name: string;
  description: string;
  section: string;
  signatures: SignatureData[];
  constants: ConstantData[];
  referencedTypes: ReferencedType[];
};

const PRIMITIVE_AND_SKIP = new Set([
  'string', 'number', 'boolean', 'any', 'unknown', 'void', 'null', 'undefined',
  'Promise', 'Array', 'Record', 'Set', 'Map', 'Object', 'Function',
]);

function extractReferencedType(
  checker: ts.TypeChecker,
  type: ts.Type,
  decl: ts.Declaration
): ReferencedType | undefined {
  const symbol = type.aliasSymbol ?? type.getSymbol();
  if (!symbol) return undefined;

  const name = symbol.getName();

  // Skip internal types and primitives
  if (name.startsWith('__')) return undefined;
  if (PRIMITIVE_AND_SKIP.has(name)) return undefined;
  // Skip generic containers unless they are specific aliases (e.g. SDK-defined type)
  if (['Promise', 'Array', 'Record', 'Set', 'Map'].includes(name) && !type.aliasSymbol) return undefined;

  const description = displayPartsToString(symbol.getDocumentationComment(checker));
  const typeText = checker.typeToString(type, decl, ts.TypeFormatFlags.NoTruncation);
  const docsUrl = extractDocsUrlFromSymbol(symbol, symbol.getDeclarations()?.[0]);

  // If it's a union of literal types, we want to show it
  // If it's an object-like type, try to extract properties
  const entries = extractPropertiesFromType(checker, type, decl);

  return {
    name,
    description,
    type: typeText,
    docsUrl,
    entries,
  };
}

/**
 * Resolve a named type from the SDK module exports.
 * Used when the checker's resolved type loses alias info (e.g. FideEntityType -> union of string literals).
 */
function resolveReferencedTypeByName(
  checker: ts.TypeChecker,
  moduleSymbol: ts.Symbol,
  typeName: string
): ReferencedType | undefined {
  if (PRIMITIVE_AND_SKIP.has(typeName)) return undefined;

  const exports = checker.getExportsOfModule(moduleSymbol);
  const typeSym = exports.find((s) => s.getName() === typeName);
  if (!typeSym) return undefined;

  const resolved = (typeSym.flags & ts.SymbolFlags.Alias) !== 0
    ? checker.getAliasedSymbol(typeSym)
    : typeSym;
  const decl = resolved.getDeclarations()?.[0];
  if (!decl) return undefined;

  const type = checker.getTypeAtLocation(decl);
  const description = displayPartsToString(resolved.getDocumentationComment(checker));
  const typeText = checker.typeToString(type, decl, ts.TypeFormatFlags.NoTruncation);
  const docsUrl = extractDocsUrlFromSymbol(resolved, decl);

  // Don't extract "properties" for union-of-literals types (e.g. FideEntityType) — they
  // would incorrectly include String/Number prototype methods
  const isUnionOfLiterals =
    type.isUnion?.() &&
    (type as ts.UnionType).types?.every((t) => t.isStringLiteral() || t.isNumberLiteral());
  const entries = isUnionOfLiterals ? undefined : extractPropertiesFromType(checker, type, decl);

  return {
    name: typeName,
    description,
    type: typeText,
    docsUrl,
    entries,
  };
}

/** Extract PascalCase type names from a type string (e.g. "Promise<FideId>" -> ["FideId"]). */
function extractTypeNamesFromTypeString(typeStr: string): string[] {
  const matches = typeStr.match(/\b([A-Z][a-zA-Z0-9]*)\b/g) ?? [];
  return [...new Set(matches)].filter((n) => !PRIMITIVE_AND_SKIP.has(n));
}

// ============================================================================
// PATHS
// ============================================================================

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DOCS_ROOT = resolve(SCRIPT_DIR, '..', '..', '..', '..');
const WORKSPACE_ROOT = resolve(DOCS_ROOT, '..', '..');
const SDK_ENTRY = resolve(WORKSPACE_ROOT, 'packages/fcp/packages/fcp-js/src/index.ts');
const OUTPUT_DIR = resolve(DOCS_ROOT, 'content/fcp/sdks/js');

// ============================================================================
// UTILITIES
// ============================================================================

function toSlug(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function displayPartsToString(parts: ts.SymbolDisplayPart[] | undefined): string {
  return parts?.map((p) => p.text).join('') ?? '';
}

function extractDocsUrlFromSymbol(symbol: ts.Symbol, decl?: ts.Declaration): string | undefined {
  const symbolTag = symbol.getJsDocTags().find((tag) => tag.name === 'docs');
  const symbolText = symbolTag ? tagText(symbolTag).trim() : '';
  if (symbolText) return symbolText;

  if (!decl) return undefined;
  const declarationTags = ts.getJSDocTags(decl);
  for (const tag of declarationTags) {
    if (tag.tagName.getText() !== 'docs') continue;
    const comment = typeof tag.comment === 'string' ? tag.comment.trim() : '';
    if (comment) return comment;
  }

  return undefined;
}

function yamlQuoted(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function tagText(tag: ts.JSDocTagInfo): string {
  if (!tag.text) return '';
  return displayPartsToString(tag.text as ts.SymbolDisplayPart[]);
}

function parseNamedExports(source: string): ExportItem[] {
  const items: ExportItem[] = [];
  const re = /export\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    const names = match[1].split(',').map((n) => n.trim().split(/\s+as\s+/).pop()!.trim());
    const src = match[2];
    for (const name of names) {
      if (name) items.push({ name, source: src });
    }
  }
  return items;
}

// ============================================================================
// TYPE TABLE EXTRACTION (for constants with object-like types)
// ============================================================================

let _sdkProgram: ts.Program | null = null;
let _sdkChecker: ts.TypeChecker | null = null;

function extractTypeTableEntries(
  checker: ts.TypeChecker,
  typeText: string
): Record<string, { description: string; type: string; required: boolean }> | undefined {
  // Try to resolve from the TS checker for known exported types
  if (_sdkProgram) {
    const entryFile = _sdkProgram.getSourceFile(SDK_ENTRY);
    if (entryFile) {
      const moduleSymbol = checker.getSymbolAtLocation(entryFile);
      if (moduleSymbol) {
        const exports = checker.getExportsOfModule(moduleSymbol);
        // Look for the type name in the type text
        const namedMatch = typeText.match(/^(\w+)$/);
        if (namedMatch) {
          const typeSym = exports.find((s) => s.getName() === namedMatch[1]);
          if (typeSym) {
            const decl = typeSym.getDeclarations()?.[0];
            if (decl) {
              const type = checker.getTypeAtLocation(decl);
              return extractPropertiesFromType(checker, type, decl);
            }
          }
        }
      }
    }
  }

  // Try to parse inline object types like { readonly Foo: "0"; readonly Bar: "1" }
  const trimmed = typeText.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return undefined;

  const body = trimmed.slice(1, -1);
  const entries: Record<string, { description: string; type: string; required: boolean }> = {};
  const parts = body.split(';').map((p) => p.trim()).filter(Boolean);

  for (const part of parts) {
    const match = part.match(/^(?:readonly\s+)?("?)([A-Za-z_$][A-Za-z0-9_$]*)\1(\??):\s*(.+)$/);
    if (match) {
      entries[match[2]] = {
        description: '',
        type: match[4].trim(),
        required: match[3] !== '?',
      };
    }
  }

  return Object.keys(entries).length > 0 ? entries : undefined;
}

function extractPropertiesFromType(
  checker: ts.TypeChecker,
  type: ts.Type,
  decl: ts.Declaration
): Record<string, { description: string; type: string; required: boolean }> | undefined {
  const props = type.getProperties();
  if (props.length === 0) return undefined;

  const result: Record<string, { description: string; type: string; required: boolean }> = {};
  for (const prop of props) {
    const propDecl = prop.getDeclarations()?.[0];
    const propType = propDecl
      ? checker.getTypeOfSymbolAtLocation(prop, propDecl)
      : checker.getTypeOfSymbolAtLocation(prop, decl);
    const isOptional =
      Boolean(prop.flags & ts.SymbolFlags.Optional) ||
      (propDecl &&
        ts.isPropertySignature(propDecl) &&
        Boolean((propDecl as ts.PropertySignature).questionToken));
    const doc = displayPartsToString(prop.getDocumentationComment(checker));
    result[prop.getName()] = {
      description: doc || '',
      type: checker.typeToString(propType, decl, ts.TypeFormatFlags.NoTruncation),
      required: !isOptional,
    };
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

// ============================================================================
// SDK SOURCE EXTRACTION (via TypeScript Compiler API)
// ============================================================================

function buildExportDetailsByName(): Map<string, ExportDetails> {
  const details = new Map<string, ExportDetails>();
  const tsconfigPath = resolve(WORKSPACE_ROOT, 'packages/fcp/packages/fcp-js/tsconfig.json');
  const configRead = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (configRead.error) return details;

  const parsed = ts.parseJsonConfigFileContent(
    configRead.config,
    ts.sys,
    resolve(WORKSPACE_ROOT, 'packages/fcp/packages/fcp-js')
  );
  const program = ts.createProgram({
    rootNames: parsed.fileNames,
    options: parsed.options,
  });
  _sdkProgram = program;
  _sdkChecker = program.getTypeChecker();
  const checker = _sdkChecker;
  const entryFile = program.getSourceFile(SDK_ENTRY);
  if (!entryFile) return details;

  const moduleSymbol = checker.getSymbolAtLocation(entryFile);
  if (!moduleSymbol) return details;

  const exports = checker.getExportsOfModule(moduleSymbol);
  for (const exportedSymbol of exports) {
    const symbol =
      (exportedSymbol.flags & ts.SymbolFlags.Alias) !== 0
        ? checker.getAliasedSymbol(exportedSymbol)
        : exportedSymbol;
    const declarations = symbol.getDeclarations();
    if (!declarations || declarations.length === 0) continue;

    const decl = declarations[0];
    const description = displayPartsToString(symbol.getDocumentationComment(checker));
    const type = checker.getTypeOfSymbolAtLocation(symbol, decl);
    const callSignatures = type.getCallSignatures();

    if (callSignatures.length > 0) {
      const signatures: SignatureData[] = callSignatures.map((signature) => {
        // ... inside signature mapping ...
        const signatureDescription = displayPartsToString(signature.getDocumentationComment(checker));
        const tags = signature.getJsDocTags();
        const returnTag = tags.find((tag) => tag.name === 'returns' || tag.name === 'return');
        const paramDefaults = new Map<string, string>();
        for (const tag of tags) {
          if (tag.name !== 'paramDefault') continue;
          const raw = tagText(tag).trim();
          const match = raw.match(/^(\S+)\s+([\s\S]+)$/);
          if (!match) continue;
          paramDefaults.set(match[1], match[2].trim());
        }

        // Collect referenced types from parameters and return type
        const referencedTypes: ReferencedType[] = [];
        const seenTypes = new Set<string>();

        const addType = (t: ts.Type, d: ts.Declaration) => {
          const ref = extractReferencedType(checker, t, d);
          if (ref && !seenTypes.has(ref.name)) {
            referencedTypes.push(ref);
            seenTypes.add(ref.name);
          }
        };

        const addTypeByName = (typeName: string) => {
          const ref = resolveReferencedTypeByName(checker, moduleSymbol, typeName);
          if (ref && !seenTypes.has(ref.name)) {
            referencedTypes.push(ref);
            seenTypes.add(ref.name);
          }
        };

        // Extract parameters
        const params: ParameterData[] = signature.getParameters().map((paramSymbol) => {
          const paramDecl = paramSymbol.valueDeclaration ?? paramSymbol.declarations?.[0];
          const paramType = paramDecl || decl;
          const tsType = checker.getTypeOfSymbolAtLocation(paramSymbol, paramType);

          addType(tsType, paramType);

          // Prefer declared type annotation (preserves aliases like FideEntityType)
          let paramTypeText: string;
          if (paramDecl && ts.isParameter(paramDecl) && paramDecl.type) {
            paramTypeText = paramDecl.type.getText(paramDecl.getSourceFile());
          } else {
            paramTypeText = paramDecl
              ? checker.typeToString(checker.getTypeOfSymbolAtLocation(paramSymbol, paramDecl))
              : checker.typeToString(checker.getTypeOfSymbolAtLocation(paramSymbol, decl));
          }
          for (const name of extractTypeNamesFromTypeString(paramTypeText)) {
            addTypeByName(name);
          }
          const isOptional =
            Boolean(paramSymbol.flags & ts.SymbolFlags.Optional) ||
            (ts.isParameter(paramDecl as ts.Node) &&
              (Boolean((paramDecl as ts.ParameterDeclaration).questionToken) ||
                Boolean((paramDecl as ts.ParameterDeclaration).initializer)));
          const paramTag = tags.find(
            (tag) => tag.name === 'param' && tagText(tag).startsWith(`${paramSymbol.getName()} `)
          );
          const paramDescriptionText = paramTag
            ? tagText(paramTag).replace(new RegExp(`^${paramSymbol.getName()}\\s*-?\\s*`), '')
            : '';

          const example = paramDefaults.get(paramSymbol.getName());
          const cleanedDescription = paramDescriptionText.trim();

          const paramTypeSymbol = checker.getTypeOfSymbolAtLocation(paramSymbol, paramDecl || decl);
          let options: string[] | undefined;

          if (paramTypeSymbol.isUnion()) {
            const parts = paramTypeSymbol.types;
            if (parts.every((p) => p.isStringLiteral())) {
              options = parts.map((p) => (p as ts.StringLiteralType).value);
            } else if (parts.every((p) => p.isNumberLiteral())) {
              options = parts.map((p) => String((p as ts.NumberLiteralType).value));
            }
          }

          return {
            name: paramSymbol.getName(),
            type: paramTypeText,
            optional: isOptional,
            description: cleanedDescription,
            example,
            options,
          };
        });

        // Add return type to referenced types
        addType(signature.getReturnType(), decl);

        const returnTypeStr = checker.typeToString(signature.getReturnType(), decl, ts.TypeFormatFlags.NoTruncation);
        for (const name of extractTypeNamesFromTypeString(returnTypeStr)) {
          addTypeByName(name);
        }

        const exampleTag = tags.find((tag) => tag.name === 'example');
        let exampleCode: string | undefined;
        if (exampleTag) {
          const raw = tagText(exampleTag);
          const match = raw.match(/```(?:ts|typescript)?\s*\n?([\s\S]*?)```/);
          exampleCode = match ? match[1].trim() : raw.trim();
          if (exampleCode) exampleCode = exampleCode.replace(/^\s*\*\s?/gm, '');
        }

        const infoCalloutTag = tags.find((tag) => tag.name === 'infoCallout');
        let infoCallout: { title: string; body: string } | undefined;
        if (infoCalloutTag) {
          const raw = tagText(infoCalloutTag).trim();
          const firstNewline = raw.indexOf('\n');
          const title = firstNewline > 0 ? raw.slice(0, firstNewline).trim() : raw;
          const body = firstNewline > 0 ? raw.slice(firstNewline).trim() : '';
          if (title) infoCallout = { title, body };
        }

        return {
          description: signatureDescription,
          parameters: params,
          returnType: returnTypeStr,
          returnDescription: returnTag ? tagText(returnTag).replace(/^-\s*/, '') : '',
          exampleCode,
          infoCallout,
          referencedTypes, // Store it here
        };
      });

      details.set(exportedSymbol.getName(), {
        kind: 'function',
        description,
        signatures,
      });
      continue;
    }

    details.set(exportedSymbol.getName(), {
      kind: 'value',
      description,
      signatures: [],
      typeText: checker.typeToString(type, decl, ts.TypeFormatFlags.NoTruncation),
    });
  }

  return details;
}

// ============================================================================
// SECTION / CONSTANT MAPPING
// ============================================================================

function sectionFor(item: ExportItem): string {
  if (item.source.includes('/fide-id/')) return 'FIDE ID';
  if (item.source.includes('/schema/')) return 'Schema';
  if (item.source.includes('/statement/')) return 'Statement';
  if (item.source.includes('/merkle/')) return 'Merkle';
  if (item.source.includes('/attestation/')) return 'Attestation';
  if (item.source.includes('/signing/')) return 'Signing';
  if (item.source.includes('/broadcasting/')) return 'Broadcasting';
  return 'Other';
}

/**
 * Dynamically find which constants are referenced in a function's JSDoc.
 * Scans description, param descriptions, return description, and example code.
 */
function findReferencedConstants(detail: ExportDetails, constantNames: Set<string>): string[] {
  const allText = [
    detail.description,
    ...detail.signatures.flatMap((sig) => [
      sig.description,
      sig.returnDescription,
      sig.exampleCode ?? '',
      ...sig.parameters.map((p) => p.description),
    ]),
  ].join(' ');

  const referenced: string[] = [];
  for (const constantName of constantNames) {
    // Look for the constant name as a whole word (not part of another identifier)
    const regex = new RegExp(`\\b${constantName}\\b`);
    if (regex.test(allText)) {
      referenced.push(constantName);
    }
  }
  return referenced;
}

function isConstant(detail: ExportDetails): boolean {
  return detail.kind === 'value';
}

const SECTION_ORDER = [
  'FIDE ID',
  'Schema',
  'Statement',
  'Merkle',
  'Attestation',
  'Signing',
  'Broadcasting',
];

// ============================================================================
// FILE OPERATIONS
// ============================================================================

async function cleanGeneratedMdx(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  const files = await readdir(dir);
  for (const file of files) {
    if (file.endsWith('.mdx') && file !== 'index.mdx') {
      await rm(resolve(dir, file));
    }
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const source = await readFile(SDK_ENTRY, 'utf8');
  const exportsList = parseNamedExports(source);

  const filteredExports = exportsList.filter(
    (item) => !item.source.includes('/examples') && !item.source.includes('/docs-examples')
  );

  const detailsByName = buildExportDetailsByName();
  const checker = _sdkChecker!;

  await cleanGeneratedMdx(OUTPUT_DIR);

  // Separate functions from constants
  const functionExports: ExportItem[] = [];
  const constantExports: ExportItem[] = [];
  for (const item of filteredExports) {
    const detail = detailsByName.get(item.name);
    if (!detail) continue;
    if (isConstant(detail)) {
      constantExports.push(item);
    } else {
      functionExports.push(item);
    }
  }

  // Build constant data for each function by scanning JSDoc for references
  const constantNames = new Set(constantExports.map((c) => c.name));
  const constantsByFunction = new Map<string, ConstantData[]>();

  for (const funcItem of functionExports) {
    const funcDetail = detailsByName.get(funcItem.name);
    if (!funcDetail) continue;

    const referencedConstantNames = findReferencedConstants(funcDetail, constantNames);
    if (referencedConstantNames.length === 0) continue;

    const constants: ConstantData[] = [];
    for (const constName of referencedConstantNames) {
      const constDetail = detailsByName.get(constName);
      if (!constDetail) continue;

      const typeText = constDetail.typeText ?? 'unknown';
      const typeTableEntries = extractTypeTableEntries(checker, typeText);

      constants.push({
        name: constName,
        description: constDetail.description,
        typeText,
        typeTableEntries,
      });
    }

    if (constants.length > 0) {
      constantsByFunction.set(funcItem.name, constants);
    }
  }

  // Group function exports by section
  const grouped = new Map<string, ExportItem[]>();
  for (const item of functionExports) {
    const section = sectionFor(item);
    const list = grouped.get(section) ?? [];
    list.push(item);
    grouped.set(section, list);
  }

  // Write one MDX file per function — just frontmatter + <SDKFunctionPage data={...} />
  let totalWritten = 0;
  for (const section of SECTION_ORDER) {
    const items = grouped.get(section);
    if (!items) continue;
    for (const item of items) {
      const detail = detailsByName.get(item.name);
      if (!detail) continue;

      const constants = constantsByFunction.get(item.name) ?? [];

      // Aggregate referenced types from all signatures
      const referencedTypes: ReferencedType[] = [];
      const seenTypes = new Set<string>();
      for (const sig of detail.signatures) {
        for (const ref of sig.referencedTypes) {
          if (!seenTypes.has(ref.name)) {
            referencedTypes.push(ref);
            seenTypes.add(ref.name);
          }
        }
      }

      const data: SDKFunctionPageData = {
        name: item.name,
        description: detail.description,
        section,
        signatures: detail.signatures,
        constants,
        referencedTypes,
      };

      const slug = toSlug(item.name);
      const mdx = `---
title: ${yamlQuoted(item.name)}
description: ${yamlQuoted(detail.description || `SDK reference for ${item.name}`)}
full: true
---

<SDKFunctionPage data={${JSON.stringify(data)}} />
`;

      await writeFile(resolve(OUTPUT_DIR, `${slug}.mdx`), mdx, 'utf8');
      totalWritten++;
    }
  }

  // Build meta.json
  const pages: string[] = ['index'];
  for (const section of SECTION_ORDER) {
    const items = grouped.get(section);
    if (!items) continue;
    pages.push(`--- ${section} ---`);
    const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name));
    for (const item of sorted) {
      if (!detailsByName.has(item.name)) continue;
      pages.push(toSlug(item.name));
    }
  }

  // Generate index page
  const sectionLinks = SECTION_ORDER
    .filter((section) => grouped.has(section))
    .map((section) => {
      const items = grouped.get(section)!;
      const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name));
      const itemLinks = sorted
        .filter((item) => detailsByName.has(item.name))
        .map((item) => `  - [\`${item.name}\`](/docs/sdks/js/${toSlug(item.name)})`)
        .join('\n');
      return `### ${section}\n\n${itemLinks}`;
    })
    .join('\n\n');

  const indexMdx = `---
title: SDKs
description: ${yamlQuoted('Complete API surface for @fide.work/fcp')}
---

<PackageManagerTabs packageName="@fide.work/fcp" />

${sectionLinks}
`;

  await writeFile(resolve(OUTPUT_DIR, 'index.mdx'), indexMdx, 'utf8');

  await writeFile(
    resolve(OUTPUT_DIR, 'meta.json'),
    JSON.stringify(
      {
        title: 'SDKs',
        description: 'Generated SDK reference',
        root: true,
        defaultOpen: false,
        icon: 'Box',
        pages,
      },
      null,
      2
    ) + '\n',
    'utf8'
  );

  const inlinedConstantCount = Array.from(constantsByFunction.values()).reduce(
    (sum, constants) => sum + constants.length,
    0
  );
  console.log(`Generated ${totalWritten} function pages (with ${inlinedConstantCount} constants inlined) in ${OUTPUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
