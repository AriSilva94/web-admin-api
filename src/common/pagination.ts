export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export function parsePagination(q: { page?: number; pageSize?: number }) {
  const page = Math.max(1, Math.floor(q.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(q.pageSize ?? 20)));

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

export function paginate<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number,
): Paginated<T> {
  return { data, page, pageSize, total };
}
