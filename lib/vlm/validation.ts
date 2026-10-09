import { integerInRange, numberInRange, requireRecord } from "../validation.ts";
import { VLM_ERROR_CODES, VLM_JOINTS, type VlmCapture, type VlmErrorCode, type VlmPoints, type VlmRequest, type VlmResponse } from "./contract.ts";

export class VlmError extends Error {
  readonly code: VlmErrorCode;
  constructor(code: VlmErrorCode, message: string) { super(message); this.name = "VlmError"; this.code = code; }
}
function exact(value: unknown, keys: readonly string[], name: string): asserts value is Record<string, unknown> {
  requireRecord(value, name);
  if (Object.keys(value).length !== keys.length || keys.some(k => !Object.hasOwn(value, k))) throw new TypeError(`${name}: 항목이 맞지 않습니다.`);
}
function text(value: unknown, name: string, max = 256): asserts value is string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new TypeError(`${name}: 문자열이 올바르지 않습니다.`);
}
export function parseCapture(value: unknown): VlmCapture {
  exact(value,["scene","revision","imageSize","facing"],"capture");
  exact(value.scene,["videoId","frameIndex","timeSec","side"],"scene");
  text(value.scene.videoId,"videoId");integerInRange(value.scene.frameIndex,0,100000,"frameIndex");numberInRange(value.scene.timeSec,0,60,"timeSec");
  if(value.scene.side!=="left"&&value.scene.side!=="right")throw new TypeError("평가할 쪽이 필요합니다.");
  integerInRange(value.revision,0,Number.MAX_SAFE_INTEGER,"revision");
  exact(value.imageSize,["width","height"],"imageSize");integerInRange(value.imageSize.width,1,2048,"width");integerInRange(value.imageSize.height,1,2048,"height");
  if(value.facing!==1&&value.facing!==-1)throw new TypeError("몸 방향을 확인하십시오.");
  return {scene:{videoId:value.scene.videoId,frameIndex:value.scene.frameIndex,timeSec:value.scene.timeSec,side:value.scene.side},revision:value.revision,imageSize:{width:value.imageSize.width,height:value.imageSize.height},facing:value.facing};
}
export function parsePoints(value: unknown): VlmPoints {
  exact(value,VLM_JOINTS,"points");
  return Object.fromEntries(VLM_JOINTS.map(name=>{
    const p=value[name];if(p===null)return [name,null];
    exact(p,["x","y"],name);numberInRange(p.x,0,1,`${name}.x`);numberInRange(p.y,0,1,`${name}.y`);
    return [name,{x:p.x,y:p.y}];
  })) as VlmPoints;
}
export function parseVlmRequest(value: unknown): VlmRequest {
  exact(value,["schemaVersion","requestId","capture","imageDataUrl","consent"],"request");
  if(value.schemaVersion!=="safeangle-joints-v1")throw new TypeError("지원하지 않는 입력 버전입니다.");
  text(value.requestId,"requestId",128);
  exact(value.consent,["granted","noticeVersion"],"consent");
  if(value.consent.granted!==true||value.consent.noticeVersion!=="representative-frame-v1")throw new VlmError("consent_required","대표 장면 전송 동의가 필요합니다.");
  if(typeof value.imageDataUrl!=="string"||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value.imageDataUrl))throw new TypeError("JPEG 장면 한 장이 필요합니다.");
  if(value.imageDataUrl.length>1400000)throw new VlmError("image_too_large","대표 장면 파일이 너무 큽니다.");
  return {schemaVersion:value.schemaVersion,requestId:value.requestId,capture:parseCapture(value.capture),imageDataUrl:value.imageDataUrl,consent:{granted:true,noticeVersion:"representative-frame-v1"}};
}
export function sameCapture(a: VlmCapture,b: VlmCapture): boolean {
  return a.revision===b.revision&&a.facing===b.facing&&a.imageSize.width===b.imageSize.width&&a.imageSize.height===b.imageSize.height
    &&a.scene.videoId===b.scene.videoId&&a.scene.frameIndex===b.scene.frameIndex&&a.scene.timeSec===b.scene.timeSec&&a.scene.side===b.scene.side;
}
export function parseVlmResponse(value: unknown): VlmResponse {
  requireRecord(value,"response");
  if(value.status==="error"){
    exact(value,["status","requestId","error"],"error response");if(value.requestId!==null)text(value.requestId,"requestId",128);
    exact(value.error,["code","message"],"error");
    if(typeof value.error.code!=="string"||!VLM_ERROR_CODES.includes(value.error.code as VlmErrorCode))throw new TypeError("응답 오류 코드가 올바르지 않습니다.");
    text(value.error.message,"message");return {status:"error",requestId:value.requestId,error:{code:value.error.code as VlmErrorCode,message:value.error.message}};
  }
  exact(value,["status","schemaVersion","requestId","capture","provenance","points"],"response");
  if(value.status!=="proposed"||value.schemaVersion!=="safeangle-joints-v1")throw new TypeError("지원하지 않는 응답입니다.");
  text(value.requestId,"requestId",128);exact(value.provenance,["provider","model","promptVersion","responseId","elapsedMs"],"provenance");
  const p=value.provenance;if(p.provider!=="openai")throw new TypeError("OpenAI 응답만 사용할 수 있습니다.");
  text(p.model,"model");text(p.promptVersion,"promptVersion");text(p.responseId,"responseId");numberInRange(p.elapsedMs,0,3600000,"elapsedMs");
  return {status:value.status,schemaVersion:value.schemaVersion,requestId:value.requestId,capture:parseCapture(value.capture),points:parsePoints(value.points),provenance:{provider:"openai",model:p.model,promptVersion:p.promptVersion,responseId:p.responseId,elapsedMs:p.elapsedMs}};
}
