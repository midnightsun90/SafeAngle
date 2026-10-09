import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { proposeJoints } from "../lib/vlm/openai.ts";
import { parseVlmRequest, VlmError } from "../lib/vlm/validation.ts";
import type { VlmErrorCode, VlmResponse } from "../lib/vlm/contract.ts";

const HTTP:Record<VlmErrorCode,number>={invalid_request:400,unauthorized:401,consent_required:403,image_too_large:413,not_configured:503,rate_limited:429,timeout:504,refused:502,incomplete:502,invalid_output:502,upstream_error:502};
export function jpegSize(dataUrl:string):{width:number;height:number}{
  const base64=dataUrl.slice(dataUrl.indexOf(",")+1),data=Buffer.from(base64,"base64");
  if(data.length>1024*1024)throw new VlmError("image_too_large","대표 장면은 1MB 이내여야 합니다.");
  if(data.toString("base64")!==base64||data[0]!==0xff||data[1]!==0xd8)throw new VlmError("invalid_request","JPEG 파일이 올바르지 않습니다.");
  let i=2;
  while(i<data.length){
    if(data[i++]!==0xff)break;while(data[i]===0xff)i++;
    const marker=data[i++];if(marker===undefined||marker===0xda||marker===0xd9)break;
    if(marker===0x01||marker>=0xd0&&marker<=0xd7)continue;
    if(i+2>data.length)break;const len=data.readUInt16BE(i);if(len<2||i+len>data.length)break;
    if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){
      if(len<8)break;return {height:data.readUInt16BE(i+3),width:data.readUInt16BE(i+5)};
    }i+=len;
  }
  throw new VlmError("invalid_request","JPEG 크기를 확인할 수 없습니다.");
}
function readBody(req:IncomingMessage):Promise<string>{
  return new Promise((resolve,reject)=>{
    const chunks:Buffer[]=[];let bytes=0,done=false;
    req.on("data",chunk=>{if(done)return;bytes+=chunk.length;if(bytes>2*1024*1024){done=true;reject(new VlmError("image_too_large","요청 크기 제한을 초과했습니다."));return;}chunks.push(chunk);});
    req.on("end",()=>{if(!done){done=true;resolve(Buffer.concat(chunks).toString("utf8"));}});
    req.on("error",()=>{if(!done){done=true;reject(new VlmError("invalid_request","요청을 읽을 수 없습니다."));}});
  });
}
export interface VisionOptions {apiKey:string;model?:string;allowedOrigins:readonly string[];fetcher?:typeof fetch;supabaseAuth?:{url:string;publishableKey:string}}
export function createVisionHandler(options:VisionOptions){
  let active=0;
  // shortcut: single-process rate limits, use a shared limiter before scaling the API.
  const recent:number[]=[];
  return async(req:IncomingMessage,res:ServerResponse)=>{
    const origin=req.headers.origin;
    res.setHeader("Cache-Control","no-store");res.setHeader("Vary","Origin");
    if(req.url==="/health"&&req.method==="GET"){send(res,200,{configured:!!options.apiKey.trim()});return;}
    if(!origin||!options.allowedOrigins.includes(origin)){send(res,403,{status:"error",requestId:null,error:{code:"invalid_request",message:"허용된 웹 화면에서 요청하십시오."}});return;}
    res.setHeader("Access-Control-Allow-Origin",origin);
    if(req.url!=="/api/vision"){send(res,404,{status:"error",requestId:null,error:{code:"invalid_request",message:"분석 주소가 올바르지 않습니다."}});return;}
    if(req.method==="OPTIONS"){res.setHeader("Access-Control-Allow-Methods","POST, OPTIONS");res.setHeader("Access-Control-Allow-Headers","Content-Type, Authorization");res.writeHead(204);res.end();return;}
    if(req.method!=="POST"||!req.headers["content-type"]?.startsWith("application/json")){send(res,400,{status:"error",requestId:null,error:{code:"invalid_request",message:"JSON 분석 요청이 필요합니다."}});return;}
    let requestId:string|null=null,started=false;
    const abort=new AbortController();res.on("close",()=>{if(!res.writableFinished)abort.abort();});
    try{
      const now=Date.now();while(recent.length&&recent[0]!<now-60000)recent.shift();
      if(active>=2||recent.length>=6)throw new VlmError("rate_limited","분석 요청이 많습니다. 잠시 후 다시 시도하십시오.");
      active++;started=true;
      if(options.supabaseAuth){
        const authorization=req.headers.authorization;
        if(!authorization||!/^Bearer [A-Za-z0-9._~-]+$/.test(authorization))throw new VlmError("unauthorized","평가자 로그인이 필요합니다. 새로고침 후 다시 시도하십시오.");
        let user:unknown;
        try{
          const response=await (options.fetcher??fetch)(`${options.supabaseAuth.url}/auth/v1/user`,{headers:{Authorization:authorization,apikey:options.supabaseAuth.publishableKey},signal:AbortSignal.any([abort.signal,AbortSignal.timeout(5000)])});
          user=response.ok?await response.json():null;
        }catch{throw new VlmError("upstream_error","로그인 서버에 연결하지 못했습니다. 잠시 후 다시 시도하십시오.");}
        if(!user||typeof user!=="object"||typeof (user as {id?:unknown}).id!=="string"||!(user as {id:string}).id)throw new VlmError("unauthorized","로그인을 확인하지 못했습니다. 새로고침 후 다시 시도하십시오.");
      }
      const input=parseVlmRequest(JSON.parse(await readBody(req)));requestId=input.requestId;
      const size=jpegSize(input.imageDataUrl);
      if(size.width!==input.capture.imageSize.width||size.height!==input.capture.imageSize.height)throw new VlmError("invalid_request","장면 크기와 요청 정보가 다릅니다.");
      recent.push(now);
      const result=await proposeJoints(input,{apiKey:options.apiKey,signal:abort.signal,...(options.model?{model:options.model}:{}),...(options.fetcher?{fetcher:options.fetcher}:{})});
      send(res,200,result);
    }catch(error){
      const e=error instanceof VlmError?error:new VlmError("invalid_request","분석 입력 형식을 확인하십시오.");
      send(res,HTTP[e.code],{status:"error",requestId,error:{code:e.code,message:e.message}} satisfies VlmResponse);
    }finally{if(started)active--;}
  };
}
export function createVisionServer(options:VisionOptions){return createServer(createVisionHandler(options));}
function send(res:ServerResponse,status:number,value:unknown){if(res.destroyed||res.writableEnded)return;res.writeHead(status,{"Content-Type":"application/json; charset=utf-8"});res.end(JSON.stringify(value));}
