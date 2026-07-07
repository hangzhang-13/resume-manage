import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import type { Resume } from "@/types/types";
import { RESUME_COLUMNS } from "@/types/types";
import { normalizeResumeText } from "@/lib/resume-text";
import { extractCompetitorTags } from "@/lib/resume-competitors";

export function exportToExcel(resumes: Resume[], filename = "面试简历管理表") {
  const headers = RESUME_COLUMNS.map((col) => col.label);

  const rows = resumes.map((r) =>
    RESUME_COLUMNS.map((col) => {
      if (col.key === "resume_file_name") {
        return r.resume_file_name || "";
      }
      if (col.key === "priority_flag") {
        return normalizeResumeText(r.interview_comment || "").startsWith("[高优关注]") ? "高优" : "";
      }
      if (col.key === "competitor_tags") {
        return extractCompetitorTags(r.work_history).map((tag) => tag.label).join(" / ");
      }
      return (r as unknown as Record<string, unknown>)[col.key] as string || "";
    })
  );

  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // 设置列宽
  ws["!cols"] = RESUME_COLUMNS.map((col) => ({
    wch: col.excelWidth,
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "简历管理");

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/octet-stream" });
  saveAs(blob, `${filename}.xlsx`);
}
