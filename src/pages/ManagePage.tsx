import React, { useEffect, useMemo, useState, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Download, Trash2, FileText, Loader2, RefreshCw, Upload, Users, Award, TrendingUp, UserCheck, UserPlus, Star, Search, X, Plus, Flame, Clock } from "lucide-react";
import { createResume, fetchResumes, updateResume, deleteResume, uploadResumeFile, updateResumeFileUrl, getResumeFileDownloadUrl } from "@/services/api";
import { exportToExcel } from "@/services/excel";
import { RESUME_COLUMNS } from "@/types/types";
import type { Resume, ResumeInsert } from "@/types/types";
import { cn } from "@/lib/utils";
import { isSupportedResumeFile, RESUME_FILE_ACCEPT } from "@/lib/resume-files";
import { RESUMES_UPDATED_EVENT, notifyResumesUpdated } from "@/lib/resume-events";
import { normalizeEducationText, normalizeResumeText, normalizeWorkHistoryText } from "@/lib/resume-text";
import { getResumeStatusStyle, STATUS_OPTIONS } from "@/lib/resume-status";
import { extractCompetitorTags, getCompetitorStyle } from "@/lib/resume-competitors";

const defaultCandidateForm: ResumeInsert = {
  interview_date: "",
  department: "",
  hiring_manager: "",
  name: "",
  status: "pending",
  nature: "",
  position: "",
  age_experience: "",
  job_level: "",
  work_history: "",
  education: "",
  interview_comment: "",
  resume_file_name: "",
};

export default function ManagePage() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState<{ id: string; key: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState(false);
  const [competitorFilter, setCompetitorFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [candidateForm, setCandidateForm] = useState<ResumeInsert>(defaultCandidateForm);
  const [creating, setCreating] = useState(false);

  const loadResumes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchResumes();
      setResumes(data);
    } catch {
      toast.error("加载简历数据失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadResumes();
  }, [loadResumes]);

  useEffect(() => {
    const handleResumesUpdated = () => {
      loadResumes();
    };

    window.addEventListener(RESUMES_UPDATED_EVENT, handleResumesUpdated);
    return () => {
      window.removeEventListener(RESUMES_UPDATED_EVENT, handleResumesUpdated);
    };
  }, [loadResumes]);

  const handleCellClick = (id: string, key: string, value: string) => {
    if (key === "resume_file_name" || key === "competitor_tags" || key === "priority_flag") return;
    setEditingCell({ id, key });
    // 工作履历和学历进入编辑时，使用格式化后的带序号文本
    if (key === "work_history") {
      const lines = normalizeWorkHistoryText(value || "").split("\n").filter(Boolean);
      setEditValue(lines.length > 1 ? lines.map((l, i) => `${i + 1}. ${l}`).join("\n") : (value || ""));
    } else if (key === "education") {
      const lines = normalizeEducationText(value || "").split("\n").filter(Boolean);
      setEditValue(lines.length > 1 ? lines.map((l, i) => `${i + 1}. ${l}`).join("\n") : (value || ""));
    } else {
      setEditValue(value || "");
    }
  };

  const handleCellBlur = async () => {
    if (!editingCell) return;
    const { id, key } = editingCell;
    const original = resumes.find((resume) => resume.id === id);
    if (!original) {
      setEditingCell(null);
      return;
    }

    // 保存时去掉序号前缀（如 "1. xxx\n2. xxx" → "xxx\nxxx"）
    let saveValue = editValue;
    if (key === "work_history" || key === "education") {
      saveValue = editValue
        .split("\n")
        .map((l) => l.replace(/^\d+\.\s*/, "").trim())
        .filter(Boolean)
        .join("\n");
    }

    const originalValue = ((original as unknown as Record<string, unknown>)[key] as string) || "";
    if (saveValue === originalValue) {
      setEditingCell(null);
      return;
    }

    setSaving(true);
    try {
      await updateResume(id, { [key]: saveValue });
      setResumes((prev) => prev.map((resume) => (resume.id === id ? { ...resume, [key]: saveValue } : resume)));
      toast.success("已保存");
    } catch {
      toast.error("保存失败");
    } finally {
      setSaving(false);
      setEditingCell(null);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent, allowMultiline = false) => {
    if (event.key === "Enter" && !allowMultiline) handleCellBlur();
    else if (event.key === "Escape") setEditingCell(null);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteResume(id);
      setResumes((prev) => prev.filter((resume) => resume.id !== id));
      notifyResumesUpdated();
      toast.success("已删除");
    } catch {
      toast.error("删除失败");
    }
  };

  const updateCandidateForm = <K extends keyof ResumeInsert>(key: K, value: ResumeInsert[K]) => {
    setCandidateForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleCreateCandidate = async () => {
    const normalizedName = normalizeResumeText(candidateForm.name || "");
    if (!normalizedName) {
      toast.error("请填写候选人姓名");
      return;
    }

    setCreating(true);
    try {
      await createResume({
        ...candidateForm,
        name: normalizedName,
        interview_date: normalizeResumeText(candidateForm.interview_date || ""),
        department: normalizeResumeText(candidateForm.department || ""),
        hiring_manager: normalizeResumeText(candidateForm.hiring_manager || ""),
        status: normalizeResumeText(candidateForm.status || ""),
        nature: normalizeResumeText(candidateForm.nature || ""),
        position: normalizeResumeText(candidateForm.position || ""),
        age_experience: normalizeResumeText(candidateForm.age_experience || ""),
        job_level: normalizeResumeText(candidateForm.job_level || ""),
        work_history: normalizeWorkHistoryText(candidateForm.work_history || ""),
        education: normalizeEducationText(candidateForm.education || ""),
        interview_comment: normalizeResumeText(candidateForm.interview_comment || ""),
        resume_file_name: normalizeResumeText(candidateForm.resume_file_name || ""),
      });
      setCandidateForm(defaultCandidateForm);
      setCreateDialogOpen(false);
      notifyResumesUpdated();
      toast.success("候选人已新增");
    } catch {
      toast.error("新增候选人失败");
    } finally {
      setCreating(false);
    }
  };

  const handleUploadFile = async (id: string, file: File) => {
    if (!isSupportedResumeFile(file)) {
      toast.error("请上传支持的简历格式（图片、PDF、Word、Excel、HTML）");
      return;
    }

    try {
      toast.info("正在上传附件...");
      const fileReference = await uploadResumeFile(file);
      await updateResumeFileUrl(id, fileReference, file.name);
      const fileUrl = await getResumeFileDownloadUrl(fileReference);
      setResumes((prev) =>
        prev.map((resume) =>
          resume.id === id ? { ...resume, resume_file_url: fileUrl, resume_file_name: file.name } : resume
        )
      );
      notifyResumesUpdated();
      toast.success("附件上传成功");
    } catch {
      toast.error("附件上传失败");
    }
  };

  const handleExport = () => {
    if (resumes.length === 0) {
      toast.error("暂无数据可导出");
      return;
    }
    exportToExcel(resumes);
    toast.success("导出成功");
  };

  const renderMultiLine = (text: string, numbered = false) => {
    if (!text) return <span className="text-muted-foreground">-</span>;
    const normalizedText = normalizeResumeText(text);
    const lines = normalizedText.split(/\n|\r\n/).filter(Boolean);
    if (lines.length <= 1) return <span className="whitespace-normal break-words">{normalizedText}</span>;
    return (
      <div className="flex flex-col gap-1">
        {lines.map((line, index) => (
          <span key={index} className="inline-block whitespace-normal break-words">
            {numbered ? `${index + 1}. ${line}` : line}
          </span>
        ))}
      </div>
    );
  };

  const formatInterviewDate = (value: string) => {
    const normalizedValue = normalizeResumeText(value || "");
    const dateMatch = normalizedValue.match(/^\d{4}-\d{2}-\d{2}/);
    if (dateMatch) return dateMatch[0];
    return normalizedValue;
  };

  const isPriorityResume = (resume: Resume) =>
    normalizeResumeText(resume.interview_comment || "").startsWith("[高优关注]");

  const getCompetitorTags = useCallback((resume: Resume) => extractCompetitorTags(resume.work_history), []);

  const statusCounts = useMemo(
    () => ({
      pending: resumes.filter((resume) => resume.status === "pending").length,
      interviewing: resumes.filter((resume) => resume.status === "面试中").length,
      offering: resumes.filter((resume) => resume.status === "offer中").length,
      waitingOnboard: resumes.filter((resume) => resume.status === "待入职").length,
      onboarded: resumes.filter((resume) => resume.status === "已入职").length,
      failed: resumes.filter((resume) => resume.status === "fail").length,
      priority: resumes.filter((resume) => normalizeResumeText(resume.interview_comment || "").startsWith("[高优关注]")).length,
    }),
    [resumes]
  );

  const competitorStats = useMemo(() => {
    const counts = resumes.reduce<Record<string, number>>((accumulator, resume) => {
      getCompetitorTags(resume).forEach((tag) => {
        accumulator[tag.label] = (accumulator[tag.label] || 0) + 1;
      });
      return accumulator;
    }, {});

    return Object.entries(counts)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8);
  }, [getCompetitorTags, resumes]);

  const filteredResumes = useMemo(() => {
    const normalizedQuery = normalizeResumeText(searchQuery).toLowerCase();

    return resumes.filter((resume) => {
      if (statusFilter && resume.status !== statusFilter) return false;

      if (priorityFilter && !normalizeResumeText(resume.interview_comment || "").startsWith("[高优关注]")) return false;

      const competitorTags = getCompetitorTags(resume);
      if (competitorFilter && !competitorTags.some((tag) => tag.label === competitorFilter)) return false;

      if (!normalizedQuery) return true;

      const searchableText = [
        resume.name,
        resume.department,
        resume.hiring_manager,
        resume.position,
        resume.work_history,
        resume.education,
        resume.interview_comment,
        resume.resume_file_name,
        resume.status,
      ]
        .map((value) => normalizeResumeText(value || "").toLowerCase())
        .join("\n");

      return searchableText.includes(normalizedQuery);
    });
  }, [competitorFilter, getCompetitorTags, priorityFilter, resumes, searchQuery, statusFilter]);

  const isMultiLineCol = (key: string) =>
    key === "competitor_tags" ||
    key === "work_history" ||
    key === "education" ||
    key === "department" ||
    key === "position" ||
    key === "interview_comment";

  const togglePriority = async (resume: Resume) => {
    const currentComment = normalizeResumeText(resume.interview_comment || "");
    const nextPriority = !isPriorityResume(resume);
    const nextComment = nextPriority
      ? currentComment
        ? `[高优关注] ${currentComment.replace(/^\[高优关注\]\s*/, "")}`
        : "[高优关注]"
      : currentComment.replace(/^\[高优关注\]\s*/, "");

    try {
      await updateResume(resume.id, { interview_comment: nextComment });
      setResumes((prev) =>
        prev.map((item) => (item.id === resume.id ? { ...item, interview_comment: nextComment } : item))
      );
      toast.success(nextPriority ? "已标记高优关注" : "已取消高优关注");
    } catch {
      toast.error("高优标记更新失败");
    }
  };

  const stats = [
    { label: "简历总数", value: resumes.length, icon: Users, bg: "from-sky-200/95 via-white to-emerald-100/90", text: "text-black", sub: "text-black", valueKey: null, filterType: "status" as const },
    { label: "高优关注", value: statusCounts.priority, icon: Flame, bg: "from-red-200/95 to-orange-100/90", text: "text-black", sub: "text-black", valueKey: "priority", filterType: "priority" as const },
    { label: "面试中", value: statusCounts.interviewing, icon: TrendingUp, bg: "from-sky-200/95 to-cyan-100/90", text: "text-black", sub: "text-black", valueKey: "面试中", filterType: "status" as const },
    { label: "Pending", value: statusCounts.pending, icon: Loader2, bg: "from-amber-200/95 to-orange-100/90", text: "text-black", sub: "text-black", valueKey: "pending", filterType: "status" as const },
    { label: "Offer 中", value: statusCounts.offering, icon: Award, bg: "from-violet-200/95 to-fuchsia-100/90", text: "text-black", sub: "text-black", valueKey: "offer中", filterType: "status" as const },
    { label: "待入职", value: statusCounts.waitingOnboard, icon: Clock, bg: "from-blue-200/95 to-indigo-100/90", text: "text-black", sub: "text-black", valueKey: "待入职", filterType: "status" as const },
    { label: "已入职", value: statusCounts.onboarded, icon: UserCheck, bg: "from-emerald-200/95 to-teal-100/90", text: "text-black", sub: "text-black", valueKey: "已入职", filterType: "status" as const },
    { label: "Fail", value: statusCounts.failed, icon: UserPlus, bg: "from-slate-200/95 to-slate-100/90", text: "text-black", sub: "text-black", valueKey: "fail", filterType: "status" as const },
  ];

  return (
    <div className="relative min-h-full space-y-5 px-4 py-4 md:px-6 md:py-6 animate-fade-in">
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="glass-panel premium-ring rounded-[1.75rem] p-5 xl:min-h-[20rem]">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-foreground">状态看板</h2>
            <p className="text-sm text-muted-foreground">点击具体状态，直接筛选下方简历库</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stats.map((stat) => {
              const isActive =
                stat.filterType === "priority"
                  ? priorityFilter
                  : stat.valueKey !== null && statusFilter === stat.valueKey;

              return (
                <button
                  key={stat.label}
                  type="button"
                  onClick={() => {
                    setCompetitorFilter(null);
                    if (stat.filterType === "priority") {
                      setStatusFilter(null);
                      setPriorityFilter((current) => !current);
                    } else {
                      setPriorityFilter(false);
                      setStatusFilter((current) => (current === stat.valueKey ? null : stat.valueKey));
                    }
                  }}
                  className={cn(
                    "interactive-lift rounded-2xl bg-gradient-to-br p-4 shadow-lg text-left transition-all min-h-[6.25rem]",
                    stat.bg,
                    isActive && "ring-[3px] ring-offset-2 ring-offset-white ring-black/70 scale-[1.02] shadow-xl"
                  )}
                >
                  <div className="flex h-full items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={cn("text-sm font-semibold mb-1", stat.sub)}>{stat.label}</p>
                      <p className={cn("text-3xl font-bold leading-none", stat.text)}>{stat.value}</p>
                    </div>
                    <div className="h-10 w-10 shrink-0 rounded-xl bg-white/80 flex items-center justify-center shadow-sm">
                      <stat.icon className="h-5 w-5 text-black" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {competitorStats.length > 0 && (
          <section className="glass-panel premium-ring rounded-[1.75rem] p-5 xl:min-h-[20rem]">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-foreground">竞品看板</h2>
              <p className="text-sm text-muted-foreground">点击竞品标签，筛选有相关互联网背景的候选人</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-3 content-start">
              {competitorStats.map(([label, count]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    setStatusFilter(null);
                    setCompetitorFilter((current) => (current === label ? null : label));
                  }}
                  className={cn(
                    "interactive-lift rounded-xl border px-3 py-3 text-left transition-all min-h-[5rem] text-slate-900",
                    getCompetitorStyle(label)?.tone || "border-cyan-100/70 bg-white/75 text-slate-900",
                    competitorFilter === label && "ring-[3px] ring-offset-2 ring-offset-white ring-black/70 scale-[1.02] shadow-xl"
                  )}
                >
                  <div className="flex h-full flex-col justify-between gap-2">
                    <span className="text-sm font-semibold leading-tight text-black">{label}</span>
                    <span className="text-sm text-black">{count}人</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="glass-panel-strong premium-ring rounded-[1.75rem] px-5 py-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-lg shadow-cyan-500/25">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">简历管理</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              共 {resumes.length} 条记录，点击单元格可编辑
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl bg-gradient-primary text-slate-700 border-0 shadow-lg shadow-cyan-500/20">
                <Plus className="h-4 w-4 mr-1.5" />
                新建候选人
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-3xl bg-white/95 backdrop-blur-xl border border-cyan-100/70">
              <DialogHeader>
                <DialogTitle>新建候选人</DialogTitle>
                <DialogDescription>填写基础信息后，直接同步到简历数据库。</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">姓名</label>
                  <Input value={candidateForm.name || ""} onChange={(event) => updateCandidateForm("name", event.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">面试时间</label>
                  <Input type="date" value={candidateForm.interview_date || ""} onChange={(event) => updateCandidateForm("interview_date", event.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">用人部门</label>
                  <Input value={candidateForm.department || ""} onChange={(event) => updateCandidateForm("department", event.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">用人经理</label>
                  <Input value={candidateForm.hiring_manager || ""} onChange={(event) => updateCandidateForm("hiring_manager", event.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">状态</label>
                  <div className="grid grid-cols-2 gap-2">
                    {STATUS_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateCandidateForm("status", option.value)}
                        className={cn(
                          "rounded-xl border px-3 py-2 text-sm font-medium transition-all",
                          candidateForm.status === option.value
                            ? option.chipTone
                            : "border-cyan-100/70 bg-white/75 text-muted-foreground hover:bg-white"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">性质</label>
                  <Input value={candidateForm.nature || ""} onChange={(event) => updateCandidateForm("nature", event.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">职位</label>
                  <Input value={candidateForm.position || ""} onChange={(event) => updateCandidateForm("position", event.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">年龄/工作经验</label>
                  <Input value={candidateForm.age_experience || ""} onChange={(event) => updateCandidateForm("age_experience", event.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">职级</label>
                  <Input value={candidateForm.job_level || ""} onChange={(event) => updateCandidateForm("job_level", event.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">工作履历</label>
                  <Textarea value={candidateForm.work_history || ""} onChange={(event) => updateCandidateForm("work_history", event.target.value)} className="min-h-[6rem]" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">学历</label>
                  <Textarea value={candidateForm.education || ""} onChange={(event) => updateCandidateForm("education", event.target.value)} className="min-h-[5rem]" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">面评</label>
                  <Textarea value={candidateForm.interview_comment || ""} onChange={(event) => updateCandidateForm("interview_comment", event.target.value)} className="min-h-[6rem]" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={creating}>取消</Button>
                <Button onClick={handleCreateCandidate} disabled={creating} className="bg-gradient-primary text-slate-700 border-0">
                  {creating ? "保存中..." : "保存候选人"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <div className="flex items-center gap-2 rounded-xl border border-cyan-100/70 bg-white/70 px-3 py-2 min-w-[15rem] text-slate-700">
            <Search className="h-4 w-4 text-slate-700 shrink-0" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="查找姓名 / 部门 / 职位 / 简历"
              className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-500"
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery("")} className="text-slate-500 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button
            variant="outline"
            onClick={loadResumes}
            disabled={loading}
            className="bg-white/75 backdrop-blur-2xl border-cyan-100/80 hover:bg-white/95 hover:border-cyan-200/80 rounded-xl"
          >
            <RefreshCw className={cn("h-4 w-4 mr-1.5", loading && "animate-spin")} />
            刷新
          </Button>
          <Button
            onClick={handleExport}
            disabled={resumes.length === 0}
            className="bg-gradient-primary text-slate-700 border-0 shadow-lg shadow-cyan-500/25 hover:shadow-xl hover:shadow-cyan-500/30 transition-all rounded-xl"
          >
            <Download className="h-4 w-4 mr-1.5" />
            导出 Excel
          </Button>
        </div>
      </div>

      <div className="glass-panel-strong rounded-[1.75rem] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
            <span className="ml-2 text-muted-foreground">加载中...</span>
          </div>
        ) : filteredResumes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <div className="h-16 w-16 rounded-2xl bg-cyan-50 flex items-center justify-center mb-4">
              <FileText className="h-8 w-8 text-cyan-500/50" />
            </div>
            <p className="font-medium">暂无匹配结果</p>
            <p className="text-sm mt-1">尝试清空筛选或搜索条件</p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <Table className="table-fixed w-full [&>div]:max-w-full">
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-sky-50/95 via-white to-emerald-50/90 border-b-2 border-sky-100/80 hover:bg-gradient-to-r hover:from-sky-50/95 hover:to-emerald-50/90">
                  {RESUME_COLUMNS.map((col) => (
                    <TableHead
                      key={col.key}
                      className={cn(
                        "font-bold text-foreground/90 text-xs uppercase tracking-wider whitespace-normal break-words",
                        isMultiLineCol(col.key) ? "align-top pt-4" : "whitespace-nowrap"
                      )}
                      style={{ width: col.width, minWidth: col.width }}
                    >
                      {col.label}
                    </TableHead>
                  ))}
                  <TableHead
                    className="whitespace-nowrap font-bold text-foreground/90 text-xs uppercase tracking-wider"
                    style={{ width: "5rem", minWidth: "5rem" }}
                  >
                    操作
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResumes.map((resume, rowIdx) => {
                  const competitorTags = getCompetitorTags(resume);
                  const isPriority = isPriorityResume(resume);

                  return (
                    <TableRow
                      key={resume.id}
                      className={cn(
                        "border-b border-cyan-100/50 transition-all duration-200 group",
                        isPriority && "text-orange-700",
                        getResumeStatusStyle(resume.status)?.rowTone
                          ? `bg-gradient-to-r ${getResumeStatusStyle(resume.status)?.rowTone}`
                          : rowIdx % 2 === 0
                            ? "bg-white/35 hover:bg-gradient-to-r hover:from-sky-50/70 hover:to-emerald-50/60"
                            : "bg-white/15 hover:bg-gradient-to-r hover:from-sky-50/70 hover:to-emerald-50/60"
                      )}
                    >
                      {RESUME_COLUMNS.map((col) => {
                        const value =
                          col.key === "interview_date"
                            ? formatInterviewDate(resume.interview_date || "")
                            : col.key === "resume_file_name"
                              ? normalizeResumeText(resume.resume_file_name || "")
                              : col.key === "priority_flag"
                                ? (isPriority ? "高优" : "")
                                : col.key === "competitor_tags"
                                  ? competitorTags.map((tag) => tag.label).join(" / ")
                                  : normalizeResumeText(((resume as unknown as Record<string, unknown>)[col.key] as string) || "");

                        const isEditing =
                          editingCell?.id === resume.id && editingCell?.key === col.key;

                        if (col.key === "competitor_tags") {
                          return (
                            <TableCell key={col.key} className="align-top">
                              {competitorTags.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {competitorTags.map((tag) => (
                                    <span
                                      key={`${resume.id}-${tag.label}`}
                                      className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium", tag.tone)}
                                    >
                                      {tag.label}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </TableCell>
                          );
                        }

                        if (col.key === "priority_flag") {
                          return (
                            <TableCell key={col.key} className="align-top">
                              <button
                                type="button"
                                onClick={() => togglePriority(resume)}
                                className={cn(
                                  "inline-flex items-center justify-center rounded-full border px-2 py-1 text-xs font-semibold transition-all",
                                  isPriority
                                    ? "border-amber-300 bg-amber-100 text-amber-700"
                                    : "border-cyan-100/70 bg-white/75 text-muted-foreground hover:border-amber-200 hover:text-amber-700"
                                )}
                              >
                                <Star className={cn("h-3.5 w-3.5", isPriority && "fill-current")} />
                              </button>
                            </TableCell>
                          );
                        }

                        if (col.key === "resume_file_name") {
                          return (
                            <TableCell key={col.key} className="align-top">
                              <div className="space-y-2">
                                {isPriority && (
                                  <div className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-700">
                                    <Star className="h-3.5 w-3.5 fill-current" />
                                    高优关注
                                  </div>
                                )}
                                <div>
                                  {resume.resume_file_url ? (
                                    <a
                                      href={resume.resume_file_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-cyan-500 hover:text-secondary hover:underline text-sm font-medium transition-colors whitespace-normal break-words"
                                    >
                                      {value || "查看"}
                                    </a>
                                  ) : value ? (
                                    <span className="text-foreground text-sm font-medium whitespace-normal break-words">{value}</span>
                                  ) : (
                                    <span className="text-muted-foreground text-sm">-</span>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                          );
                        }

                        if (isMultiLineCol(col.key)) {
                          const displayValue =
                            col.key === "education"
                              ? normalizeEducationText(value)
                              : col.key === "work_history"
                                ? normalizeWorkHistoryText(value)
                                : value;
                          return (
                            <TableCell
                              key={col.key}
                              className={cn(
                                "cursor-pointer transition-colors text-sm leading-relaxed align-top",
                                !value && "text-muted-foreground",
                                isEditing && "p-0 bg-primary/5"
                              )}
                              onClick={() => !isEditing && handleCellClick(resume.id, col.key, value)}
                            >
                              {isEditing ? (
                                <textarea
                                  value={editValue}
                                  onChange={(event) => setEditValue(event.target.value)}
                                  onBlur={handleCellBlur}
                                  onKeyDown={(event) => handleKeyDown(event, true)}
                                  autoFocus
                                  rows={4}
                                  className="w-full min-w-[200px] p-3 text-sm bg-white/80 border-0 outline-none focus:ring-2 focus:ring-primary/30 resize-none leading-relaxed"
                                />
                              ) : (
                                renderMultiLine(displayValue, col.key === "work_history" || col.key === "education")
                              )}
                            </TableCell>
                          );
                        }

                        return (
                          <TableCell
                            key={col.key}
                            className={cn(
                              "cursor-pointer transition-colors text-sm align-top",
                              !value && "text-muted-foreground",
                              isEditing && "p-0 bg-primary/5",
                              col.key === "name" || col.key === "status" || col.key === "nature" || col.key === "job_level" || col.key === "interview_date"
                                ? "whitespace-nowrap"
                                : "whitespace-normal break-words"
                            )}
                            onClick={() => !isEditing && handleCellClick(resume.id, col.key, value)}
                          >
                            {isEditing ? (
                              <Input
                                value={editValue}
                                onChange={(event) => setEditValue(event.target.value)}
                                onBlur={handleCellBlur}
                                onKeyDown={handleKeyDown}
                                autoFocus
                                className="h-10 border-0 rounded-none bg-white/80 focus-visible:ring-2 focus-visible:ring-primary/30"
                              />
                            ) : (
                              <span className="whitespace-normal break-words">{value || "-"}</span>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-xl text-cyan-500/70 hover:text-cyan-500 hover:bg-cyan-50 transition-all"
                            onClick={() => document.getElementById(`file-upload-${resume.id}`)?.click()}
                            title="上传/更新附件"
                          >
                            <Upload className="h-4 w-4" />
                          </Button>
                          <input
                            id={`file-upload-${resume.id}`}
                            type="file"
                            accept={RESUME_FILE_ACCEPT}
                            className="hidden"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) handleUploadFile(resume.id, file);
                              event.target.value = "";
                            }}
                          />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-xl text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-all"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg bg-white/90 backdrop-blur-xl border border-cyan-100/70 shadow-2xl">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-foreground">确认删除</AlertDialogTitle>
                                <AlertDialogDescription>
                                  确定要删除 <span className="font-semibold text-cyan-500">{resume.name}</span> 的简历记录吗？此操作不可撤销。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-xl">取消</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(resume.id)}
                                  className="bg-gradient-to-r from-destructive to-red-500 text-white rounded-xl shadow-lg shadow-destructive/30 border-0"
                                >
                                  确认删除
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {saving && (
        <div className="fixed bottom-4 right-4 bg-white/80 backdrop-blur-xl border border-cyan-100/80 rounded-2xl px-5 py-3 shadow-2xl flex items-center gap-2 z-40">
          <Loader2 className="h-4 w-4 animate-spin text-cyan-500" />
          <span className="text-sm text-foreground font-medium">保存中...</span>
        </div>
      )}
    </div>
  );
}
