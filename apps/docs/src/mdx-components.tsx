import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import { TypeTable } from 'fumadocs-ui/components/type-table';
import { PackageManagerTabs } from '@/components/mdx/package-manager-tabs';
import { SDKSection } from '@/components/sdk-layout';
import { SDKFunctionPageInteractive as SDKFunctionPage } from '@/components/sdk-layout/sdk-function-page-interactive';
import { AttestationVerifier } from '@/components/tools/attestation-verifier';
import { FideIdCalculator } from '@/components/tools/fide-id-calculator';
import { IdentityInspector } from '@/components/tools/identity-inspector';
import { StatementBuilder } from '@/components/tools/statement-builder';

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    TypeTable,
    PackageManagerTabs,
    SDKSection,
    SDKFunctionPage,
    IdentityInspector,
    FideIdCalculator,
    StatementBuilder,
    AttestationVerifier,
    ...components,
  };
}
