require('dotenv').config();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const Database = require('better-sqlite3');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, 'aurum.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = `
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'customer',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS addresses (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 label TEXT NOT NULL DEFAULT 'Home',
 full_name TEXT NOT NULL,
 phone TEXT NOT NULL,
 line1 TEXT NOT NULL,
 city TEXT NOT NULL,
 state TEXT NOT NULL,
 pincode TEXT NOT NULL,
 is_default INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS orders (
 id TEXT PRIMARY KEY,
 user_id INTEGER NOT NULL REFERENCES users(id),
 subtotal INTEGER NOT NULL,
 shipping INTEGER NOT NULL,
 tax INTEGER NOT NULL,
 total INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending',
 payment_method TEXT NOT NULL,
 payment_status TEXT NOT NULL DEFAULT 'pending',
 payment_utr TEXT,
 payment_submitted_at TEXT,
 payment_verified_at TEXT,
 address_json TEXT NOT NULL,
 items_json TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS inventory (
 product_id INTEGER PRIMARY KEY,
 stock INTEGER NOT NULL DEFAULT 100,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
`;
db.exec(schema);

// Safe migration for databases created by the previous AURUM build.
for (const [name, type] of [['payment_utr','TEXT'],['payment_submitted_at','TEXT'],['payment_verified_at','TEXT'],['cancel_request_status',"TEXT NOT NULL DEFAULT 'none'"],['cancel_reason','TEXT'],['return_request_status',"TEXT NOT NULL DEFAULT 'none'"],['return_reason','TEXT'],['return_type','TEXT'],['return_requested_at','TEXT'],['cancel_requested_at','TEXT'],['admin_note','TEXT'],['refund_status',"TEXT NOT NULL DEFAULT 'not_applicable'"],['delivered_at','TEXT']]) {
  const exists = db.prepare("SELECT 1 FROM pragma_table_info('orders') WHERE name=?").get(name);
  if (!exists) db.exec(`ALTER TABLE orders ADD COLUMN ${name} ${type}`);
}

const products = JSON.parse(fs.readFileSync(path.join(__dirname, 'products.json'), 'utf8'));
const productMap = new Map(products.map(p => [Number(p.id), p]));
const insertInventory = db.prepare('INSERT OR IGNORE INTO inventory(product_id, stock) VALUES (?, ?)');
for (const p of products) insertInventory.run(Number(p.id), 100);

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cookieParser());
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false });
const apiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 180, standardHeaders: 'draft-8', legacyHeaders: false });
app.use('/api', apiLimiter);
app.use(express.json({ limit: '1mb' }));

function signUser(user) {
  return jwt.sign({ sub: String(user.id), role: user.role, email: user.email }, process.env.JWT_SECRET || 'dev-only-change-me', { expiresIn: '7d' });
}
function setAuthCookie(res, token) {
  // Session cookie: customer remains signed in for this browser session only.
  res.cookie('aurum_session', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' });
}
function setAdminCookie(res, token) {
  // Session cookie: admin must sign in again after browser close.
  res.cookie('aurum_admin_session', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' });
}
function publicUser(user) { return { id: user.id, name: user.name, email: user.email, role: user.role, joined: user.created_at }; }
function auth(req, res, next) {
  try {
    const token = req.cookies.aurum_session;
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-only-change-me');
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(Number(payload.sub));
    if (!user) return res.status(401).json({ error: 'Session expired' });
    req.user = user; next();
  } catch { return res.status(401).json({ error: 'Invalid or expired session' }); }
}
function admin(req, res, next) {
  try {
    const token = req.cookies.aurum_admin_session;
    if (!token) return res.status(401).json({ error: 'Admin authentication required' });
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-only-change-me');
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(Number(payload.sub));
    if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    req.user = user; next();
  } catch { return res.status(401).json({ error: 'Invalid or expired admin session' }); }
}
function cleanItems(items) {
  if (!Array.isArray(items) || !items.length || items.length > 50) throw new Error('Invalid cart');
  const normalized = [];
  for (const raw of items) {
    const p = productMap.get(Number(raw.id));
    const qty = Number(raw.qty);
    if (!p || !Number.isInteger(qty) || qty < 1 || qty > 20) throw new Error('Invalid product or quantity');
    const size = raw.size == null ? null : String(raw.size);
    const color = raw.colorKey ? String(raw.colorKey) : null;
    const stock = db.prepare('SELECT stock FROM inventory WHERE product_id=?').get(p.id)?.stock ?? 0;
    if (stock < qty) throw new Error(`${p.name} is out of stock`);
    normalized.push({ id:p.id, name:p.name, brand:p.brand, image:p.image, price:Number(p.price), qty, size, colorKey:color });
  }
  return normalized;
}
function totals(items) {
  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const shipping = subtotal >= 15000 ? 0 : 199;
  const tax = Math.round(subtotal * 0.05);
  return { subtotal, shipping, tax, total: subtotal + shipping + tax };
}
function validAddress(a) {
  if (!a || !a.fullName || !a.phone || !a.line1 || !a.city || !a.state || !/^\d{6}$/.test(String(a.pincode))) return false;
  return String(a.phone).replace(/\D/g,'').length >= 10;
}
function orderView(o) {
  return { id:o.id,date:o.created_at,status:o.status,cancelRequestStatus:o.cancel_request_status||'none',cancelReason:o.cancel_reason||null,cancelRequestedAt:o.cancel_requested_at||null,returnRequestStatus:o.return_request_status||'none',returnReason:o.return_reason||null,returnType:o.return_type||null,returnRequestedAt:o.return_requested_at||null,adminNote:o.admin_note||null,refundStatus:o.refund_status||'not_applicable',paymentMethod:o.payment_method,paymentStatus:o.payment_status,paymentUtr:o.payment_utr||null,total:o.total,subtotal:o.subtotal,shipping:o.shipping,tax:o.tax,address:JSON.parse(o.address_json),items:JSON.parse(o.items_json) };
}
function upiId() { return String(process.env.UPI_ID || '').trim(); }
function upiName() { return String(process.env.UPI_NAME || 'AURUM Store').trim(); }
function buildUpiUri(order) {
  const pa = upiId();
  if (!pa) throw new Error('UPI ID is not configured. Add UPI_ID to .env');
  const params = new URLSearchParams({ pa, pn: upiName(), am: (order.total / 100).toFixed(2), cu:'INR', tn:`AURUM ${order.id}` });
  return `upi://pay?${params.toString()}`;
}

app.get('/api/health', (_req,res)=>res.json({ ok:true, service:'aurum', payment:'manual_upi', time:new Date().toISOString() }));
app.get('/api/store/payment-info',(req,res)=>res.json({ upiId:upiId(), upiName:upiName(), configured:Boolean(upiId()) }));
app.get('/api/store/upi-qr/:orderId',auth,async(req,res)=>{
  try {
    const order=db.prepare('SELECT * FROM orders WHERE id=? AND user_id=?').get(req.params.orderId,req.user.id);
    if(!order || order.payment_method!=='upi') return res.status(404).json({error:'UPI order not found'});
    const dataUrl=await QRCode.toDataURL(buildUpiUri(order),{width:360,margin:2,errorCorrectionLevel:'M'});
    res.json({qr:dataUrl,upiId:upiId(),upiName:upiName(),amount:order.total,upiUri:buildUpiUri(order)});
  } catch(e){res.status(503).json({error:e.message||'Could not create UPI QR'});}
});

app.get('/api/products', (req,res)=>{
  let result = products.slice();
  const q = String(req.query.q || '').trim().toLowerCase();
  const brand = String(req.query.brand || '').trim().toLowerCase();
  const category = String(req.query.category || '').trim().toLowerCase();
  const gender = String(req.query.gender || '').trim().toLowerCase();
  if (q) result = result.filter(p => `${p.name} ${p.brand} ${p.category}`.toLowerCase().includes(q));
  if (brand) result = result.filter(p => String(p.brandId).toLowerCase() === brand);
  if (category) result = result.filter(p => String(p.category).toLowerCase() === category);
  if (gender && gender !== 'all') result = result.filter(p => String(p.gender).toLowerCase() === gender);
  const withStock = result.map(p => ({ ...p, stock: Number(db.prepare('SELECT stock FROM inventory WHERE product_id=?').get(Number(p.id))?.stock ?? 0) }));
  res.json(withStock);
});
app.get('/api/products/:id',(req,res)=>{
  const p=productMap.get(Number(req.params.id));
  if (!p) return res.status(404).json({error:'Product not found'});
  const stock = Number(db.prepare('SELECT stock FROM inventory WHERE product_id=?').get(Number(p.id))?.stock ?? 0);
  res.json({...p, stock});
});

app.post('/api/auth/signup', authLimiter, async (req,res)=>{
  const {name,email,password}=req.body || {};
  if (!name || !/^\S+@\S+\.\S+$/.test(String(email||'')) || String(password||'').length < 8) return res.status(400).json({error:'Use a valid email and password of at least 8 characters'});
  try { const hash=await bcrypt.hash(password,12); const info=db.prepare('INSERT INTO users(name,email,password_hash) VALUES (?,?,?)').run(String(name).trim(),String(email).trim().toLowerCase(),hash); const user=db.prepare('SELECT * FROM users WHERE id=?').get(info.lastInsertRowid); setAuthCookie(res,signUser(user)); res.status(201).json({user:publicUser(user)}); }
  catch(e){ if(String(e.message).includes('UNIQUE')) return res.status(409).json({error:'Email already registered'}); return res.status(500).json({error:'Could not create account'}); }
});
app.post('/api/auth/login', authLimiter, async (req,res)=>{
  const {email,password}=req.body || {}; const user=db.prepare('SELECT * FROM users WHERE email=?').get(String(email||'').trim().toLowerCase());
  if(!user || !(await bcrypt.compare(String(password||''),user.password_hash))) return res.status(401).json({error:'Invalid email or password'});
  setAuthCookie(res,signUser(user)); res.json({user:publicUser(user)});
});
app.post('/api/auth/logout',(req,res)=>{ res.clearCookie('aurum_session',{path:'/'}); res.json({ok:true}); });
app.get('/api/auth/me',auth,(req,res)=>res.json({user:publicUser(req.user)}));

// Admin uses a separate cookie so signing into the admin tab never overwrites the customer's session.
app.post('/api/admin/auth/login', authLimiter, async (req,res)=>{
  const {email,password}=req.body||{};
  const user=db.prepare('SELECT * FROM users WHERE email=?').get(String(email||'').trim().toLowerCase());
  if(!user || user.role!=='admin' || !(await bcrypt.compare(String(password||''),user.password_hash))) return res.status(401).json({error:'Invalid admin email or password'});
  setAdminCookie(res,signUser(user)); res.json({user:publicUser(user)});
});
app.post('/api/admin/auth/logout',(req,res)=>{res.clearCookie('aurum_admin_session',{path:'/'});res.json({ok:true});});
app.get('/api/admin/auth/me',admin,(req,res)=>res.json({user:publicUser(req.user)}));

app.get('/api/addresses',auth,(req,res)=>res.json(db.prepare('SELECT id,label,full_name AS fullName,phone,line1,city,state,pincode,is_default AS isDefault FROM addresses WHERE user_id=? ORDER BY is_default DESC,id DESC').all(req.user.id)));
app.post('/api/addresses',auth,(req,res)=>{
  const a=req.body||{}; if(!validAddress(a)) return res.status(400).json({error:'Complete address and valid 6-digit pincode are required'});
  const tx=db.transaction(()=>{ if(a.isDefault) db.prepare('UPDATE addresses SET is_default=0 WHERE user_id=?').run(req.user.id); const info=db.prepare('INSERT INTO addresses(user_id,label,full_name,phone,line1,city,state,pincode,is_default) VALUES(?,?,?,?,?,?,?,?,?)').run(req.user.id,a.label||'Home',a.fullName,a.phone,a.line1,a.city,a.state,a.pincode,a.isDefault?1:0); return db.prepare('SELECT id,label,full_name AS fullName,phone,line1,city,state,pincode,is_default AS isDefault FROM addresses WHERE id=?').get(info.lastInsertRowid); });
  res.status(201).json(tx());
});
app.delete('/api/addresses/:id',auth,(req,res)=>{db.prepare('DELETE FROM addresses WHERE id=? AND user_id=?').run(Number(req.params.id),req.user.id);res.json({ok:true});});

app.post('/api/orders',auth,(req,res)=>{
  try {
    const {items,address,paymentMethod='cod'}=req.body||{};
    if(!validAddress(address)) return res.status(400).json({error:'A complete delivery address is required'});
    if(!['cod','upi'].includes(paymentMethod)) return res.status(400).json({error:'Choose Cash on Delivery or UPI'});
    if(paymentMethod==='upi' && !upiId()) return res.status(503).json({error:'UPI payment is not configured. Add your UPI_ID to .env'});
    const clean=cleanItems(items); const t=totals(clean); const id='AUR'+Date.now().toString().slice(-9)+crypto.randomInt(100,999);
    const status=paymentMethod==='cod'?'confirmed':'pending_payment';
    const paymentStatus=paymentMethod==='cod'?'cod_pending':'pending';
    const tx=db.transaction(()=>{
      db.prepare(`INSERT INTO orders(id,user_id,subtotal,shipping,tax,total,status,payment_method,payment_status,address_json,items_json) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(id,req.user.id,t.subtotal,t.shipping,t.tax,t.total,status,paymentMethod,paymentStatus,JSON.stringify(address),JSON.stringify(clean));
      const dec=db.prepare('UPDATE inventory SET stock=stock-? WHERE product_id=? AND stock>=?');
      for(const i of clean){const r=dec.run(i.qty,i.id,i.qty);if(!r.changes) throw new Error('Inventory changed, please retry');}
    });
    tx();
    const order=db.prepare('SELECT * FROM orders WHERE id=?').get(id);
    res.status(201).json({order:orderView(order),upi:paymentMethod==='upi'?{upiId:upiId(),upiName:upiName(),qrUrl:`/api/store/upi-qr/${id}`}:null});
  } catch(e){ console.error(e); res.status(400).json({error:e.message||'Could not create order'}); }
});

app.post('/api/payments/upi/submit',auth,(req,res)=>{
  const {orderId,utr}=req.body||{}; const cleanUtr=String(utr||'').trim().replace(/\s+/g,'');
  if(!/^[A-Za-z0-9-]{6,35}$/.test(cleanUtr)) return res.status(400).json({error:'Enter a valid UTR / transaction ID'});
  const order=db.prepare('SELECT * FROM orders WHERE id=? AND user_id=?').get(orderId,req.user.id);
  if(!order || order.payment_method!=='upi') return res.status(404).json({error:'UPI order not found'});
  if(order.payment_status==='paid') return res.status(409).json({error:'This payment is already verified'});
  if(order.payment_status==='verification_pending') return res.status(409).json({error:'Payment is already submitted for verification'});
  const duplicate=db.prepare('SELECT id FROM orders WHERE payment_utr=? AND id<>?').get(cleanUtr,orderId);
  if(duplicate) return res.status(409).json({error:'This UTR has already been submitted'});
  db.prepare(`UPDATE orders SET payment_utr=?,payment_submitted_at=CURRENT_TIMESTAMP,payment_status='verification_pending',status='pending_payment',updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(cleanUtr,orderId);
  res.json({ok:true,orderId,paymentStatus:'verification_pending',message:'UTR submitted. We will verify your payment shortly.'});
});

app.get('/api/orders',auth,(req,res)=>{ const rows=db.prepare('SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC').all(req.user.id); res.json(rows.map(orderView)); });
app.get('/api/orders/:id',auth,(req,res)=>{ const o=db.prepare('SELECT * FROM orders WHERE id=? AND user_id=?').get(req.params.id,req.user.id); if(!o)return res.status(404).json({error:'Order not found'}); res.json(orderView(o)); });
app.post('/api/orders/:id/cancel-request',auth,(req,res)=>{
  try {
    const reason=String(req.body?.reason||'').trim();
    if(reason.length<3) return res.status(400).json({error:'Please provide a cancellation reason (at least 3 characters)'});
    const o=db.prepare('SELECT * FROM orders WHERE id=? AND user_id=?').get(String(req.params.id),req.user.id);
    if(!o) return res.status(404).json({error:'Order not found for this account'});
    const status=String(o.status||'').toLowerCase();
    if(!['pending','confirmed','packed','pending_payment'].includes(status)) return res.status(400).json({error:'Cancellation is available only before shipping'});
    if(o.cancel_request_status==='requested') return res.status(409).json({error:'Cancellation request is already pending'});
    db.prepare("UPDATE orders SET cancel_request_status='requested',cancel_reason=?,cancel_requested_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?").run(reason,o.id,req.user.id);
    const updated=db.prepare('SELECT * FROM orders WHERE id=? AND user_id=?').get(o.id,req.user.id);
    return res.json({ok:true,order:orderView(updated),cancelRequestStatus:'requested'});
  } catch (err) {
    console.error('Cancellation request failed:',err);
    return res.status(500).json({error:'Could not save cancellation request. Check the server console for details.'});
  }
});
app.post('/api/orders/:id/return-request',auth,(req,res)=>{
  try {
    const reason=String(req.body?.reason||'').trim();
    const type=String(req.body?.type||'return').trim().toLowerCase();
    if(reason.length<3) return res.status(400).json({error:'Please provide a reason (at least 3 characters)'});
    if(!['return','replacement'].includes(type)) return res.status(400).json({error:'Choose return or replacement'});
    const o=db.prepare('SELECT * FROM orders WHERE id=? AND user_id=?').get(String(req.params.id),req.user.id);
    if(!o) return res.status(404).json({error:'Order not found for this account'});
    if(String(o.status||'').toLowerCase()!=='delivered') return res.status(400).json({error:'Return/replacement is available only after delivery'});
    if(o.return_request_status && !['none','rejected'].includes(o.return_request_status)) return res.status(409).json({error:'A return/replacement request already exists'});
    // Use the recorded delivery timestamp; for legacy orders without it, use updated_at.
    const rawDate=o.delivered_at||o.updated_at||o.created_at;
    const dateText=String(rawDate||'').includes('T') ? String(rawDate) : String(rawDate||'').replace(' ','T')+'Z';
    const deliveredAt=new Date(dateText);
    if(!Number.isFinite(deliveredAt.getTime())) return res.status(400).json({error:'Could not verify the delivery date. Please contact support.'});
    const age=Date.now()-deliveredAt.getTime();
    if(age<0 || age>7*24*60*60*1000) return res.status(400).json({error:'The 7-day return window has expired'});
    db.prepare("UPDATE orders SET return_request_status='requested',return_reason=?,return_type=?,return_requested_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?").run(reason,type,o.id,req.user.id);
    const updated=db.prepare('SELECT * FROM orders WHERE id=? AND user_id=?').get(o.id,req.user.id);
    return res.json({ok:true,order:orderView(updated),returnRequestStatus:'requested'});
  } catch (err) {
    console.error('Return/replacement request failed:',err);
    return res.status(500).json({error:'Could not save return/replacement request. Check the server console for details.'});
  }
});
app.get('/api/admin/stats',admin,(req,res)=>{ const sales=db.prepare("SELECT COALESCE(SUM(total),0) total, COUNT(*) orders FROM orders WHERE payment_status='paid' OR payment_method='cod'").get(); const users=db.prepare("SELECT COUNT(*) count FROM users WHERE role='customer'").get().count; const low=db.prepare('SELECT COUNT(*) count FROM inventory WHERE stock<=10').get().count; const pending=db.prepare("SELECT COUNT(*) count FROM orders WHERE payment_status='verification_pending'").get().count; res.json({sales:Number(sales.total),orders:Number(sales.orders),users:Number(users),lowStock:Number(low),pendingPayments:Number(pending)}); });
app.get('/api/admin/orders',admin,(req,res)=>res.json(db.prepare(`SELECT o.id,o.created_at,o.updated_at,o.status,o.payment_status,o.payment_method,o.payment_utr,o.payment_submitted_at,o.total,o.address_json,o.cancel_request_status,o.cancel_reason,o.cancel_requested_at,o.return_request_status,o.return_reason,o.return_type,o.return_requested_at,o.admin_note,o.refund_status,u.name,u.email FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.created_at DESC LIMIT 200`).all().map(o=>({...o,address:JSON.parse(o.address_json)}))));
app.patch('/api/admin/orders/:id',admin,(req,res)=>{
 const action=String(req.body.action||''); const note=String(req.body.note||'').trim(); const o=db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id); if(!o)return res.status(404).json({error:'Order not found'});
 if(action==='cancel_approve'){
  if(o.cancel_request_status!=='requested')return res.status(400).json({error:'No pending cancellation request'});
  const tx=db.transaction(()=>{db.prepare("UPDATE orders SET status='cancelled',cancel_request_status='approved',admin_note=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(note,o.id); const items=JSON.parse(o.items_json); const inc=db.prepare('UPDATE inventory SET stock=stock+? WHERE product_id=?'); for(const it of items)inc.run(Number(it.qty)||0,Number(it.id));}); tx(); return res.json({ok:true});
 }
 if(action==='cancel_reject') { if(o.cancel_request_status!=='requested')return res.status(400).json({error:'No pending cancellation request'}); db.prepare("UPDATE orders SET cancel_request_status='rejected',admin_note=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(note,o.id); return res.json({ok:true}); }
 if(['return_approve','replacement_approve','return_reject'].includes(action)) { if(o.return_request_status!=='requested')return res.status(400).json({error:'No pending return/replacement request'}); const status=action==='return_reject'?'rejected':'approved'; db.prepare("UPDATE orders SET return_request_status=?,return_type=CASE WHEN ?='replacement_approve' THEN 'replacement' ELSE return_type END,refund_status=CASE WHEN ?='return_approve' THEN 'pending' ELSE refund_status END,admin_note=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(status,action,action,note,o.id); return res.json({ok:true}); }
 if(action==='refund_processed') { db.prepare("UPDATE orders SET refund_status='processed',admin_note=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(note,o.id); return res.json({ok:true}); }
 const allowed=['pending_payment','pending','confirmed','packed','shipped','out_for_delivery','delivered','cancelled','payment_failed']; const status=String(req.body.status||''); if(!allowed.includes(status))return res.status(400).json({error:'Invalid status'}); if(['confirmed','packed','shipped','out_for_delivery','delivered'].includes(status)&&o.payment_method==='upi'&&o.payment_status!=='paid')return res.status(400).json({error:'Verify UPI payment before advancing this order'}); db.prepare("UPDATE orders SET status=?,delivered_at=CASE WHEN ?='delivered' THEN COALESCE(delivered_at,CURRENT_TIMESTAMP) ELSE delivered_at END,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(status,status,o.id); res.json({ok:true});
});
app.patch('/api/admin/payments/:id',admin,(req,res)=>{
  const action=String(req.body.action||''); const order=db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
  if(!order || order.payment_method!=='upi') return res.status(404).json({error:'UPI order not found'});
  if(!order.payment_utr) return res.status(400).json({error:'Customer has not submitted a UTR yet'});
  if(action==='verify') { db.prepare(`UPDATE orders SET payment_status='paid',status='confirmed',payment_verified_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(order.id); return res.json({ok:true,paymentStatus:'paid'}); }
  if(action==='reject') { db.prepare(`UPDATE orders SET payment_status='failed',status='payment_failed',updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(order.id); return res.json({ok:true,paymentStatus:'failed'}); }
  return res.status(400).json({error:'Action must be verify or reject'});
});
app.get('/api/admin/inventory',admin,(req,res)=>res.json(products.map(p=>({...p,stock:db.prepare('SELECT stock FROM inventory WHERE product_id=?').get(p.id).stock}))));
app.patch('/api/admin/inventory/:productId',admin,(req,res)=>{const stock=Math.max(0,Math.floor(Number(req.body.stock)));if(!Number.isFinite(stock))return res.status(400).json({error:'Invalid stock'});db.prepare('UPDATE inventory SET stock=?,updated_at=CURRENT_TIMESTAMP WHERE product_id=?').run(stock,Number(req.params.productId));res.json({ok:true});});

app.use(express.static(ROOT, { extensions: ['html'] }));
app.use((req,res,next)=>{ if(req.method==='GET' && !req.path.startsWith('/api/')) return res.sendFile(path.join(ROOT,'index.html')); next(); });
app.use((err,_req,res,_next)=>{console.error(err);res.status(500).json({error:'Internal server error'});});

(async()=>{
  const email=process.env.ADMIN_EMAIL, password=process.env.ADMIN_PASSWORD;
  if(email && password){ const existing=db.prepare('SELECT * FROM users WHERE email=?').get(email.toLowerCase()); if(!existing){const hash=await bcrypt.hash(password,12);db.prepare('INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,\'admin\')').run('AURUM Admin',email.toLowerCase(),hash);} }
  app.listen(PORT,()=>console.log(`AURUM running at http://localhost:${PORT}`));
})();
