import { useNavigate } from "@tanstack/react-router";
import { useTemplateStore } from "@/state/templateStore";
import { Button } from "@/components/ui/button";
import { Plus, LayoutTemplate, Palette, ArrowRight, Settings2, Home, FolderOpen, Search, Sparkles, Bell, User, Clock } from "lucide-react";

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
    <div className="flex h-screen bg-[#0a0a0a] text-neutral-100 font-bangla overflow-hidden selection:bg-amber-500/30">
      
      {/* Sidebar Navigation */}
      <aside className="w-64 flex-shrink-0 bg-neutral-950 border-r border-neutral-800/50 flex flex-col z-20">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Palette className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-neutral-100 to-neutral-400">
            স্টুডিও আল-কালাম
          </span>
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-4">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 text-amber-500 font-semibold transition-colors">
            <Home className="w-5 h-5" />
            হোম
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900/50 transition-colors">
            <FolderOpen className="w-5 h-5" />
            প্রজেক্টস
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900/50 transition-colors">
            <LayoutTemplate className="w-5 h-5" />
            টেমপ্লেটস
          </button>
        </nav>

        <div className="p-4 mt-auto">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900/50 transition-colors">
            <Settings className="w-5 h-5" />
            সেটিংস
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        
        {/* Top Navbar */}
        <header className="h-16 flex-shrink-0 border-b border-neutral-800/50 bg-neutral-950/50 backdrop-blur-md flex items-center justify-between px-8 z-20">
          <div className="flex-1 max-w-xl relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input 
              type="text" 
              placeholder="টেমপ্লেট বা প্রজেক্ট খুঁজুন..." 
              className="w-full bg-neutral-900/50 border border-neutral-800 rounded-full py-2 pl-10 pr-4 text-sm text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all"
            />
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 text-neutral-400 hover:text-amber-400 transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-neutral-950"></span>
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-400 to-cyan-500 flex items-center justify-center shadow-lg cursor-pointer">
              <User className="w-4 h-4 text-white" />
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto relative z-10 pb-20">
          
          {/* Dynamic Background Gradients */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-[10%] left-[20%] w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-[120px]" />
            <div className="absolute top-[20%] -right-[10%] w-[500px] h-[500px] bg-sky-500/10 rounded-full blur-[100px]" />
            <div className="absolute -bottom-[20%] left-[10%] w-[700px] h-[700px] bg-purple-500/10 rounded-full blur-[120px]" />
          </div>

          <div className="relative max-w-6xl mx-auto px-8 pt-12">
            
            {/* Hero Welcome */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-16">
              <div>
                <h1 className="text-4xl md:text-5xl font-bold mb-3 tracking-tight flex items-center gap-3">
                  স্বাগতম <Sparkles className="w-8 h-8 text-amber-400 animate-pulse" />
                </h1>
                <p className="text-neutral-400 text-lg max-w-xl leading-relaxed">
                  আপনার পরবর্তী প্রফেশনাল মুসহাফ ডিজাইন শুরু করুন। নতুন টেমপ্লেট তৈরি করুন বা বিদ্যমান একটি বেছে নিন।
                </p>
              </div>
              <div className="flex gap-4">
                <Button
                  onClick={handleCreateNew}
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-bold px-6 py-6 rounded-2xl shadow-xl shadow-amber-500/20 transition-all hover:scale-105 active:scale-95 text-base"
                >
                  <Plus className="mr-2 w-5 h-5" /> ডিজাইন তৈরি করুন
                </Button>
                <Button
                  onClick={() => navigate({ to: "/editor" })}
                  className="bg-neutral-800/80 hover:bg-neutral-700 text-white border border-neutral-700 backdrop-blur-md font-bold px-6 py-6 rounded-2xl transition-all hover:scale-105 active:scale-95 text-base"
                >
                  <ArrowRight className="mr-2 w-5 h-5" /> বর্তমান এডিটর
                </Button>
              </div>
            </div>

            {/* Templates Section */}
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Clock className="w-6 h-6 text-emerald-400" /> আপনার ডিজাইনসমূহ
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {/* Create New Card */}
              <button
                onClick={handleCreateNew}
                className="group flex flex-col items-center justify-center h-[260px] rounded-3xl bg-neutral-900/40 border border-neutral-800 hover:bg-neutral-800/60 hover:border-amber-500/50 transition-all duration-300 cursor-pointer backdrop-blur-sm"
              >
                <div className="w-16 h-16 rounded-full bg-neutral-800/80 group-hover:bg-amber-500 group-hover:text-neutral-950 text-neutral-400 flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-110 shadow-lg">
                  <Plus size={32} />
                </div>
                <span className="font-bold text-neutral-300 group-hover:text-amber-400 text-lg transition-colors">খালি ক্যানভাস</span>
              </button>

              {/* Map through all templates */}
              {templates.map((template) => {
                const isActive = activeTemplateId === template.id;
                return (
                  <div 
                    key={template.id} 
                    className={`group relative flex flex-col rounded-3xl bg-neutral-900/60 border overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-black/60 backdrop-blur-md ${
                      isActive ? "border-amber-500/50 shadow-lg shadow-amber-500/10" : "border-neutral-800"
                    }`}
                  >
                    {/* Visual Preview Header */}
                    <div className="h-40 bg-neutral-950/80 flex items-center justify-center border-b border-neutral-800/50 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-neutral-800/30 to-transparent" />
                      <LayoutTemplate size={56} strokeWidth={1} className={`relative z-10 transition-transform duration-500 group-hover:scale-110 ${isActive ? "text-amber-500/80" : "text-neutral-700"}`} />
                      
                      {/* Hover Overlay Button */}
                      <div className="absolute inset-0 bg-neutral-950/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-20 backdrop-blur-[2px]">
                        <Button 
                          onClick={() => navigate({ to: "/template-builder" })}
                          className="bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-full px-6 py-2 backdrop-blur-md"
                        >
                          <Settings2 className="w-4 h-4 mr-2" /> কাস্টমাইজ
                        </Button>
                      </div>
                    </div>
                    
                    {/* Info Body */}
                    <div className="p-5 flex flex-col flex-1">
                      <div className="flex justify-between items-start mb-1 gap-2">
                        <h3 className="font-bold text-lg text-neutral-100 truncate group-hover:text-amber-400 transition-colors" title={template.name}>
                          {template.name}
                        </h3>
                        {isActive && (
                          <span className="shrink-0 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold">
                            সক্রিয়
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-neutral-500 mb-5 flex-1 line-clamp-2 leading-relaxed">
                        {template.description || "কাস্টমাইজড কুরআন লেআউট টেমপ্লেট"}
                      </p>
                      
                      <Button 
                        onClick={() => handleOpenEditor(template.id)} 
                        className={`w-full font-bold rounded-xl py-5 transition-all duration-300 ${
                          isActive 
                            ? "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20" 
                            : "bg-neutral-800 text-neutral-300 hover:bg-emerald-600 hover:text-white"
                        }`}
                      >
                        {isActive ? "কাজ চালিয়ে যান" : "এডিটর খুলুন"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            
          </div>
        </main>
      </div>
    </div>
  );
}
