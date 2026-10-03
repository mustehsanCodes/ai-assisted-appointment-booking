"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Bot, MessageSquareText, MessagesSquare } from "lucide-react";
import type { ChatMessage, ChatSession } from "@appointment/contracts";
import { api } from "@/lib/api-client";
import { InlineLoader } from "@/components/ui/loading-screen";

export function ChatHistoryPanel() {
  const [selectedId, setSelectedId] = useState<string>();

  const sessions = useQuery({
    queryKey: ["chat-sessions"],
    queryFn: () => api<{ sessions: ChatSession[] }>("/chat/sessions"),
  });

  const withActivity = useMemo(() => {
    const list = sessions.data?.sessions ?? [];
    return list.filter((session) => {
      const draft = session.bookingDraft;
      const hasDraft = !!draft && typeof draft === "object" && Object.keys(draft).length > 0;
      const hasTitle = session.title && session.title !== "New conversation";
      return hasDraft || hasTitle || session.updatedAt !== session.createdAt;
    });
  }, [sessions.data?.sessions]);

  useEffect(() => {
    if (!selectedId && withActivity[0]?.id) setSelectedId(withActivity[0].id);
  }, [selectedId, withActivity]);

  const messages = useQuery({
    queryKey: ["messages", selectedId],
    queryFn: () => api<{ messages: ChatMessage[] }>(`/chat/sessions/${selectedId}/messages`),
    enabled: !!selectedId,
  });

  if (sessions.isPending) {
    return (
      <div className="card panel" style={{ minHeight: 280, display: "grid", placeItems: "center" }}>
        <InlineLoader label="Loading chat history…" />
      </div>
    );
  }

  if (sessions.isError) {
    return <div className="form-error">Could not load chat history.</div>;
  }

  if (!withActivity.length) {
    return (
      <div className="card empty">
        <MessagesSquare size={30} className="muted" />
        <h2 style={{ margin: "14px 0 6px" }}>No conversations yet</h2>
        <p className="muted">Start chatting from the Book page to build history here.</p>
      </div>
    );
  }

  const active = withActivity.find((s) => s.id === selectedId) ?? withActivity[0];

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <section className="card panel rules-banner">
        <div className="rules-banner-head">
          <Bot size={18} color="#4f46e5" />
          <strong>Chat is draft-only</strong>
        </div>
        <p className="muted" style={{ margin: "8px 0 0" }}>
          Conversations never create or confirm appointments — even if an older reply said
          “scheduled.” Submit the time in{" "}
          <a href="/dashboard" style={{ color: "var(--primary)", fontWeight: 700 }}>
            Manual Booking
          </a>
          , then watch status become <span className="badge badge-pending">PENDING</span> until an
          admin approves.
        </p>
      </section>
      <div className="history-layout">
        <aside className="card history-list" aria-label="Chat sessions">
          <div className="panel-header" style={{ padding: "18px 18px 14px" }}>
            <div>
              <p className="eyebrow">SESSIONS</p>
              <h2>Conversations</h2>
            </div>
            <span className="icon-tile">
              <MessageSquareText size={18} />
            </span>
          </div>
          <ul className="history-items">
            {withActivity.map((session) => {
              const selected = session.id === active.id;
              return (
                <li key={session.id}>
                  <button
                    type="button"
                    className={`history-item ${selected ? "history-item-active" : ""}`}
                    onClick={() => setSelectedId(session.id)}
                  >
                    <strong>{session.title}</strong>
                    <span>
                      {session.subtitle ? `${session.subtitle} · ` : ""}
                      {formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true })}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <section className="card panel history-thread">
          <header className="panel-header">
            <div>
              <p className="eyebrow">TRANSCRIPT</p>
              <h2>{active.title}</h2>
              <p className="muted">
                {active.subtitle ? `${active.subtitle} · ` : ""}
                Updated{" "}
                {new Intl.DateTimeFormat("en-PK", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "Asia/Karachi",
                }).format(new Date(active.updatedAt))}
              </p>
            </div>
            <span className="icon-tile">
              <Bot size={18} />
            </span>
          </header>

          <div className="messages history-messages" aria-live="polite">
            {messages.isPending && <InlineLoader label="Loading messages…" />}
            {messages.isError && <div className="form-error">Could not load this conversation.</div>}
            {messages.data && !messages.data.messages.length && (
              <div className="empty">
                <p className="muted">This session has no messages.</p>
              </div>
            )}
            {messages.data?.messages.map((m) => (
              <div
                key={m.id}
                className={`message ${m.role === "USER" ? "message-user" : "message-assistant"}`}
              >
                {m.content}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
