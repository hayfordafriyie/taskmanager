import { useMutation } from "@tanstack/react-query";
import { gql } from "../../../lib/api";

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ phone, code, password, confirmPassword }) =>
      gql(
        `mutation ($phone: String!, $code: String!, $password: String!, $confirmPassword: String!) {
          resetPassword(phone: $phone, code: $code, password: $password, confirmPassword: $confirmPassword) {
            success message
          }
        }`,
        { phone, code, password, confirmPassword },
      ),
  });
}