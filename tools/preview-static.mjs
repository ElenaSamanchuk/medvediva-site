// Loopback-only static preview with direct routes and real 404; does not accept form submissions.
import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';
const root=path.resolve('dist');const mime={'.html':'text/html; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp','.gif':'image/gif','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.ico':'image/x-icon'};
const server=http.createServer(async(req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);let file=path.resolve(root,'.'+pathname);let status=200;
  if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(400);res.end();return;}
  let info=await fs.stat(file).catch(()=>null);if(info?.isDirectory()){file=path.join(file,'index.html');info=await fs.stat(file).catch(()=>null);}
  if(!info?.isFile()){file=path.join(root,'404.html');status=404;}
  const body=await fs.readFile(file);res.writeHead(status,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':body.length,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:body);
 }catch{res.writeHead(400);res.end();}
});
server.listen(4176,'127.0.0.1',()=>console.log('Static preview: http://127.0.0.1:4176/ (local, noindex, GET/HEAD only)'));
