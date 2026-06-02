import { createContext, useContext, useState, ReactNode, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type PromptOptions = {
  title: string;
  description?: string;
  defaultValue?: string;
};

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

interface ModalContextType {
  showPrompt: (options: PromptOptions) => Promise<string | null>;
  showConfirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ModalContext = createContext<ModalContextType | null>(null);

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModal must be used within a ModalProvider");
  }
  return context;
}

export function ModalProvider({ children }: { children: ReactNode }) {
  const [promptState, setPromptState] = useState<{
    open: boolean;
    options: PromptOptions | null;
    resolve: (value: string | null) => void;
    inputValue: string;
  }>({
    open: false,
    options: null,
    resolve: () => {},
    inputValue: "",
  });

  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    options: ConfirmOptions | null;
    resolve: (value: boolean) => void;
  }>({
    open: false,
    options: null,
    resolve: () => {},
  });

  const showPrompt = useCallback((options: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      setPromptState({
        open: true,
        options,
        resolve,
        inputValue: options.defaultValue || "",
      });
    });
  }, []);

  const showConfirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({
        open: true,
        options,
        resolve,
      });
    });
  }, []);

  const closePrompt = (value: string | null) => {
    promptState.resolve(value);
    setPromptState((prev) => ({ ...prev, open: false }));
  };

  const closeConfirm = (value: boolean) => {
    confirmState.resolve(value);
    setConfirmState((prev) => ({ ...prev, open: false }));
  };

  return (
    <ModalContext.Provider value={{ showPrompt, showConfirm }}>
      {children}
      
      {/* Prompt Dialog */}
      <Dialog open={promptState.open} onOpenChange={(open) => !open && closePrompt(null)}>
        <DialogContent className="sm:max-w-[425px] bg-neutral-950 border-neutral-800 text-neutral-200">
          <DialogHeader>
            <DialogTitle className="text-amber-400">{promptState.options?.title}</DialogTitle>
            {promptState.options?.description && (
              <DialogDescription className="text-neutral-400">
                {promptState.options.description}
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="py-4">
            <input
              type="text"
              autoFocus
              value={promptState.inputValue}
              onChange={(e) => setPromptState((prev) => ({ ...prev, inputValue: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter") closePrompt(promptState.inputValue);
              }}
              className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-amber-500"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => closePrompt(null)} className="border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100">
              বাতিল
            </Button>
            <Button onClick={() => closePrompt(promptState.inputValue)} className="bg-amber-600 text-neutral-950 hover:bg-amber-500">
              নিশ্চিত করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <Dialog open={confirmState.open} onOpenChange={(open) => !open && closeConfirm(false)}>
        <DialogContent className="sm:max-w-[425px] bg-neutral-950 border-neutral-800 text-neutral-200">
          <DialogHeader>
            <DialogTitle className="text-amber-400">{confirmState.options?.title}</DialogTitle>
            {confirmState.options?.description && (
              <DialogDescription className="text-neutral-400">
                {confirmState.options.description}
              </DialogDescription>
            )}
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => closeConfirm(false)} className="border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100">
              {confirmState.options?.cancelLabel || "না, বাতিল"}
            </Button>
            <Button onClick={() => closeConfirm(true)} variant="destructive" className="bg-red-600 text-white hover:bg-red-500">
              {confirmState.options?.confirmLabel || "হ্যাঁ, নিশ্চিত"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModalContext.Provider>
  );
}
