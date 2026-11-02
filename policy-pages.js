'use strict';
const fs=require('node:fs'),path=require('node:path');
const routes=new Map([['/privacy','privacy38.html'],['/legal','legal38.html']]);
function serve(req,res,pathname){
 if(!routes.has(pathname)||!['GET','HEAD'].includes(req.method))return false;
 const bytes=fs.readFileSync(path.join(__dirname,'public',routes.get(pathname)));
 res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Length':bytes.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"});
 res.end(req.method==='HEAD'?undefined:bytes);return true;
}
module.exports={serve};
