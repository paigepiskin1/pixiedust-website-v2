// Build the workspace route for a template card. The real workspace screen
// lands in Phase 6; a stub route resolves these links for now.
export function workspaceHref(kind: string, id: string | number): string {
  const slug = String(id)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `/studio/${kind}/${slug}`;
}
