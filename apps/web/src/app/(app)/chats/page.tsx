import { ChatHistoryPanel } from "@/features/chat/chat-history-panel";

export default function ChatHistoryPage() {
  return (
    <main className="page">
      <header className="page-heading">
        <p className="eyebrow">CONVERSATIONS</p>
        <h1>Chat history</h1>
        <p className="muted">Review past assistant threads and any booking draft they collected.</p>
      </header>
      <ChatHistoryPanel />
    </main>
  );
}
