import { expect, it, vi } from "vitest";
import { GeminiLiveClient } from "../lib/geminiLiveClient";
it("forwards the provider tool-call ID and keeps the same ID in its response envelope", async () => {
  const executeTool = vi.fn(async () => ({
    type: "action-result",
    status: "succeeded",
  }));
  const client = new GeminiLiveClient({
    getSession: async () => ({ token: "fixture", setup: {} }),
    executeTool,
  });
  const socket = { readyState: WebSocket.OPEN, send: vi.fn() };
  (client as any).ws = socket;
  (client as any).connectionReady = true;
  await (client as any).handleToolCalls({
    functionCalls: [
      {
        id: "provider-id/42",
        name: "create_task",
        args: { title: "Check AC" },
      },
    ],
  });
  expect(executeTool).toHaveBeenCalledWith(
    "create_task",
    { title: "Check AC" },
    "provider-id/42"
  );
  expect(
    JSON.parse(socket.send.mock.calls[0][0]).toolResponse.functionResponses[0]
      .id
  ).toBe("provider-id/42");
});
