import { useState, useEffect } from 'react';

interface Idea {
  id: string;
  name: string;
  idea: string;
  createdAt: number;
  implemented: boolean;
  adminNote?: string;
}

export default function IdeaBox({ apiUrl }: { apiUrl: string }) {
  const [implementedIdeas, setImplementedIdeas] = useState<Idea[]>([]);
  const [pendingIdeas, setPendingIdeas] = useState<Idea[]>([]);
  const [name, setName] = useState('');
  const [idea, setIdea] = useState('');
  const [status, setStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchIdeas();
  }, []);

  const fetchIdeas = async () => {
    try {
      const response = await fetch(apiUrl);
      const data = await response.json();
      if (data.implemented) setImplementedIdeas(data.implemented);
      if (data.pending) setPendingIdeas(data.pending);
    } catch (error) {
      console.error('Failed to fetch ideas:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (name.length < 2 || name.length > 20) {
      setStatus('昵称长度必须在2-20个字符之间');
      return;
    }

    if (idea.length < 5 || idea.length > 500) {
      setStatus('点子内容必须在5-500个字符之间');
      return;
    }

    setIsSubmitting(true);
    setStatus('提交中...');

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, idea }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setStatus('感谢提交，等待管理员审核');
        setName('');
        setIdea('');
      } else {
        setStatus(data.error || '提交失败');
      }
    } catch (error) {
      setStatus('提交失败，请稍后重试');
    }

    setIsSubmitting(false);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('zh-CN');
  };

  return (
    <div className="idea-box-container">
      <h3 className="section-title">点子收集箱</h3>

      {/* Implemented ideas */}
      {implementedIdeas.length > 0 && (
        <div className="idea-group">
          <h4 className="idea-group-title implemented">
            <span className="status-icon">✓</span> 已实现
          </h4>
          <ul className="idea-list">
            {implementedIdeas.map(idea => (
              <li key={idea.id} className="idea-item implemented">
                <span className="idea-content">{idea.idea}</span>
                {idea.adminNote && (
                  <span className="idea-note"> - {idea.adminNote}</span>
                )}
                <span className="idea-meta">提交者: {idea.name} | {formatTime(idea.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Pending ideas */}
      {pendingIdeas.length > 0 && (
        <div className="idea-group">
          <h4 className="idea-group-title pending">
            <span className="status-icon">○</span> 待实现
          </h4>
          <ul className="idea-list">
            {pendingIdeas.map(idea => (
              <li key={idea.id} className="idea-item pending">
                <span className="idea-content">{idea.idea}</span>
                <span className="idea-meta">提交者: {idea.name} | {formatTime(idea.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* No ideas message */}
      {implementedIdeas.length === 0 && pendingIdeas.length === 0 && (
        <p className="meta" style={{ textAlign: 'center', padding: '1rem' }}>
          暂无已审核的点子，快来提交你的想法吧！
        </p>
      )}

      {/* Submission form */}
      <form className="idea-form" onSubmit={handleSubmit}>
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
            placeholder="点子内容 (5-500字符)"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            maxLength={500}
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