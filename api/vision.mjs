import { createVisionHandler } from "../.api-build/server/vision.js";

export default createVisionHandler({
  apiKey:process.env.OPENAI_API_KEY??"",
  model:process.env.OPENAI_VISION_MODEL??"gpt-6.1-sol",
  allowedOrigins:(process.env.ALLOWED_ORIGIN??"https://midnightsun90.github.io").split(",").map(value=>value.trim()).filter(Boolean),
  supabaseAuth:{
    url:process.env.SUPABASE_URL??"https://ixocecrvriaprwynhnst.supabase.co",
    publishableKey:process.env.SUPABASE_PUBLISHABLE_KEY??"sb_publishable_AS3RphAZQVJno1NspjsBWw_o0TROhFj",
  },
});
