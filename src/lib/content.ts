import { getCollection } from 'astro:content';

export async function getPublishedPosts() {
  const posts = await getCollection('posts', ({ data }) => !data.isDraft);
  return posts.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export async function getAllNotes() {
  const notes = await getCollection('notes');
  return notes.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export function getEntrySlug(entry: { slug?: string; id: string }) {
  if (entry.slug && entry.slug.length > 0) return entry.slug;
  return entry.id.replace(/\\/g, '/').replace(/^.*\//, '').replace(/\.mdx?$/, '');
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
