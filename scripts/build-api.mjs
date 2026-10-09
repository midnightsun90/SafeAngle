import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { stripTypeScriptTypes } from "node:module";

const files=["server/vision.ts","lib/validation.ts",...['contract','openai','prompt','schema','validation'].map(name=>`lib/vlm/${name}.ts`)];
for(const file of files){
  const target=`.api-build/${file.replace(/\.ts$/,'.js')}`;
  const code=stripTypeScriptTypes(await readFile(file,'utf8')).replace(/(from\s*["'][^"']+)\.ts(["'])/g,'$1.js$2');
  await mkdir(dirname(target),{recursive:true});await writeFile(target,code);
}
const {createVisionHandler}=await import('../.api-build/server/vision.js');
if(typeof createVisionHandler!=="function")throw new Error("API build failed");
console.log(`API runtime built from ${files.length} checked source files`);
