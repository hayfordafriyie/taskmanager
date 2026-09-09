import { useMutation } from "@tanstack/react-query";
import { gql } from "../../../lib/api";

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: (phone) =>
      gql(
        "mutation ($phone: String!) { requestPasswordReset(phone: $phone) { success message } }",
        { phone },
      ),
  });
}