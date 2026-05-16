import axios from 'axios';

import { ExternalClientFactory } from '../../../src/api/ExternalClientFactory';
import { ConfigManager } from '../../../src/config/ConfigManager';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ExternalClientFactory', () => {
  const config = new ConfigManager({ network: 'testnet' }).getConfig();
  let factory: ExternalClientFactory;
  let mockDefaults: { headers: { common: Record<string, string> } };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});

    mockDefaults = { headers: { common: {} } };
    mockedAxios.create.mockReturnValue({
      request: jest.fn(),
      defaults: mockDefaults,
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    } as unknown as ReturnType<typeof axios.create>);

    factory = new ExternalClientFactory(config);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should create an ApiClient with the given base URL', () => {
    const client = factory.create('https://api-baas.wirexapp.tech');
    expect(client).toBeDefined();
    expect(mockedAxios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'https://api-baas.wirexapp.tech',
      }),
    );
  });

  it('should use default timeout from config when not specified', () => {
    factory.create('https://example.com');
    expect(mockedAxios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        timeout: config.timeout.api,
      }),
    );
  });

  it('should use custom timeout when provided', () => {
    factory.create('https://example.com', { timeout: 5000 });
    expect(mockedAxios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        timeout: 5000,
      }),
    );
  });

  it('should set custom headers on the axios instance', () => {
    factory.create('https://api-baas.wirexapp.tech', {
      headers: {
        'Authorization': 'Bearer test-token',
        'X-Partner-Id': '0x00000044',
      },
    });
    expect(mockDefaults.headers.common['Authorization']).toBe('Bearer test-token');
    expect(mockDefaults.headers.common['X-Partner-Id']).toBe('0x00000044');
  });

  it('should not set headers when none provided', () => {
    factory.create('https://example.com');
    expect(Object.keys(mockDefaults.headers.common)).toHaveLength(0);
  });

  it('should return different client instances for different URLs', () => {
    const client1 = factory.create('https://api1.example.com');
    const client2 = factory.create('https://api2.example.com');
    expect(client1).not.toBe(client2);
    expect(mockedAxios.create).toHaveBeenCalledTimes(2);
  });
});
