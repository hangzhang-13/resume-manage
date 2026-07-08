import React, { useState } from "react";
import { BriefcaseBusiness, Eye, EyeOff, LockKeyhole, Network, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const HRBP_AUTH_STORAGE_KEY = "hrbp_resume_auth";
export const HRBP_LOGIN_ACCOUNT = "huangxuejiao@baidu.com";
export const HRBP_LOGIN_PASSWORD = "smile&1239";

interface LoginPageProps {
  onLogin: () => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState(HRBP_LOGIN_ACCOUNT);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [hasError, setHasError] = useState(false);

  const submitCredentials = () => {
    if (username.trim() !== HRBP_LOGIN_ACCOUNT || password !== HRBP_LOGIN_PASSWORD) {
      setHasError(true);
      return;
    }

    sessionStorage.setItem(HRBP_AUTH_STORAGE_KEY, "authenticated");
    setHasError(false);
    onLogin();
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitCredentials();
  };

  const handleFormKeyDown = (event: React.KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    submitCredentials();
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_22%_18%,rgba(125,211,252,0.34),transparent_30%),radial-gradient(circle_at_78%_22%,rgba(153,246,228,0.28),transparent_32%),radial-gradient(circle_at_50%_84%,rgba(220,252,231,0.38),transparent_34%),linear-gradient(135deg,#fbfeff_0%,#f3fbff_46%,#f8fffb_100%)]" />
      <div className="aurora-blob left-[10%] top-[8%] h-72 w-72 bg-sky-300/25" />
      <div className="aurora-blob right-[8%] top-[18%] h-96 w-96 bg-teal-300/20 [animation-delay:1.1s]" />
      <div className="aurora-blob bottom-[7%] left-[38%] h-80 w-80 bg-emerald-300/18 [animation-delay:2.2s]" />

      <main className="w-full max-w-[28rem]">
        <section className="glass-panel-strong premium-ring rounded-[28px] p-6 shadow-[0_28px_90px_rgba(14,116,144,0.14)] sm:p-8">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="relative mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-primary shadow-xl shadow-cyan-300/30">
              <Sparkles className="h-7 w-7 text-slate-800" />
              <div className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border border-white/80 bg-white/80 shadow-sm backdrop-blur">
                <Network className="h-3.5 w-3.5 text-teal-600" />
              </div>
            </div>
            <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-cyan-200/70 bg-white/70 px-3 py-1 text-xs font-semibold text-cyan-700">
              <BriefcaseBusiness className="h-3.5 w-3.5" />
              Authorized HR Workspace
            </p>
            <h1 className="text-2xl font-bold tracking-normal text-slate-950 sm:text-3xl">
              HRBP 面试官简历管理系统
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-500 sm:text-base">
              AI 辅助筛选 · 面试评估 · Pipeline 管理
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit} onKeyDown={handleFormKeyDown}>
            <div className="space-y-2">
              <Label htmlFor="hrbp-account" className="text-sm font-semibold text-slate-700">
                授权账号
              </Label>
              <Input
                id="hrbp-account"
                value={username}
                readOnly
                autoComplete="username"
                aria-readonly="true"
                className={cn(
                  "h-12 cursor-default rounded-2xl border-cyan-100 bg-white/76 px-4 text-slate-800 shadow-sm backdrop-blur placeholder:text-slate-400 focus-visible:ring-cyan-300",
                  hasError && "border-red-300 focus-visible:ring-red-300"
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hrbp-password" className="text-sm font-semibold text-slate-700">
                访问密码
              </Label>
              <div className="relative">
                <Input
                  id="hrbp-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setHasError(false);
                  }}
                  autoComplete="current-password"
                  placeholder="请输入访问密码"
                  className={cn(
                    "h-12 rounded-2xl border-cyan-100 bg-white/76 px-4 pr-12 text-slate-800 shadow-sm backdrop-blur placeholder:text-slate-400 focus-visible:ring-cyan-300",
                    hasError && "border-red-300 focus-visible:ring-red-300"
                  )}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "隐藏密码" : "显示密码"}
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-cyan-50 hover:text-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {hasError && (
                <p className="text-sm font-medium text-red-500">账号或密码错误，请重新输入。</p>
              )}
            </div>

            <Button
              type="submit"
              className="h-12 w-full rounded-2xl bg-gradient-primary text-sm font-bold text-slate-900 shadow-lg shadow-cyan-200/60 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-cyan-200/70"
            >
              <LockKeyhole className="h-4 w-4" />
              进入系统
            </Button>
          </form>

          <p className="mt-7 text-center text-xs font-medium text-slate-400">仅限授权面试官访问</p>
        </section>
      </main>
    </div>
  );
}
