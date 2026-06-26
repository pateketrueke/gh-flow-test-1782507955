export type AccountConfig = {
  country: string;
  feeCollector: 'application';
  lossesCollector: 'stripe';
  dashboard: 'full';
};

export function createAccountConfig(country: string): AccountConfig {
  const supportedCountries = ['US', 'UK', 'CA', 'NZ', 'ES'];
  if (!supportedCountries.includes(country)) {
    throw new Error(`Unsupported country: ${country}`);
  }
  return {
    country,
    feeCollector: 'application',
    lossesCollector: 'stripe',
    dashboard: 'full',
  };
}
