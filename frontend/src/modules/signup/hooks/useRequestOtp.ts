import { useMutation } from "@tanstack/react-query";
import { gql } from "../../../lib/api";
import type { ApiResponse } from "../../../types/api";
import type { PhoneVariables, RequestOtpData } from "../../../types/auth";

export function useRequestOtp() {
  return useMutation<ApiResponse<RequestOtpData>, Error, string>({
    mutationFn: (phone: string) =>
      gql<RequestOtpData>(
        "mutation ($phone: String!) { requestOTP(phone: $phone) { success message expiresInSeconds retryAfterSeconds } }",
        { phone } satisfies PhoneVariables,
      ),
  });
}
