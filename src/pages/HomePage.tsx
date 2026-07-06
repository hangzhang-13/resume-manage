import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import UploadPage from "@/pages/UploadPage";
import ManagePage from "@/pages/ManagePage";

export default function HomePage() {
  const location = useLocation();

  useEffect(() => {
    const targetId = location.pathname === "/manage" || location.hash === "#manage-section"
      ? "manage-section"
      : "upload-section";

    requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [location.hash, location.pathname]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="aurora-blob left-[12%] top-[6%] h-72 w-72 bg-sky-300/20" />
        <div className="aurora-blob right-[8%] top-[18%] h-96 w-96 bg-teal-300/20 [animation-delay:1.2s]" />
        <div className="aurora-blob bottom-[10%] left-[36%] h-80 w-80 bg-emerald-300/15 [animation-delay:2.4s]" />
      </div>

      <div className="space-y-8 pb-10">
        <section id="upload-section" className="scroll-mt-6">
          <UploadPage />
        </section>
        <section id="manage-section" className="scroll-mt-6">
          <ManagePage />
        </section>
      </div>
    </div>
  );
}
