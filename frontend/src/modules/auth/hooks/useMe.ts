import { useQuery } from "@tanstack/react-query";
import { gql } from "../../../lib/api";
import type { AuthUser, MeData, MeQueryOptions } from "../../../types/auth";

export function useMe(options: MeQueryOptions = {}) {
  return useQuery<AuthUser>({
    queryKey: ["me"],
    queryFn: async (): Promise<AuthUser> => {
      const res = await gql<MeData>(
        "query { me { id phone firstName surname otherNames } }",
      );
      const me = res?.data?.me;
      if (!me) {
        throw new Error("not authenticated");
      }
      return me;
    },
    retry: false,
    ...options,
  });
}
