import { useNavigate } from "@tanstack/react-router";
import { useTemplateStore } from "@/state/templateStore";
import { Button } from "@/components/ui/button";
import { Plus, LayoutTemplate, Palette, ArrowRight, Settings2 } from "lucide-react";

export function Dashboard() {
  const navigate = useNavigate();
  const { templates, activeTemplateId, setActiveTemplate } = useTemplateStore();

  const handleCreateNew = () => {
    navigate({ to: "/template-builder" });
  };

  const handleOpenEditor = (templateId: string) => {
    setActiveTemplate(templateId);
    navigate({ to: "/editor" });
  };

  return (
    <div className="flex flex-col min-h-screen bg-neutral-950 text-neutral-100 font-bangla selection:bg-amber-500/30">
      
      {/* Premium Hero Section */}
      <header className="relative overflow-hidden bg-neutral-900 border-b border-neutral-800 pb-12 pt-16 px-8">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] w-[600px] h-[600px] bg-amber-500/20 rounded-full blur-[120px]" />
          <div className="absolute top-[40%] -right-[10%] w-[500px] h-[500px] bg-sky-500/20 rounded-full blur-[100px]" />
        </div>
        
        <div className="relative max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 text-sm font-semibold tracking-wide">
              <Palette className="w-4 h-4" /> Professional DTP Workspace
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-4 tracking-tight">স্টুডিও আল-কালাম</h1>
            <p className="text-neutral-400 text-lg md:text-xl max-w-2xl leading-relaxed">
              আপনার কুরআন প্রকাশনার জন্য অত্যাধুনিক লেআউট ও টেমপ্লেট ডিজাইন টুল। প্রফেশনাল মুসহাফ তৈরির জন্য শুরু করুন।
            </p>
          </div>
          <div className="flex gap-4">
            <Button
              onClick={handleCreateNew}
              className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold px-8 py-6 rounded-xl shadow-lg shadow-amber-500/20 transition-all hover:scale-105 active:scale-95 text-base"
            >
              <Plus className="mr-2 w-5 h-5" /> নতুন টেমপ্লেট
            </Button>
            <Button
              onClick={() => navigate({ to: "/editor" })}
              variant="outline"
              className="border-neutral-700 bg-neutral-900/50 hover:bg-neutral-800 text-neutral-200 font-bold px-8 py-6 rounded-xl transition-all hover:scale-105 active:scale-95 text-base"
            >
              <ArrowRight className="mr-2 w-5 h-5" /> বর্তমান এডিটর
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <LayoutTemplate className="w-6 h-6 text-amber-400" /> আপনার টেমপ্লেটসমূহ
          </h2>
          <span className="text-neutral-500 text-sm bg-neutral-900 px-3 py-1 rounded-full border border-neutral-800">
            মোট {templates.length}টি টেমপ্লেট
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {/* Create New Card */}
          <button
            onClick={handleCreateNew}
            className="group relative flex flex-col items-center justify-center h-[280px] border border-dashed border-neutral-700 rounded-2xl bg-neutral-900/30 hover:bg-neutral-900/80 hover:border-amber-500/50 transition-all cursor-pointer"
          >
            <div className="w-16 h-16 rounded-2xl bg-neutral-800/80 group-hover:bg-amber-500/20 text-neutral-500 group-hover:text-amber-400 flex items-center justify-center mb-4 transition-all group-hover:scale-110 shadow-lg">
              <Plus size={32} />
            </div>
            <span className="font-bold text-neutral-400 group-hover:text-amber-300 text-lg transition-colors">নতুন টেমপ্লেট তৈরি</span>
          </button>

          {/* Map through all templates */}
          {templates.map((template) => {
            const isActive = activeTemplateId === template.id;
            return (
              <div 
                key={template.id} 
                className={`group relative flex flex-col border rounded-2xl bg-neutral-900 overflow-hidden transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-black/50 ${
                  isActive ? "border-amber-500/50 shadow-lg shadow-amber-500/10" : "border-neutral-800"
                }`}
              >
                {/* Visual Preview Header */}
                <div className="h-32 bg-neutral-950 flex items-center justify-center border-b border-neutral-800 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-neutral-800/50 to-transparent" />
                  <LayoutTemplate size={48} className={`relative z-10 ${isActive ? "text-amber-500/50" : "text-neutral-800"}`} />
                  
                  {/* Hover Overlay Button */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20 backdrop-blur-sm">
                    <Button 
                      onClick={() => navigate({ to: "/template-builder" })}
                      size="sm"
                      className="bg-neutral-800 hover:bg-neutral-700 text-white rounded-full px-4"
                    >
                      <Settings2 className="w-4 h-4 mr-2" /> কাস্টমাইজ
                    </Button>
                  </div>
                </div>
                
                {/* Info Body */}
                <div className="p-5 flex flex-col flex-1">
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <h3 className="font-bold text-lg text-neutral-100 truncate" title={template.name}>
                      {template.name}
                    </h3>
                    {isActive && (
                      <span className="shrink-0 bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold">
                        সক্রিয়
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-neutral-500 mb-5 flex-1 line-clamp-2">
                    {template.description || "কাস্টমাইজড কুরআন লেআউট টেমপ্লেট"}
                    <br/>
                    <span className="text-neutral-600 font-mono text-xs mt-1 block">
                      {template.linesPerPage} Lines • Page Size: {template.pageGeometry.width}x{template.pageGeometry.height}
                    </span>
                  </p>
                  <Button 
                    onClick={() => handleOpenEditor(template.id)} 
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors"
                  >
                    এডিটর খুলুন
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
