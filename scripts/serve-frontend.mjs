import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { fileURLToPath } from "node:url";
const root=fileURLToPath(new URL("../frontend/out/",import.meta.url));
const prefix=process.env.BASE_PATH??"",port=Number(process.env.PORT??3000);
const mime={".html":"text/html; charset=utf-8",".txt":"text/plain; charset=utf-8",".js":"text/javascript",".css":"text/css",".json":"application/json",".wasm":"application/wasm",".svg":"image/svg+xml",".png":"image/png",".woff2":"font/woff2"};
if(!Number.isInteger(port)||port<1||port>65535||prefix&&!/^\/[A-Za-z0-9/_-]+$/.test(prefix))throw new Error("유효한 PORT와 BASE_PATH가 필요합니다.");
createServer(async(req,res)=>{
  try{
    if(req.method!=="GET"&&req.method!=="HEAD"){res.writeHead(405);res.end();return;}
    let pathname=decodeURIComponent(new URL(req.url,"http://localhost").pathname);
    if(prefix && !pathname.startsWith(prefix+"/") && pathname!==prefix){res.writeHead(404);res.end();return;}
    if(prefix)pathname=pathname.slice(prefix.length);
    let target=resolve(root,"."+(pathname||"/"));
    if(target!==resolve(root)&&!target.startsWith(resolve(root)+sep)){res.writeHead(403);res.end();return;}
    if((await stat(target)).isDirectory())target=resolve(target,"index.html");
    const bytes=await readFile(target);res.writeHead(200,{"Content-Type":mime[extname(target)]??"application/octet-stream","Content-Length":bytes.length});res.end(req.method==="HEAD"?undefined:bytes);
  }catch(error){res.writeHead(error.code==="ENOENT"?404:400);res.end("Not found");}
}).listen(port,"127.0.0.1",()=>console.log(`Static frontend: http://127.0.0.1:${port}${prefix}/`));
