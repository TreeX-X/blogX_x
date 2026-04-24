import { useState, useEffect, useRef, useCallback } from 'react';

interface Message {
  id: string;
  name: string;
  content: string;
  createdAt: number;
}

interface FloatingQueueItem {
  id: string;
  message: Message;
  lane: number;
  topPx: number;
  animationName: 'float-left' | 'float-right';
  durationMs: number;
  fromX: string;
  toX: string;
}

interface FloatingMessageProps {
  message: Message;
  lane: number;
  topPx: number;
  animationName: 'float-left' | 'float-right';
  durationMs: number;
  fromX: string;
  toX: string;
  onComplete: () => void;
}

function FloatingMessage({ message, lane, topPx, animationName, durationMs, fromX, toX, onComplete }: FloatingMessageProps) {
  const style = {
    top: `${topPx}px`,
    animation: `${animationName} ${durationMs}ms linear forwards`,
    '--message-from': fromX,
    '--message-to': toX,
  } as React.CSSProperties;

  return (
    <div className="floating-message" data-lane={lane} style={style} onAnimationEnd={onComplete}>
      <span className="message-bubble">
        "{message.content}" - {message.name}
      </span>
    </div>
  );
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
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const floatingMessagesRef = useRef<FloatingQueueItem[]>([]);
  const pendingMessagesRef = useRef<Message[]>([]);
  const trackCountRef = useRef(4);
  const areaRef = useRef<HTMLDivElement | null>(null);

  const getTrackCount = useCallback(() => {
    if (typeof window === 'undefined') {
      return 4;
    }
    return window.innerWidth <= 600 ? 3 : 4;
  }, []);

  const getTrackTop = useCallback((lane: number) => {
    const isCompact = typeof window !== 'undefined' && window.innerWidth <= 600;
    const topOffset = isCompact ? 10 : 14;
    const trackStep = isCompact ? 40 : 44;
    return topOffset + lane * trackStep;
  }, []);

  const buildFloatingItem = useCallback(
    (message: Message, lane: number): FloatingQueueItem => {
      const direction = Math.random() > 0.5 ? 'float-left' : 'float-right';
      const areaWidth = areaRef.current?.clientWidth || 760;
      const overscan = 140;
      const fromX = direction === 'float-left' ? `-${overscan}px` : `${areaWidth + overscan}px`;
      const toX = direction === 'float-left' ? `${areaWidth + overscan}px` : `-${overscan}px`;

      return {
        id: `${message.id}-${lane}-${Date.now()}`,
        message,
        lane,
        topPx: getTrackTop(lane),
        animationName: direction,
        durationMs: 15000,
        fromX,
        toX,
      };
    },
    [getTrackTop],
  );

  const flushPendingMessages = useCallback(() => {
    const queue = pendingMessagesRef.current;
    if (queue.length === 0) {
      return;
    }

    const currentItems = floatingMessagesRef.current;
    const reservedLanes = new Set(currentItems.map((item) => item.lane));
    const additions: FloatingQueueItem[] = [];
    const remainingQueue = [...queue];

    while (remainingQueue.length > 0) {
      let freeLane: number | null = null;
      for (let lane = 0; lane < trackCountRef.current; lane += 1) {
        if (!reservedLanes.has(lane)) {
          freeLane = lane;
          break;
        }
      }

      if (freeLane === null) {
        break;
      }

      const nextMessage = remainingQueue.shift();
      if (!nextMessage) {
        break;
      }

      reservedLanes.add(freeLane);
      additions.push(buildFloatingItem(nextMessage, freeLane));
    }

    if (additions.length === 0) {
      return;
    }

    const nextItems = [...currentItems, ...additions];
    floatingMessagesRef.current = nextItems;
    setFloatingMessages(nextItems);

    pendingMessagesRef.current = remainingQueue;
    setPendingMessages(remainingQueue);
  }, [buildFloatingItem]);

  const fetchMessages = useCallback(async () => {
    try {
      const response = await fetch(apiUrl);
      const data = await response.json();

      if (Array.isArray(data.messages)) {
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
  }, [apiUrl]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    const updateTrackCount = () => {
      trackCountRef.current = getTrackCount();
      setFloatingMessages((current) => {
        floatingMessagesRef.current = current.map((item) => ({
          ...item,
          topPx: getTrackTop(item.lane),
        }));
        return floatingMessagesRef.current;
      });
    };

    updateTrackCount();
    window.addEventListener('resize', updateTrackCount);
    return () => window.removeEventListener('resize', updateTrackCount);
  }, [getTrackCount, getTrackTop]);

  useEffect(() => {
    if (messages.length === 0) {
      return;
    }

    const unseenMessages = messages.filter((message) => !seenMessageIdsRef.current.has(message.id));
    if (unseenMessages.length === 0) {
      return;
    }

    unseenMessages.forEach((message) => seenMessageIdsRef.current.add(message.id));
    pendingMessagesRef.current = [...pendingMessagesRef.current, ...unseenMessages];
    setPendingMessages(pendingMessagesRef.current);
  }, [messages]);

  useEffect(() => {
    flushPendingMessages();
  }, [floatingMessages, pendingMessages, flushPendingMessages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const now = Date.now();
    if (now - lastSubmitRef.current < 30000) {
      setStatus('提交过于频繁，请等待30秒');
      return;
    }

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
        setStatus(typeof data.message === 'string' ? data.message : '提交成功');
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
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeFloatingMessage = useCallback(
    (id: string) => {
      const nextItems = floatingMessagesRef.current.filter((item) => item.id !== id);
      floatingMessagesRef.current = nextItems;
      setFloatingMessages(nextItems);
      flushPendingMessages();
      fetchMessages();
    },
    [fetchMessages, flushPendingMessages],
  );

  return (
    <div className="fun-messages-container">
      <h3 className="section-title">趣味留言墙</h3>

      <div className="floating-messages-area" ref={areaRef}>
        {floatingMessages.map((fm) => (
          <FloatingMessage
            key={fm.id}
            message={fm.message}
            lane={fm.lane}
            topPx={fm.topPx}
            animationName={fm.animationName}
            durationMs={fm.durationMs}
            fromX={fm.fromX}
            toX={fm.toX}
            onComplete={() => removeFloatingMessage(fm.id)}
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
