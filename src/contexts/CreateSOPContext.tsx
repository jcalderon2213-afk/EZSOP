import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

interface CreateSOPContextValue {
  isOpen: boolean;
  openCreateSOP: () => void;
  closeCreateSOP: () => void;
}

const CreateSOPContext = createContext<CreateSOPContextValue | undefined>(undefined);

export function CreateSOPProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <CreateSOPContext.Provider
      value={{
        isOpen,
        openCreateSOP: () => setIsOpen(true),
        closeCreateSOP: () => setIsOpen(false),
      }}
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
