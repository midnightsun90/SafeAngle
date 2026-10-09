import { VLM_OUTPUT_FORMAT } from "./schema.ts";
import { jointPrompt, VLM_PROMPT_VERSION } from "./prompt.ts";
import { parsePoints, parseVlmRequest, VlmError } from "./validation.ts";
import type { VlmProposal, VlmRequest } from "./contract.ts";

export const DEFAULT_VISION_MODEL="gpt-6.1-sol";
export async function proposeJoints(input: VlmRequest, options: {apiKey:string;model?:string;signal?:AbortSignal;fetcher?:typeof fetch}): Promise<VlmProposal> {
  const request=parseVlmRequest(input),model=options.model??DEFAULT_VISION_MODEL;
  if(!options.apiKey.trim())throw new VlmError("not_configured","서버 API 키가 설정되지 않았습니다.");
  if(!/^gpt-6\.1-sol(?:-[a-z0-9-]+)?$/.test(model))throw new VlmError("not_configured","검증한 GPT 모델을 설정하십시오.");
  const start=performance.now();
  try{
    const signal=options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(120000)]):AbortSignal.timeout(120000);
    const response=await (options.fetcher??fetch)("https://api.openai.com/v1/responses",{
      method:"POST",headers:{Authorization:`Bearer ${options.apiKey}`,"Content-Type":"application/json"},signal,
      body:JSON.stringify({model,store:false,reasoning:{effort:"high"},max_output_tokens:8192,
        input:[{role:"user",content:[{type:"input_text",text:jointPrompt(request.capture)},{type:"input_image",image_url:request.imageDataUrl,detail:"original"}]}],text:{format:VLM_OUTPUT_FORMAT}}),
    });
    if(!response.ok)throw new VlmError(response.status===429?"rate_limited":"upstream_error",response.status===429?"GPT 요청 한도에 도달했습니다. 잠시 후 다시 시도하십시오.":"GPT 서버 호출에 실패했습니다.");
    const data:unknown=await response.json();
    if(!data||typeof data!=="object")throw new VlmError("invalid_output","GPT 응답을 읽을 수 없습니다.");
    const payload=data as Record<string,unknown>;
    if(payload.status!=="completed")throw new VlmError("incomplete","GPT 분석이 완료되지 않았습니다. 다시 요청하십시오.");
    const items=Array.isArray(payload.output)?payload.output:[];
    const content=items.flatMap((item:unknown)=>item&&typeof item==="object"&&Array.isArray((item as Record<string,unknown>).content)?(item as {content:unknown[]}).content:[]);
    if(content.some(c=>c&&typeof c==="object"&&(c as Record<string,unknown>).type==="refusal"))throw new VlmError("refused","GPT가 이 장면 분석을 진행하지 않았습니다. 다른 장면을 선택하십시오.");
    const output=content.filter(c=>c&&typeof c==="object"&&(c as Record<string,unknown>).type==="output_text").map(c=>(c as Record<string,unknown>).text);
    if(output.length!==1||typeof output[0]!=="string"||output[0].length>10000||typeof payload.id!=="string"||typeof payload.model!=="string")throw new VlmError("invalid_output","GPT 관절 응답 형식이 올바르지 않습니다.");
    let points;
    try{points=parsePoints(JSON.parse(output[0]));}catch{throw new VlmError("invalid_output","GPT 관절 좌표가 올바르지 않습니다.");}
    return {status:"proposed",schemaVersion:"safeangle-joints-v1",requestId:request.requestId,capture:request.capture,points,
      provenance:{provider:"openai",model:payload.model,promptVersion:VLM_PROMPT_VERSION,responseId:payload.id,elapsedMs:Math.round(performance.now()-start)}};
  }catch(error){
    if(error instanceof VlmError)throw error;
    if(error instanceof Error&&(error.name==="TimeoutError"||error.name==="AbortError"))throw new VlmError("timeout","GPT 요청이 취소되었거나 대기 시간을 초과했습니다.");
    throw new VlmError("upstream_error","GPT 분석 서버에 연결할 수 없습니다.");
  }
}
