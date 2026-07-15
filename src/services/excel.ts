import { saveAs } from "file-saver";
import type { Resume } from "@/types/types";
import { RESUME_COLUMNS } from "@/types/types";
import { normalizeResumeText } from "@/lib/resume-text";
import { extractCompetitorTags } from "@/lib/resume-competitors";

export async function exportToExcel(resumes: Resume[], filename = "面试简历管理表") {
  const { default: ExcelJS } = await import("exceljs");
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

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("简历管理");
  worksheet.columns = RESUME_COLUMNS.map((column) => ({ width: column.excelWidth }));
  worksheet.addRow(headers);
  rows.forEach((row) => worksheet.addRow(row));
  const workbookData = await workbook.xlsx.writeBuffer();
  const blob = new Blob([workbookData], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, `${filename}.xlsx`);
}
