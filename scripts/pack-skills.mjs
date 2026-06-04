import { readdir, stat, mkdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { join, relative } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { ZipArchive } = require('archiver');

const SKILLS_DIR = '.claude/skills';
const OUTPUT_DIR = 'public/skills-download';

async function getAllFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      files.push(...await getAllFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

async function packSkill(skillDirName, outputDir) {
  const skillPath = join(SKILLS_DIR, skillDirName);
  const outputPath = join(outputDir, `${skillDirName}.zip`);

  const files = await getAllFiles(skillPath);
  if (files.length === 0) return false;

  await mkdir(outputDir, { recursive: true });

  const output = createWriteStream(outputPath);
  const archive = new ZipArchive({ zlib: { level: 9 } });

  archive.pipe(output);

  for (const file of files) {
    const relPath = relative(skillPath, file);
    archive.file(file, { name: relPath });
  }

  await archive.finalize();
  await new Promise((resolve, reject) => {
    output.on('close', resolve);
    output.on('error', reject);
  });

  return true;
}

async function main() {
  console.log('📦 [pack-skills] 打包 Claude Code Skills...');

  try {
    await stat(SKILLS_DIR);
  } catch {
    console.log('⏭️ [pack-skills] .claude/skills/ 不存在，跳过打包');
    return;
  }

  const entries = await readdir(SKILLS_DIR, { withFileTypes: true });
  const skillDirs = entries.filter(e => e.isDirectory());

  let packed = 0;
  for (const dir of skillDirs) {
    const ok = await packSkill(dir.name, OUTPUT_DIR);
    if (ok) {
      console.log(`  ✅ ${dir.name}.zip`);
      packed++;
    }
  }

  console.log(`📊 [pack-skills] 完成: ${packed} 个 skill 已打包到 ${OUTPUT_DIR}/`);
}

main().catch(err => {
  console.error('❌ [pack-skills] 打包失败:', err.message);
  process.exit(1);
});
