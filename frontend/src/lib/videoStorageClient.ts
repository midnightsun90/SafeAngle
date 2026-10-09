import { Upload } from "tus-js-client";
import { supabase, supabaseUrl } from "./supabaseClient";
import { videoBucket, videoContentType } from "./videoStorage";

export async function uploadVideo(file: File, path: string, onProgress?: (percent: number) => void): Promise<void> {
  if (!supabase) throw new Error("DB 설정이 없습니다.");
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) throw error ?? new Error("로그인이 필요합니다.");
  const storageUrl = new URL(supabaseUrl);
  storageUrl.hostname = storageUrl.hostname.replace(/\.supabase\.co$/, ".storage.supabase.co");
  const endpoint = `${storageUrl.origin}/storage/v1/upload/resumable`;

  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint,
      headers: { authorization: `Bearer ${session.access_token}` },
      metadata: { bucketName: videoBucket, objectName: path, contentType: videoContentType(file) },
      chunkSize: 6 * 1024 * 1024,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      onProgress(bytesUploaded, bytesTotal) {
        onProgress?.(Math.round(bytesUploaded / bytesTotal * 100));
      },
      onError: reject,
      onSuccess: () => resolve(),
    });
    upload.start();
  });
}

export async function videoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const element = document.createElement("video");
    const url = URL.createObjectURL(file);
    const timer = window.setTimeout(() => finish(null), 10000);
    function finish(duration: number | null) {
      window.clearTimeout(timer);
      element.onloadedmetadata = null;
      element.onerror = null;
      element.removeAttribute("src");
      element.load();
      URL.revokeObjectURL(url);
      resolve(duration);
    }
    element.preload = "metadata";
    element.onloadedmetadata = () => finish(Number.isFinite(element.duration) ? element.duration : null);
    element.onerror = () => finish(null);
    element.src = url;
  });
}
