function hrefWithPage(searchParams: URLSearchParams, page: number): string {
  const next = new URLSearchParams(searchParams);
  next.set("page", String(page));
  return `?${next.toString()}`;
}

export function Pagination({
  page,
  pageSize,
  total,
  searchParams,
}: {
  page: number;
  pageSize: number;
  total: number;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "page") continue;
    if (Array.isArray(value)) value.forEach((v) => sp.append(key, v));
    else if (value) sp.set(key, value);
  }

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav className="mt-4 flex items-center justify-between border-t border-rule pt-3 text-sm text-ink-quiet">
      <span>
        {from}–{to} of {total}
      </span>
      <div className="flex gap-3 font-mono">
        {page > 1 ? (
          <a href={hrefWithPage(sp, page - 1)} className="text-ink hover:underline">
            ← Previous
          </a>
        ) : (
          <span className="text-rule">← Previous</span>
        )}
        <span>
          {page} / {totalPages}
        </span>
        {page < totalPages ? (
          <a href={hrefWithPage(sp, page + 1)} className="text-ink hover:underline">
            Next →
          </a>
        ) : (
          <span className="text-rule">Next →</span>
        )}
      </div>
    </nav>
  );
}
