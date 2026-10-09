export function waitForLoad<T>(pending:Promise<T>,signal?:AbortSignal,timeoutMs=40_000,onLate?:(value:T)=>void):Promise<T> {
  return new Promise((resolve,reject)=>{
    let stopped=false;
    const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener("abort",abort);};
    const abort=()=>{stopped=true;cleanup();reject(signal?.reason??new DOMException("분석이 취소됐습니다.","AbortError"));};
    const timer=setTimeout(()=>{stopped=true;cleanup();reject(new Error("모델 준비 시간이 초과됐습니다."));},timeoutMs);
    signal?.addEventListener("abort",abort,{once:true});
    pending.then(value=>{if(stopped){onLate?.(value);return;}cleanup();resolve(value);},error=>{if(!stopped){cleanup();reject(error);}});
    if(signal?.aborted)abort();
  });
}
export function waitForTask<T extends { close():void }>(pending:Promise<T>,signal?:AbortSignal,timeoutMs=40_000):Promise<T> {
  return waitForLoad(pending,signal,timeoutMs,task=>task.close());
}
