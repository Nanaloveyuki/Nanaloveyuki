import { getCollection, type CollectionEntry } from 'astro:content';

export type BlogEntry = CollectionEntry<'blog'>;

export const isPublicBlogEntry = (entry: BlogEntry) =>
  entry.id !== 'example' && entry.id !== '.example' && !entry.data.draft;

export const parseBlogDate = (value: string) => {
  const normalized = value.trim();

  if (/^\d{8}$/.test(normalized)) {
    const year = Number(normalized.slice(0, 4));
    const month = Number(normalized.slice(4, 6)) - 1;
    const day = Number(normalized.slice(6, 8));
    return new Date(year, month, day);
  }

  return new Date(normalized);
};

export const formatBlogDate = (value: string) => {
  const date = parseBlogDate(value);

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};

export const sortBlogEntries = (entries: BlogEntry[]) =>
  [...entries].sort(
    (left, right) =>
      parseBlogDate(right.data.time).getTime() - parseBlogDate(left.data.time).getTime(),
  );

const isMissingBlogCollectionError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes('The collection "blog" does not exist or is empty.');
};

export const getPublishedBlogEntries = async () => {
  let entries: BlogEntry[] = [];

  try {
    entries = await getCollection('blog');
  } catch (error) {
    if (isMissingBlogCollectionError(error)) {
      return [];
    }

    throw error;
  }

  const published = entries.filter(isPublicBlogEntry);
  return sortBlogEntries(published);
};
