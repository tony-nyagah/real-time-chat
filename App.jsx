import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabase";
import "./App.css";

const ROOMS = ["general", "random", "dev", "design", "announcements"];

function generateUserId() {
  return "user_" + Math.random().toString(36).slice(2, 8);
}

const userId = generateUserId();

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function App() {
  const [screen, setScreen] = useState("login"); // 'login' | 'chat'
  const [username, setUsername] = useState("");
  const [room, setRoom] = useState("general");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [online, setOnline] = useState({});
  const [typing, setTyping] = useState({});
  const [unread, setUnread] = useState({});
  const [loadingMessages, setLoadingMessages] = useState(false);
  const bottomRef = useRef(null);
  const channelRef = useRef(null);
  const typingTimerRef = useRef(null);

  const joinChannel = useCallback((roomName, name) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Channel naming: scope:id:entity per Supabase docs
    const channel = supabase.channel(`room:${roomName}:messages`, {
      config: {
        private: false, // set true once you add realtime.messages RLS policies
        presence: { key: userId },
      },
    });

    // Presence — online users
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const users = {};
      Object.values(state)
        .flat()
        .forEach((u) => {
          users[u.userId] = u.username;
        });
      setOnline(users);
    });

    // Typing broadcast
    channel.on("broadcast", { event: "typing" }, ({ payload }) => {
      if (payload.userId === userId) return;
      setTyping((prev) => ({ ...prev, [payload.userId]: payload.username }));
      setTimeout(() => {
        setTyping((prev) => {
          const next = { ...prev };
          delete next[payload.userId];
          return next;
        });
      }, 2500);
    });

    // New messages via Postgres Changes (fires on every INSERT without needing a custom trigger)
    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `room=eq.${roomName}`,
      },
      ({ new: record }) => {
        setMessages((prev) => {
          // avoid duplicates (optimistic message already in list under same id)
          if (prev.find((m) => m.id === record.id)) return prev;
          return [...prev, record];
        });
      },
    );

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ userId, username: name });
      }
    });

    channelRef.current = channel;
  }, []);

  useEffect(() => {
    if (screen !== "chat") return;

    let cancelled = false;
    setMessages([]);
    setLoadingMessages(true);

    supabase
      .from("messages")
      .select("*")
      .eq("room", room)
      .order("created_at", { ascending: true })
      .limit(100)
      .then(({ data }) => {
        if (!cancelled) {
          setMessages(data || []);
          setLoadingMessages(false);
        }
      });

    joinChannel(room, username);

    return () => {
      cancelled = true;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [room, screen]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (!username.trim()) return;
    setScreen("chat");
  };

  const switchRoom = (r) => {
    setRoom(r);
    setUnread((prev) => ({ ...prev, [r]: 0 }));
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const content = input.trim();
    setInput("");

    // Optimistic update — show the message immediately for the sender
    const tempId = `temp_${Date.now()}`;
    const optimistic = {
      id: tempId,
      room,
      user_id: userId,
      username,
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    const { data, error } = await supabase
      .from("messages")
      .insert({ room, user_id: userId, username, content })
      .select()
      .single();

    if (data) {
      // Swap temp entry for the real DB record so the duplicate check works
      setMessages((prev) => prev.map((m) => (m.id === tempId ? data : m)));
    } else {
      // Insert failed — roll back the optimistic message
      console.error("Failed to send message:", error);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    }
  };

  const handleTyping = (e) => {
    setInput(e.target.value);
    if (!channelRef.current) return;
    channelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: { userId, username },
    });
    clearTimeout(typingTimerRef.current);
  };

  const typingUsers = Object.values(typing).filter(Boolean);
  const onlineCount = Object.keys(online).length;

  if (screen === "login") {
    return (
      <div className="login-screen">
        <div className="login-box">
          <div className="login-logo">
            <span className="logo-bracket">[</span>
            <span className="logo-text">RELAY</span>
            <span className="logo-bracket">]</span>
          </div>
          <p className="login-sub">real-time chat</p>
          <form onSubmit={handleLogin} className="login-form">
            <div className="input-row">
              <span className="prompt">$</span>
              <input
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="enter your handle"
                maxLength={20}
              />
            </div>
            <button type="submit" className="join-btn">
              connect →
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="logo-sm">[RELAY]</span>
        </div>

        <div className="sidebar-section">
          <div className="section-label">CHANNELS</div>
          {ROOMS.map((r) => (
            <button
              key={r}
              className={`room-btn ${r === room ? "active" : ""}`}
              onClick={() => switchRoom(r)}
            >
              <span className="hash">#</span>
              <span>{r}</span>
              {unread[r] > 0 && <span className="badge">{unread[r]}</span>}
            </button>
          ))}
        </div>

        <div className="sidebar-section online-section">
          <div className="section-label">ONLINE — {onlineCount}</div>
          {Object.entries(online).map(([id, name]) => (
            <div key={id} className="online-user">
              <span className="dot green" />
              <span className={id === userId ? "me" : ""}>
                {name}
                {id === userId ? " (you)" : ""}
              </span>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <span className="dot green" />
          <span className="me">{username}</span>
        </div>
      </aside>

      {/* Main */}
      <main className="chat-main">
        <div className="chat-header">
          <span className="hash">#</span>
          <span className="room-name">{room}</span>
          <span className="header-meta">{onlineCount} online</span>
        </div>

        <div className="messages-area">
          {loadingMessages && <div className="empty-state">Loading...</div>}
          {!loadingMessages && messages.length === 0 && (
            <div className="empty-state">No messages yet. Say hello!</div>
          )}
          {messages.map((msg, i) => {
            const isMe = msg.user_id === userId;
            const showUser = i === 0 || messages[i - 1].user_id !== msg.user_id;
            return (
              <div
                key={msg.id}
                className={`message ${isMe ? "mine" : ""} ${!showUser ? "cont" : ""}`}
              >
                {showUser && (
                  <div className="msg-header">
                    <span className={`msg-user ${isMe ? "me" : ""}`}>
                      {msg.username}
                    </span>
                    <span className="msg-time">
                      {formatTime(msg.created_at)}
                    </span>
                  </div>
                )}
                <div className="msg-body">{msg.content}</div>
              </div>
            );
          })}
          {typingUsers.length > 0 && (
            <div className="typing-indicator">
              <span className="typing-dots">
                <span />
                <span />
                <span />
              </span>
              <span>
                {typingUsers.join(", ")}{" "}
                {typingUsers.length === 1 ? "is" : "are"} typing
              </span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form className="input-area" onSubmit={sendMessage}>
          <span className="input-prefix">#{room} &gt;</span>
          <input
            autoFocus
            value={input}
            onChange={handleTyping}
            placeholder="message..."
          />
          <button type="submit" className="send-btn" disabled={!input.trim()}>
            send
          </button>
        </form>
      </main>
    </div>
  );
}
