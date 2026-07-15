import React, { useState } from "react";
import { BriefcaseBusiness, Eye, EyeOff, LockKeyhole, Network, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/db/supabase";
import { cn } from "@/lib/utils";

const adminEmail = (import.meta.env.VITE_ADMIN_EMAIL || "").trim().toLowerCase();

export default function LoginPage() {
  const [email, setEmail] = useState(adminEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateEmail = () => {
    if (!adminEmail || email.trim().toLowerCase() === adminEmail) return true;
    setMessage("该邮箱未获授权访问本系统。");
    return false;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    if (!validateEmail()) return;
    if (password.length < 8) {
      setMessage("密码至少需要 8 位。");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败，请稍后重试。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_22%_18%,rgba(125,211,252,0.34),transparent_30%),radial-gradient(circle_at_78%_22%,rgba(153,246,228,0.28),transparent_32%),radial-gradient(circle_at_50%_84%,rgba(220,252,231,0.38),transparent_34%),linear-gradient(135deg,#fbfeff_0%,#f3fbff_46%,#f8fffb_100%)]" />
      <main className="w-full max-w-[28rem]">
        <section className="glass-panel-strong premium-ring rounded-[28px] p-6 shadow-[0_28px_90px_rgba(14,116,144,0.14)] sm:p-8">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="relative mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-primary shadow-xl shadow-cyan-300/30">
              <Sparkles className="h-7 w-7 text-slate-800" />
              <div className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border border-white/80 bg-white/80 shadow-sm backdrop-blur">
                <Network className="h-3.5 w-3.5 text-teal-600" />
              </div>
            </div>
            <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-cyan-200/70 bg-white/70 px-3 py-1 text-xs font-semibold text-cyan-700"><BriefcaseBusiness className="h-3.5 w-3.5" />授权工作区</p>
            <h1 className="text-2xl font-bold tracking-normal text-slate-950 sm:text-3xl">HRBP 面试官简历管理系统</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500 sm:text-base">使用管理员邮箱安全登录</p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="hrbp-email" className="text-sm font-semibold text-slate-700">管理员邮箱</Label>
              <Input id="hrbp-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" className="h-12 rounded-2xl border-cyan-100 bg-white/76 px-4 text-slate-800" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hrbp-password" className="text-sm font-semibold text-slate-700">密码</Label>
              <div className="relative">
                <Input id="hrbp-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="请输入密码" className="h-12 rounded-2xl border-cyan-100 bg-white/76 px-4 pr-12 text-slate-800" required />
                <button type="button" aria-label={showPassword ? "隐藏密码" : "显示密码"} onClick={() => setShowPassword((current) => !current)} className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-cyan-50 hover:text-cyan-700"><>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</></button>
              </div>
            </div>
            {message && <p className={cn("text-sm font-medium", message.includes("已发送") ? "text-emerald-600" : "text-red-500")}>{message}</p>}
            <Button type="submit" disabled={isSubmitting} className="h-12 w-full rounded-2xl bg-gradient-primary text-sm font-bold text-slate-900 shadow-lg shadow-cyan-200/60"><LockKeyhole className="h-4 w-4" />{isSubmitting ? "请稍候…" : "进入系统"}</Button>
          </form>
        </section>
      </main>
    </div>
  );
}
