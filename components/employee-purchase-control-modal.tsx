"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { PurchaseControlDialog } from "@/components/purchase-control-dialog";

export function EmployeePurchaseControlModal({
  title,
  description,
  returnHref,
  children,
}: {
  title: string;
  description: string;
  returnHref: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  function close() {
    setOpen(false);
    router.replace(returnHref, { scroll: false });
  }

  return (
    <PurchaseControlDialog
      open={open}
      onClose={close}
      title={title}
      description={description}
      closeOnBackdrop={false}
      wide
    >
      {children}
    </PurchaseControlDialog>
  );
}
