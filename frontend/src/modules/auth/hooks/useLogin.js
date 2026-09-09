import { useMutation, useQueryClient } from "@tanstack/react-query";
import { gql, setTokens } from "../../../lib/api";

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ phone, password }) =>
      gql(
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