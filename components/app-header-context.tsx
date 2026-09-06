"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

export type CompanyHeaderContextValue = {
  companyId: number;
  name: string;
  reference: string | null;
};

type AppHeaderContextState = {
  company: CompanyHeaderContextValue | null;
  setCompany: Dispatch<SetStateAction<CompanyHeaderContextValue | null>>;
};

const AppHeaderContext = createContext<AppHeaderContextState | null>(null);

export function AppHeaderContextProvider({ children }: { children: ReactNode }) {
  const [company, setCompany] = useState<CompanyHeaderContextValue | null>(null);
  const value = useMemo(() => ({ company, setCompany }), [company]);

  return <AppHeaderContext.Provider value={value}>{children}</AppHeaderContext.Provider>;
}

export function useAppHeaderContext() {
  const context = useContext(AppHeaderContext);
  if (!context) throw new Error("App header context must be used inside AppHeaderContextProvider.");
  return context;
}

export function CompanyHeaderContext({
  companyId,
  name,
  reference,
  children,
}: CompanyHeaderContextValue & { children: ReactNode }) {
  const { setCompany } = useAppHeaderContext();

  useEffect(() => {
    setCompany({ companyId, name, reference });
    return () => setCompany(null);
  }, [companyId, name, reference, setCompany]);

  return children;
}
