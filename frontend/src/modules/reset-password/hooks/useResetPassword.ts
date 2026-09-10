import { useMutation } from "@tanstack/react-query";
import { gql } from "../../../lib/api";
import type { ApiResponse } from "../../../types/api";
import type { ResetPasswordData, ResetPasswordVariables } from "../../../types/auth";

export function useResetPassword() {
  return useMutation<ApiResponse<ResetPasswordData>, Error, ResetPasswordVariables>({
    mutationFn: ({ phone, code, password, confirmPassword }: ResetPasswordVariables) =>
      gql<ResetPasswordData>(
        `mutation ($phone: String!, $code: String!, $password: String!, $confirmPassword: String!) {
          resetPassword(phone: $phone, code: $code, password: $password, confirmPassword: $confirmPassword) {
            success message
          }
        }`,
        { phone, code, password, confirmPassword } satisfies ResetPasswordVariables,
      ),
  });
}
