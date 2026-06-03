import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";

type PromptOptions = {
  title: string;
  message?: string;
  defaultValue?: string;
  placeholder?: string;
};

type ConfirmOptions = {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
};

type ModalContextType = {
  showPrompt: (options: PromptOptions | string, defaultVal?: string) => Promise<string | null>;
  showConfirm: (options: ConfirmOptions | string) => Promise<boolean>;
};

const ModalContext = createContext<ModalContextType | null>(null);

export function useModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error("useModal must be used within ModalProvider");
  return ctx;
}

type ModalState = 
  | { type: "prompt"; options: PromptOptions; resolve: (val: string | null) => void }
  | { type: "confirm"; options: ConfirmOptions; resolve: (val: boolean) => void }
  | null;

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [modal, setModal] = useState<ModalState>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const showPrompt = useCallback((options: PromptOptions | string, defaultVal?: string) => {
    return new Promise<string | null>((resolve) => {
      const opts = typeof options === "string" ? { title: options, defaultValue: defaultVal } : options;
      setModal({ type: "prompt", options: opts, resolve });
    });
  }, []);

  const showConfirm = useCallback((options: ConfirmOptions | string) => {
    return new Promise<boolean>((resolve) => {
      const opts = typeof options === "string" ? { title: "Confirm", message: options } : options;
      setModal({ type: "confirm", options: opts, resolve });
    });
  }, []);

  const handleClose = useCallback(() => {
    if (modal?.type === "prompt") modal.resolve(null);
    else if (modal?.type === "confirm") modal.resolve(false);
    setModal(null);
  }, [modal]);

  const handleSubmitPrompt = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    if (modal?.type === "prompt") {
      modal.resolve(inputRef.current?.value || "");
      setModal(null);
    }
  }, [modal]);

  const handleConfirm = useCallback(() => {
    if (modal?.type === "confirm") {
      modal.resolve(true);
      setModal(null);
    }
  }, [modal]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    if (modal) {
      window.addEventListener("keydown", handleKeyDown);
      if (modal.type === "prompt") {
        setTimeout(() => {
          inputRef.current?.focus();
          inputRef.current?.select();
        }, 10);
      }
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modal, handleClose]);

  return (
    <ModalContext.Provider value={{ showPrompt, showConfirm }}>
      {children}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div 
            className="bg-neutral-900 border border-neutral-700/50 shadow-2xl shadow-black/50 rounded-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            <div className="p-6">
              <h3 className="text-xl font-bold text-neutral-100 mb-2 font-bangla">
                {modal.options.title}
              </h3>
              
              {modal.type === "confirm" && (
                <p className="text-neutral-400 font-bangla text-base mb-6">
                  {modal.options.message}
                </p>
              )}

              {modal.type === "prompt" && modal.options.message && (
                <p className="text-neutral-400 font-bangla text-sm mb-4">
                  {modal.options.message}
                </p>
              )}

              {modal.type === "prompt" && (
                <form onSubmit={handleSubmitPrompt} className="mb-6">
                  <input
                    ref={inputRef}
                    type="text"
                    defaultValue={modal.options.defaultValue}
                    placeholder={modal.options.placeholder}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-4 py-3 text-neutral-100 font-bangla focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all"
                  />
                </form>
              )}

              <div className="flex justify-end gap-3 font-bangla">
                <Button 
                  onClick={handleClose} 
                  variant="outline" 
                  className="border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl"
                >
                  {modal.type === "confirm" ? (modal.options.cancelText || "বাতিল") : "বাতিল"}
                </Button>
                
                {modal.type === "prompt" ? (
                  <Button 
                    onClick={handleSubmitPrompt} 
                    className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl"
                  >
                    নিশ্চিত করুন
                  </Button>
                ) : (
                  <Button 
                    onClick={handleConfirm} 
                    className="bg-red-500 hover:bg-red-400 text-white font-bold rounded-xl"
                  >
                    {modal.options.confirmText || "হ্যাঁ, নিশ্চিত"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}
