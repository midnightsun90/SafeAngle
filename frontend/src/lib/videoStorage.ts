export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const videoBucket = "assessment-videos";
export const videoPostureTypes = ["lift_transfer", "seated_handwork", "push_pull"] as const;
export type VideoPostureType = typeof videoPostureTypes[number];

type VideoFileInfo = Pick<File, "name" | "type" | "size">;

export function validateVideoFile(file: VideoFileInfo): string | null {
  if (!file.type.startsWith("video/") && !/\.(mp4|mov|webm|m4v|avi)$/i.test(file.name)) {
    return "영상 파일을 선택해 주세요.";
  }
  if (file.size === 0) return "파일이 비어 있습니다. 다른 영상을 선택해 주세요.";
  if (file.size > MAX_VIDEO_BYTES) return "영상은 50MB 이하로 올려주세요.";
  return null;
}

export function videoContentType(file: VideoFileInfo): string {
  if (file.type.startsWith("video/")) return file.type;
  const extension = file.name.split(".").at(-1)?.toLowerCase();
  return ({ mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", m4v: "video/x-m4v", avi: "video/x-msvideo" } as Record<string, string>)[extension ?? ""] ?? "video/mp4";
}

export function storagePathForVideo(managerId: string, assessmentId: string, posture: VideoPostureType, filename: string): string {
  const extension = filename.split(".").at(-1)?.toLowerCase();
  const safeExtension = extension && /^(mp4|mov|webm|m4v|avi)$/.test(extension) ? extension : "mp4";
  return `${managerId}/${assessmentId}/${posture}-${crypto.randomUUID()}.${safeExtension}`;
}
