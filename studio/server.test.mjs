import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createStudio } from './server.mjs';

test('local article lifecycle preserves math and rejects stale or foreign writes',async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'paper-trails-studio-test-'));
  const server = createStudio({root,port:0});
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const get = async route => (await fetch(url+route)).json();
  const info = await get('/api/info');
  const headers = {'Origin':url,'X-Studio-Token':info.token,'Content-Type':'application/json'};
  const write = (slug,value,h=headers) => fetch(url+'/api/posts/'+slug,{method:'PUT',headers:h,body:JSON.stringify(value)});
  try {
    await fs.mkdir(path.join(root,'src/content/posts'),{recursive:true});
    const formula = '推导 $x_i^2$。\n\n$$\n\\mathcal{L}=\\frac{1}{N}\\sum_{i=1}^{N} (x_i-y_i)^2\n$$\n';
    const data = {version:null,metadata:{title:'公式测试',published:'2026-10-19',tags:['推导'],draft:true,custom:'保留额外字段'},body:formula};
    assert.equal((await write('math-test',data,{})).status,403);
    assert.equal((await write('math-test',data,{...headers,Origin:'https://foreign.example'})).status,403);
    let response = await write('math-test',data); assert.equal(response.status,200); const created = await response.json();
    assert.equal(created.body,formula); assert.equal(created.metadata.custom,'保留额外字段');
    assert.equal((await write('math-test',data)).status,409);
    response = await write('math-test',{...data,version:created.version,metadata:{...data.metadata,title:'已更新'}});
    assert.equal(response.status,200); assert.equal((await get('/api/posts/math-test')).body,formula);
    assert.equal((await get('/api/posts')).length,1);
    assert.equal((await write('UPPER',data)).status,400);
    const upload = await fetch(url+'/api/images',{method:'POST',headers:{...headers,'Content-Type':'image/png'},body:Buffer.from([137,80,78,71])});
    assert.equal(upload.status,200); const image = await upload.json(); assert.match(image.url,/^\/images\/uploads\//);
    assert.equal((await fetch(url+image.url)).status,200);
    assert.equal((await fetch(url+'/api/publish',{method:'POST'})).status,403);
    assert.equal((await fetch(url+'/vendor/vditor/../../../../server.mjs')).status,404);
  } finally { await new Promise(resolve=>server.close(resolve)); await fs.rm(root,{recursive:true,force:true}); }
});
