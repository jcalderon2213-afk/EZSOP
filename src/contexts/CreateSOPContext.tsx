import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";

export interface SOPPrefillData {
  title?: string;
}

interface CreateSOPContextValue {
  isOpen: boolean;
  prefillData: SOPPrefillData | null;
  openCreateSOP: (prefill?: SOPPrefillData) => void;
  closeCreateSOP: () => void;
  consumePrefill: () => SOPPrefillData | null;
}

const CreateSOPContext = createContext<CreateSOPContextValue | undefined>(undefined);

export function CreateSOPProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [prefillData, setPrefillData] = useState<SOPPrefillData | null>(null);

  const openCreateSOP = useCallback((prefill?: SOPPrefillData) => {
    setPrefillData(prefill ?? null);
    setIsOpen(true);
  }, []);

  const closeCreateSOP = useCallback(() => {
    setIsOpen(false);
    setPrefillData(null);
  }, []);

  const consumePrefill = useCallback(() => {
    const data = prefillData;
    setPrefillData(null);
    return data;
  }, [prefillData]);

  return (
    <CreateSOPContext.Provider
      value={{ isOpen, prefillData, openCreateSOP, closeCreateSOP, consumePrefill }}
    >
      {children}
    </CreateSOPContext.Provider>
  );
}

export function useCreateSOP(): CreateSOPContextValue {
  const ctx = useContext(CreateSOPContext);
  if (!ctx) throw new Error("useCreateSOP must be used within CreateSOPProvider");
  return ctx;
}
