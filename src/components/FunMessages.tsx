import { useState, useEffect, useMemo, useRef, useCallback } from 'react';

interface Message {
  id: string;
  name: string;
  content: string;
  createdAt: number;
}

interface FloatingMessageProps {
  message: Message;
  direction: 'left' | 'right';
  lane: number;
  durationMs: number;
  fromX: string;
  toX: string;
  onRemove: () => void;
}

function FloatingMessage({ message, direction, lane, durationMs, fromX, toX, onRemove }: FloatingMessageProps) {
  useEffect(() => {
    const timer = setTimeout(onRemove, durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, onRemove]);

  const style = {
    animation: `${direction === 'left' ? 'float-left' : 'float-right'} ${durationMs}ms linear forwards`,
    '--message-from': fromX,
    '--message-to': toX,
    '--message-lane': lane,
  };

  return (
    <div className="floating-message" style={style as React.CSSProperties}>
      <span className="message-bubble">
        "{message.content}" - {message.name}
      </span>
    </div>
  );
}

interface FloatingQueueItem {
  id: string;
  message: Message;
  direction: 'left' | 'right';
  lane: number;
  durationMs: number;
  fromX: string;
  toX: string;
}

export default function FunMessages({ apiUrl }: { apiUrl: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [floatingMessages, setFloatingMessages] = useState<FloatingQueueItem[]>([]);
  const [pendingMessages, setPendingMessages] = useState<Message[]>([]);
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const lastSubmitRef = useRef<number>(0);
  const seenMessageIdsRef = useRef(new Set<string>());
  const floatingMessagesRef = useRef<FloatingQueueItem[]>([]);
  const pendingMessagesRef = useRef<Message[]>([]);
  const trackCountRef = useRef(4);
  const areaRef = useRef<HTMLDivElement | null>(null);

  const laneCount = useMemo(() => {
    if (typeof window === 'undefined') {
      return 4;
    }
    return window.innerWidth <= 600 ? 3 : 4;
  }, []);

  useEffect(() => {
    const updateTrackCount = () => {
      trackCountRef.current = window.innerWidth <= 600 ? 3 : 4;
      flushPendingMessages();
    };

    updateTrackCount();
    window.addEventListener('resize', updateTrackCount);
    return () => window.removeEventListener('resize', updateTrackCount);
  }, []);

  useEffect(() => {
    floatingMessagesRef.current = floatingMessages;
  }, [floatingMessages]);

  useEffect(() => {
    pendingMessagesRef.current = pendingMessages;
  }, [pendingMessages]);

  const getFreeLane = useCallback(() => {
    const activeLanes = new Set(floatingMessagesRef.current.map((item) => item.lane));
    for (let lane = 0; lane < trackCountRef.current; lane += 1) {
      if (!activeLanes.has(lane)) {
        return lane;
      }
    }
    return null;
  }, []);

  const buildFloatingItem = useCallback((message: Message, lane: number): FloatingQueueItem => {
    const direction = Math.random() > 0.5 ? 'left' : 'right';
    const areaWidth = areaRef.current?.clientWidth || 760;
    const overscan = 140;
    const fromX = direction === 'left' ? `-${overscan}px` : `${areaWidth + overscan}px`;
    const toX = direction === 'left' ? `${areaWidth + overscan}px` : `-${overscan}px`;
    const durationMs = 15000;

    return {
      id: `${message.id}-${lane}`,
      message,
      direction,
      lane,
      durationMs,
      fromX,
      toX,
    };
  }, []);

  const flushPendingMessages = useCallback(() => {
    const queued = pendingMessagesRef.current;
    if (queued.length === 0) {
      return;
    }

    const additions: FloatingQueueItem[] = [];
    const nextQueue = [...queued];

    while (nextQueue.length > 0) {
      const lane = getFreeLane();
      if (lane === null) {
        break;
      }

      const message = nextQueue.shift();
      if (!message) {
        break;
      }

      additions.push(buildFloatingItem(message, lane));
    }

    if (additions.length > 0) {
      setFloatingMessages((current) => [...current, ...additions]);
    }

    if (nextQueue.length !== queued.length) {
      pendingMessagesRef.current = nextQueue;
      setPendingMessages(nextQueue);
    }
  }, [buildFloatingItem, getFreeLane]);

  // Load messages on mount
  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (messages.length === 0) {
      return;
    }

    const unseenMessages = messages.filter((message) => !seenMessageIdsRef.current.has(message.id));

    if (unseenMessages.length === 0) {
      return;
    }

    unseenMessages.forEach((message) => {
      seenMessageIdsRef.current.add(message.id);
    });

    setPendingMessages((currentQueue) => [...currentQueue, ...unseenMessages]);
  }, [messages]);

  useEffect(() => {
    flushPendingMessages();
  }, [floatingMessages, pendingMessages, flushPendingMessages, laneCount]);

  const fetchMessages = async () => {
    try {
      const response = await fetch(apiUrl);
      const data = await response.json();
      if (data.messages) {
        setMessages(data.messages);
      }
      if (typeof data.pendingCount === 'number') {
        setPendingCount(data.pendingCount);
      }
      if (data.status === 'pending') {
        setStatus((current) => current || '留言已提交，正在审核中');
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Local rate limit check
    const now = Date.now();
    if (now - lastSubmitRef.current < 30000) {
      setStatus('提交过于频繁，请等待30秒');
      return;
    }

    // Validation
    if (name.length < 2 || name.length > 20) {
      setStatus('昵称长度必须在2-20个字符之间');
      return;
    }

    if (content.length < 5 || content.length > 200) {
      setStatus('留言内容必须在5-200个字符之间');
      return;
    }

    setIsSubmitting(true);
    setStatus('提交中...');

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, content }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const finalMessage = typeof data.message === 'string' ? data.message : '提交成功';
        setStatus(finalMessage);
        setName('');
        setContent('');
        lastSubmitRef.current = now;
        await fetchMessages();
      } else {
        setStatus(data.error || '提交失败');
        await fetchMessages();
      }
    } catch (error) {
      setStatus('提交失败，请稍后重试');
    }

    setIsSubmitting(false);
  };

  const removeFloatingMessage = (id: string) => {
    setFloatingMessages((prev) => {
      const nextMessages = prev.filter((item) => item.id !== id);
      floatingMessagesRef.current = nextMessages;
      return nextMessages;
    });
    flushPendingMessages();
  };

  return (
    <div className="fun-messages-container">
      <h3 className="section-title">趣味留言墙</h3>

      {/* Floating messages display area */}
      <div className="floating-messages-area" ref={areaRef}>
        {floatingMessages.map(fm => (
          <FloatingMessage
            key={fm.id}
            message={fm.message}
            direction={fm.direction}
            lane={fm.lane}
            durationMs={fm.durationMs}
            fromX={fm.fromX}
            toX={fm.toX}
            onRemove={() => removeFloatingMessage(fm.id)}
          />
        ))}
        {floatingMessages.length === 0 && pendingMessages.length === 0 && (
          <p className="meta" style={{ textAlign: 'center', padding: '2rem' }}>
            暂无留言，快来提交第一条吧！
          </p>
        )}
      </div>

      {messages.length > 0 && (
        <p className="meta" style={{ textAlign: 'right', marginTop: '0.5rem' }}>
          当前已展示 {messages.length} 条留言
        </p>
      )}
      {pendingCount > 0 && (
        <p className="meta" style={{ textAlign: 'right', marginTop: '0.25rem' }}>
          还有 {pendingCount} 条留言正在审核
        </p>
      )}
      {pendingMessages.length > 0 && (
        <p className="meta" style={{ textAlign: 'right', marginTop: '0.25rem' }}>
          还有 {pendingMessages.length} 条留言正在排队展示
        </p>
      )}

      {/* Submission form */}
      <form className="message-form" onSubmit={handleSubmit}>
        <div className="form-row">
          <input
            type="text"
            placeholder="昵称 (2-20字符)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            disabled={isSubmitting}
          />
          <input
            type="text"
            placeholder="留言内容 (5-200字符)"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={200}
            disabled={isSubmitting}
            className="content-input"
          />
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? '提交中' : '提交'}
          </button>
        </div>
        {status && <p className="status-text">{status}</p>}
      </form>
    </div>
  );
}
