import { getCollection } from 'astro:content';

export async function getPublishedPosts() {
  const posts = await getCollection('posts', ({ data }) => !data.isDraft);
  return posts.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export async function getKnowledgeBaseEntries() {
  const entries = await getCollection('knowledgeBase', ({ data }) => !data.isDraft);
  return entries.sort((a, b) => getContentDate(b).getTime() - getContentDate(a).getTime());
}

export function getEntryPath(entry: { slug?: string; id: string }) {
  if (entry.slug && entry.slug.length > 0) return entry.slug;
  return entry.id.replace(/\\/g, '/').replace(/\.mdx?$/, '');
}

export function getEntrySlug(entry: { slug?: string; id: string }) {
  const entryPath = getEntryPath(entry);
  const segments = entryPath.split('/');
  return segments[segments.length - 1] || entryPath;
}

function tryParseDateFromId(id: string) {
  const matched = id.match(/(\d{4}-\d{2}-\d{2})/);
  if (!matched) return null;
  const date = new Date(matched[1]);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getContentDate(entry: { data: { date?: Date }; id: string }) {
  const dataDate = entry.data?.date;
  if (dataDate instanceof Date && !Number.isNaN(dataDate.getTime())) return dataDate;
  return tryParseDateFromId(entry.id) || new Date(0);
}

export function getContentTitle(entry: { data: { title?: string }; slug?: string; id: string }) {
  const title = entry.data?.title;
  if (typeof title === 'string' && title.trim()) return title.trim();
  return getEntrySlug(entry);
}

export function getContentSummary(
  entry: { data: { description?: string }; body?: string },
  maxLength = 100
) {
  const description = entry.data?.description;
  if (typeof description === 'string' && description.trim()) return description.trim();
  const plain = String(entry.body ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/[>#*_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength).trim()}...`;
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
