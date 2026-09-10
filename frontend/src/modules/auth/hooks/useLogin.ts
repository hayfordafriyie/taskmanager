import { useMutation, useQueryClient } from "@tanstack/react-query";
import { gql, setTokens } from "../../../lib/api";
import type { ApiResponse } from "../../../types/api";
import type { LoginData, LoginVariables } from "../../../types/auth";

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<LoginData>, Error, LoginVariables>({
    mutationFn: ({ phone, password }: LoginVariables) =>
      gql<LoginData>(
        `mutation ($phone: String!, $password: String!) {
          login(phone: $phone, password: $password) {
            success message accessToken refreshToken user { id phone firstName surname otherNames }
          }
        }`,
        { phone, password },
      ),
    onSuccess: (res) => {
      const result = res?.data?.login;
      if (result?.success && result?.accessToken && result?.refreshToken) {
        setTokens(result.accessToken, result.refreshToken);
        queryClient.setQueryData(["me"], result.user);
      }
    },
  });
}
