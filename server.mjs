import http from 'node:http';
import {readFileSync,existsSync,mkdirSync,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {localAssistant,validateHistory,answerWithAI} from './asistente.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)), pub=path.join(root,'public');
const products=JSON.parse(readFileSync(path.join(pub,'catalogo.json'),'utf8'));
const data=process.env.DATA_DIR||path.join(root,'data'); mkdirSync(data,{recursive:true});
const db=new DatabaseSync(path.join(data,'tienda.sqlite'));
db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS inventory(id TEXT PRIMARY KEY, stock INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY, token TEXT NOT NULL, created TEXT NOT NULL, payload TEXT NOT NULL);');
for(const p of products)db.prepare('INSERT OR IGNORE INTO inventory VALUES (?,?)').run(p.id,p.stock);
const catalog=()=>products.map(p=>({...p,stock:db.prepare('SELECT stock FROM inventory WHERE id=?').get(p.id).stock}));
const send=(res,status,obj)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(obj));};
async function body(req){let s='';for await(const chunk of req){s+=chunk;if(s.length>16000)throw new Error('Solicitud demasiado grande.');}try{return JSON.parse(s);}catch{throw new Error('Solicitud inválida.');}}
const rates=new Map();
const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');
 res.setHeader('X-Frame-Options','DENY');
 try{
 const url=new URL(req.url,'http://localhost');
 if(req.method==='GET'&&url.pathname==='/api/catalogo')return send(res,200,{products:catalog(),aiConfigured:!!process.env.OPENAI_API_KEY});
 if(req.method==='POST'&&url.pathname.startsWith('/api/')){
  const origin=req.headers.origin;if(origin&&origin!==`http://${req.headers.host}`&&origin!==`https://${req.headers.host}`)return send(res,403,{error:'Origen no permitido.'});
  const b=await body(req);
  if(!b||typeof b!=='object'||Array.isArray(b))return send(res,400,{error:'Se esperaba un objeto JSON.'});
  if(url.pathname==='/api/asistente'){
   if(typeof b.message!=='string'||!b.message.trim()||b.message.length>2000)return send(res,400,{error:'Escribí una consulta de hasta 2.000 caracteres.'});
   let history;try{history=validateHistory(b.history);}catch(error){return send(res,400,{error:error.message});}
   const currentCatalog=catalog();
   const cartItems=Array.isArray(b.cart)?b.cart.slice(0,6).filter(i=>i&&Number.isInteger(i.qty)&&i.qty>0&&i.qty<=10000).map(i=>{const p=currentCatalog.find(p=>p.id===i.id);return p?{id:p.id,name:p.name,qty:i.qty,price:p.price,unit:p.unit}:null;}).filter(Boolean):[];
   const city=['Asunción','San Lorenzo','Luque','Capiatá','Lambaré','Otra ciudad'].includes(b.city)?b.city:'Asunción';
   const ip=req.socket.remoteAddress,now=Date.now();for(const [key,value] of rates)if(now-value.time>60000)rates.delete(key);const rate=rates.get(ip)||{time:now,count:0};if(++rate.count>15)return send(res,429,{error:'Esperá un minuto antes de otra consulta.'});rates.set(ip,rate);
   if(!process.env.OPENAI_API_KEY)return send(res,200,{reply:localAssistant(b.message,history,currentCatalog),mode:'local'});
   try{return send(res,200,await answerWithAI({message:b.message,history,catalog:currentCatalog,cart:cartItems,city,apiKey:process.env.OPENAI_API_KEY,model:process.env.OPENAI_MODEL||'gpt-4.1'}));}catch{return send(res,200,{reply:'No pude completar la consulta en este momento. '+localAssistant(b.message,history,currentCatalog),mode:'local'});}
  }
  if(url.pathname==='/api/pedidos'){
   if(!Array.isArray(b.items)||b.items.length===0||b.items.length>20)return send(res,400,{error:'Tu carrito está vacío o contiene demasiados productos.'});
   if(!b.customer||!['name','phone','address','city'].every(k=>typeof b.customer[k]==='string'&&b.customer[k].trim().length>=3&&b.customer[k].length<=250))return send(res,400,{error:'Completá nombre, teléfono, dirección y ciudad.'});
   b.customer=Object.fromEntries(['name','phone','address','city'].map(k=>[k,b.customer[k].trim()]));
   if(!['Asunción','San Lorenzo','Luque','Capiatá','Lambaré','Otra ciudad'].includes(b.customer.city))return send(res,400,{error:'Seleccioná una ciudad del formulario.'});
   if(!/^[+\d\s()-]{6,30}$/.test(b.customer.phone))return send(res,400,{error:'Ingresá un teléfono válido.'});
   if(!['transferencia','contraentrega'].includes(b.payment))return send(res,400,{error:'Elegí una forma de pago válida.'});
   const seen=new Set();const items=[];
   for(const i of b.items){const p=products.find(p=>p.id===i.id);if(!p||seen.has(i.id)||!Number.isInteger(i.qty)||i.qty<1||i.qty>10000)return send(res,400,{error:'Hay cantidades o productos inválidos.'});seen.add(i.id);items.push({id:p.id,name:p.name,price:p.price,qty:i.qty,unit:p.unit});}
   const subtotal=items.reduce((sum,i)=>sum+i.price*i.qty,0),shipping=b.customer.city==='Asunción'?35000:60000;
   const order={id:'CM-'+randomUUID().slice(0,8).toUpperCase(),created:new Date().toISOString(),status:'Pendiente de confirmación',paymentStatus:'No cobrado',customer:b.customer,items,subtotal,shipping,total:subtotal+shipping,payment:b.payment};const token=randomBytes(24).toString('hex');
   db.exec('BEGIN IMMEDIATE');try{for(const i of items){const r=db.prepare('UPDATE inventory SET stock=stock-? WHERE id=? AND stock>=?').run(i.qty,i.id,i.qty);if(!r.changes)throw new Error(`Stock insuficiente: ${i.name}.`);}db.prepare('INSERT INTO orders VALUES (?,?,?,?)').run(order.id,token,order.created,JSON.stringify(order));db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');return send(res,409,{error:e.message});}
   return send(res,201,{order,token});
  }
 }
 if(req.method==='GET'&&url.pathname.startsWith('/api/pedidos/')){const id=decodeURIComponent(url.pathname.split('/').pop()),auth=req.headers.authorization||'';const row=db.prepare('SELECT payload FROM orders WHERE id=? AND token=?').get(id,auth.replace(/^Bearer /,''));return row?send(res,200,{order:JSON.parse(row.payload)}):send(res,404,{error:'Pedido no encontrado.'});}
 if(url.pathname.startsWith('/api/'))return send(res,404,{error:'Ruta no encontrada.'});
 if(req.method!=='GET'&&req.method!=='HEAD')return send(res,405,{error:'Método no permitido.'});
 const relative=decodeURIComponent(url.pathname)==='/'?'index.html':decodeURIComponent(url.pathname).slice(1),file=path.resolve(pub,relative);if(!file.startsWith(pub+path.sep)||relative.includes(':')||!existsSync(file)||!statSync(file).isFile())return send(res,404,{error:'Archivo no encontrado.'});
 const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(req.method==='HEAD'?undefined:readFileSync(file));
 }catch(e){send(res,400,{error:'No se pudo procesar la solicitud.'});}
});
server.listen(Number(process.env.PORT)||3080,process.env.HOST||'127.0.0.1',()=>console.log(`AMC CONSTRUCCIONES: http://${process.env.HOST||'127.0.0.1'}:${process.env.PORT||3080}`));
