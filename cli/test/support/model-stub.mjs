import { createServer } from "node:http";

// Ein Modell-Server mit der Chat-Schnittstelle von OpenAI, wie Ollama, LM Studio oder OpenRouter sie anbieten:
// GET /v1/models und POST /v1/chat/completions mit Strom. Echtes HTTP, damit fetch und Strom wirklich laufen.
// Die Tests stellen `state` ein und lesen in `requests`, was angekommen ist.
export async function startModelStub(overrides = {}) {
  const state = {
    models: ["finn-test"],
    replies: [],
    modelsStatus: null,
    chatStatus: null,
    chatBody: null,
    redirect: null,
    ...overrides,
  };
  const requests = [];

  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const text = Buffer.concat(chunks).toString("utf8");
    requests.push({ method: req.method, url: req.url, headers: req.headers, body: text ? JSON.parse(text) : undefined });
    const send = (status, payload) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(payload));
    };

    if (state.redirect) {
      res.writeHead(302, { location: state.redirect });
      res.end();
      return;
    }
    if (req.method === "GET" && req.url === "/v1/models") {
      if (state.modelsStatus) return send(state.modelsStatus, { error: { message: "nope" } });
      return send(200, { object: "list", data: state.models.map((id) => ({ id, object: "model" })) });
    }
    if (req.method === "POST" && req.url === "/v1/chat/completions") {
      if (state.chatStatus) return send(state.chatStatus, state.chatBody ?? { error: { message: "nope" } });
      const reply = state.replies.length > 1 ? state.replies.shift() : (state.replies[0] ?? completion(["Hallo"]));
      res.writeHead(200, { "content-type": "text/event-stream" });
      for (const part of reply.raw) {
        res.write(part);
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
      if (reply.hang) return;
      res.end();
      return;
    }
    send(404, { error: { message: "not found" } });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  return {
    origin,
    url: `${origin}/v1`,
    state,
    requests,
    chats: () => requests.filter((r) => r.url === "/v1/chat/completions"),
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  };
}

/** Ein Stück des Stroms, wie es OpenAI-kompatible Server schicken. */
export function chunk(delta, finishReason = null) {
  return `data: ${JSON.stringify({ object: "chat.completion.chunk", choices: [{ index: 0, delta, finish_reason: finishReason }] })}\n\n`;
}

/** Eine ganze Antwort: Rolle, Text in Stücken, Ende mit finish_reason und [DONE]. */
export function completion(parts, { done = true } = {}) {
  return {
    raw: [
      chunk({ role: "assistant", content: "" }),
      ...parts.map((content) => chunk({ content })),
      chunk({}, "stop"),
      ...(done ? ["data: [DONE]\n\n"] : []),
    ],
  };
}
