# Docs APIs — design

Team wiki with **per-member permissions**. A doc has a `visibility`, and access
can additionally be granted to individual members with or without edit rights.

## Permission rules (migration `011_docs.sql`)
| visibility   | who can read                                  |
|--------------|-----------------------------------------------|
| `team`       | every workspace member                        |
| `private`    | the creator (and workspace admins)            |
| `restricted` | only members in `doc_access` (+ creator/admin)|

Edit rights: creator, workspace **admin**, or a member whose `doc_access.can_edit`
is true. Delete: creator or admin. Implemented once in `can_view_doc` /
`can_edit_doc` and reused everywhere.

## Data
- `docs` — `team_id`, `created_by`, `title`, `body`, `visibility`, timestamps.
- `doc_access` — `(doc_id, user_id)` → `can_edit`, `granted_by`.
- Functions: `create_doc`, `update_doc`, `delete_doc`, `docs_for_team`
  (viewer-filtered, with `can_edit` + access count), `set_doc_access`,
  `revoke_doc_access`, `doc_access_list`.

## GraphQL
```graphql
enum DocVisibility { TEAM PRIVATE RESTRICTED }

type Doc {
  id: UUID! teamId: UUID! title: String! body: String!
  visibility: DocVisibility! createdAt: Time! updatedAt: Time!
  createdBy: User! canEdit: Boolean! accessCount: Int!
}
type DocAccess { userId: UUID! name: String! phone: String! canEdit: Boolean! grantedAt: Time! }
type DocResult { success: Boolean! message: String! doc: Doc }

query {
  teamDocs: [Doc!]!
  docAccessList(docId: UUID!): [DocAccess!]!
}
mutation {
  createDoc(title: String!, body: String = "", visibility: DocVisibility = TEAM): DocResult!
  updateDoc(docId: UUID!, title: String, body: String, visibility: DocVisibility): DocResult!
  deleteDoc(docId: UUID!): Boolean!
  setDocAccess(docId: UUID!, userId: UUID!, canEdit: Boolean = false): DocResult!
  revokeDocAccess(docId: UUID!, userId: UUID!): Boolean!
}
```

## Frontend
- `modules/docs/hooks.js`: `useTeamDocs`, `useCreateDoc`, `useUpdateDoc`,
  `useDeleteDoc`, `useDocAccessList`, `useSetDocAccess`, `useRevokeDocAccess`.
- `DocsView`: sidebar of docs (grouped by visibility, search), a **doc editor**
  (title/body, save, delete), **New doc** modal (visibility), and a **Share**
  modal listing team members with an access toggle plus an "can edit" switch —
  granting/revoking per member. Keeps the existing glass design.
