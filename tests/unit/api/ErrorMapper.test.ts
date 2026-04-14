import { ErrorMapper } from '../../../src/api/ErrorMapper';
import { ApiError } from '../../../src/errors/ApiError';
import { ApiErrorCode } from '../../../src/types/api.types';

describe('ErrorMapper', () => {
  describe('fromHorizon', () => {
    it('should map 404 to NOT_FOUND', () => {
      const error = ErrorMapper.fromHorizon(
        404,
        { title: 'Resource Missing', detail: 'Not found', status: 404 },
        '/accounts/GABC',
      );
      expect(error).toBeInstanceOf(ApiError);
      expect(error.code).toBe(ApiErrorCode.NOT_FOUND);
      expect(error.statusCode).toBe(404);
      expect(error.endpoint).toBe('/accounts/GABC');
    });

    it('should map 429 to RATE_LIMITED', () => {
      const error = ErrorMapper.fromHorizon(429, undefined, '/transactions');
      expect(error.code).toBe(ApiErrorCode.RATE_LIMITED);
      expect(error.statusCode).toBe(429);
    });

    it('should map 500 to SERVER_ERROR', () => {
      const error = ErrorMapper.fromHorizon(
        500,
        { title: 'Internal Server Error', detail: 'Something broke' },
        '/ledgers',
      );
      expect(error.code).toBe(ApiErrorCode.SERVER_ERROR);
    });

    it('should map 502 to SERVER_ERROR', () => {
      const error = ErrorMapper.fromHorizon(502, undefined, '/');
      expect(error.code).toBe(ApiErrorCode.SERVER_ERROR);
    });

    it('should map 400 without tx result to BAD_REQUEST', () => {
      const error = ErrorMapper.fromHorizon(
        400,
        { title: 'Bad Request', detail: 'Invalid params' },
        '/transactions',
      );
      expect(error.code).toBe(ApiErrorCode.BAD_REQUEST);
    });

    it('should map 400 with tx_bad_seq to TX_BAD_SEQ', () => {
      const error = ErrorMapper.fromHorizon(
        400,
        {
          title: 'Transaction Failed',
          detail: 'tx_bad_seq',
          extras: { result_codes: { transaction: 'tx_bad_seq' } },
        },
        '/transactions',
      );
      expect(error.code).toBe(ApiErrorCode.TX_BAD_SEQ);
    });

    it('should map 400 with tx_insufficient_balance', () => {
      const error = ErrorMapper.fromHorizon(
        400,
        {
          title: 'Transaction Failed',
          extras: { result_codes: { transaction: 'tx_insufficient_balance' } },
        },
        '/transactions',
      );
      expect(error.code).toBe(ApiErrorCode.TX_INSUFFICIENT_BALANCE);
    });

    it('should map 400 with tx_failed', () => {
      const error = ErrorMapper.fromHorizon(
        400,
        {
          title: 'Transaction Failed',
          extras: { result_codes: { transaction: 'tx_failed', operations: ['op_no_trust'] } },
        },
        '/transactions',
      );
      expect(error.code).toBe(ApiErrorCode.TX_FAILED);
    });

    it('should map 400 with unknown tx result to TX_FAILED', () => {
      const error = ErrorMapper.fromHorizon(
        400,
        {
          title: 'Transaction Failed',
          extras: { result_codes: { transaction: 'tx_some_unknown' } },
        },
        '/transactions',
      );
      expect(error.code).toBe(ApiErrorCode.TX_FAILED);
    });

    it('should map unknown status to UNKNOWN', () => {
      const error = ErrorMapper.fromHorizon(418, undefined, '/teapot');
      expect(error.code).toBe(ApiErrorCode.UNKNOWN);
    });

    it('should use detail as message when present', () => {
      const error = ErrorMapper.fromHorizon(
        404,
        { title: 'Resource Missing', detail: 'The account was not found' },
        '/accounts/X',
      );
      expect(error.message).toBe('The account was not found');
    });

    it('should fall back to title when detail is empty', () => {
      const error = ErrorMapper.fromHorizon(
        500,
        { title: 'Internal Error', detail: '' },
        '/',
      );
      expect(error.message).toBe('Internal Error');
    });

    it('should handle undefined body', () => {
      const error = ErrorMapper.fromHorizon(500, undefined, '/');
      expect(error).toBeInstanceOf(ApiError);
      expect(error.message).toBe('Unknown Error');
    });
  });
});
