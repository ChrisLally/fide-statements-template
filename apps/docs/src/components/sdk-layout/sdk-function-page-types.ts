export type ParameterData = {
    name: string;
    type: string;
    optional: boolean;
    description: string;
    example?: string;
    options?: string[];
};

export type SignatureData = {
    description: string;
    parameters: ParameterData[];
    returnType: string;
    returnDescription: string;
    exampleCode?: string;
    infoCallout?: { title: string; body: string };
    referencedTypes?: ReferencedType[];
};

export type ConstantData = {
    name: string;
    description: string;
    typeText: string;
    typeTableEntries?: Record<string, { description: string; type: string; required: boolean }>;
};

export type ReferencedType = {
    name: string;
    description: string;
    type: string;
    docsUrl?: string;
    entries?: Record<string, { description: string; type: string; required: boolean }>;
};

export type SDKFunctionPageData = {
    name: string;
    description: string;
    section: string;
    signatures: SignatureData[];
    constants?: ConstantData[];
    referencedTypes?: ReferencedType[];
};
