export default function health(_request,response){
  response.setHeader("Cache-Control","no-store");
  response.writeHead(200,{"Content-Type":"application/json"});
  response.end(JSON.stringify({configured:!!process.env.OPENAI_API_KEY?.trim(),authRequired:true}));
}
