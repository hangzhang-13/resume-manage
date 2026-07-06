/**
 * 为已有记录补传附件：找到磁盘上存在的简历文件，上传到 Storage 并更新 DB。
 */

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://backend.appmiaoda.com/projects/supabase327815123773206528";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoyMDk3NTg0NDE2LCJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwic3ViIjoiYW5vbiJ9.jPV_RmB5LABgtT-uCx3EnSlruDsDP4bsJ5i3SMjlT3Q";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const FILE_SEARCH_DIRS = [
  "/Users/zhanghang/Desktop/bp面试",
  "/Users/zhanghang/Desktop",
];

function findFileOnDisk(fileName) {
  if (!fileName || fileName === "无") return null;
  for (const dir of FILE_SEARCH_DIRS) {
    const fullPath = path.join(dir, fileName);
    if (fs.existsSync(fullPath)) return fullPath;
  }
  return null;
}

async function uploadFile(filePath, fileName) {
  const fileBuffer = fs.readFileSync(filePath);
  const ext = path.extname(fileName).toLowerCase();
  const mimeTypes = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".html": "text/html",
  };
  const contentType = mimeTypes[ext] || "application/octet-stream";
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
  const datePrefix = new Date().toISOString().slice(0, 10);
  const randomId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const storagePath = `${datePrefix}/${randomId}_${safeName}`;

  const { error } = await supabase.storage
    .from("resumes")
    .upload(storagePath, fileBuffer, { contentType });

  if (error) {
    console.error(`  ✗ Upload failed: ${error.message}`);
    return null;
  }
  return storagePath;
}

async function main() {
  // Get records with file_name but no file_url
  const { data, error } = await supabase
    .from("resumes")
    .select("id, name, resume_file_name, resume_file_url")
    .not("resume_file_name", "eq", "")
    .not("resume_file_name", "eq", "无");

  if (error) { console.error(error); process.exit(1); }

  const needsUpload = data.filter(r => !r.resume_file_url || r.resume_file_url === "");
  console.log(`🔍 ${needsUpload.length} 条记录需要补传附件`);

  let uploaded = 0;
  for (const record of needsUpload) {
    const localPath = findFileOnDisk(record.resume_file_name);
    if (!localPath) {
      console.log(`  ⚠️  ${record.name}: 文件 ${record.resume_file_name} 未找到`);
      continue;
    }

    const storagePath = await uploadFile(localPath, record.resume_file_name);
    if (!storagePath) continue;

    const { error: updateErr } = await supabase
      .from("resumes")
      .update({ resume_file_url: storagePath })
      .eq("id", record.id);

    if (updateErr) {
      console.error(`  ✗ ${record.name}: 更新失败 ${updateErr.message}`);
    } else {
      console.log(`  ✓ ${record.name}: 附件已上传`);
      uploaded++;
    }
  }

  console.log(`\n✅ 补传完成: ${uploaded}/${needsUpload.length}`);
}

main().catch(console.error);
