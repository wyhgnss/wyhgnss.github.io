# LPW MIMIC poller on Tencent SCF

This event function checks the UW-Madison MIMIC directory every five minutes
and dispatches the GitHub Actions workflow only when a newer source product is
available.

The decision sequence is:

1. Read the latest `compYYYYMMDD.HH0000.nc` timestamp from the newest MIMIC
   monthly directory.
2. Read the latest published timestamp from
   `lpw/data/mimic-archive.json` on GitHub.
3. Stop with `action: up_to_date` if the source product is already published.
4. If the source is newer, check for a queued or running `update-lpw.yml` run.
5. Stop with `action: workflow_active` if a matching run is already active;
   otherwise dispatch one update with `force: true`.

The function uses only Python's standard library. GitHub Actions no longer has
its own cron schedule, so this SCF timer is the sole automatic scheduler.

## Deploy or update the function

1. In **Tencent Cloud > Serverless Cloud Function (SCF) > Function Service**,
   open the existing event function.
2. Replace its `index.py` with the file in this directory, or upload a ZIP whose
   root directly contains `index.py`.
3. Keep the handler as `index.main_handler`, use a supported Python 3 runtime,
   and keep public network access enabled.
4. Keep the environment variable `GITHUB_TOKEN`. The fine-grained token must be
   limited to `wyhgnss/wyhgnss.github.io` and have **Actions: Read and write**.
5. Change the enabled timer trigger to custom Cron expression:

   ```text
   0 */5 * * * * *
   ```

   Tencent's seven fields are seconds, minutes, hours, day, month, weekday, and
   year. This expression runs at second 0 every five minutes.

One invocation normally performs three public reads. It calls the authenticated
workflow-runs API, and then the dispatch API, only when the source timestamp is
newer than the published timestamp.

## Verify

Use **Test Function** once with:

```json
{"Type":"Timer","TriggerName":"manual-test","Message":""}
```

Expected outcomes:

- `action: up_to_date`, `dispatched: false`: no unpublished MIMIC product.
- `action: workflow_active`, `dispatched: false`: a new product exists but the
  workflow is already queued or running.
- `action: dispatched`, `dispatched: true`: a new GitHub Actions run was
  created. GitHub may return status 200 with run details or an empty 204.

Do not commit the GitHub token or include it inside the ZIP file.

Run local tests from this directory with:

```text
python -m unittest -v test_index.py
```
