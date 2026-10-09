import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const root=resolve(fileURLToPath(new URL("../",import.meta.url)));
const build=spawnSync(process.execPath,[resolve(root,"node_modules/typescript/bin/tsc"),"--noEmit","false","--rewriteRelativeImportExtensions","--outDir",".engine-build"],{cwd:root,stdio:"inherit"});
if(build.status!==0)process.exit(build.status??1);
const routes=[["/build/",".engine-build/"],["/wasm/","public/wasm/"],["/models/","public/models/"],["/vendor/","node_modules/@mediapipe/tasks-vision/"],["/fixtures/",".local/fixtures/"]];
const types={".html":"text/html; charset=utf-8",".js":"text/javascript",".mjs":"text/javascript",".wasm":"application/wasm",".task":"application/octet-stream",".webm":"video/webm",".mp4":"video/mp4",".json":"application/json"};
createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,"http://localhost");const path=decodeURIComponent(url.pathname);
    let full=path==="/"?resolve(root,"dev/engine.html"):undefined;
    for(const[prefix,dir]of routes)if(path.startsWith(prefix)){
      const base=resolve(root,dir);full=resolve(base,path.slice(prefix.length));
      if(!full.startsWith(base+sep)){res.writeHead(403).end();return;}
    }
    if(!full){res.writeHead(404).end();return;}
    const bytes=await readFile(full);res.writeHead(200,{"Content-Type":types[extname(full)]??"application/octet-stream","Cache-Control":"no-store"});res.end(bytes);
  }catch{res.writeHead(404).end();}
}).listen(Number(process.env.PORT??4173),"127.0.0.1",()=>console.log("Engine check: http://127.0.0.1:"+(process.env.PORT??4173)));
