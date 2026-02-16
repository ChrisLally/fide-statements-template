import { readFile } from 'node:fs/promises';
import { processGithubWebhookPayload } from '../process-github-webhook.js';
import { parseGithubStatementsWebhookPayload } from '../sources/github-webhook.js';

async function main(): Promise<void> {
  const fixturePath = process.argv[2] ?? 'fixtures/mock-github-statements-webhook.json';
  const raw = await readFile(fixturePath, 'utf8');
  const payloadUnknown = JSON.parse(raw) as unknown;

  const payload = parseGithubStatementsWebhookPayload(payloadUnknown);
  const results = await processGithubWebhookPayload(payload);

  console.log(JSON.stringify({
    source: 'github-webhook',
    repo: payload.repo,
    repoId: payload.repoId,
    ownerId: payload.ownerId,
    sha: payload.sha,
    runId: payload.runId,
    processed: results,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
