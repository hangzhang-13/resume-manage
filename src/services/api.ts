import { supabase } from "@/db/supabase";
import type { Resume, ResumeInsert, ResumeUpdate } from "@/types/types";

// 数据库实际存在的列（新增列后在此处加入即可生效）
const DB_COLUMNS = new Set([
  "interview_date", "department", "hiring_manager", "name", "status", "nature",
  "hiring_manager", "position", "age_experience", "job_level", "work_history", "education",
  "interview_comment", "resume_file_url", "resume_file_name",
]);

/** 尝试写入新列，失败后自动去掉不存在的列重试 */
async function safeUpsert(
  table: string,
  id: string | null,
  payload: Record<string, unknown>,
  preserveEmptyValues = false,
): Promise<{ data: unknown; error: unknown }> {
  const filtered: Record<string, unknown> = {};
  for (const key of Object.keys(payload)) {
    if (payload[key] !== undefined && payload[key] !== null && (preserveEmptyValues || String(payload[key]).trim() !== "")) {
      filtered[key] = payload[key];
    }
  }

  if (id) {
    // update
    const { data, error } = await supabase.from(table).update(filtered).eq("id", id);
    if (error && String(error.message).includes("does not exist")) {
      // 去掉不存在的列重试
      const safePayload: Record<string, unknown> = {};
      for (const key of Object.keys(filtered)) {
        if (DB_COLUMNS.has(key)) safePayload[key] = filtered[key];
      }
      if (Object.keys(safePayload).length === 0) return { data: null, error: null };
      return supabase.from(table).update(safePayload).eq("id", id);
    }
    return { data, error };
  }
  // insert
  const { data, error } = await supabase.from(table).insert(filtered).select().single();
  if (error && String(error.message).includes("does not exist")) {
    const safePayload: Record<string, unknown> = {};
    for (const key of Object.keys(filtered)) {
      if (DB_COLUMNS.has(key)) safePayload[key] = filtered[key];
    }
    return supabase.from(table).insert(safePayload).select().single();
  }
  return { data, error };
}

// 获取所有简历
export async function fetchResumes(): Promise<Resume[]> {
  const { data, error } = await supabase
    .from("resumes")
    .select("*")
    .order("uploaded_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!Array.isArray(data)) return [];

  return data as Resume[];
}

// 更新简历信息
export async function updateResume(id: string, updates: ResumeUpdate): Promise<void> {
  const { error } = await safeUpsert("resumes", id, updates as Record<string, unknown>, true);
  if (error) throw error;
}

// 新建简历信息
export async function createResume(payload: ResumeInsert): Promise<Resume> {
  const { data, error } = await safeUpsert("resumes", null, payload as unknown as Record<string, unknown>);
  if (error) throw error;
  return data as Resume;
}

// 删除简历
export async function deleteResume(id: string): Promise<void> {
  const { error } = await supabase
    .from("resumes")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// 根据文件名查找已有简历
export async function findResumeByFileName(fileName: string): Promise<Resume | null> {
  const { data, error } = await supabase
    .from("resumes")
    .select("*")
    .eq("resume_file_name", fileName)
    .limit(1);

  if (error || !data || data.length === 0) return null;
  return data[0] as Resume;
}

// 上传简历文件到 Storage
export async function uploadResumeFile(file: File): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "resume";
  const datePrefix = new Date().toISOString().slice(0, 10);
  const randomId = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const filePath = `${datePrefix}/${randomId}_${safeName}`;

  const { error } = await supabase.storage
    .from("resumes")
    .upload(filePath, file, { contentType: file.type });

  if (error) throw error;

  return filePath;
}

// 获取简历附件临时访问链接，兼容历史 public URL 数据
export async function getResumeFileDownloadUrl(fileReference?: string): Promise<string> {
  if (!fileReference) return "";
  if (/^https?:\/\//i.test(fileReference)) return fileReference;

  const { data, error } = await supabase.storage
    .from("resumes")
    .createSignedUrl(fileReference, 60 * 60);

  if (error) throw error;
  return data.signedUrl;
}

// 更新简历附件链接
export async function updateResumeFileUrl(id: string, fileUrl: string, fileName: string): Promise<void> {
  const { error } = await supabase
    .from("resumes")
    .update({ resume_file_url: fileUrl, resume_file_name: fileName, uploaded_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

interface ExtractResponse {
  success?: boolean;
  data?: Resume;
  duplicate?: boolean;
  merged?: boolean;
  name?: string;
  extractedData?: Record<string, string>;
  mergedIntoId?: string;
  error?: string;
}

// 调用提取简历 Edge Function（图片用 OCR）
export async function extractResume(fileUrl: string, fileName: string, force = false, duplicateData?: Record<string, string>): Promise<ExtractResponse> {
  const body: Record<string, unknown> = { file_url: fileUrl, file_name: fileName };
  if (force) body.force = true;
  if (duplicateData) body.duplicate_data = duplicateData;

  const { data, error } = await supabase.functions.invoke("extract-resume", { body });

  if (error) {
    const errorMsg = await error?.context?.text();
    throw new Error(errorMsg || error.message);
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data as ExtractResponse;
}

// 调用提取简历 Edge Function（文本直接传给 LLM 解析）
export async function extractResumeFromText(text: string, fileName: string, fileUrl?: string, force = false, duplicateData?: Record<string, string>, targetId?: string, nameHint?: string): Promise<ExtractResponse> {
  const body: Record<string, unknown> = { text, file_name: fileName, file_url: fileUrl || "" };
  if (force) body.force = true;
  if (duplicateData) body.duplicate_data = duplicateData;
  if (targetId) body.target_id = targetId;
  if (nameHint) body.name_hint = nameHint;

  const { data, error } = await supabase.functions.invoke("extract-resume", { body });

  if (error) {
    const errorMsg = await error?.context?.text();
    throw new Error(errorMsg || error.message);
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data as ExtractResponse;
}

// 检查是否存在同名简历
export async function checkDuplicateName(name: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("resumes")
    .select("id")
    .ilike("name", name)
    .limit(1);

  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}
