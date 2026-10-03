"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, LoaderCircle, Send, ShieldCheck } from "lucide-react";
import type { ChatMessage } from "@appointment/contracts";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { useTypewriter } from "./use-typewriter";

type LocalMessage = ChatMessage & { streaming?: boolean; pending?: boolean };

function StreamingBubble({ content, animate }: { content: string; animate: boolean }) {
  const { shown, done } = useTypewriter(content, animate);
  return (
    <div className="message message-assistant">
      <span>{shown}</span>
      {animate && !done && <span className="stream-caret" aria-hidden="true" />}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="message message-assistant typing-bubble" aria-live="polite">
      <span className="typing-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="typing-label">Assistant is typing…</span>
    </div>
  );
}

export function ChatPanel() {
  const qc = useQueryClient();
  const listRef = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<string>();
  const [text, setText] = useState("");
  const [optimistic, setOptimistic] = useState<LocalMessage[]>([]);
  const [streamIds, setStreamIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let current = true;
    void (async () => {
      const existing = await api<{ sessions: Array<{ id: string }> }>("/chat/sessions");
      if (!current) return;
      if (existing.sessions[0]) {
        setSession(existing.sessions[0].id);
        return;
      }
      const created = await api<{ session: { id: string } }>("/chat/sessions", { method: "POST" });
      if (current) setSession(created.session.id);
    })();
    return () => {
      current = false;
    };
  }, []);

  async function startNewChat() {
    setOptimistic([]);
    setStreamIds(new Set());
    const created = await api<{ session: { id: string } }>("/chat/sessions", { method: "POST" });
    setSession(created.session.id);
    void qc.invalidateQueries({ queryKey: ["chat-sessions"] });
    void qc.invalidateQueries({ queryKey: ["messages"] });
  }

  const messages = useQuery({
    queryKey: ["messages", session],
    queryFn: () => api<{ messages: ChatMessage[] }>(`/chat/sessions/${session}/messages`),
    enabled: !!session,
  });

  const send = useMutation({
    mutationFn: async (content: string) => {
      const clientMessageId = crypto.randomUUID();
      const tempUser: LocalMessage = {
        id: `temp-${clientMessageId}`,
        role: "USER",
        content,
        aiStatus: "PENDING",
        createdAt: new Date().toISOString(),
        pending: true,
      };
      setOptimistic((prev) => [...prev, tempUser]);
      setText("");
      return api<{ messages: ChatMessage[] }>(`/chat/sessions/${session}/messages`, {
        method: "POST",
        body: JSON.stringify({ content, clientMessageId }),
      });
    },
    onSuccess: (data) => {
      setOptimistic([]);
      const lastAssistant = [...data.messages].reverse().find((m) => m.role === "ASSISTANT");
      if (lastAssistant) {
        setStreamIds((prev) => new Set(prev).add(lastAssistant.id));
      }
      qc.setQueryData(["messages", session], data);
    },
    onError: () => {
      setOptimistic((prev) => prev.filter((m) => !m.pending));
    },
  });

  const serverMessages = messages.data?.messages ?? [];
  const visible: LocalMessage[] =
    optimistic.length > 0 ? [...serverMessages, ...optimistic] : serverMessages;

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [visible.length, send.isPending, streamIds.size]);

  const canSend = !!text.trim() && !!session && !send.isPending;

  return (
    <section className="card panel chat-panel">
      <header className="panel-header">
        <div>
          <p className="eyebrow">AI BOOKING ASSISTANT</p>
          <h2>Tell us what works for you</h2>
          <p className="muted">Try “next Tuesday around 2:30 PM Islamabad time.”</p>
        </div>
        <div className="chat-header-actions">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void startNewChat()}
            disabled={!session || send.isPending}
          >
            New chat
          </Button>
          <span className="icon-tile">
            <Bot size={21} />
          </span>
        </div>
      </header>

      <div className="messages" aria-live="polite" ref={listRef}>
        {!visible.length && !send.isPending && (
          <div className="empty">
            <Bot size={26} className="muted" />
            <p style={{ margin: "10px 0 4px", fontWeight: 750 }}>How can I help?</p>
            <span className="muted">Share a preferred day and time to begin.</span>
          </div>
        )}

        {visible.map((m) =>
          m.role === "ASSISTANT" ? (
            <StreamingBubble
              key={m.id}
              content={m.content}
              animate={streamIds.has(m.id)}
            />
          ) : (
            <div key={m.id} className={`message message-user ${m.pending ? "message-pending" : ""}`}>
              {m.content}
            </div>
          ),
        )}

        {send.isPending && <TypingIndicator />}
        {send.isError && <div className="form-error">{send.error.message}</div>}
      </div>

      <form
        className="composer-shell"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSend) send.mutate(text.trim());
        }}
      >
        <label className="composer-field">
          <span className="sr-only">Message the booking assistant</span>
          <input
            className="composer-input"
            placeholder="Describe your preferred time…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={!session || send.isPending}
            autoComplete="off"
          />
        </label>
        <Button
          type="submit"
          size="icon"
          className="composer-send"
          aria-label="Send message"
          disabled={!canSend}
        >
          {send.isPending ? (
            <LoaderCircle size={17} className="animate-spin" />
          ) : (
            <Send size={17} />
          )}
        </Button>
      </form>

      <p className="field-hint composer-hint">
        <ShieldCheck size={13} />
        Chat only builds a draft. Submit via Manual Booking → PENDING until an admin approves.
      </p>
    </section>
  );
}
