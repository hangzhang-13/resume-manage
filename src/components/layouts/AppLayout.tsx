import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/db/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { FileUp, KeyRound, LogOut, Menu, Sparkles, Table2 } from "lucide-react";
import { toast } from "sonner";

const navItems = [
  { hash: "upload-section", label: "简历上传", icon: FileUp },
  { hash: "manage-section", label: "简历管理", icon: Table2 },
];

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();

  return (
    <nav className="flex flex-col gap-1.5 p-3">
      {navItems.map((item) => {
        const isActive =
          (location.pathname === "/manage" && item.hash === "manage-section")
          || location.hash === `#${item.hash}`
          || (!location.hash && item.hash === "upload-section");
        return (
          <a
            key={item.hash}
            href={`#${item.hash}`}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-300",
              isActive
                ? "bg-gradient-primary text-white shadow-lg shadow-primary/25"
                : "text-white/60 hover:bg-white/10 hover:text-white"
            )}
            >
            <item.icon className="h-4 w-4" />
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}

function LogoutButton({ onLogout }: { onLogout: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onLogout}
      className="w-full justify-start rounded-xl px-4 py-3 text-xs font-medium text-white/50 hover:bg-white/10 hover:text-white"
    >
      <LogOut className="h-4 w-4" />
      退出登录
    </Button>
  );
}

function ChangePasswordButton({ onComplete }: { onComplete?: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setMessage("");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) resetForm();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage("请完整填写密码信息。");
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage("两次输入的新密码不一致。");
      return;
    }
    if (!user?.email) {
      setMessage("未获取到当前登录账号，请重新登录后再试。");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (verifyError) throw new Error("当前密码不正确。");

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      toast.success("密码修改成功，下次请使用新密码登录。");
      handleOpenChange(false);
      onComplete?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "密码修改失败，请稍后重试。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="w-full justify-start rounded-xl px-4 py-3 text-xs font-medium text-white/50 hover:bg-white/10 hover:text-white"
        >
          <KeyRound className="h-4 w-4" />
          修改密码
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>修改密码</DialogTitle>
          <DialogDescription>验证当前密码后即可设置新密码。</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="current-password">当前密码</Label>
            <Input id="current-password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">新密码</Label>
            <Input id="new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">确认新密码</Label>
            <Input id="confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" required />
          </div>
          {message && <p className="text-sm font-medium text-red-500">{message}</p>}
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "正在保存…" : "确认修改"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AppLayout({ children, onLogout }: { children: React.ReactNode; onLogout: () => void }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full">
      {/* 桌面侧边栏 - 毛玻璃深色科技风 */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 bg-slate-950/80 backdrop-blur-2xl border-r border-white/10 shadow-2xl shadow-cyan-950/30">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
          <div className="h-9 w-9 rounded-xl bg-gradient-primary flex items-center justify-center shadow-lg shadow-primary/30">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-white text-sm tracking-wide">HRBP 面试官简历管理系统</span>
            <span className="text-[10px] text-white/40 font-medium">AI 智能提取</span>
          </div>
        </div>
        <NavContent />
        {/* 底部装饰 */}
        <div className="mt-auto p-4">
          <ChangePasswordButton />
          <LogoutButton onLogout={onLogout} />
          <div className="rounded-xl bg-white/5 p-3 border border-white/5">
            <p className="text-[10px] text-white/40 leading-relaxed">支持图片 / PDF / Word / Excel 格式</p>
          </div>
        </div>
      </aside>

      {/* 移动端头部 + Sheet */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="lg:hidden flex items-center gap-3 bg-white/70 backdrop-blur-2xl border-b border-cyan-100/80 px-4 py-3">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0 text-foreground">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 bg-slate-950 border-r border-white/10">
              <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
                <div className="h-9 w-9 rounded-xl bg-gradient-primary flex items-center justify-center shadow-lg shadow-primary/30">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-white text-sm tracking-wide">HRBP 面试官简历管理系统</span>
                  <span className="text-[10px] text-white/40 font-medium">AI 智能提取</span>
                </div>
              </div>
              <NavContent onNavigate={() => setMobileOpen(false)} />
              <div className="mt-auto p-4">
                <ChangePasswordButton onComplete={() => setMobileOpen(false)} />
                <LogoutButton onLogout={() => {
                  setMobileOpen(false);
                  onLogout();
                }} />
              </div>
            </SheetContent>
          </Sheet>
          <span className="font-bold text-foreground">HRBP 面试官简历管理系统</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="ml-auto rounded-xl text-xs text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            退出
          </Button>
        </header>

        <main className="relative flex-1 overflow-x-hidden p-2 md:p-4">
          {children}
        </main>
      </div>
    </div>
  );
}
