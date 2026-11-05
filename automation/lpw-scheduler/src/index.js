const OWNER = "wyhgnss";
const REPOSITORY = "wyhgnss.github.io";
const WORKFLOW = "update-lpw.yml";
const REF = "main";

export async function dispatchWorkflow(env, fetchImpl = fetch) {
  if (!env.GITHUB_TOKEN) {
    throw new Error("Missing required GITHUB_TOKEN secret.");
  }

  const endpoint =
    `https://api.github.com/repos/${OWNER}/${REPOSITORY}` +
    `/actions/workflows/${WORKFLOW}/dispatches`;

  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "lpw-hourly-scheduler",
      "X-GitHub-Api-Version": "2026-03-10",
    },
    body: JSON.stringify({
      ref: REF,
      inputs: { force: false },
    }),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(
      `GitHub workflow dispatch failed (${response.status}): ${responseText.slice(0, 500)}`,
    );
  }

  console.log(
    JSON.stringify({
      event: "workflow_dispatch",
      repository: `${OWNER}/${REPOSITORY}`,
      workflow: WORKFLOW,
      ref: REF,
      status: response.status,
      dispatchedAt: new Date().toISOString(),
    }),
  );

  return { status: response.status, body: responseText };
}

export default {
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(dispatchWorkflow(env));
  },

  async fetch() {
    return Response.json({
      service: "LPW hourly GitHub workflow scheduler",
      repository: `${OWNER}/${REPOSITORY}`,
      workflow: WORKFLOW,
      schedule: "7 * * * * (UTC)",
      status: "ready",
    });
  },
};
