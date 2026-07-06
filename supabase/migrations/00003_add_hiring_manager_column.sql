-- 新增用人经理列
ALTER TABLE public.resumes ADD COLUMN IF NOT EXISTS hiring_manager text;
