import type { VlmProposal, VlmRequest } from "../../../lib/vlm/contract.ts";
import { parseVlmResponse, sameCapture } from "../../../lib/vlm/validation.ts";

export async function requestJoints(input:VlmRequest,signal:AbortSignal):Promise<VlmProposal>{
  const configured=process.env.NEXT_PUBLIC_VISION_API_URL;
  const local=["localhost","127.0.0.1"].includes(window.location.hostname);
  const endpoint=configured||(local?"http://127.0.0.1:3212/api/vision":"");
  if(!endpoint)throw new Error("GPT 분석 서버 주소가 설정되지 않았습니다. 팀의 서버 배포 설정을 확인하십시오.");
  const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input),signal});
  const result=parseVlmResponse(await response.json());
  if(result.status==="error")throw new Error(result.error.message);
  if(!response.ok)throw new Error("분석 서버 호출에 실패했습니다.");
  if(result.requestId!==input.requestId||!sameCapture(result.capture,input.capture))throw new Error("다른 장면의 분석 응답을 사용할 수 없습니다.");
  return result;
}
