const $ = id => document.getElementById(id);
let editor, info, allPosts = [], current, dirty = false, bodyDirty = false, loading = false, busy = false, savedRange, formulaRange, formulaEdit, toastTimer, lastEditorValue;
const today = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const fields = ['title','slug','published','category','tags','description','cover','draft'];
function toast(message, duration = 7000) { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false; toastTimer = setTimeout(() => $('toast').hidden = true,duration); }
async function api(url, options = {}) {
  const response = await fetch(url,{...options,headers:{'X-Studio-Token':info?.token,...options.headers}});
  const data = await response.json(); if (!response.ok) throw new Error(data.error || '操作失败'); return data;
}
function state(text) { $('save-state').textContent = text; }
function updateDetails() {
  $('title').style.height = 'auto'; $('title').style.height = $('title').scrollHeight + 'px';
  $('crumb').textContent = $('title').value || '未命名文章';
  $('date-label').textContent = $('published').value;
  $('draft-badge').textContent = $('draft').checked ? '草稿' : '公开文章';
  const text = editor?.getValue() || '';
  $('word-count').textContent = text.replace(/\s/g,'').length.toLocaleString() + ' 字';
}
function changed(body = false) {
  if (loading || !current) return;
  if (body) { const value = editor.getValue(); if (value === lastEditorValue) return; lastEditorValue = value; }
  dirty = true; bodyDirty ||= body; state('未保存'); updateDetails();
  try { localStorage.setItem('paper-trails-recovery',JSON.stringify({slug:current.slug,version:current.version,metadata:metadata(),body:bodyDirty ? editor.getValue() : current.body,time:Date.now()})); } catch {}
}
function metadata() {
  return {...current.metadata,title:$('title').value.trim(),published:$('published').value,description:$('description').value,category:$('category').value,tags:$('tags').value.split(/[,，]/).map(x=>x.trim()).filter(Boolean),image:$('cover').value,draft:$('draft').checked};
}
function restoreRange(range = savedRange) {
  editor.focus();
  if (range && document.contains(range.startContainer)) { const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); }
}
document.addEventListener('selectionchange', () => { const s = window.getSelection(); if (s.rangeCount && document.querySelector('.vditor-wysiwyg')?.contains(s.anchorNode)) savedRange = s.getRangeAt(0).cloneRange(); });
function showFormula(node) {
  if (busy) return;
  formulaRange = savedRange?.cloneRange();
  formulaEdit = null;
  if (node) {
    const root = document.querySelector('.vditor-wysiwyg [contenteditable="true"]');
    const nodes = [...root.querySelectorAll('.vditor-wysiwyg__block[data-type="math-inline"],.vditor-wysiwyg__block[data-type="math-block"]')];
    formulaEdit = { html:root.innerHTML, index:nodes.indexOf(node) };
    const code = node.querySelector('.vditor-wysiwyg__pre code') || node.querySelector('code');
    $('math-input').value = (code?.textContent || '').replace(/\u200b/g,'');
    $('block-math').checked = node.dataset.type === 'math-block';
  } else { $('math-input').value = ''; $('block-math').checked = true; }
  $('latex-source').value = $('math-input').value;
  $('insert-formula').textContent = node ? '更新公式' : '插入公式';
  $('formula-dialog').showModal();
  window.mathVirtualKeyboard.container = $('math-keyboard');
  $('math-input').focus();
}
$('math-input').addEventListener('input', () => $('latex-source').value = $('math-input').value);
$('formula-dialog').addEventListener('close', () => window.mathVirtualKeyboard?.hide());
$('latex-source').addEventListener('input', () => $('math-input').value = $('latex-source').value);
document.querySelectorAll('[data-latex]').forEach(button => button.onclick = () => { $('math-input').executeCommand(['insert',button.dataset.latex]); $('math-input').focus(); $('latex-source').value = $('math-input').value; });
$('insert-formula').onclick = () => {
  const latex = $('math-input').value.trim(); if (!latex) return toast('请先写入公式');
  if (!window.katex) return toast('公式渲染器正在加载，请稍后重试');
  try { window.katex.renderToString(latex,{throwOnError:true,displayMode:$('block-math').checked}); } catch (e) { return toast('公式还未完整：' + e.message); }
  const markdown = $('block-math').checked ? '\n\n$$\n' + latex + '\n$$\n\n' : '$' + latex + '$';
  $('formula-dialog').close();
  if (formulaEdit) {
    // Replace exactly one math node in a snapshot: modal focus must not move or
    // merge Vditor's live code/preview nodes through a browser selection.
    const snapshot = document.createElement('template'); snapshot.innerHTML = formulaEdit.html;
    const nodes = snapshot.content.querySelectorAll('.vditor-wysiwyg__block[data-type="math-inline"],.vditor-wysiwyg__block[data-type="math-block"]');
    const replacement = document.createElement('template'); replacement.innerHTML = editor.vditor.lute.Md2VditorDOM(markdown);
    if (!$('block-math').checked) nodes[formulaEdit.index].replaceWith(replacement.content.querySelector('[data-type="math-inline"]'));
    else nodes[formulaEdit.index].replaceWith(replacement.content);
    editor.setValue(editor.vditor.lute.VditorDOM2Md(snapshot.innerHTML));
  } else { restoreRange(formulaRange); editor.insertMD(markdown); }
  changed(true);
};
async function upload(files) {
  try {
    for (const file of files) {
      const result = await api('/api/images',{method:'POST',headers:{'Content-Type':file.type},body:file});
      restoreRange(); editor.insertMD(`![${file.name.replace(/[\[\]\\\n]/g,'')}](${result.url})`); changed(true);
    }
    return null;
  } catch (e) { toast(e.message); return e.message; }
}
$('image-file').onchange = async () => { await upload(Array.from($('image-file').files)); $('image-file').value = ''; };
async function reloadList() { allPosts = await api('/api/posts'); renderList(); }
function renderList() {
  const query = $('search').value.toLowerCase(); $('posts').replaceChildren(); $('count').textContent = allPosts.length;
  for (const post of allPosts.filter(p => (p.title + p.slug).toLowerCase().includes(query))) {
    const button = document.createElement('button'); button.classList.toggle('active',post.slug === current?.slug); button.dataset.slug = post.slug;
    const title = document.createElement('strong'); title.textContent = post.title;
    const sub = document.createElement('small'); sub.textContent = `${post.published}  ·  ${post.draft ? '草稿' : (post.category || '文章')}`;
    button.append(title,sub); button.onclick = () => openPost(post.slug); button.disabled = busy; $('posts').append(button);
  }
}
function canLeave() { return !dirty || window.confirm('当前文章还未保存。切换后将丢弃这些修改，确定继续吗？'); }
function populate(post) {
  loading = true; current = post;
  const m = post.metadata;
  $('title').value = m.title || ''; $('slug').value = post.slug; $('slug').disabled = !!post.version;
  $('published').value = String(m.published || today()).slice(0,10);
  $('category').value = m.category || ''; $('tags').value = (m.tags || []).join(', '); $('description').value = m.description || ''; $('cover').value = m.image || ''; $('draft').checked = m.draft !== false;
  editor.setValue(post.body,true); lastEditorValue = editor.getValue(); savedRange = undefined; dirty = false; bodyDirty = false; updateDetails(); renderList();
  // Vditor's renderer invokes input asynchronously when a new document is loaded.
  setTimeout(() => { loading = false; state(post.version ? '已保存到本地' : '新草稿 · 未保存'); },100);
}
async function openPost(slug) { if (busy || !canLeave()) return; try { populate(await api('/api/posts/' + encodeURIComponent(slug))); } catch(e) { toast(e.message); } }
$('new').onclick = () => { if (busy || !canLeave()) return; populate({slug:'paper-note-' + today() + '-' + Date.now().toString(36).slice(-4),version:null,metadata:{title:'',published:today(),draft:true,tags:[]},body:''}); $('metadata').hidden = false; $('metadata-toggle').setAttribute('aria-expanded','true'); $('title').focus(); };
$('search').oninput = renderList;
$('metadata-toggle').onclick = () => { $('metadata').hidden = !$('metadata').hidden; $('metadata-toggle').setAttribute('aria-expanded',String(!$('metadata').hidden)); };
fields.forEach(id => $(id).addEventListener('input',() => changed()));
async function save() {
  const slug = $('slug').value.trim();
  if (!/^[a-z0-9][a-z0-9-]{0,149}$/.test(slug)) throw new Error('请在文章设置里填写英文文件名，只使用小写字母、数字和短横线');
  state('正在保存…');
  const data = await api('/api/posts/' + encodeURIComponent(slug),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:current.version,metadata:metadata(),body:bodyDirty ? editor.getValue() : current.body})});
  current = data; dirty = false; bodyDirty = false; $('slug').disabled = true; localStorage.removeItem('paper-trails-recovery'); state('已保存到本地'); await reloadList(); return data;
}
$('save').onclick = async () => { if (busy) return; $('save').disabled = true; try { await save(); toast('已保存到 D 盘',2500); } catch(e) { toast(e.message); state('保存未完成'); } finally { $('save').disabled = false; } };
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); $('save').click(); } });
$('publish').onclick = () => { if (busy) return; $('publish-summary').textContent = $('draft').checked ? '当前文章勾选了“草稿”，发布后不会出现在博客首页。要公开这篇文章，请先在“文章设置”中取消勾选。' : '当前文章将作为公开文章发布。其他已保存的本地文章改动也会一起上传。'; $('publish-dialog').showModal(); };
$('cancel-publish').onclick = () => $('publish-dialog').close();
$('confirm-publish').onclick = async () => {
  $('publish-dialog').close(); if (busy) return;
  try {
    await save(); busy = true; fields.forEach(id => $(id).disabled = true); editor.disabled(); $('new').disabled = $('publish').disabled = $('save').disabled = true; renderList(); state('校验并发布中…');
    toast('正在校验文章并上传，可能需要 1–3 分钟。请保持此页面打开。',180000);
    const result = await api('/api/publish',{method:'POST'}); state('已上传 · 等待部署'); toast(result.message,15000);
  } catch(e) { toast(e.message,20000); state('发布未完成'); }
  finally { busy = false; fields.forEach(id => $(id).disabled = false); $('slug').disabled = !!current.version; editor.enable(); $('new').disabled = $('publish').disabled = $('save').disabled = false; renderList(); }
};
window.addEventListener('beforeunload', e => { if (dirty || busy) { e.preventDefault(); e.returnValue = ''; } });
async function init() {
  info = await api('/api/info');
  MathfieldElement.fontsDirectory = '/vendor/mathlive/fonts'; MathfieldElement.soundsDirectory = null;
  $('math-input').mathVirtualKeyboardPolicy = 'manual';
  await new Promise(resolve => {
    editor = new Vditor('editor',{
      cdn:'/vendor/vditor',lang:'zh_CN',mode:'wysiwyg',height:'auto',minHeight:450,placeholder:'写下你的理解，从这篇论文解决了什么问题开始…',cache:{enable:false},
      toolbarConfig:{pin:false},counter:{enable:false},outline:{enable:false},
      preview:{math:{engine:'KaTeX',inlineDigit:true},hljs:{enable:false},markdown:{autoSpace:false,fixTermTypo:false}},
      toolbar:['headings','bold','italic','strike','|','list','ordered-list','check','quote','|','link','table','code','inline-code',{name:'image-local',tip:'插入图片',icon:'<svg viewBox="0 0 24 24"><path d="M3 3h18v18H3V3zm2 2v12l5-6 4 5 3-3 2 3V5H5zm10 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/></svg>',click:()=> $('image-file').click()},{name:'formula',tip:'插入公式',icon:'<span style="font-size:18px;font-family:Georgia;white-space:nowrap">∑</span>',click:()=>showFormula()},'|','undo','redo'],
      upload:{handler:upload,accept:'image/*',multiple:true},input:()=>changed(true),after:resolve
    });
  });
  // Load the local KaTeX runtime also for a completely empty first article.
  const katex = document.createElement('script'); katex.src='/vendor/vditor/dist/js/katex/katex.min.js'; document.head.append(katex);
  $('editor').addEventListener('dblclick', e => { const node = e.target.closest('.vditor-wysiwyg__block[data-type="math-inline"],.vditor-wysiwyg__block[data-type="math-block"]'); if (node) { e.preventDefault(); e.stopImmediatePropagation(); showFormula(node); } },true);
  await reloadList();
  populate(await api('/api/posts/' + (allPosts.some(p=>p.slug==='maskgit') ? 'maskgit' : allPosts[0].slug)));
  try {
    const recovery = JSON.parse(localStorage.getItem('paper-trails-recovery') || 'null');
    if (recovery && confirm('检测到上次未保存的文章内容，要恢复到编辑器吗？')) {
      let disk; try { disk = await api('/api/posts/' + recovery.slug); } catch {}
      if (disk && disk.version !== recovery.version) toast('文件已发生变化。为避免覆盖，未自动恢复旧内容。',12000);
      else { populate({...recovery}); setTimeout(()=>{ bodyDirty = true; changed(); },150); }
    }
  } catch {}
}
init().catch(e => { state('打开失败'); toast(e.message,60000); });
