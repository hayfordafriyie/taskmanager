import { useMutation } from "@tanstack/react-query";
import { gql } from "../../../lib/api";

export function useRequestOtp() {
  return useMutation({
    mutationFn: (phone) =>
      gql(
        "mutation ($phone: String!) { requestOTP(phone: $phone) { success message expiresInSeconds retryAfterSeconds } }",
        { phone },
      ),
  });
}