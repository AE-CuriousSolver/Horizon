"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { radar } from "@/lib/copy/en-GB";

interface ToastItem {
  id: number;
  message: string;
  undo?: () => void | Promise<void>;
}

const ToastContext = createContext<(message: string, undo?: ToastItem["undo"]) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, undo?: ToastItem["undo"]) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), message, undo });
    timer.current = setTimeout(() => setToast(null), 8000);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 sm:bottom-6">
        {toast && (
          <div
            key={toast.id}
            className="pointer-events-auto flex max-w-md items-center gap-4 rounded-full bg-ink px-4 py-2.5 text-sm text-bg shadow-lg"
          >
            <span>{toast.message}</span>
            {toast.undo && (
              <button
                type="button"
                className="font-semibold underline underline-offset-2"
                onClick={async () => {
                  const undo = toast.undo;
                  setToast(null);
                  await undo?.();
                }}
              >
                {radar.undo}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
