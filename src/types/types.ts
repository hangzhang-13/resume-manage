export interface Resume {
  id: string;
  interview_date: string;
  department: string;
  hiring_manager: string;
  name: string;
  status: string;
  priority_note?: string;
  nature: string;
  position: string;
  age_experience: string;
  job_level: string;
  work_history: string;
  education: string;
  interview_comment: string;
  resume_file_url: string;
  resume_file_name: string;
  created_at: string;
  updated_at: string;
}

export interface ResumeInsert {
  interview_date?: string;
  department?: string;
  hiring_manager?: string;
  name: string;
  status?: string;
  priority_note?: string;
  nature?: string;
  position?: string;
  age_experience?: string;
  job_level?: string;
  work_history?: string;
  education?: string;
  interview_comment?: string;
  resume_file_url?: string;
  resume_file_name?: string;
}

export interface ResumeUpdate {
  interview_date?: string;
  department?: string;
  hiring_manager?: string;
  name?: string;
  status?: string;
  priority_note?: string;
  nature?: string;
  position?: string;
  age_experience?: string;
  job_level?: string;
  work_history?: string;
  education?: string;
  interview_comment?: string;
}

// 表格列定义
export const RESUME_COLUMNS = [
  { key: "interview_date", label: "面试时间", width: "7rem", excelWidth: 14 },
  { key: "department", label: "用人部门", width: "8rem", excelWidth: 16 },
  { key: "hiring_manager", label: "用人经理", width: "6.5rem", excelWidth: 12 },
  { key: "position", label: "职位", width: "8.5rem", excelWidth: 18 },
  { key: "name", label: "姓名", width: "5.5rem", excelWidth: 10 },
  { key: "priority_flag", label: "高优", width: "5rem", excelWidth: 10 },
  { key: "competitor_tags", label: "竞品情况", width: "10rem", excelWidth: 20 },
  { key: "status", label: "状态", width: "6.5rem", excelWidth: 12 },
  { key: "nature", label: "性质", width: "5.5rem", excelWidth: 10 },
  { key: "age_experience", label: "年龄/工作经验", width: "8.5rem", excelWidth: 16 },
  { key: "job_level", label: "职级", width: "5.5rem", excelWidth: 10 },
  { key: "work_history", label: "工作履历", width: "14rem", excelWidth: 30 },
  { key: "education", label: "学历", width: "10rem", excelWidth: 22 },
  { key: "interview_comment", label: "面评", width: "12rem", excelWidth: 28 },
  { key: "resume_file_name", label: "简历", width: "10rem", excelWidth: 20 },
] as const;
