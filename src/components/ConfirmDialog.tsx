"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ConfirmOptions = {
  title: string;
  description?: string;
  actionLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

const ConfirmContext = createContext<(o: ConfirmOptions) => Promise<boolean>>(
  () => Promise.resolve(false),
);

/** どこからでも `const confirm = useConfirm();` → `await confirm({title, ...})` */
export function useConfirm() {
  return useContext(ConfirmContext);
}

export default function ConfirmProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(v: boolean) => void>(() => {});

  const confirm = useCallback((o: ConfirmOptions) => {
    setOpts(o);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = (result: boolean) => {
    setOpen(false);
    const r = resolver.current;
    resolver.current = () => {};
    r(result);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog
        open={open}
        onOpenChange={(o) => {
          // Escape / キャンセルで閉じた場合は false 扱い
          if (!o) settle(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{opts?.title}</AlertDialogTitle>
            {opts?.description && (
              <AlertDialogDescription>
                {opts.description}
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{opts?.cancelLabel ?? "キャンセル"}</AlertDialogCancel>
            <AlertDialogAction
              variant={opts?.destructive ? "destructive" : "default"}
              onClick={() => settle(true)}
            >
              {opts?.actionLabel ?? "OK"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}
