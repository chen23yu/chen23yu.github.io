import fs from 'node:fs';
import path from 'node:path';

const slug = process.argv[2];
if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
  console.error('Usage: pnpm new-post your-paper-slug (lowercase letters, digits and hyphens)');
  process.exit(1);
}
const target = path.resolve('src/content/posts', `${slug}.md`);
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const template = fs.readFileSync('templates/paper-review.md', 'utf8').replace(/^published: .*$/m, `published: ${today}`);
fs.writeFileSync(target, template, { flag: 'wx' });
console.log(`Created draft: ${target}\nSet draft: false when ready to publish.`);
