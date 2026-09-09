import { useMutation } from "@tanstack/react-query";
import { gql } from "../../../lib/api";

export function useCreateAccount() {
  return useMutation({
    mutationFn: (input) =>
      gql(
        `mutation ($input: CreateAccountInput!) { createAccount(input: $input) { success message user { id phone firstName surname otherNames } } }`,
        { input },
      ),
  });
}