# LPW hourly scheduler on Tencent SCF

This event function dispatches the existing GitHub Actions workflow once per
hour. It does not run the LPW model itself, so the function package is small and
does not need any third-party Python dependencies.

## Create the function

1. In **Tencent Cloud > Serverless Cloud Function (SCF) > Function Service**, create an event function.
2. Choose the same region you normally use (for example, Guangzhou), a supported Python 3 runtime, 128 MB memory, and a 60-second timeout.
3. Upload a ZIP whose root directly contains `index.py` (the prepared delivery package is named `tencent-lpw-scheduler.zip`).
4. Set the handler to `index.main_handler` and leave public network access enabled so the function can call the GitHub API.
5. Add environment variable `GITHUB_TOKEN` with a fine-grained GitHub token limited to `wyhgnss/wyhgnss.github.io` and **Actions: Read and write** permission.
6. Add an enabled timer trigger with custom Cron expression `0 7 * * * * *`. Tencent's seven fields are seconds, minutes, hours, day, month, weekday, and year; this runs at minute 7 of every hour.

The workflow receives `force: false`, so its 45-minute freshness check prevents
duplicate model runs if GitHub's own fallback schedule also fires.

## Verify

Use **Test Function** once with this event:

```json
{"Type":"Timer","TriggerName":"manual-test","Message":""}
```

A successful invocation returns `github_status: 200` plus `workflow_run_id` and
`html_url`. GitHub may return an empty `204` response on older behavior; both
success codes are accepted. Then check GitHub Actions for the new
`workflow_dispatch` run. Do not commit the GitHub token or include it inside the
ZIP file.

Run local tests from this directory with:

```text
python -m unittest -v test_index.py
```
