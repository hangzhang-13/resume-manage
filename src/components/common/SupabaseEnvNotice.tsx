import { SUPABASE_ENV_ERROR_MESSAGE } from "@/db/supabase";

export default function SupabaseEnvNotice() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="aurora-blob left-[12%] top-[6%] h-72 w-72 bg-sky-300/20" />
        <div className="aurora-blob right-[8%] top-[18%] h-96 w-96 bg-teal-300/20 [animation-delay:1.2s]" />
        <div className="aurora-blob bottom-[10%] left-[36%] h-80 w-80 bg-emerald-300/15 [animation-delay:2.4s]" />
      </div>

      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-6 py-12">
        <section className="w-full rounded-[28px] border border-white/70 bg-white/80 p-8 shadow-[0_24px_80px_rgba(15,118,110,0.12)] backdrop-blur-xl">
          <p className="mb-3 text-sm font-semibold text-teal-700">Supabase 配置缺失</p>
          <h1 className="mb-4 text-2xl font-bold text-slate-950">应用暂时无法连接数据库</h1>
          <p className="text-base leading-7 text-slate-700">{SUPABASE_ENV_ERROR_MESSAGE}</p>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm text-slate-700">
            <div>VITE_SUPABASE_URL=</div>
            <div>VITE_SUPABASE_ANON_KEY=</div>
          </div>
          <p className="mt-5 text-sm leading-6 text-slate-500">
            添加环境变量后，请重新触发 Vercel 部署。
          </p>
        </section>
      </main>
    </div>
  );
}
