const SUPPORTED_TYPES: Record<string, string> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/bmp": "image",
  "image/webp": "image",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/html": "html",
};

const SUPPORTED_EXTENSIONS: Record<string, string> = {
  jpg: "image",
  jpeg: "image",
  png: "image",
  bmp: "image",
  webp: "image",
  pdf: "pdf",
  doc: "doc",
  docx: "docx",
  xls: "xls",
  xlsx: "xlsx",
  html: "html",
  htm: "html",
};

export const RESUME_FILE_ACCEPT =
  ".jpg,.jpeg,.png,.bmp,.webp,.pdf,.doc,.docx,.xls,.xlsx,.html,.htm,image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/html";

export function getResumeFileType(file: File): string | null {
  const byMime = SUPPORTED_TYPES[file.type];
  if (byMime) return byMime;

  const ext = file.name.split(".").pop()?.toLowerCase();
  return SUPPORTED_EXTENSIONS[ext || ""] || null;
}

export function isSupportedResumeFile(file: File): boolean {
  return getResumeFileType(file) !== null;
}
