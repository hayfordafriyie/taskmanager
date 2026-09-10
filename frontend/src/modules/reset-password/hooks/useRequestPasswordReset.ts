import { useMutation } from "@tanstack/react-query";
import { gql } from "../../../lib/api";
import type { ApiResponse } from "../../../types/api";
import type { PhoneVariables, RequestPasswordResetData } from "../../../types/auth";

export function useRequestPasswordReset() {
  return useMutation<ApiResponse<RequestPasswordResetData>, Error, string>({
    mutationFn: (phone: string) =>
      gql<RequestPasswordResetData>(
        "mutation ($phone: String!) { requestPasswordReset(phone: $phone) { success message } }",
        { phone } satisfies PhoneVariables,
      ),
  });
}
