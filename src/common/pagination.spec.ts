import { paginate, parsePagination } from './pagination';

describe('parsePagination', () => {
  it('uses the default page and page size', () => {
    expect(parsePagination({})).toEqual({
      page: 1,
      pageSize: 20,
      skip: 0,
      take: 20,
    });
  });

  it('normalizes page values and calculates the offset', () => {
    expect(parsePagination({ page: 3.9, pageSize: 25.8 })).toEqual({
      page: 3,
      pageSize: 25,
      skip: 50,
      take: 25,
    });
  });

  it('clamps page and page size to their supported limits', () => {
    expect(parsePagination({ page: 0, pageSize: 500 })).toEqual({
      page: 1,
      pageSize: 100,
      skip: 0,
      take: 100,
    });
  });
});

describe('paginate', () => {
  it('shapes paginated data without changing it', () => {
    const data = [{ id: 'h1' }];

    expect(paginate(data, 42, 2, 20)).toEqual({
      data,
      total: 42,
      page: 2,
      pageSize: 20,
    });
  });
});
