# LPW hourly external scheduler

This Cloudflare Worker calls the existing GitHub Actions `workflow_dispatch`
endpoint once per hour at minute 7 UTC. The existing GitHub schedules at minutes
13 and 43 remain as fallbacks.

The external request sends `force: false`, so the workflow keeps its 45-minute
freshness gate. A manual **Run workflow** action defaults to `force: true` and
still performs a full update immediately.

## One-time deployment

1. Create a GitHub fine-grained personal access token:
   - Repository access: only `wyhgnss/wyhgnss.github.io`.
   - Repository permission: **Actions — Read and write**.
   - Set a reasonable expiration and renew it before expiry.
2. Open a terminal in this directory and sign in to Cloudflare:

   ```text
   npx wrangler@latest login
   ```

3. Deploy the Worker:

   ```text
   npx wrangler@latest deploy
   ```

4. Store the GitHub token as an encrypted Cloudflare secret. Paste the token
   only into Wrangler's local prompt; never put it in this repository:

   ```text
   npx wrangler@latest secret put GITHUB_TOKEN
   ```

5. Deploy once more to ensure the current code and cron trigger are active:

   ```text
   npx wrangler@latest deploy
   ```

## Verification

- Cloudflare dashboard: Workers & Pages > `lpw-hourly-scheduler` > Triggers.
- Confirm the cron expression is `7 * * * *`.
- After the next minute 7, check Cloudflare Observability logs for a successful
  GitHub response and GitHub Actions for a `workflow_dispatch` run.
- Opening the Worker's public URL only returns non-sensitive health metadata; it
  does not trigger the workflow.

Run the local unit tests with:

```text
npm test
```
