import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { FileUp, LogOut, Menu, Sparkles, Table2 } from "lucide-react";

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
