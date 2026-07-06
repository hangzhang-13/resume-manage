-- 创建简历信息表
CREATE TABLE public.resumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_date text,
  department text,
  name text NOT NULL,
  status text,
  nature text,
  position text,
  age_experience text,
  job_level text,
  work_history text,
  education text,
  interview_comment text,
  resume_file_url text,
  resume_file_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 启用 RLS
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;

-- 仅允许登录用户访问简历数据
CREATE POLICY "authenticated_select_resumes" ON public.resumes FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_resumes" ON public.resumes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update_resumes" ON public.resumes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_delete_resumes" ON public.resumes FOR DELETE TO authenticated USING (true);

-- 创建存储桶用于简历文件
INSERT INTO storage.buckets (id, name, public) VALUES ('resumes', 'resumes', false);

-- 存储桶策略：登录用户可上传/读取，删除通过服务端或管理员执行
CREATE POLICY "authenticated_upload_resumes" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'resumes');
CREATE POLICY "authenticated_select_resumes_storage" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'resumes');

-- 更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER resumes_updated_at
  BEFORE UPDATE ON public.resumes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
