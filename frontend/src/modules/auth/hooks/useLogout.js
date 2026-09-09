import { useMutation, useQueryClient } from "@tanstack/react-query";
import { clearTokens, gql } from "../../../lib/api";

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => gql("mutation { logout }"),
    onSettled: () => {
      clearTokens();
      queryClient.removeQueries({ queryKey: ["me"] });
    },
  });
}