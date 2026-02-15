import { createOpenAPI } from 'fumadocs-openapi/server';
import { resolve } from 'node:path';

export const openapi = createOpenAPI({
    input: [process.env.OPENAPI_URL ?? resolve(process.cwd(), 'openapi.json')],
});
