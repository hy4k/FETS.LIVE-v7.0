import { type Conversation } from "./fets-ai-api";
export function ConversationControls({
  chat,
}: {
  chat: {
    conversationId?: string;
    conversations: Conversation[];
    busy: boolean;
    restoring: boolean;
    newChat: () => void;
    selectConversation: (id: string) => Promise<void>;
  };
}) {
  return (
    <div className="flex gap-2 p-3 border-b border-slate-100 text-sm">
      <button
        type="button"
        className="rounded-lg border px-3 py-1"
        disabled={chat.busy || chat.restoring}
        onClick={chat.newChat}
      >
        New chat
      </button>
      <select
        className="min-w-0 rounded-lg border px-2 py-1"
        aria-label="Conversation history"
        disabled={chat.busy || chat.restoring}
        value={chat.conversationId || ""}
        onChange={(e) =>
          e.target.value
            ? chat.selectConversation(e.target.value)
            : chat.newChat()
        }
      >
        <option value="">
          {chat.restoring ? "Loading history…" : "Conversation history"}
        </option>
        {chat.conversations.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>
    </div>
  );
}
