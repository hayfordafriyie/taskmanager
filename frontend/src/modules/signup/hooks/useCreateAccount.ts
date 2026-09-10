import { useMutation } from "@tanstack/react-query";
import { gql } from "../../../lib/api";
import type { ApiResponse } from "../../../types/api";
import type {
  CreateAccountData,
  CreateAccountInput,
  CreateAccountVariables,
} from "../../../types/auth";

export function useCreateAccount() {
  return useMutation<ApiResponse<CreateAccountData>, Error, CreateAccountInput>({
    mutationFn: (input: CreateAccountInput) =>
      gql<CreateAccountData>(
        `mutation ($input: CreateAccountInput!) { createAccount(input: $input) { success message user { id phone firstName surname otherNames } } }`,
        { input } satisfies CreateAccountVariables,
      ),
  });
}
