import { describe, it, expect } from 'vitest';
import { createAccountConfig } from './account-config.js';

describe('createAccountConfig', () => {
  it('creates config with UA-2 traits for a supported country', () => {
    const config = createAccountConfig('US');
    expect(config.feeCollector).toBe('application');
    expect(config.lossesCollector).toBe('stripe');
    expect(config.dashboard).toBe('full');
    expect(config.country).toBe('US');
  });

  it('rejects unsupported country', () => {
    expect(() => createAccountConfig('XX')).toThrow('Unsupported country');
  });

  it('supports all required countries', () => {
    const countries = ['US', 'UK', 'CA', 'NZ', 'ES'];
    for (const country of countries) {
      const config = createAccountConfig(country);
      expect(config.country).toBe(country);
    }
  });
});
