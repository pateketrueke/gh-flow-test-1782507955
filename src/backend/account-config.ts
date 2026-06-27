export const supportedCountries = ['US', 'UK', 'CA', 'NZ', 'ES'] as const;

export type SupportedCountry = (typeof supportedCountries)[number];

export type MerchantCapability =
  | 'card_payments'
  | 'transfers'
  | 'tax_reporting_us_1099_k'
  | 'tax_reporting_gb_vat'
  | 'tax_reporting_ca_gst_hst'
  | 'tax_reporting_nz_gst'
  | 'tax_reporting_es_vat';

export type AccountsV2CreateRequest = {
  country: SupportedCountry;
  defaults: {
    responsibilities: {
      fee_collector: 'application';
      losses_collector: 'stripe';
    };
  };
  configuration: {
    merchant: {
      dashboard: 'full';
      capabilities: MerchantCapability[];
    };
  };
};

export type AccountConfig = AccountsV2CreateRequest;

export type ConnectedAccount = {
  id: string;
  country: SupportedCountry;
};

export type SubscriberRecord = {
  id: string;
  country: SupportedCountry;
  connectedAccountId?: string;
};

export type SubscriberRepository = {
  findById(subscriberId: string): Promise<SubscriberRecord | undefined>;
  create(record: Pick<SubscriberRecord, 'id' | 'country'>): Promise<SubscriberRecord>;
  setConnectedAccountId(
    subscriberId: string,
    connectedAccountId: string,
  ): Promise<SubscriberRecord>;
};

export type AccountsV2Client = {
  createAccount(
    request: AccountsV2CreateRequest,
    options: { idempotencyKey: string },
  ): Promise<ConnectedAccount>;
};

export type ProvisionConnectedAccountInput = {
  subscriberId: string;
  country: string;
  idempotencyKey?: string;
};

export type ProvisionConnectedAccountResult = {
  subscriber: SubscriberRecord;
  account: ConnectedAccount;
  request: AccountsV2CreateRequest;
  idempotencyKey: string;
};

const merchantCapabilitiesByCountry: Record<SupportedCountry, MerchantCapability[]> = {
  US: ['card_payments', 'transfers', 'tax_reporting_us_1099_k'],
  UK: ['card_payments', 'transfers', 'tax_reporting_gb_vat'],
  CA: ['card_payments', 'transfers', 'tax_reporting_ca_gst_hst'],
  NZ: ['card_payments', 'transfers', 'tax_reporting_nz_gst'],
  ES: ['card_payments', 'transfers', 'tax_reporting_es_vat'],
};

export function isSupportedCountry(country: string): country is SupportedCountry {
  return supportedCountries.includes(country as SupportedCountry);
}

export function getMerchantCapabilities(country: SupportedCountry): MerchantCapability[] {
  return [...merchantCapabilitiesByCountry[country]];
}

export function createAccountConfig(country: string): AccountConfig {
  if (!isSupportedCountry(country)) {
    throw new Error(`Unsupported country: ${country}`);
  }

  return {
    country,
    defaults: {
      responsibilities: {
        fee_collector: 'application',
        losses_collector: 'stripe',
      },
    },
    configuration: {
      merchant: {
        dashboard: 'full',
        capabilities: getMerchantCapabilities(country),
      },
    },
  };
}

export class InMemorySubscriberRepository implements SubscriberRepository {
  readonly #subscribers = new Map<string, SubscriberRecord>();

  constructor(initialSubscribers: SubscriberRecord[] = []) {
    for (const subscriber of initialSubscribers) {
      this.#subscribers.set(subscriber.id, { ...subscriber });
    }
  }

  async findById(subscriberId: string): Promise<SubscriberRecord | undefined> {
    const subscriber = this.#subscribers.get(subscriberId);
    return subscriber ? { ...subscriber } : undefined;
  }

  async create(record: Pick<SubscriberRecord, 'id' | 'country'>): Promise<SubscriberRecord> {
    const existing = this.#subscribers.get(record.id);
    if (existing) {
      return { ...existing };
    }

    const subscriber = { ...record };
    this.#subscribers.set(record.id, subscriber);
    return { ...subscriber };
  }

  async setConnectedAccountId(
    subscriberId: string,
    connectedAccountId: string,
  ): Promise<SubscriberRecord> {
    const subscriber = this.#subscribers.get(subscriberId);
    if (!subscriber) {
      throw new Error(`Subscriber not found: ${subscriberId}`);
    }

    const updated = { ...subscriber, connectedAccountId };
    this.#subscribers.set(subscriberId, updated);
    return { ...updated };
  }
}

export async function provisionConnectedAccountForSubscriber(
  input: ProvisionConnectedAccountInput,
  dependencies: {
    accounts: AccountsV2Client;
    subscribers: SubscriberRepository;
  },
): Promise<ProvisionConnectedAccountResult> {
  if (!isSupportedCountry(input.country)) {
    throw new Error(`Unsupported country: ${input.country}`);
  }

  const existingSubscriber = await dependencies.subscribers.findById(input.subscriberId);
  if (existingSubscriber && existingSubscriber.country !== input.country) {
    throw new Error(
      `Subscriber ${input.subscriberId} country cannot change from ${existingSubscriber.country} to ${input.country}`,
    );
  }

  const subscriber =
    existingSubscriber ??
    (await dependencies.subscribers.create({
      id: input.subscriberId,
      country: input.country,
    }));

  const request = createAccountConfig(subscriber.country);
  const idempotencyKey =
    input.idempotencyKey ?? `subscriber:${input.subscriberId}:connected-account`;

  if (subscriber.connectedAccountId) {
    return {
      subscriber,
      account: {
        id: subscriber.connectedAccountId,
        country: subscriber.country,
      },
      request,
      idempotencyKey,
    };
  }

  const account = await dependencies.accounts.createAccount(request, { idempotencyKey });
  const persistedSubscriber = await dependencies.subscribers.setConnectedAccountId(
    subscriber.id,
    account.id,
  );

  return {
    subscriber: persistedSubscriber,
    account,
    request,
    idempotencyKey,
  };
}
