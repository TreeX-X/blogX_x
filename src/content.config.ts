import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import {
  postsSchema,
  knowledgeBaseSchema,
  wikiSchema,
  reposSchema,
  skillsSchema,
  projectsSchema,
} from './lib/content-schemas';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: postsSchema,
});

const knowledgeBase = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/knowledge-base' }),
  schema: knowledgeBaseSchema,
});

const wiki = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/wiki' }),
  schema: wikiSchema,
});

const repos = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/repos' }),
  schema: reposSchema,
});

const skills = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/skills' }),
  schema: skillsSchema,
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: projectsSchema,
});

export const collections = {
  posts,
  knowledgeBase,
  wiki,
  repos,
  skills,
  projects,
};
