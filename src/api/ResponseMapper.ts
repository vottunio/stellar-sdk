import { ApiResponse, PaginationInfo } from '../types/api.types';

/**
 * Maps raw Horizon REST API responses into the standardized `ApiResponse<T>` format.
 * Extracts pagination info from `_links` and `_embedded.records`.
 */
export class ResponseMapper {
  /**
   * Map a single-resource Horizon response (e.g. /accounts/{id}).
   * @param data - Raw Horizon response data.
   * @returns Standardized ApiResponse wrapping the data.
   */
  static single<T>(data: T): ApiResponse<T> {
    return { data, raw: data };
  }

  /**
   * Map a paginated Horizon collection response (e.g. /transactions).
   * Horizon returns `{ _embedded: { records: [...] }, _links: { next, prev } }`.
   *
   * @param responseData - Raw Horizon collection response.
   * @param requestLimit - The limit used in the request.
   * @param requestOrder - The order used in the request.
   * @returns Standardized ApiResponse with pagination info.
   */
  static collection<T>(
    responseData: HorizonCollectionResponse,
    requestLimit: number,
    requestOrder: 'asc' | 'desc',
  ): ApiResponse<T[]> {
    const records = responseData._embedded?.records ?? [];

    const nextLink = responseData._links?.next?.href;
    const nextCursor = nextLink ? this.extractCursor(nextLink) : undefined;

    const pagination: PaginationInfo = {
      cursor: nextCursor,
      limit: requestLimit,
      order: requestOrder,
      hasMore: records.length >= requestLimit,
    };

    return {
      data: records as T[],
      pagination,
      raw: responseData,
    };
  }

  /**
   * Extract cursor value from a Horizon `_links.next.href` URL.
   */
  private static extractCursor(url: string): string | undefined {
    try {
      const parsed = new URL(url, 'https://placeholder');
      return parsed.searchParams.get('cursor') ?? undefined;
    } catch {
      return undefined;
    }
  }
}

/**
 * Shape of a Horizon paginated collection response.
 */
export interface HorizonCollectionResponse {
  _embedded?: {
    records: unknown[];
  };
  _links?: {
    self?: { href: string };
    next?: { href: string };
    prev?: { href: string };
  };
}
