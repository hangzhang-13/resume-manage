export const STATUS_OPTIONS = [
  {
    value: "面试中",
    label: "面试中",
    chipTone: "bg-sky-100 text-sky-700 border-sky-200",
    rowTone: "bg-sky-50/70 hover:from-sky-100/70 hover:to-sky-50/40",
  },
  {
    value: "pending",
    label: "pending",
    chipTone: "bg-amber-100 text-amber-700 border-amber-200",
    rowTone: "bg-amber-50/70 hover:from-amber-100/70 hover:to-amber-50/40",
  },
  {
    value: "offer中",
    label: "offer 中",
    chipTone: "bg-violet-100 text-violet-700 border-violet-200",
    rowTone: "bg-violet-50/70 hover:from-violet-100/70 hover:to-violet-50/40",
  },
  {
    value: "待入职",
    label: "待入职",
    chipTone: "bg-blue-100 text-blue-700 border-blue-200",
    rowTone: "bg-blue-50/70 hover:from-blue-100/70 hover:to-blue-50/40",
  },
  {
    value: "已入职",
    label: "已入职",
    chipTone: "bg-emerald-100 text-emerald-700 border-emerald-200",
    rowTone: "bg-emerald-50/70 hover:from-emerald-100/70 hover:to-emerald-50/40",
  },
  {
    value: "fail",
    label: "fail",
    chipTone: "bg-slate-100 text-slate-700 border-slate-200",
    rowTone: "bg-slate-100/70 hover:from-slate-200/70 hover:to-slate-100/40",
  },
] as const;

export function getResumeStatusStyle(status?: string) {
  return STATUS_OPTIONS.find((option) => option.value === status);
}
