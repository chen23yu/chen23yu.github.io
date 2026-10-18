import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import YAML from 'yaml';

const here = path.dirname(fileURLToPath(import.meta.url));
const run = promisify(execFile);
const fail = (status, message) => Object.assign(new Error(message), { status });
const digest = text => createHash('sha256').update(text).digest('hex');
const validSlug = slug => /^[a-z0-9][a-z0-9-]{0,149}$/.test(slug);
const contentTypes = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.gif':'image/gif', '.webp':'image/webp', '.avif':'image/avif', '.woff':'font/woff', '.woff2':'font/woff2', '.ttf':'font/ttf' };
function parsePost(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw fail(422, '文章缺少有效的 YAML 信息区');
  return { metadata: YAML.parse(match[1]), body: text.slice(match[0].length).replace(/^\r?\n/, '') };
}
async function body(req, max = 5 * 1024 * 1024) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > max) throw fail(413, '文件太大'); chunks.push(chunk); }
  return Buffer.concat(chunks);
}
export function createStudio({ root = path.resolve(here, '..'), port = 4318 } = {}) {
  const posts = path.join(root, 'src/content/posts');
  const token = randomBytes(32).toString('hex');
  let writes = Promise.resolve(), publishing = false;
  const queue = fn => { const next = writes.then(fn); writes = next.catch(() => {}); return next; };
  const postFile = slug => { if (!validSlug(slug)) throw fail(400, '文件名只接受英文小写、数字和短横线'); return path.join(posts, slug + '.md'); };
  async function load(slug) {
    const text = await fs.readFile(postFile(slug), 'utf8');
    return { slug, ...parsePost(text), version: digest(text) };
  }
  async function save(slug, data) {
    if (publishing) throw fail(409, '正在发布，请稍后保存');
    const filename = postFile(slug);
    let old;
    try { old = await load(slug); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    if ((old?.version ?? null) !== data.version) throw fail(409, '文件已在其他窗口或后台修改。请先重新打开，避免覆盖。');
    const m = data.metadata;
    if (!m || typeof m.title !== 'string' || !m.title.trim() || m.title.length > 300) throw fail(422, '请填写文章标题');
    for (const key of ['published','updated']) if (m[key] && (!/^\d{4}-\d{2}-\d{2}$/.test(m[key]) || !Number.isFinite(Date.parse(m[key])))) throw fail(422, '日期格式应为 YYYY-MM-DD');
    if (!m.published || typeof m.draft !== 'boolean' || !Array.isArray(m.tags) || m.tags.some(x => typeof x !== 'string')) throw fail(422, '文章信息格式不正确');
    if (typeof data.body !== 'string') throw fail(422, '正文格式不正确');
    const metadata = { ...old?.metadata, ...m };
    if (!metadata.updated) delete metadata.updated;
    const text = '---\n' + YAML.stringify(metadata) + '---\n\n' + data.body.replace(/\r\n/g, '\n').trimEnd() + '\n';
    await fs.mkdir(posts, { recursive: true });
    const temp = filename + '.' + randomBytes(6).toString('hex') + '.tmp';
    await fs.writeFile(temp, text, { flag: 'wx' });
    await fs.rename(temp, filename);
    return load(slug);
  }
  const git = async args => (await run('git', ['-c','http.proxy=', ...args], { cwd:root, windowsHide:true, maxBuffer:2*1024*1024 })).stdout.trim();
  async function publish() {
    if (publishing) throw fail(409, '正在发布');
    publishing = true;
    try {
      await writes;
      if (await git(['branch','--show-current']) !== 'main') throw fail(409, '请先将博客切换到 main 分支');
      if (await git(['remote','get-url','origin']) !== 'https://github.com/chen23yu/chen23yu.github.io.git') throw fail(409, '仓库地址不符合当前博客配置');
      const staged = await git(['diff','--cached','--name-only']);
      if (staged) throw fail(409, 'Git 暂存区有其他改动，请先处理后再发布');
      await git(['fetch','origin','main']);
      try { await git(['merge-base','--is-ancestor','origin/main','HEAD']); }
      catch {
        try { await git(['merge','--ff-only','origin/main']); }
        catch { throw fail(409, 'GitHub 与本地的改动暂时无法自动同步，请先处理版本差异；文章仍保存在本地，没有被覆盖。'); }
      }
      // Validate the same Astro content schema used by the public blog before committing.
      await run(process.execPath, [path.join(root,'node_modules/astro/astro.js'),'build'], { cwd:root, windowsHide:true, timeout:180000, maxBuffer:4*1024*1024 });
      await git(['add','--','src/content/posts']);
      if (await fs.stat(path.join(root,'public/images/uploads')).catch(() => null)) await git(['add','--','public/images/uploads']);
      if (await git(['diff','--cached','--name-only'])) await git(['commit','-m','Update articles from Paper Trails Studio']);
      await git(['push','origin','main']);
      return { commit:await git(['rev-parse','--short','HEAD']), url:'https://github.com/chen23yu/chen23yu.github.io/actions', message:'已上传 GitHub。网页部署通常需要 1–3 分钟。' };
    } catch (e) {
      if (e.status) throw e;
      throw fail(500, '发布未完成：' + String(e.stderr || e.message).slice(-1800) + '\n文章已保存在本地，可稍后重试。');
    } finally { publishing = false; }
  }
  async function staticFile(res, base, relative) {
    const resolved = await fs.realpath(path.resolve(base, relative));
    const realBase = await fs.realpath(base);
    if (resolved !== realBase && !resolved.startsWith(realBase + path.sep)) throw fail(403,'禁止访问该路径');
    const bytes = await fs.readFile(resolved);
    res.writeHead(200, { 'Content-Type':contentTypes[path.extname(resolved)] || 'application/octet-stream', 'Cache-Control':'no-cache', 'X-Content-Type-Options':'nosniff' }); res.end(bytes);
  }
  const server = http.createServer(async (req, res) => {
    const json = (value, status = 200) => { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}); res.end(JSON.stringify(value)); };
    try {
      const host = req.headers.host;
      if (host !== `127.0.0.1:${server.address().port}`) throw fail(403,'仅允许本机访问');
      const url = new URL(req.url, `http://${host}`);
      const pathname = decodeURIComponent(url.pathname);
      if (!['GET','HEAD'].includes(req.method)) {
        if (req.headers.origin !== `http://${host}` || req.headers['x-studio-token'] !== token) throw fail(403,'请求来源无效，请重新打开写作台');
      }
      if (req.method === 'GET' && pathname === '/api/info') return json({ app:'paper-trails-studio', root, token, publishing });
      if (req.method === 'GET' && pathname === '/api/posts') {
        const names = await fs.readdir(posts);
        return json((await Promise.all(names.filter(n => n.endsWith('.md') && validSlug(n.slice(0,-3))).map(async n => { const p = await load(n.slice(0,-3)); return {slug:p.slug,...p.metadata}; }))).sort((a,b) => String(b.published).localeCompare(String(a.published))));
      }
      if (pathname.startsWith('/api/posts/')) {
        const slug = pathname.slice('/api/posts/'.length);
        if (req.method === 'GET') return json(await load(slug));
        if (req.method === 'PUT') { const data = JSON.parse((await body(req)).toString()); return json(await queue(() => save(slug,data))); }
      }
      if (req.method === 'POST' && pathname === '/api/images') {
        if (publishing) throw fail(409,'正在发布，请稍后上传');
        const ext = {'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp','image/gif':'.gif','image/avif':'.avif'}[req.headers['content-type']];
        if (!ext) throw fail(422,'支持 PNG、JPEG、WebP、GIF 和 AVIF 图片');
        const bytes = await body(req, 15*1024*1024);
        const name = Date.now() + '-' + randomBytes(6).toString('hex') + ext;
        await queue(async () => { const dir = path.join(root,'public/images/uploads'); await fs.mkdir(dir,{recursive:true}); await fs.writeFile(path.join(dir,name),bytes,{flag:'wx'}); });
        return json({url:'/images/uploads/' + name});
      }
      if (req.method === 'POST' && pathname === '/api/publish') return json(await publish());
      if (req.method !== 'GET') throw fail(405,'不支持的操作');
      if (pathname.startsWith('/api/')) throw fail(404,'没有该接口');
      if (pathname.startsWith('/vendor/')) return await staticFile(res,path.join(here,'node_modules'),pathname.slice(8));
      if (pathname.startsWith('/images/') || pathname.startsWith('/assets/')) return await staticFile(res,path.join(root,'public'),pathname.slice(1));
      return await staticFile(res,path.join(here,'web'),pathname === '/' ? 'index.html' : pathname.slice(1));
    } catch (e) { json({error:e.code === 'ENOENT' ? '文件不存在' : e.message}, e.status || (e.code === 'ENOENT' ? 404 : 500)); }
  });
  return server;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.STUDIO_PORT || 4318);
  createStudio({port}).listen(port,'127.0.0.1', () => console.log(`Paper Trails Studio: http://127.0.0.1:${port}`));
}
