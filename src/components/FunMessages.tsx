import { useState, useEffect, useRef } from 'react';

interface Message {
  id: string;
  name: string;
  content: string;
  createdAt: number;
}

interface FloatingMessageProps {
  message: Message;
  direction: 'left' | 'right';
  onRemove: () => void;
}

function FloatingMessage({ message, direction, onRemove }: FloatingMessageProps) {
  useEffect(() => {
    const timer = setTimeout(onRemove, 15000);
    return () => clearTimeout(timer);
  }, [onRemove]);

  const style = {
    animation: direction === 'left' ? 'float-left 15s linear forwards' : 'float-right 15s linear forwards',
    top: `${Math.random() * 60 + 10}%`,
  };

  return (
    <div className="floating-message" style={style}>
      <span className="message-bubble">
        "{message.content}" - {message.name}
      </span>
    </div>
  );
}

export default function FunMessages({ apiUrl }: { apiUrl: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [floatingMessages, setFloatingMessages] = useState<{ id: string; message: Message; direction: 'left' | 'right' }[]>([]);
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const lastSubmitRef = useRef<number>(0);

  // Load messages on mount
  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  // Add new messages to floating queue
  useEffect(() => {
    if (messages.length > 0) {
      const currentIds = floatingMessages.map(f => f.message.id);
      const newMessages = messages.filter(m => !currentIds.includes(m.id));

      newMessages.forEach(msg => {
        const direction = Math.random() > 0.5 ? 'left' : 'right';
        setFloatingMessages(prev => [...prev, { id: msg.id + '-' + Date.now(), message: msg, direction }]);
      });
    }
  }, [messages]);

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
    setFloatingMessages(prev => prev.filter(f => f.id !== id));
  };

  return (
    <div className="fun-messages-container">
      <h3 className="section-title">趣味留言墙</h3>

      {/* Floating messages display area */}
      <div className="floating-messages-area">
        {floatingMessages.map(fm => (
          <FloatingMessage
            key={fm.id}
            message={fm.message}
            direction={fm.direction}
            onRemove={() => removeFloatingMessage(fm.id)}
          />
        ))}
        {floatingMessages.length === 0 && (
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
