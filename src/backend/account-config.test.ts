import { describe, it, expect } from 'vitest';
import {
  InMemorySubscriberRepository,
  createAccountConfig,
  provisionConnectedAccountForSubscriber,
  supportedCountries,
  type AccountsV2Client,
  type AccountsV2CreateRequest,
  type ConnectedAccount,
} from './account-config.js';

type CreateCall = {
  request: AccountsV2CreateRequest;
  idempotencyKey: string;
};

class FakeAccountsV2Client implements AccountsV2Client {
  readonly createCalls: CreateCall[] = [];
  readonly #accountsByIdempotencyKey = new Map<string, ConnectedAccount>();

  async createAccount(
    request: AccountsV2CreateRequest,
    options: { idempotencyKey: string },
  ): Promise<ConnectedAccount> {
    this.createCalls.push({ request, idempotencyKey: options.idempotencyKey });

    const existingAccount = this.#accountsByIdempotencyKey.get(options.idempotencyKey);
    if (existingAccount) {
      return existingAccount;
    }

    const account = {
      id: `acct_${this.#accountsByIdempotencyKey.size + 1}`,
      country: request.country,
    };
    this.#accountsByIdempotencyKey.set(options.idempotencyKey, account);
    return account;
  }
}

describe('createAccountConfig', () => {
  it('creates an Accounts v2 request with UA-2 traits for a supported country', () => {
    const config = createAccountConfig('US');

    expect(config.defaults.responsibilities.fee_collector).toBe('application');
    expect(config.defaults.responsibilities.losses_collector).toBe('stripe');
    expect(config.configuration.merchant.dashboard).toBe('full');
    expect(config.configuration.merchant.capabilities).toContain('card_payments');
    expect(config.configuration.merchant.capabilities).toContain('transfers');
    expect(config.country).toBe('US');
  });

  it('rejects unsupported countries', () => {
    expect(() => createAccountConfig('XX')).toThrow('Unsupported country: XX');
  });

  it.each(supportedCountries)(
    'sets country-specific merchant capabilities for %s',
    (country) => {
      const config = createAccountConfig(country);

      expect(config.country).toBe(country);
      expect(config.configuration.merchant.capabilities.length).toBeGreaterThan(2);
      expect(config.configuration.merchant.capabilities).toContain('card_payments');
      expect(config.configuration.merchant.capabilities).toContain('transfers');
    },
  );
});

describe('provisionConnectedAccountForSubscriber', () => {
  it.each(supportedCountries)(
    'creates and persists a connected account for subscribers in %s',
    async (country) => {
      const accounts = new FakeAccountsV2Client();
      const subscribers = new InMemorySubscriberRepository();

      const result = await provisionConnectedAccountForSubscriber(
        {
          subscriberId: `sub_${country.toLowerCase()}`,
          country,
        },
        { accounts, subscribers },
      );

      expect(accounts.createCalls).toHaveLength(1);
      expect(accounts.createCalls[0]?.request.country).toBe(country);
      expect(result.account.country).toBe(country);
      expect(result.subscriber.connectedAccountId).toBe(result.account.id);

      const persistedSubscriber = await subscribers.findById(result.subscriber.id);
      expect(persistedSubscriber?.connectedAccountId).toBe(result.account.id);
    },
  );

  it('sends the idempotency key on the Accounts v2 create call', async () => {
    const accounts = new FakeAccountsV2Client();
    const subscribers = new InMemorySubscriberRepository();

    const result = await provisionConnectedAccountForSubscriber(
      {
        subscriberId: 'sub_1',
        country: 'US',
        idempotencyKey: 'subscriber:sub_1:connected-account',
      },
      { accounts, subscribers },
    );

    expect(result.idempotencyKey).toBe('subscriber:sub_1:connected-account');
    expect(accounts.createCalls[0]?.idempotencyKey).toBe(
      'subscriber:sub_1:connected-account',
    );
  });

  it('uses idempotency to avoid duplicate account IDs on retry', async () => {
    const accounts = new FakeAccountsV2Client();
    const idempotencyKey = 'subscriber:sub_retry:connected-account';

    const firstAttempt = await provisionConnectedAccountForSubscriber(
      {
        subscriberId: 'sub_retry',
        country: 'CA',
        idempotencyKey,
      },
      { accounts, subscribers: new InMemorySubscriberRepository() },
    );
    const retryAttempt = await provisionConnectedAccountForSubscriber(
      {
        subscriberId: 'sub_retry',
        country: 'CA',
        idempotencyKey,
      },
      { accounts, subscribers: new InMemorySubscriberRepository() },
    );

    expect(accounts.createCalls).toHaveLength(2);
    expect(firstAttempt.account.id).toBe(retryAttempt.account.id);
  });

  it('does not create another account when the subscriber already has one persisted', async () => {
    const accounts = new FakeAccountsV2Client();
    const subscribers = new InMemorySubscriberRepository([
      {
        id: 'sub_existing',
        country: 'NZ',
        connectedAccountId: 'acct_existing',
      },
    ]);

    const result = await provisionConnectedAccountForSubscriber(
      {
        subscriberId: 'sub_existing',
        country: 'NZ',
      },
      { accounts, subscribers },
    );

    expect(accounts.createCalls).toHaveLength(0);
    expect(result.account.id).toBe('acct_existing');
    expect(result.subscriber.connectedAccountId).toBe('acct_existing');
  });

  it('preserves subscriber country and rejects attempts to change it', async () => {
    const accounts = new FakeAccountsV2Client();
    const subscribers = new InMemorySubscriberRepository([
      {
        id: 'sub_country',
        country: 'US',
      },
    ]);

    await expect(
      provisionConnectedAccountForSubscriber(
        {
          subscriberId: 'sub_country',
          country: 'ES',
        },
        { accounts, subscribers },
      ),
    ).rejects.toThrow('country cannot change from US to ES');

    const subscriber = await subscribers.findById('sub_country');
    expect(subscriber?.country).toBe('US');
    expect(accounts.createCalls).toHaveLength(0);
  });
});
