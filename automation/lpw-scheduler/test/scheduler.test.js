import assert from "node:assert/strict";
import test from "node:test";

import { dispatchWorkflow } from "../src/index.js";

test("dispatches the LPW workflow without forcing a duplicate update", async () => {
  let request;
  const fakeFetch = async (url, options) => {
    request = { url, options };
    return new Response(null, { status: 204 });
  };

  const result = await dispatchWorkflow(
    { GITHUB_TOKEN: "test-token" },
    fakeFetch,
  );

  assert.equal(result.status, 204);
  assert.equal(
    request.url,
    "https://api.github.com/repos/wyhgnss/wyhgnss.github.io/actions/workflows/update-lpw.yml/dispatches",
  );
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers.Authorization, "Bearer test-token");
  assert.deepEqual(JSON.parse(request.options.body), {
    ref: "main",
    inputs: { force: false },
  });
});

test("rejects a missing GitHub token", async () => {
  await assert.rejects(() => dispatchWorkflow({}), /GITHUB_TOKEN/);
});

test("surfaces a GitHub dispatch error", async () => {
  const fakeFetch = async () =>
    new Response("bad credentials", { status: 401 });

  await assert.rejects(
    () => dispatchWorkflow({ GITHUB_TOKEN: "invalid" }, fakeFetch),
    /401.*bad credentials/,
  );
});
