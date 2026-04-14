import { ResponseMapper } from '../../../src/api/ResponseMapper';

describe('ResponseMapper', () => {
  describe('single', () => {
    it('should wrap a single resource in ApiResponse', () => {
      const data = { id: 'abc', balance: '100' };
      const result = ResponseMapper.single(data);
      expect(result.data).toBe(data);
      expect(result.raw).toBe(data);
      expect(result.pagination).toBeUndefined();
    });
  });

  describe('collection', () => {
    it('should extract records from _embedded', () => {
      const response = {
        _embedded: {
          records: [{ id: '1' }, { id: '2' }],
        },
        _links: {
          next: { href: '/transactions?cursor=abc123&limit=10&order=desc' },
        },
      };

      const result = ResponseMapper.collection<{ id: string }>(response, 10, 'desc');
      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe('1');
      expect(result.pagination?.cursor).toBe('abc123');
      expect(result.pagination?.limit).toBe(10);
      expect(result.pagination?.order).toBe('desc');
      expect(result.raw).toBe(response);
    });

    it('should set hasMore=true when records.length >= limit', () => {
      const response = {
        _embedded: { records: [{ id: '1' }, { id: '2' }, { id: '3' }] },
        _links: {},
      };
      const result = ResponseMapper.collection(response, 3, 'asc');
      expect(result.pagination?.hasMore).toBe(true);
    });

    it('should set hasMore=false when records.length < limit', () => {
      const response = {
        _embedded: { records: [{ id: '1' }] },
        _links: {},
      };
      const result = ResponseMapper.collection(response, 10, 'asc');
      expect(result.pagination?.hasMore).toBe(false);
    });

    it('should handle missing _embedded gracefully', () => {
      const response = { _links: {} };
      const result = ResponseMapper.collection(response, 10, 'desc');
      expect(result.data).toEqual([]);
      expect(result.pagination?.hasMore).toBe(false);
    });

    it('should handle missing _links.next', () => {
      const response = {
        _embedded: { records: [{ id: '1' }] },
        _links: {},
      };
      const result = ResponseMapper.collection(response, 10, 'desc');
      expect(result.pagination?.cursor).toBeUndefined();
    });
  });
});
