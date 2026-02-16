import { readFile } from 'node:fs/promises';
import { parseGithubStatementsWebhookPayload, toSourceStatementBatchRefs } from '../index.js';

async function main(): Promise<void> {
  const fixturePath = process.argv[2] ?? 'fixtures/mock-github-statements-webhook.json';
  const raw = await readFile(fixturePath, 'utf8');
  const payloadUnknown = JSON.parse(raw) as unknown;

  const payload = parseGithubStatementsWebhookPayload(payloadUnknown);
  const refs = toSourceStatementBatchRefs(payload);

  // This is the handoff point for the next stage:
  // fetch each {repo, sha, path} file and ingest statement JSONL content.
  console.log(JSON.stringify({
    source: 'github-webhook',
    repo: payload.repo,
    sha: payload.sha,
    runId: payload.runId,
    batchCount: refs.length,
    batches: refs,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
