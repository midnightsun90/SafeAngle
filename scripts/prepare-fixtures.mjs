import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
const root=fileURLToPath(new URL("../",import.meta.url));
const dir=resolve(root,".local/fixtures");await mkdir(dir,{recursive:true});
const source=resolve(dir,"squat.webm");
const sha="ab4602823ad00de3409eb50d2c65c6b1ce5566c5dca6753555ff2b19107db88e";
let bytes;try{bytes=await readFile(source);}catch{}
if(!bytes||createHash("sha256").update(bytes).digest("hex")!==sha){
  const response=await fetch("https://upload.wikimedia.org/wikipedia/commons/1/16/Basic_single_leg_squat.webm",{signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error("Fixture download failed: "+response.status);
  bytes=Buffer.from(await response.arrayBuffer());
  if(createHash("sha256").update(bytes).digest("hex")!==sha)throw new Error("Fixture SHA256 mismatch");
  await writeFile(source,bytes);
}
const ffmpeg=process.env.FFMPEG??"ffmpeg";
// Put output last: FFmpeg applies encoder options to the output that follows them.
const encode=(args,name)=>{
  const result=spawnSync(ffmpeg,["-hide_banner","-loglevel","error",...args,"-an","-c:v","libvpx-vp9","-y",resolve(dir,name)],{stdio:"inherit"});
  if(result.error)throw new Error("FFmpeg is required. Add it to PATH or set FFMPEG to its executable path.",{cause:result.error});
  if(result.status!==0)throw new Error("FFmpeg failed: "+name);
};
encode(["-i",source,"-t","1"],"short.webm");
encode(["-f","lavfi","-i","color=c=black:s=480x640:d=1:r=30"],"empty.webm");
encode(["-f","lavfi","-i","color=c=black:s=32x32:d=61:r=1"],"too-long.webm");
encode(["-i",source,"-t","1","-vf","crop=iw:ih/2:0:ih/2"],"cropped.webm");
encode(["-i",source,"-t","1","-filter_complex","[0:v]crop=240:240:120:230,split=2[a][b];[a][b]hstack=inputs=2"],"multiple.webm");
encode(["-i",source,"-t","1","-vf","drawbox=x=145:y=285:w=75:h=70:color=black:t=fill"],"occluded.webm");
await writeFile(resolve(dir,"SOURCE.txt"),"RickyBennison, Basic single leg squat, 2022-08-04\nhttps://commons.wikimedia.org/wiki/File:Basic_single_leg_squat.webm\nCC BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/\nshort: first second; cropped: lower half; multiple: 240x240 crop at (120,230), duplicated side by side; occluded: black head/shoulder rectangle.\nDerived clips retain CC BY-SA 4.0. empty is a generated black clip.\n");
console.log("Prepared fixtures in .local/fixtures (not committed).");
