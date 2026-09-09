import { useMutation } from "@tanstack/react-query";
import { gql } from "../../../lib/api";

export function useVerifyOtp() {
  return useMutation({
    mutationFn: ({ phone, code }) =>
      gql(
        "mutation ($phone: String!, $code: String!) { verifyOTP(phone: $phone, code: $code) { success message } }",
        { phone, code },
      ),
  });
}