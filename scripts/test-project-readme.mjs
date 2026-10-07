import test from 'node:test';
import assert from 'node:assert/strict';
import { extractReadme, fetchProjectReadme, githubRepository } from '../src/lib/project-readme.ts';
import { validateCollectionFields } from '../src/lib/content-schemas.ts';

const revision = 'a'.repeat(40);
const context = { owner: 'author', repo: 'example', revision, fetchedAt: '2026-10-07T00:00:00Z' };
const readme = `# Example
### 项目的用途说明
**这是一个解决实际问题的项目介绍，适合用作博客项目展示的简介。**
[![License](https://img.shields.io/badge/MIT)](LICENSE)
<img src="resources/icon.png" alt="logo">
<img src="docs/overview.gif" alt="真实演示">
![架构图](docs/architecture.png)
![unsafe](javascript:alert)
## 核心功能
### 01 · 多分支管理
在同一项目中维护多个独立分支，能够隔离任务并继续运行服务。
### 02 · 会话与检查点
支持查看每一轮的对话记录和变更，帮助定位问题和恢复文件。
## 安装
此段安装命令不应进入默认的项目介绍精选内容中。
\`\`\`html
<img src="docs/not-a-real-image.png">
\`\`\`
`;

test('extracts readable sections and pinned media, omitting badges, icons and code', () => {
  const snapshot = extractReadme(readme, context);
  assert.equal(snapshot.summary, '项目的用途说明');
  assert.deepEqual(snapshot.highlights, ['多分支管理', '会话与检查点']);
  assert.equal(snapshot.sections.length, 2);
  assert.equal(snapshot.images.length, 2);
  assert.equal(snapshot.images[0].url, `https://raw.githubusercontent.com/author/example/${revision}/docs/overview.gif`);
  assert.ok(snapshot.sections.every(section => !section.text.includes('安装命令')));
  assert.equal(snapshot.fetchedAt, context.fetchedAt);
});

test('handles relative assets and empty README without manufacturing content', () => {
  const snapshot = extractReadme('![diagram](../assets/chart.png)', { ...context, path: 'docs/README.md' });
  assert.equal(snapshot.images[0].url, `https://raw.githubusercontent.com/author/example/${revision}/assets/chart.png`);
  assert.equal(snapshot.summary, '');
  assert.deepEqual(snapshot.sections, []);
});

test('rejects non-GitHub addresses before making a request', async () => {
  for (const url of ['http://github.com/a/b', 'https://github.com.evil.test/a/b', 'https://localhost/a/b', 'https://github.com/a/b/tree/main', 'https://user@github.com/a/b']) {
    await assert.rejects(fetchProjectReadme(url, () => { throw Error('network must not be called'); }), /GitHub 仓库地址/);
  }
  assert.deepEqual(githubRepository('https://github.com/author/example.git'), {owner:'author',repo:'example'});
});

test('pins README and images to the same commit and reports upstream failures', async () => {
  const urls = [];
  const fetcher = async url => {
    urls.push(url);
    return Response.json(url.includes('commits?') ? [{sha:revision}] : {encoding:'base64',content:Buffer.from(readme).toString('base64'),path:'README.md'});
  };
  const snapshot = await fetchProjectReadme('https://github.com/author/example', fetcher);
  assert.ok(urls[1].endsWith(`readme?ref=${revision}`));
  assert.equal(snapshot.revision, revision);
  await assert.rejects(fetchProjectReadme('https://github.com/author/example', async () => new Response('', {status:429})), /HTTP 429/);
});

test('project schema accepts snapshots and rejects unsafe covers and oversized highlights', () => {
  const project = {title:'Example',repoUrl:'https://github.com/author/example',description:'Description',readmeSnapshot:extractReadme(readme,context),summary:'Manual summary',coverImage:'/projects/manual.webp'};
  assert.equal(validateCollectionFields('projects',project).ok,true);
  assert.equal(validateCollectionFields('projects',{...project,coverImage:'javascript:alert(1)'}).ok,false);
  assert.equal(validateCollectionFields('projects',{...project,readmeSnapshot:{...project.readmeSnapshot,sourceUrl:'javascript:alert(1)'}}).ok,false);
  assert.equal(validateCollectionFields('projects',{...project,highlights:['1','2','3','4']}).ok,false);
  assert.equal(validateCollectionFields('projects',{...project,readmeSnapshot:null}).ok,true);
});
