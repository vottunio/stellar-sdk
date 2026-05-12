import { ApiError } from '../errors/ApiError';
import { ApiErrorCode } from '../types/api.types';

/**
 * Maps raw Horizon API error responses into typed `ApiError` instances.
 *
 * Horizon error responses follow the format:
 * ```json
 * {
 *   "type": "https://stellar.org/horizon-errors/not_found",
 *   "title": "Resource Missing",
 *   "status": 404,
 *   "detail": "The resource at the url requested was not found."
 * }
 * ```
 */
export class ErrorMapper {
  /**
   * Map a Horizon error response body into an ApiError.
   * @param statusCode - HTTP status code.
   * @param body - Response body (parsed JSON).
   * @param endpoint - The request endpoint for context.
   * @returns Typed ApiError.
   */
  static fromHorizon(
    statusCode: number,
    body: HorizonErrorBody | undefined,
    endpoint: string,
  ): ApiError {
    const title = body?.title ?? 'Unknown Error';
    const detail = body?.detail ?? '';
    const message = detail || title;

    const code = this.mapStatusCode(statusCode, body);

    return new ApiError(message, code, {
      statusCode,
      endpoint,
      details: {
        type: body?.type,
        title,
        detail,
        extras: body?.extras,
      },
    });
  }

  /**
   * Map HTTP status + Horizon error body to an ApiErrorCode.
   */
  private static mapStatusCode(
    statusCode: number,
    body?: HorizonErrorBody,
  ): ApiErrorCode {
    switch (statusCode) {
      case 400:
        return this.mapBadRequest(body);
      case 404:
        return ApiErrorCode.NOT_FOUND;
      case 429:
        return ApiErrorCode.RATE_LIMITED;
      default:
        if (statusCode >= 500) return ApiErrorCode.SERVER_ERROR;
        return ApiErrorCode.UNKNOWN;
    }
  }

  /**
   * For 400 errors, inspect Horizon extras to determine specific error codes.
   */
  private static mapBadRequest(body?: HorizonErrorBody): ApiErrorCode {
    const txResult = body?.extras?.result_codes?.transaction;
    if (txResult) {
      switch (txResult) {
        case 'tx_bad_seq':
          return ApiErrorCode.TX_BAD_SEQ;
        case 'tx_insufficient_balance':
          return ApiErrorCode.TX_INSUFFICIENT_BALANCE;
        case 'tx_failed':
          return ApiErrorCode.TX_FAILED;
        default:
          return ApiErrorCode.TX_FAILED;
      }
    }
    return ApiErrorCode.BAD_REQUEST;
  }
}

/**
 * Shape of a Horizon error response body.
 */
export interface HorizonErrorBody {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  extras?: {
    result_codes?: {
      transaction?: string;
      operations?: string[];
    };
    envelope_xdr?: string;
    result_xdr?: string;
  };
}
