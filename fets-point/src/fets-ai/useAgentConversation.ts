import { useEffect, useRef, useState } from "react";
import {
  agentRequest,
  type AgentReply,
  type Conversation,
} from "./fets-ai-api";
export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  metadata?: Partial<AgentReply>;
  live?: boolean;
};
const uuid = () => crypto.randomUUID();
export function useAgentConversation(
  userId: string,
  branch: string,
  page: string
) {
  const scope = `${userId}:${branch}`,
    latest = useRef(scope);
  latest.current = scope;
  const instanceId = useRef(uuid());
  const [reloadVersion, setReloadVersion] = useState(0);
  const revision = useRef(0),
    locked = useRef(false),
    selected = useRef<string>();
  const [state, setState] = useState<{
    scope: string;
    messages: ChatMessage[];
    conversations: Conversation[];
    conversationId?: string;
    busy: boolean;
    restoring: boolean;
    error: string;
  }>({
    scope,
    messages: [],
    conversations: [],
    busy: false,
    restoring: true,
    error: "",
  });
  const storageKey = `fets-ai:conversation:${scope}`;
  const remember = (id?: string, broadcast = false) => {
    try {
      id
        ? localStorage.setItem(storageKey, id)
        : localStorage.removeItem(storageKey);
    } catch {
      /* storage unavailable */
    }
    if (broadcast)
      window.dispatchEvent(
        new CustomEvent("fets-ai-conversation-changed", {
          detail: { scope, id, source: instanceId.current },
        })
      );
  };
  const current = (version: number) =>
    latest.current === scope && revision.current === version;
  const update = (changes: Partial<typeof state>) =>
    setState((old) => (old.scope === scope ? { ...old, ...changes } : old));
  const fetchConversation = async (id: string, version: number) => {
    const data = await agentRequest<{
      conversation: Conversation;
      messages: {
        id: string;
        role: "user" | "assistant";
        content: string;
        metadata: Partial<AgentReply>;
        created_at: string;
      }[];
    }>({ action: "conversation", branch, page, conversationId: id });
    if (!current(version)) return;
    selected.current = id;
    remember(id);
    setState((old) =>
      old.scope === scope
        ? {
            ...old,
            conversations:
              data.conversation?.title &&
              !old.conversations.some((c) => c.id === id)
                ? [data.conversation, ...old.conversations]
                : old.conversations,
          }
        : old
    );
    update({
      conversationId: id,
      messages: (data.messages || []).map((m) => ({
        ...m,
        timestamp: new Date(m.created_at),
      })),
    });
  };
  useEffect(() => {
    const version = ++revision.current;
    locked.current = false;
    selected.current = undefined;
    pending.current = undefined;
    setState({
      scope,
      messages: [],
      conversations: [],
      busy: false,
      restoring: Boolean(userId),
      error: "",
    });
    if (!userId) return;
    (async () => {
      try {
        const data = await agentRequest<{
          conversations: Conversation[];
        }>({ action: "conversations", branch, page });
        if (!current(version)) return;
        const conversations = data.conversations || [];
        update({ conversations });
        let saved: string | null = null;
        try {
          saved = localStorage.getItem(storageKey);
        } catch {}
        if (saved && conversations.some((c) => c.id === saved))
          await fetchConversation(saved, version);
        else if (saved) remember();
      } catch (e) {
        if (current(version))
          update({
            error:
              e instanceof Error ? e.message : "History could not be loaded.",
          });
      } finally {
        if (current(version)) update({ restoring: false });
      }
    })();
    return () => {
      revision.current++;
    };
  }, [scope, reloadVersion]);
  useEffect(() => {
    const changed = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          scope: string;
          id?: string;
          source: string;
        }>
      ).detail;
      if (
        detail.scope !== scope ||
        detail.source === instanceId.current ||
        locked.current
      )
        return;
      const version = ++revision.current;
      pending.current = undefined;
      if (!detail.id) {
        selected.current = undefined;
        update({
          conversationId: undefined,
          messages: [],
          restoring: false,
          error: "",
        });
        return;
      }
      update({ restoring: true, error: "" });
      fetchConversation(detail.id, version)
        .catch((e) => {
          if (current(version))
            update({
              error:
                e instanceof Error ? e.message : "History could not be loaded.",
            });
        })
        .finally(() => {
          if (current(version)) update({ restoring: false });
        });
    };
    window.addEventListener("fets-ai-conversation-changed", changed);
    return () =>
      window.removeEventListener("fets-ai-conversation-changed", changed);
  }, [scope]);
  const selectConversation = async (id: string) => {
    if (locked.current) return;
    pending.current = undefined;
    const version = ++revision.current;
    selected.current = undefined;
    update({
      messages: [],
      conversationId: undefined,
      restoring: true,
      error: "",
    });
    try {
      await fetchConversation(id, version);
      if (current(version)) remember(id, true);
    } catch (e) {
      if (current(version))
        update({
          error:
            e instanceof Error ? e.message : "History could not be loaded.",
        });
    } finally {
      if (current(version)) update({ restoring: false });
    }
  };
  const newChat = () => {
    if (locked.current) return;
    pending.current = undefined;
    revision.current++;
    selected.current = undefined;
    remember(undefined, true);
    update({
      conversationId: undefined,
      messages: [],
      error: "",
      restoring: false,
    });
  };
  const pending = useRef<{
    scope: string;
    text: string;
    id: string;
    conversationId?: string;
  }>();
  const send = async (text: string) => {
    if (
      !userId ||
      !text.trim() ||
      locked.current ||
      state.restoring ||
      state.scope !== scope
    )
      return;
    const version = revision.current;
    locked.current = true;
    const request =
      pending.current?.scope === scope &&
      pending.current.text === text &&
      pending.current.conversationId === selected.current
        ? pending.current
        : { scope, text, id: uuid(), conversationId: selected.current };
    pending.current = request;
    setState((old) => ({
      ...old,
      busy: true,
      error: "",
      messages: [
        ...old.messages.filter((m) => m.id !== request.id),
        { id: request.id, role: "user", content: text, timestamp: new Date() },
      ],
    }));
    try {
      const reply = await agentRequest<AgentReply>({
        action: "chat",
        branch,
        page,
        message: text,
        conversationId: request.conversationId,
        requestId: request.id,
      });
      if (!current(version)) return;
      pending.current = undefined;
      if (reply.conversationId) {
        selected.current = reply.conversationId;
        remember(reply.conversationId, true);
      }
      setState((old) => ({
        ...old,
        conversationId: reply.conversationId || old.conversationId,
        messages: [
          ...old.messages,
          {
            id: uuid(),
            role: "assistant",
            content: reply.text,
            timestamp: new Date(),
            metadata: reply,
          },
        ],
        conversations:
          reply.conversationId &&
          !old.conversations.some((c) => c.id === reply.conversationId)
            ? [
                {
                  id: reply.conversationId,
                  title: text.slice(0, 80),
                  branch,
                  updated_at: new Date().toISOString(),
                },
                ...old.conversations,
              ]
            : old.conversations,
      }));
    } catch (e) {
      if (current(version))
        update({
          error:
            e instanceof Error ? e.message : "Could not send your message.",
        });
    } finally {
      if (current(version)) {
        locked.current = false;
        update({ busy: false });
      }
    }
  };
  const appendLive = (message: ChatMessage) => {
    if (latest.current === scope)
      setState((old) =>
        old.scope === scope
          ? {
              ...old,
              messages: [
                ...old.messages.filter((m) => m.id !== message.id),
                message,
              ],
            }
          : old
      );
  };
  const visible =
    state.scope === scope
      ? state
      : {
          scope,
          messages: [],
          conversations: [],
          busy: false,
          restoring: true,
          error: "",
          conversationId: undefined,
        };
  const retry = async () => {
    if (pending.current?.scope === scope) await send(pending.current.text);
    else setReloadVersion((v) => v + 1);
  };
  return { ...visible, send, newChat, selectConversation, appendLive, retry };
}
