"use client";

import { useState } from "react";

interface Props {
  projectId: string;
}

interface CoachMessage {
  id: string;
  action: string;
  actionLabel: string;
  input?: string;
  response: string;
  timestamp: string;
}

const ACTIONS = [
  { id: "next_steps", label: "What should I do next?", icon: "🎯", desc: "AI prioritizes your tasks" },
  { id: "break_down", label: "Break this down", icon: "🧩", desc: "Turn goals into actionable steps" },
  { id: "summarize", label: "Summarize progress", icon: "📊", desc: "Get a progress report" },
  { id: "plan_week", label: "Plan my week", icon: "📅", desc: "AI schedules your tasks" },
  { id: "think_through", label: "Help me think...", icon: "💭", desc: "Discuss a challenge" },
];

export default function CoachSection({ projectId }: Props) {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [freeInput, setFreeInput] = useState("");
  const [showInput, setShowInput] = useState(false);

  const askCoach = async (action: string, input?: string) => {
    setLoading(true);
    setActiveAction(action);
    try {
      const res = await fetch(`/api/admin/ark/${projectId}/coach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, input }),
      }).then((r) => r.json());

      if (res.success) {
        const actionDef = ACTIONS.find((a) => a.id === action);
        setMessages((prev) => [
          {
            id: crypto.randomUUID(),
            action,
            actionLabel: actionDef?.label || action,
            input,
            response: res.response,
            timestamp: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
    } catch (e) {
      console.error("Coach error:", e);
    } finally {
      setLoading(false);
      setActiveAction(null);
      setShowInput(false);
      setFreeInput("");
    }
  };

  const handleThinkThrough = () => {
    if (freeInput.trim()) {
      askCoach("think_through", freeInput.trim());
    }
  };

  const handleBreakDown = () => {
    if (freeInput.trim()) {
      askCoach("break_down", freeInput.trim());
    } else {
      askCoach("break_down");
    }
  };

  // Save AI response to timeline
  const saveToTimeline = async (msg: CoachMessage) => {
    await fetch(`/api/admin/ark/${projectId}/timeline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entry_type: "ai_coaching",
        title: `AI Coach: ${msg.actionLabel}`,
        description: msg.response.substring(0, 500),
        metadata: { action: msg.action, input: msg.input },
      }),
    });
  };

  return (
    <div className="max-w-3xl space-y-6">
      {/* Action buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {ACTIONS.map((action) => {
          const isActive = activeAction === action.id && loading;
          const needsInput = action.id === "think_through" || action.id === "break_down";
          return (
            <button
              key={action.id}
              onClick={() => {
                if (needsInput) {
                  setShowInput(showInput && activeAction === null ? false : true);
                  setActiveAction(null);
                } else {
                  askCoach(action.id);
                }
              }}
              disabled={loading}
              className={`text-left bg-[#1a1816] border border-[#302927] rounded-lg p-3 hover:border-[#843c2d]/30 transition-colors disabled:opacity-50 ${
                isActive ? "border-[#843c2d] animate-pulse" : ""
              }`}
            >
              <span className="text-lg block mb-1">{action.icon}</span>
              <span className="text-sm font-medium text-[#ede8df] block">{action.label}</span>
              <span className="text-[10px] text-[#726d6c]">{action.desc}</span>
            </button>
          );
        })}
      </div>

      {/* Free input for think_through / break_down */}
      {showInput && (
        <div className="bg-[#1a1816] border border-[#302927] rounded-lg p-4 space-y-3">
          <textarea
            value={freeInput}
            onChange={(e) => setFreeInput(e.target.value)}
            placeholder="What do you need help with? Describe a challenge, goal, or idea..."
            rows={3}
            className="w-full bg-[#0d0c0a] border border-[#302927] rounded-lg px-3 py-2 text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d] resize-y"
            autoFocus
          />
          <div className="flex gap-2">
            <button onClick={handleThinkThrough} disabled={!freeInput.trim() || loading} className="px-4 py-1.5 bg-[#843c2d] text-[#ede8df] rounded-lg text-sm disabled:opacity-40">
              Think through
            </button>
            <button onClick={handleBreakDown} disabled={loading} className="px-4 py-1.5 border border-[#302927] text-[#ede8df] rounded-lg text-sm disabled:opacity-40">
              Break down
            </button>
            <button onClick={() => { setShowInput(false); setFreeInput(""); }} className="px-4 py-1.5 text-sm text-[#726d6c]">Cancel</button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-3 bg-[#1a1816] border border-[#302927] rounded-lg p-4">
          <div className="w-5 h-5 border-2 border-[#502d26]/30 border-t-[#843c2d] rounded-full animate-spin" />
          <span className="text-sm text-[#726d6c]">Coach is thinking...</span>
        </div>
      )}

      {/* Messages */}
      {messages.length === 0 && !loading && (
        <div className="text-center py-8">
          <p className="text-sm text-[#726d6c]">Ask the AI Coach anything about this project.</p>
          <p className="text-xs text-[#726d6c] mt-1">It has full context — charter, tasks, milestones, notes, and activity.</p>
        </div>
      )}

      <div className="space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className="bg-[#1a1816] border border-[#302927] rounded-lg overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-[#302927] bg-[#0d0c0a]">
              <div className="flex items-center gap-2">
                <span className="text-sm">{ACTIONS.find((a) => a.id === msg.action)?.icon || "🤖"}</span>
                <span className="text-xs font-medium text-[#ede8df]">{msg.actionLabel}</span>
                {msg.input && <span className="text-[10px] text-[#726d6c] truncate max-w-[200px]">&quot;{msg.input}&quot;</span>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => saveToTimeline(msg)} className="text-[10px] text-[#843c2d] hover:text-[#ede8df]" title="Save to timeline">
                  Save
                </button>
                <span className="text-[10px] text-[#726d6c]">
                  {new Date(msg.timestamp).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
            {/* Response */}
            <div className="px-4 py-3 text-sm text-[#ede8df] whitespace-pre-wrap leading-relaxed">
              {msg.response}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
