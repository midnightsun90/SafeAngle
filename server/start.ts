import { createVisionServer } from "./vision.ts";

try{process.loadEnvFile(".env.local");}catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;}
const origins=(process.env.ALLOWED_ORIGIN??"http://localhost:3000,http://127.0.0.1:3000").split(",").map(s=>s.trim()).filter(Boolean);
const port=Number(process.env.PORT??3212);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error("PORT를 확인하십시오.");
const server=createVisionServer({apiKey:process.env.OPENAI_API_KEY??"",allowedOrigins:origins,...(process.env.OPENAI_VISION_MODEL?{model:process.env.OPENAI_VISION_MODEL}:{})});
server.listen(port,process.env.HOST??"127.0.0.1",()=>console.log(`SafeAngle GPT API: port ${port}, configured=${!!process.env.OPENAI_API_KEY}`));
