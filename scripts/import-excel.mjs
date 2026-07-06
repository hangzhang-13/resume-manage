/**
 * 从 Excel 导入面试记录到 Supabase，并上传关联的简历附件。
 *
 * Usage: node scripts/import-excel.mjs
 */

import XLSX from "xlsx";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://backend.appmiaoda.com/projects/supabase327815123773206528";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoyMDk3NTg0NDE2LCJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwic3ViIjoiYW5vbiJ9.jPV_RmB5LABgtT-uCx3EnSlruDsDP4bsJ5i3SMjlT3Q";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 简历文件搜索目录
const FILE_SEARCH_DIRS = [
  "/Users/zhanghang/Desktop/bp面试",
  "/Users/zhanghang/Desktop",
];

// Excel 日期序列号转日期字符串
function excelDateToString(serial) {
  if (!serial) return "";
  if (typeof serial === "string") return serial.trim();
  const date = new Date((serial - 25569) * 86400000);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// 清理文本
function clean(val) {
  if (val === null || val === undefined) return "";
  return String(val).trim();
}

// 在磁盘上查找文件
function findFileOnDisk(fileName) {
  if (!fileName || fileName === "无") return null;
  for (const dir of FILE_SEARCH_DIRS) {
    const fullPath = path.join(dir, fileName);
    if (fs.existsSync(fullPath)) return fullPath;
  }
  return null;
}

// 上传文件到 Supabase Storage
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
  };
  const contentType = mimeTypes[ext] || "application/octet-stream";

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "resume";
  const datePrefix = new Date().toISOString().slice(0, 10);
  const randomId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const storagePath = `${datePrefix}/${randomId}_${safeName}`;

  const { error } = await supabase.storage
    .from("resumes")
    .upload(storagePath, fileBuffer, { contentType });

  if (error) {
    console.error(`  ✗ Upload failed for ${fileName}:`, error.message);
    return null;
  }
  return storagePath;
}

// 解析一行 Excel 数据为简历记录
function parseRow(row, headers) {
  const interviewDateIdx = 0;
  const departmentIdx = 1;
  const nameIdx = 2;
  const statusIdx = 3;
  const natureIdx = 4; // 性质 or 渠道
  const positionIdx = 5;
  const ageExpIdx = 6;
  const jobLevelIdx = 7;
  const workHistoryIdx = 8;
  const educationIdx = 9;
  const commentIdx = 10;
  const fileIdx = 11; // 简历附件文件名

  const name = clean(row[nameIdx]);
  if (!name) return null;

  return {
    interview_date: excelDateToString(row[interviewDateIdx]),
    department: clean(row[departmentIdx]),
    name,
    status: clean(row[statusIdx]) || "pending",
    nature: clean(row[natureIdx]),
    position: clean(row[positionIdx]),
    age_experience: clean(row[ageExpIdx]),
    job_level: clean(row[jobLevelIdx]),
    work_history: clean(row[workHistoryIdx]),
    education: clean(row[educationIdx]),
    interview_comment: clean(row[commentIdx]),
    resume_file_name: clean(row[fileIdx]),
  };
}

async function main() {
  const excelFiles = [
    "/Users/zhanghang/Desktop/【导入】面试记录 (1).xlsx",
    "/Users/zhanghang/Desktop/【导入】面试记录 (2).xlsx",
  ];

  // 1. 获取已有记录避免重复
  console.log("📋 获取现有数据库记录...");
  const { data: existingRecords, error: fetchErr } = await supabase
    .from("resumes")
    .select("name, resume_file_name")
    .limit(1000);

  if (fetchErr) {
    console.error("获取现有记录失败:", fetchErr.message);
    process.exit(1);
  }

  const existingNames = new Set(existingRecords.map((r) => r.name));
  console.log(`  已有 ${existingNames.size} 条记录`);

  // 2. 解析 Excel
  const allRecords = [];
  const sheetsToImport = ["Sheet1", "Q3 面试和交流"];

  for (const file of excelFiles) {
    if (!fs.existsSync(file)) {
      console.log(`⚠️  文件不存在: ${file}`);
      continue;
    }
    console.log(`\n📂 解析: ${path.basename(file)}`);
    const wb = XLSX.readFile(file);

    for (const sheetName of sheetsToImport) {
      if (!wb.SheetNames.includes(sheetName)) continue;
      const ws = wb.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
      const headers = data[0];

      let added = 0;
      for (let i = 1; i < data.length; i++) {
        const record = parseRow(data[i], headers);
        if (!record) continue;

        // 去重：如果同名已在 DB 或已在本次导入列表中，跳过
        if (existingNames.has(record.name)) continue;
        if (allRecords.some((r) => r.name === record.name)) continue;

        allRecords.push(record);
        added++;
      }
      console.log(`  [${sheetName}] 新增 ${added} 条`);
    }
  }

  console.log(`\n🔢 总计需导入: ${allRecords.length} 条新记录`);

  // 3. 上传附件并插入数据库
  let successCount = 0;
  let fileUploadCount = 0;

  for (let i = 0; i < allRecords.length; i++) {
    const record = allRecords[i];
    const progress = `[${i + 1}/${allRecords.length}]`;

    // 查找并上传附件
    let fileStoragePath = "";
    if (record.resume_file_name && record.resume_file_name !== "无") {
      const localPath = findFileOnDisk(record.resume_file_name);
      if (localPath) {
        const uploaded = await uploadFile(localPath, record.resume_file_name);
        if (uploaded) {
          fileStoragePath = uploaded;
          fileUploadCount++;
        }
      }
    }

    // 构建插入数据
    const insertData = {
      interview_date: record.interview_date,
      department: record.department,
      name: record.name,
      status: record.status,
      nature: record.nature,
      position: record.position,
      age_experience: record.age_experience,
      job_level: record.job_level,
      work_history: record.work_history,
      education: record.education,
      interview_comment: record.interview_comment,
      resume_file_name: record.resume_file_name,
    };

    if (fileStoragePath) {
      insertData.resume_file_url = fileStoragePath;
    }

    const { error: insertErr } = await supabase.from("resumes").insert(insertData);

    if (insertErr) {
      console.error(`${progress} ✗ ${record.name}: ${insertErr.message}`);
    } else {
      successCount++;
      if (i < 5 || i % 20 === 0) {
        console.log(`${progress} ✓ ${record.name}${fileStoragePath ? " (附件已上传)" : ""}`);
      }
    }
  }

  console.log(`\n✅ 导入完成！`);
  console.log(`   成功: ${successCount}/${allRecords.length}`);
  console.log(`   附件上传: ${fileUploadCount}`);
}

main().catch((err) => {
  console.error("导入失败:", err);
  process.exit(1);
});
