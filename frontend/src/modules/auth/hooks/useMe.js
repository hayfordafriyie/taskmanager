import { useQuery } from "@tanstack/react-query";
import { gql } from "../../../lib/api";

export function useMe(options = {}) {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await gql(
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