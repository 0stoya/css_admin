"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import { savePurchaseControlTemplate } from "@/lib/graphql/purchase-controls";
import { requiredId, templateInput } from "@/lib/purchase-control-forms";
import type { PurchaseTemplateEditState } from "@/lib/purchase-template-edit";

/** Edit-only action: reuse the existing validation, admin token and Magento scope/ACL checks. */
export async function editPurchaseControlTemplateAction(
  _previous: PurchaseTemplateEditState,
  formData: FormData,
): Promise<PurchaseTemplateEditState> {
  try {
    const companyId = requiredId(formData, "companyId");
    const templateId = requiredId(formData, "templateId");
    const result = await savePurchaseControlTemplate(companyId, {
      ...templateInput(formData),
      template_id: templateId,
    });
    if (result.cssAdminSavePurchaseControlTemplate.template_id !== templateId) {
      throw new Error("Magento did not confirm the requested template update. Refresh before retrying.");
    }
    revalidatePath(`/companies/${companyId}/purchase-controls`);
    return { status: "saved", templateId };
  } catch (error) {
    unstable_rethrow(error);
    return { status: "error", message: graphQLErrorMessage(error) };
  }
}
