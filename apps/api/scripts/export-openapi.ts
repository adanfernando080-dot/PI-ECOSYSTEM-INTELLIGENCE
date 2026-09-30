/**
 * Writes the generated OpenAPI document to docs/api/openapi.json.
 *   npm run openapi:export
 */
import { writeFileSync } from 'node:fs';
import { buildOpenApiDocument } from '../src/openapi/document';

const target = new URL('../../../docs/api/openapi.json', import.meta.url);
writeFileSync(target, `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`);
console.log(`OpenAPI document written to ${target.pathname}`);
