const { resolveAppUrl, sanitizePublicUrl } = require('../utils/urlHelper');

describe('urlHelper Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('1. Resolves live origin from req.headers.origin', () => {
    const req = {
      headers: {
        origin: 'https://bakewealthinternational.com'
      }
    };
    expect(resolveAppUrl(req)).toBe('https://bakewealthinternational.com');
  });

  test('2. Resolves live origin from req.headers.referer if origin missing', () => {
    const req = {
      headers: {
        referer: 'https://bakewealth.netlify.app/register'
      }
    };
    expect(resolveAppUrl(req)).toBe('https://bakewealth.netlify.app');
  });

  test('3. Falls back to APP_URL when request is missing', () => {
    process.env.APP_URL = 'https://bakewealthinternational.com';
    expect(resolveAppUrl(null)).toBe('https://bakewealthinternational.com');
  });

  test('4. Defaults to production domain https://bakewealthinternational.com in production', () => {
    delete process.env.APP_URL;
    process.env.NODE_ENV = 'production';
    expect(resolveAppUrl(null)).toBe('https://bakewealthinternational.com');
  });

  test('5. Sanitizes localhost URLs when resolved app URL is live domain', () => {
    process.env.APP_URL = 'https://bakewealthinternational.com';
    const localhostUrl = 'http://localhost:5173/?activate=8272c34dff164b9c0aa8cf44e3eae043a4cbc8f95ea5cd360a89edd1bb617ebe';
    const sanitized = sanitizePublicUrl(localhostUrl);
    expect(sanitized).toBe('https://bakewealthinternational.com/?activate=8272c34dff164b9c0aa8cf44e3eae043a4cbc8f95ea5cd360a89edd1bb617ebe');
  });

  test('6. Sanitizes 127.0.0.1 URLs', () => {
    process.env.APP_URL = 'https://bakewealthinternational.com';
    const localIpUrl = 'http://127.0.0.1:5173/?activate=test12345';
    const sanitized = sanitizePublicUrl(localIpUrl);
    expect(sanitized).toBe('https://bakewealthinternational.com/?activate=test12345');
  });
});
