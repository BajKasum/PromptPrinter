// Wird mit `node --require` in jeden Prozess des Test-Servers geladen (e2e/support/env.ts, NODE_OPTIONS): Anfragen an
// die Hosts aus fakes.cjs beantworten die Stellvertreter, alles andere läuft unverändert. Jede beantwortete Anfrage
// steht als JSON-Zeile in E2E_OUTBOUND_LOG, damit ein Test prüfen kann, was der Server verschickt hat. Next legt
// seine eigene Hülle um dieses fetch, nicht umgekehrt.
/* eslint-disable @typescript-eslint/no-require-imports -- `node --require` lädt CommonJS, hier gibt es nur require. */
"use strict";

const { appendFileSync } = require("node:fs");
const { FAKED_HOSTS, fakeResponse } = require("./fakes.cjs");

const realFetch = globalThis.fetch;

function hostOf(input) {
  try {
    return new URL(input instanceof Request ? input.url : String(input)).hostname;
  } catch {
    return null;
  }
}

globalThis.fetch = async function e2eFetch(input, init) {
  const host = hostOf(input);
  if (!host || !FAKED_HOSTS.includes(host)) return realFetch.call(this, input, init);

  const request = new Request(input, init);
  const body = request.method === "GET" || request.method === "HEAD" ? "" : await request.text();
  const answer = fakeResponse(request.url, request.method, Object.fromEntries(request.headers), body);
  const log = process.env.E2E_OUTBOUND_LOG;
  if (log) {
    const { pathname } = new URL(request.url);
    appendFileSync(log, `${JSON.stringify({ host, method: request.method, path: pathname, status: answer.status, body })}\n`);
  }
  return new Response(answer.body, { status: answer.status, headers: answer.headers });
};
