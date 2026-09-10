import { useMutation, useQueryClient } from "@tanstack/react-query";
import { clearTokens, gql } from "../../../lib/api";
import type { ApiResponse } from "../../../types/api";
import type { LogoutData } from "../../../types/auth";

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<LogoutData>, Error, void>({
    mutationFn: () => gql<LogoutData>("mutation { logout }"),
    onSettled: () => {
      clearTokens();
      queryClient.removeQueries({ queryKey: ["me"] });
    },
  });
}
