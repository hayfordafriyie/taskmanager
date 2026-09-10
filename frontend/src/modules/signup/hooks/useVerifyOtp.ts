import { useMutation } from "@tanstack/react-query";
import { gql } from "../../../lib/api";
import type { ApiResponse } from "../../../types/api";
import type { VerifyOtpData, VerifyOtpVariables } from "../../../types/auth";

export function useVerifyOtp() {
  return useMutation<ApiResponse<VerifyOtpData>, Error, VerifyOtpVariables>({
    mutationFn: ({ phone, code }: VerifyOtpVariables) =>
      gql<VerifyOtpData>(
        "mutation ($phone: String!, $code: String!) { verifyOTP(phone: $phone, code: $code) { success message } }",
        { phone, code } satisfies VerifyOtpVariables,
      ),
  });
}
