import React, { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Upload, CheckCircle2, AlertCircle, Loader2, ArrowRight, Sparkles, Star } from "lucide-react";
import { createResume, extractResume, extractResumeFromText, findResumeByFileName, updateResume, updateResumeFileUrl, uploadResumeFile } from "@/services/api";
import { cn } from "@/lib/utils";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { getResumeFileType, RESUME_FILE_ACCEPT } from "@/lib/resume-files";
import { notifyResumesUpdated } from "@/lib/resume-events";
import { normalizeEducationText, normalizeResumeText, normalizeWorkHistoryText } from "@/lib/resume-text";
import { STATUS_OPTIONS } from "@/lib/resume-status";
import type { ResumeInsert, ResumeUpdate } from "@/types/types";

interface UploadItem {
  file: File;
  status: "uploading" | "extracting" | "success" | "error";
  progress: number;
  message: string;
}

interface UploadNotes {
  interview_date: string;
  department: string;
  hiring_manager: string;
  job_level_type: string;
  job_level_number: string;
  status: string;
  interview_comment: string;
  priority_focus: boolean;
}

interface EditableParsed {
  name: string;
  position: string;
  work_history: string;
  education: string;
}

interface ParsedResult {
  name: string;
  interview_date: string;
  department: string;
  status: string;
  nature: string;
  position: string;
  age_experience: string;
  job_level: string;
  work_history: string;
  education: string;
  interview_comment: string;
}

interface ConfirmDialogState {
  open: boolean;
  resumeId?: string;
  fileName?: string;
  parsed: ParsedResult | null;
}

const defaultUploadNotes: UploadNotes = {
  interview_date: "",
  department: "",
  hiring_manager: "",
  job_level_type: "",
  job_level_number: "",
  status: "pending",
  interview_comment: "",
  priority_focus: false,
};

const defaultEditableParsed: EditableParsed = {
  name: "",
  position: "",
  work_history: "",
  education: "",
};

const defaultConfirmDialogState: ConfirmDialogState = {
  open: false,
  parsed: null,
};

const FILE_FORMAT_LABELS = [
  { label: "图片", types: "JPG / PNG" },
  { label: "文档", types: "PDF / DOC / DOCX / HTML" },
  { label: "表格", types: "XLS / XLSX" },
];

function getExcelRowValues(row: { values: unknown }): unknown[] {
  return Array.isArray(row.values) ? row.values.slice(1) : [];
}

async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer, useSystemFonts: true }).promise;
  let text = "";

  try {
    for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
      const page = await pdf.getPage(pageIndex);
      const content = await page.getTextContent();
      text += content.items
        .map((item: unknown) => {
          if (typeof item !== "object" || item === null || !("str" in item)) return "";
          return String((item as { str: unknown }).str);
        })
        .filter(Boolean)
        .join(" ") + "\n";
    }
    const cleanedText = removePdfWatermarks(text);
    if (hasUsableResumeText(cleanedText)) return cleanedText;

    // 扫描版 PDF 没有文字层：逐页渲染后交给本地 OCR。
    const pages: Blob[] = [];
    for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
      const page = await pdf.getPage(pageIndex);
      // OCR 以适合简历文字的清晰度渲染，避免高分辨率导致等待过长。
      const viewport = page.getViewport({ scale: 1.4 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("无法准备 PDF 的 OCR 识别画布");
      await page.render({ canvasContext: context, viewport }).promise;
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
      if (blob) pages.push(blob);
    }
    return extractTextFromImages(pages);
  } finally {
    await pdf.cleanup();
  }
}

function removePdfWatermarks(text: string): string {
  return text
    .replace(/(?:Baidu|百度)\s*招聘专用/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function hasUsableResumeText(text: string): boolean {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const uniqueLines = new Set(lines);
  const chineseCharacters = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const wordLikeTokens = text.match(/[A-Za-z0-9][A-Za-z0-9_./@:+-]*/g) || [];
  // 部分 PDF 把水印作为唯一“文字层”导出；同一串编码反复出现不应阻止 OCR。
  return (chineseCharacters >= 20 || wordLikeTokens.length >= 20) && uniqueLines.size >= 3;
}

async function extractTextFromImages(images: Blob[]): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("chi_sim+eng", 1);
  try {
    const chunks: string[] = [];
    for (const image of images) {
      const result = await worker.recognize(image);
      if (result.data.text.trim()) chunks.push(result.data.text);
    }
    const text = removePdfWatermarks(chunks.join("\n"));
    if (!text) throw new Error("未能从图片中识别到文字，请确认图片清晰、文字朝向正常");
    return text;
  } finally {
    await worker.terminate();
  }
}

async function extractTextFromDoc(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value.trim();
}

async function extractTextFromExcel(file: File): Promise<string> {
  const { default: ExcelJS } = await import("exceljs");
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  let text = "";

  workbook.eachSheet((worksheet) => {
    const rows: string[][] = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      rows.push(getExcelRowValues(row).map((value) => String(value ?? "")));
    });
    text += `${rows.map((row) => row.join("\t")).join("\n")}\n`;
  });

  return text.trim();
}

async function parseExcelRows(file: File): Promise<ResumeInsert[]> {
  const { default: ExcelJS } = await import("exceljs");
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  const rows: ResumeInsert[] = [];

  workbook.eachSheet((worksheet) => {
    const headers = getExcelRowValues(worksheet.getRow(1)).map((value) => String(value ?? "").trim());

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      const cells = getExcelRowValues(row);
      const data = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
      const name = normalizeResumeText(String(data["姓名"] || data["name"] || ""));
      if (!name) return;

      rows.push({
        interview_date: normalizeResumeText(String(data["面试时间"] || data["interview_date"] || "")),
        department: normalizeResumeText(String(data["用人部门"] || data["department"] || "")),
        hiring_manager: normalizeResumeText(String(data["用人经理"] || data["hiring_manager"] || "")),
        name,
        status: normalizeResumeText(String(data["状态"] || data["status"] || "")),
        nature: normalizeResumeText(String(data["性质"] || data["nature"] || "")),
        position: normalizeResumeText(String(data["职位"] || data["position"] || "")),
        age_experience: normalizeResumeText(String(data["年龄/工作经验"] || data["age_experience"] || "")),
        job_level: normalizeResumeText(String(data["职级"] || data["job_level"] || "")),
        work_history: normalizeWorkHistoryText(String(data["工作履历"] || data["work_history"] || "")),
        education: normalizeEducationText(String(data["学历"] || data["education"] || "")),
        interview_comment: normalizeResumeText(String(data["面评"] || data["interview_comment"] || "")),
        resume_file_name: file.name,
      });
    });
  });

  return rows;
}

async function extractTextFromHtml(file: File): Promise<string> {
  const html = await file.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  return cleanText(doc.body.innerText || doc.body.textContent || "");
}

async function extractTextFromFile(file: File, fileType: string): Promise<string> {
  let text = "";
  if (fileType === "pdf") text = await extractTextFromPdf(file);
  else if (fileType === "image") text = await extractTextFromImages([file]);
  else if (fileType === "doc" || fileType === "docx") text = await extractTextFromDoc(file);
  else if (fileType === "xls" || fileType === "xlsx") text = await extractTextFromExcel(file);
  else if (fileType === "html") text = await extractTextFromHtml(file);
  else throw new Error("不支持的文件格式");
  return cleanText(text);
}

function cleanText(text: string): string {
  return normalizeResumeText(text);
}

/** 将多行文本格式化为带序号的列表（每行前加 "1. "、"2. "...） */
function formatAsList(text: string): string {
  if (!text) return "";
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 1) return lines.join("");
  return lines.map((line, i) => `${i + 1}. ${line}`).join("\n");
}

function toParsedResult(data: ParsedResult | null | undefined): ParsedResult | null {
  if (!data) return null;
  return {
    name: String(data.name || ""),
    interview_date: String(data.interview_date || ""),
    department: String(data.department || ""),
    status: String(data.status || ""),
    nature: String(data.nature || ""),
    position: String(data.position || ""),
    age_experience: String(data.age_experience || ""),
    job_level: String(data.job_level || ""),
    work_history: String(data.work_history || ""),
    education: String(data.education || ""),
    interview_comment: String(data.interview_comment || ""),
  };
}

export default function UploadPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [uploadNotes, setUploadNotes] = useState<UploadNotes>(defaultUploadNotes);
  const [editableParsed, setEditableParsed] = useState<EditableParsed>(defaultEditableParsed);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(defaultConfirmDialogState);

  const buildManualResumePatch = useCallback((): ResumeUpdate => {
    const patch: ResumeUpdate = { department: "" };
    if (uploadNotes.interview_date.trim()) patch.interview_date = uploadNotes.interview_date.trim();
    if (uploadNotes.department.trim()) {
      // "其他:部门名" 只保存冒号后的部门名
      const dept = uploadNotes.department.startsWith("其他:")
        ? uploadNotes.department.replace("其他:", "").trim()
        : uploadNotes.department.trim();
      if (dept) patch.department = normalizeResumeText(dept);
    }
    if (uploadNotes.hiring_manager.trim()) patch.hiring_manager = normalizeResumeText(uploadNotes.hiring_manager);
    // 合并职级类型和数字：如 "技术6级"
    const levelType = uploadNotes.job_level_type.trim();
    const levelNumber = uploadNotes.job_level_number.trim();
    if (levelType || levelNumber) {
      patch.job_level = normalizeResumeText(`${levelType}${levelNumber}`);
    }
    if (uploadNotes.status.trim()) patch.status = uploadNotes.status.trim();

    const normalizedComment = normalizeResumeText(uploadNotes.interview_comment);
    if (uploadNotes.priority_focus && normalizedComment) {
      patch.interview_comment = `[高优关注] ${normalizedComment}`;
    } else if (uploadNotes.priority_focus) {
      patch.interview_comment = "[高优关注]";
    } else if (normalizedComment) {
      patch.interview_comment = normalizedComment;
    }

    return patch;
  }, [uploadNotes]);

  const openConfirmDialog = useCallback((resumeId: string | undefined, fileName: string, parsed: ParsedResult | null) => {
    setConfirmDialog({
      open: true,
      resumeId,
      fileName,
      parsed,
    });

    setEditableParsed({
      name: parsed?.name || "",
      position: parsed?.position || "",
      work_history: formatAsList(normalizeWorkHistoryText(parsed?.work_history || "")),
      education: formatAsList(normalizeEducationText(parsed?.education || "")),
    });

    setUploadNotes((prev) => ({
      ...prev,
      // 用人部门只由招聘方在确认页选择，不从文件名或原始简历猜测。
      department: prev.department,
      interview_date: prev.interview_date || parsed?.interview_date || "",
      job_level_type: prev.job_level_type || "",
      job_level_number: prev.job_level_number || "",
      status: prev.status || parsed?.status || "pending",
      interview_comment: prev.interview_comment || parsed?.interview_comment || "",
    }));
  }, []);

  const processFile = useCallback(async (file: File, type: string, itemIndex: number): Promise<boolean> => {
    const update = (patch: Partial<UploadItem>) =>
      setUploadItems((prev) => prev.map((item, idx) => (idx === itemIndex ? { ...item, ...patch } : item)));

    try {
      const existing = await findResumeByFileName(file.name);
      if (type === "xls" || type === "xlsx") {
        update({ status: "extracting", progress: 20, message: "正在解析 Excel..." });
        const rows = await parseExcelRows(file);
        if (rows.length === 0) throw new Error("Excel 中没有可导入的候选人数据");

        let importedCount = 0;
        let updatedCount = 0;
        for (const row of rows) {
          const matchedResume = row.resume_file_name ? await findResumeByFileName(row.resume_file_name) : null;
          if (matchedResume) {
            await updateResume(matchedResume.id, row);
            updatedCount += 1;
          } else {
            await createResume(row);
            importedCount += 1;
          }
        }

        notifyResumesUpdated();
        update({
          status: "success",
          progress: 100,
          message: `Excel 已导入 ${importedCount} 条，更新 ${updatedCount} 条 ✓`,
        });
        toast.success(`Excel 导入完成：新增 ${importedCount} 条，更新 ${updatedCount} 条`);
        return true;
      }

      update({ status: type === "image" ? "uploading" : "extracting", progress: 30, message: existing ? "检测到同名文件，正在重新解析..." : type === "image" ? "正在上传..." : "正在解析文件内容..." });
      const fileUrl = await uploadResumeFile(file);
      if (type === "image") update({ status: "extracting", progress: 55, message: "正在进行本地 OCR 文字识别..." });
      const text = await extractTextFromFile(file, type);
      if (!text || text.trim().length === 0) throw new Error("无法从文件中提取文字内容");
      update({ progress: 80, message: "AI 正在分析简历..." });
      const resp = await extractResumeFromText(text, file.name, fileUrl, false, undefined, existing?.id);
      if (resp.merged && resp.name) {
        notifyResumesUpdated();
        toast.info(`检测到重复简历，已自动合并并更新到 ${resp.name} 所在记录`);
        update({ status: "success", progress: 100, message: "重复简历已自动更新到原记录 ✓" });
        return true;
      }
      openConfirmDialog(resp.data?.id, file.name, toParsedResult(resp.data));
      notifyResumesUpdated();
      update({ status: "success", progress: 100, message: "提取完成，等待确认 ✓" });
      return true;
    } catch (error) {
      update({ status: "error", progress: 0, message: error instanceof Error ? error.message : "处理失败" });
      return true;
    }
  }, [openConfirmDialog]);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const typedFiles = fileArray
      .map((file) => ({ file, type: getResumeFileType(file) }))
      .filter((item): item is { file: File; type: string } => item.type !== null);

    if (typedFiles.length === 0) {
      toast.error("请上传支持的简历格式（图片、PDF、Word、Excel）");
      return;
    }

    const startIndex = uploadItems.length;
    const newItems: UploadItem[] = typedFiles.map(({ file }) => ({
      file,
      status: "uploading",
      progress: 0,
      message: "等待处理...",
    }));
    setUploadItems((prev) => [...prev, ...newItems]);

    for (let index = 0; index < typedFiles.length; index += 1) {
      const { file, type } = typedFiles[index];
      await processFile(file, type, startIndex + index);
    }
  }, [processFile, uploadItems.length]);

  const onDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer.files.length > 0) handleFiles(event.dataTransfer.files);
  };

  const onFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) {
      handleFiles(event.target.files);
      event.target.value = "";
    }
  };

  const updateNotes = <K extends keyof UploadNotes>(key: K, value: UploadNotes[K]) => {
    setUploadNotes((prev) => ({ ...prev, [key]: value }));
  };

  const handleConfirmSave = async () => {
    if (!confirmDialog.resumeId) {
      setConfirmDialog(defaultConfirmDialogState);
      setEditableParsed(defaultEditableParsed);
      return;
    }

    try {
      const patch = buildManualResumePatch();
      if (editableParsed.name.trim()) patch.name = normalizeResumeText(editableParsed.name);
      // 合入用户编辑过的解析字段（保存时去掉列表序号前缀）
      if (editableParsed.position.trim()) {
        // "其他:xxx" 格式只保存冒号后的内容
        const pos = editableParsed.position.startsWith("其他:")
          ? editableParsed.position.replace("其他:", "").trim()
          : editableParsed.position.trim();
        if (pos) patch.position = pos;
      }
      if (editableParsed.work_history.trim()) {
        patch.work_history = editableParsed.work_history.trim()
          .split("\n").map((l) => l.replace(/^\d+\.\s*/, "").trim()).filter(Boolean).join("\n");
      }
      if (editableParsed.education.trim()) {
        patch.education = editableParsed.education.trim()
          .split("\n").map((l) => l.replace(/^\d+\.\s*/, "").trim()).filter(Boolean).join("\n");
      }

      if (Object.keys(patch).length > 0) {
        await updateResume(confirmDialog.resumeId, patch);
      }
      notifyResumesUpdated();
      toast.success("已确认并补充简历信息");
      setConfirmDialog(defaultConfirmDialogState);
      setUploadNotes(defaultUploadNotes);
      setEditableParsed(defaultEditableParsed);
    } catch {
      toast.error("确认信息保存失败");
    }
  };

  const hasSuccess = uploadItems.some((item) => item.status === "success");

  return (
    <div className="relative mx-auto max-w-7xl space-y-5 px-4 py-4 md:px-6 md:py-6 animate-fade-in">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="aurora-blob -top-24 left-10 h-60 w-60 bg-sky-300/25" />
        <div className="aurora-blob right-8 top-12 h-72 w-72 bg-emerald-300/20 [animation-delay:1.5s]" />
      </div>

      <div className="glass-panel-strong premium-ring rounded-[1.75rem] px-5 py-4 md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-lg shadow-cyan-500/25">
              <Sparkles className="h-6 w-6 text-slate-700" />
            </div>
            <div>
              <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-cyan-200/70 bg-cyan-50/70 px-2.5 py-1 text-[11px] font-semibold text-cyan-700">
                AI Resume Intelligence
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">简历上传</h1>
              <p className="text-sm text-muted-foreground">轻量上传区 + AI 自动识别 + 批量导入</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[24rem]">
            {FILE_FORMAT_LABELS.map((format) => (
              <div key={format.label} className="rounded-2xl border border-white/70 bg-white/70 px-3 py-2 shadow-sm backdrop-blur-xl">
                <p className="text-sm font-bold text-foreground">{format.label}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{format.types}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => document.getElementById("file-input")?.click()}
          className={cn(
            "premium-ring interactive-lift relative cursor-pointer overflow-hidden rounded-[1.75rem] border border-white/60 p-5 transition-all duration-300 md:p-6",
            "min-h-[13.5rem] bg-white/60 shadow-card backdrop-blur-2xl",
            isDragging ? "scale-[1.01] bg-cyan-50/80 shadow-hover" : "hover:bg-white/80"
          )}
        >
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -left-16 -top-20 h-52 w-52 rounded-full bg-sky-300/25 blur-3xl" />
            <div className="absolute -bottom-24 right-8 h-56 w-56 rounded-full bg-emerald-300/25 blur-3xl" />
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent" />
          </div>

          <div className="relative z-10 grid h-full gap-5 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
            <div
              className={cn(
                "flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-primary shadow-xl shadow-cyan-500/25 transition-all duration-300 md:h-20 md:w-20",
                isDragging && "scale-110 rotate-3"
              )}
            >
              <Upload className="h-8 w-8 text-slate-700" />
            </div>

            <div className="min-w-0 text-left">
              <p className="text-xl font-bold tracking-tight text-foreground md:text-2xl">
                {isDragging ? "松开文件，开始智能解析" : "拖拽或点击上传简历"}
              </p>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                先上传文件，系统完成解析后会弹出确认窗口，在那里统一核对解析结果并补充备注信息。
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-700 ring-1 ring-cyan-200/70">AI 提取</span>
                <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700 ring-1 ring-teal-200/70">确认后入库</span>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200/70">批量处理</span>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => document.getElementById("file-input")?.click()}
              className="rounded-2xl bg-gradient-primary px-6 text-slate-700 shadow-lg shadow-cyan-500/25 hover:shadow-xl hover:shadow-cyan-500/30"
            >
              选择文件
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          <input
            id="file-input"
            type="file"
            accept={RESUME_FILE_ACCEPT}
            multiple
            className="hidden"
            onChange={onFileInput}
          />
        </div>
      </div>

      {uploadItems.length > 0 && (
        <div className="glass-panel-strong rounded-[1.75rem] overflow-hidden">
          <div className="px-5 py-4 border-b border-cyan-100/70 flex items-center justify-between">
            <h2 className="font-semibold text-foreground">处理进度</h2>
            <span className="rounded-full bg-white/75 px-2.5 py-1 text-xs text-muted-foreground">
              {uploadItems.filter((item) => item.status === "success").length} / {uploadItems.length} 完成
            </span>
          </div>
          <div className="divide-y divide-cyan-100/60">
            {uploadItems.map((item, index) => (
              <div key={index} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-white/45">
                <div className={cn(
                  "h-9 w-9 rounded-2xl flex items-center justify-center shrink-0 border",
                  item.status === "success" ? "bg-emerald-50 border-emerald-200" :
                    item.status === "error" ? "bg-red-50 border-red-200" :
                      "bg-cyan-50 border-cyan-200"
                )}>
                  {item.status === "success" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                  {item.status === "error" && <AlertCircle className="h-4 w-4 text-red-500" />}
                  {(item.status === "uploading" || item.status === "extracting") && (
                    <Loader2 className="h-4 w-4 text-cyan-500 animate-spin" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="mb-1 min-w-0">
                    <p className="truncate text-sm font-medium text-foreground" title={item.file.name}>{item.file.name}</p>
                    <p className={cn(
                      "mt-0.5 break-words text-xs",
                      item.status === "success" ? "text-emerald-600" :
                        item.status === "error" ? "text-red-500" : "text-muted-foreground"
                    )}>{item.message}</p>
                  </div>
                  {(item.status === "uploading" || item.status === "extracting") && (
                    <div className="relative h-1.5 rounded-full bg-cyan-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-primary transition-all duration-500"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}
                  {item.status === "success" && (
                    <div className="h-1.5 rounded-full bg-emerald-100 overflow-hidden">
                      <div className="h-full w-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-400" />
                    </div>
                  )}
                  {item.status === "error" && <div className="h-1.5 rounded-full bg-red-100" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasSuccess && (
        <div className="flex justify-center">
          <Button
            onClick={() => document.getElementById("manage-section")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            size="lg"
            className="rounded-2xl bg-gradient-primary px-8 text-slate-700 shadow-lg shadow-cyan-500/25 hover:shadow-xl hover:shadow-cyan-500/30"
          >
            查看简历管理表
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}

      <Dialog open={confirmDialog.open} onOpenChange={(open) => { if (!open) { setConfirmDialog(defaultConfirmDialogState); setEditableParsed(defaultEditableParsed); } }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-5xl bg-white/95 backdrop-blur-xl border border-cyan-100/70">
          <DialogHeader>
            <DialogTitle>确认解析结果</DialogTitle>
            <DialogDescription>核对 AI 解析内容，并补充备注信息后再完成本次入库。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_24rem]">
            <div className="glass-panel rounded-[1.5rem] p-4 space-y-3">
              <div className="text-sm font-semibold text-foreground">解析结果</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-cyan-100/70 bg-white/75 p-3 sm:col-span-2">
                  <div className="text-xs font-semibold text-muted-foreground">文件名</div>
                  <div className="mt-1 text-sm text-foreground break-words">{confirmDialog.fileName || "-"}</div>
                </div>
                <div className="rounded-2xl border border-cyan-100/70 bg-white/75 p-3 sm:col-span-2">
                  <div className="text-xs font-semibold text-muted-foreground">姓名</div>
                  <Input
                    value={editableParsed.name}
                    onChange={(e) => setEditableParsed((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="核对或填写候选人姓名"
                    className="mt-1 h-9 rounded-xl bg-white/80 text-sm"
                  />
                </div>
                <div className="rounded-2xl border border-cyan-100/70 bg-white/75 p-3 sm:col-span-2">
                  <div className="text-xs font-semibold text-muted-foreground">工作履历</div>
                  <Textarea
                    value={editableParsed.work_history}
                    onChange={(e) => setEditableParsed((prev) => ({ ...prev, work_history: e.target.value }))}
                    placeholder="AI 解析的工作履历"
                    className="mt-1 min-h-[8rem] rounded-xl bg-white/80 text-sm"
                  />
                </div>
                <div className="rounded-2xl border border-cyan-100/70 bg-white/75 p-3 sm:col-span-2">
                  <div className="text-xs font-semibold text-muted-foreground">学历</div>
                  <Textarea
                    value={editableParsed.education}
                    onChange={(e) => setEditableParsed((prev) => ({ ...prev, education: e.target.value }))}
                    placeholder="AI 解析的学历"
                    className="mt-1 min-h-[5rem] rounded-xl bg-white/80 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-[1.5rem] p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">补充备注</h2>
                  <p className="text-xs text-muted-foreground">确认后一起写入当前简历记录。</p>
                </div>
                <span className="rounded-full bg-white/75 px-2.5 py-1 text-[11px] font-medium text-muted-foreground ring-1 ring-cyan-200/60">Optional</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">面试时间</label>
                  <Input
                    type="date"
                    value={uploadNotes.interview_date}
                    onChange={(event) => updateNotes("interview_date", event.target.value)}
                    className="h-9 rounded-xl bg-white/80 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">用人经理</label>
                  <Input
                    value={uploadNotes.hiring_manager}
                    onChange={(event) => updateNotes("hiring_manager", event.target.value)}
                    placeholder="用人经理姓名"
                    className="h-9 rounded-xl bg-white/80 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">职级</label>
                <div className="grid grid-cols-[1fr_1fr] gap-2">
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { label: "技术", value: "技术" },
                      { label: "产品", value: "产品" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => updateNotes("job_level_type", uploadNotes.job_level_type === opt.value ? "" : opt.value)}
                        className={cn(
                          "rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all",
                          uploadNotes.job_level_type === opt.value
                            ? "border-cyan-400 bg-cyan-50 text-cyan-700"
                            : "border-cyan-100 bg-white/70 text-muted-foreground hover:bg-white"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div>
                    <Input
                      type="number"
                      value={uploadNotes.job_level_number}
                      onChange={(event) => updateNotes("job_level_number", event.target.value)}
                      placeholder="输入数字"
                      className="h-9 rounded-xl bg-white/80 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">用人部门</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "MaaS", tone: "border-sky-300 bg-sky-50 text-sky-700" },
                    { label: "DuMate", tone: "border-blue-300 bg-blue-50 text-blue-700" },
                    { label: "千帆策略部", tone: "border-violet-300 bg-violet-50 text-violet-700" },
                    { label: "秒哒产品部", tone: "border-emerald-300 bg-emerald-50 text-emerald-700" },
                    { label: "伐谋产品部", tone: "border-amber-300 bg-amber-50 text-amber-700" },
                    { label: "其他", tone: "border-slate-300 bg-slate-50 text-slate-700" },
                  ].map((dept) => {
                    const isActive = dept.label === "其他"
                      ? uploadNotes.department === "其他" || uploadNotes.department.startsWith("其他:")
                      : uploadNotes.department === dept.label;
                    return (
                      <button
                        key={dept.label}
                        type="button"
                        onClick={() => {
                          if (dept.label === "其他") {
                            updateNotes("department", "其他:");
                          } else {
                            updateNotes("department", dept.label);
                          }
                        }}
                        className={cn(
                          "rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all",
                          isActive
                            ? dept.tone
                            : "border-cyan-100 bg-white/70 text-muted-foreground hover:bg-white"
                        )}
                      >
                        {dept.label}
                      </button>
                    );
                  })}
                </div>
                {(uploadNotes.department === "其他:" || uploadNotes.department.startsWith("其他:")) && (
                  <Input
                    value={uploadNotes.department.replace("其他:", "")}
                    onChange={(event) => updateNotes("department", `其他:${event.target.value}`)}
                    placeholder="请输入部门名称"
                    className="mt-2 h-8 rounded-xl bg-white/80 text-sm"
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">职位</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "产品", value: "产品" },
                    { label: "工程", value: "工程" },
                    { label: "算法", value: "算法" },
                    { label: "运营", value: "运营" },
                    { label: "生态", value: "生态" },
                    { label: "其他", value: "其他" },
                  ].map((opt) => {
                    const isActive = opt.value === "其他"
                      ? editableParsed.position.startsWith("其他:")
                      : editableParsed.position === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          if (opt.value === "其他") {
                            setEditableParsed((prev) => ({ ...prev, position: "其他:" }));
                          } else {
                            setEditableParsed((prev) => ({ ...prev, position: opt.value }));
                          }
                        }}
                        className={cn(
                          "rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all",
                          isActive
                            ? "border-cyan-400 bg-cyan-50 text-cyan-700"
                            : "border-cyan-100 bg-white/70 text-muted-foreground hover:bg-white"
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                {editableParsed.position.startsWith("其他:") && (
                  <Input
                    value={editableParsed.position.replace("其他:", "")}
                    onChange={(e) => setEditableParsed((prev) => ({ ...prev, position: `其他:${e.target.value}` }))}
                    placeholder="请输入职位名称"
                    className="mt-2 h-8 rounded-xl bg-white/80 text-sm"
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">状态</label>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateNotes("status", option.value)}
                      className={cn(
                        "rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all",
                        uploadNotes.status === option.value
                          ? option.chipTone
                          : "border-cyan-100 bg-white/70 text-muted-foreground hover:bg-white"
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">面评</label>
                <Textarea
                  value={uploadNotes.interview_comment}
                  onChange={(event) => updateNotes("interview_comment", event.target.value)}
                  placeholder="补充重点判断、风险点或推荐原因"
                  className="min-h-[5.5rem] resize-none rounded-xl bg-white/80 text-sm"
                />
              </div>

              <Button
                type="button"
                variant={uploadNotes.priority_focus ? "default" : "outline"}
                onClick={() => updateNotes("priority_focus", !uploadNotes.priority_focus)}
                className={cn(
                  "w-full rounded-xl text-sm",
                  uploadNotes.priority_focus
                    ? "border-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white"
                    : "border-cyan-100 bg-white/70 hover:bg-white"
                )}
              >
                <Star className={cn("h-4 w-4 mr-2", uploadNotes.priority_focus && "fill-current")} />
                {uploadNotes.priority_focus ? "已标记高优关注" : "标记高优关注"}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleConfirmSave} className="bg-gradient-primary text-slate-700 border-0">确认并保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
