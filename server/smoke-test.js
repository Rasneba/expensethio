const { spawn } = require('child_process');
const http = require('http');

const server = spawn('node', ['dist/index.js'], { cwd: __dirname, stdio: 'ignore' });

const get = (path) =>
  new Promise((resolve, reject) => {
    const req = http.get({ host: 'localhost', port: 3001, path }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error('timeout')));
  });

const post = (path, data) =>
  new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const req = http.request(
      { host: 'localhost', port: 3001, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
      (res) => {
        let resp = '';
        res.on('data', (c) => (resp += c));
        res.on('end', () => resolve({ status: res.statusCode, body: resp }));
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });

const put = (path, data) =>
  new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const req = http.request(
      { host: 'localhost', port: 3001, path, method: 'PUT', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
      (res) => {
        let resp = '';
        res.on('data', (c) => (resp += c));
        res.on('end', () => resolve({ status: res.statusCode, body: resp }));
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });

const del = (path) =>
  new Promise((resolve, reject) => {
    const req = http.request({ host: 'localhost', port: 3001, path, method: 'DELETE' }, (res) => {
      let resp = '';
      res.on('data', (c) => (resp += c));
      res.on('end', () => resolve({ status: res.statusCode, body: resp }));
    });
    req.on('error', reject);
    req.end();
  });

(async () => {
  try {
    await new Promise((r) => setTimeout(r, 2500));

    const d0 = await get('/api/dashboard');
    console.log('GET /api/dashboard', d0.status, d0.body.slice(0, 200));

    const created = await post('/api/expenses', {
      type: 'income',
      amount: 1500.5,
      category: 'Salary',
      description: 'smoke test income',
      date: new Date().toISOString().slice(0, 10),
    });
    console.log('POST income', created.status, created.body.slice(0, 200));
    const id = JSON.parse(created.body).id;

    const created2 = await post('/api/expenses', {
      type: 'expense',
      amount: 99.99,
      category: 'Food & Dining',
      description: 'smoke test expense',
      date: new Date().toISOString().slice(0, 10),
    });
    console.log('POST expense', created2.status, created2.body.slice(0, 200));
    const id2 = JSON.parse(created2.body).id;

    const upd = await put('/api/expenses/' + id, { amount: 1600 });
    console.log('PUT', upd.status, upd.body.slice(0, 120));

    const list = await get('/api/expenses');
    console.log('GET /api/expenses', list.status, 'count', JSON.parse(list.body).length);

    const d1 = await get('/api/dashboard');
    const parsed = JSON.parse(d1.body);
    console.log('dashboard income', parsed.incomeTotal, 'expense', parsed.expenseTotal, 'balance', parsed.balance, 'months', parsed.byMonth.length, 'cats', parsed.byCategory.length);

    const inv = await post('/api/expenses', { amount: -5, category: 'X', date: 'bad-date' });
    console.log('POST invalid (expect 400)', inv.status, inv.body.slice(0, 120));

    await del('/api/expenses/' + id);
    await del('/api/expenses/' + id2);
    const d2 = await get('/api/dashboard');
    const final = JSON.parse(d2.body);
    console.log('after cleanup income', final.incomeTotal, 'expense', final.expenseTotal);

    console.log('SMOKE TEST OK');
  } catch (e) {
    console.error('SMOKE TEST FAILED', e.message);
    process.exitCode = 1;
  } finally {
    server.kill();
  }
})();
