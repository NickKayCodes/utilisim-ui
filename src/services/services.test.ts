import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../lib/api';
import { archiveApi } from './archive';
import { authApi } from './auth';
import { oracleApi } from './oracle';
import { simulationApi } from './simulation';
import { tomesApi } from './tomes';
import type { DebtSnapshot, ScenarioInput, TomeRequest } from '../types/api';

vi.mock('../lib/api', () => ({ api: vi.fn() }));

const apiMock = vi.mocked(api);

beforeEach(() => {
  apiMock.mockReset();
  apiMock.mockResolvedValue(undefined);
});

const debt: DebtSnapshot = {
  tomeId: 't1',
  accountName: 'Card',
  currentBalance: 100,
  apr: 20,
  estimatedApr: 16,
  minimumPayment: 10,
  interestRate: 20,
};

const scenario: ScenarioInput = {
  name: 'Aggressive',
  strategy: 'SNOWBALL',
  extraPayment: 50,
  lumpSumPayment: 0,
};

const tomeRequest: TomeRequest = {
  name: 'Card',
  currentBalance: 100,
  apr: 20,
  minimumDebtPayment: 10,
  creditLimit: 1000,
  type: 'CREDIT_CARD',
};

describe('archiveApi', () => {
  it('covers list, get, create, update and remove', async () => {
    await archiveApi.list();
    await archiveApi.get('id with/slash');
    await archiveApi.create(scenario);
    await archiveApi.update('id 1', scenario);
    await archiveApi.remove('id 1');

    expect(apiMock).toHaveBeenNthCalledWith(1, '/api/archive/scenarios');
    expect(apiMock).toHaveBeenNthCalledWith(2, '/api/archive/scenarios/id%20with%2Fslash');
    expect(apiMock).toHaveBeenNthCalledWith(3, '/api/archive/scenarios', {
      method: 'POST',
      body: scenario,
    });
    expect(apiMock).toHaveBeenNthCalledWith(4, '/api/archive/scenarios/id%201', {
      method: 'PUT',
      body: scenario,
    });
    expect(apiMock).toHaveBeenNthCalledWith(5, '/api/archive/scenarios/id%201', {
      method: 'DELETE',
    });
  });
});

describe('authApi', () => {
  it('posts login and register without a token', async () => {
    const login = { email: 'user@example.com', password: 'secret' };
    const register = { username: 'user', email: 'user@example.com', password: 'secret' };

    await authApi.login(login);
    await authApi.register(register);

    expect(apiMock).toHaveBeenNthCalledWith(1, '/api/auth/login', {
      method: 'POST',
      body: login,
      auth: false,
    });
    expect(apiMock).toHaveBeenNthCalledWith(2, '/api/auth/register', {
      method: 'POST',
      body: register,
      auth: false,
    });
  });
});

describe('oracleApi', () => {
  it('posts strategy requests to the expected paths', async () => {
    const input = { strategyType: 'SNOWBALL' as const, extraPayment: 0, lumpSumPayment: 0 };

    await oracleApi.order([debt], input);
    await oracleApi.recommend([debt]);
    await oracleApi.analyze([debt], ['SNOWBALL', 'AVALANCHE'], {
      extraPayment: 10,
      lumpSumPayment: 5,
    });
    await oracleApi.totalInterest([debt]);
    await oracleApi.isDeterministic('MINIMUM_ONLY');

    expect(apiMock).toHaveBeenNthCalledWith(1, '/api/oracle/strategy/order', {
      method: 'POST',
      body: { debts: [debt], input },
    });
    expect(apiMock).toHaveBeenNthCalledWith(2, '/api/oracle/strategy/recommend', {
      method: 'POST',
      body: [debt],
    });
    expect(apiMock).toHaveBeenNthCalledWith(3, '/api/oracle/strategy/analyze', {
      method: 'POST',
      body: {
        debts: [debt],
        strategies: ['SNOWBALL', 'AVALANCHE'],
        input: { extraPayment: 10, lumpSumPayment: 5 },
      },
    });
    expect(apiMock).toHaveBeenNthCalledWith(4, '/api/oracle/strategy/calculate-total-interest', {
      method: 'POST',
      body: [debt],
    });
    expect(apiMock).toHaveBeenNthCalledWith(
      5,
      '/api/oracle/strategy/is-deterministic/MINIMUM_ONLY',
    );
  });
});

describe('simulationApi', () => {
  it('posts the simulation input', async () => {
    const body = {
      principal: 1000,
      interestRate: 0.2,
      termMonths: 12,
      minimumPayment: 100,
      extraPayment: 0,
      lumpSumPayment: 0,
      strategy: 'SNOWBALL' as const,
    };

    await simulationApi.run(body);

    expect(apiMock).toHaveBeenCalledWith('/api/assemble/run', { method: 'POST', body });
  });

  it('runs a single ledger plan', async () => {
    const body = { tomeIds: ['t1'], plan: 'CURRENT' as const };

    await simulationApi.runPlan(body);

    expect(apiMock).toHaveBeenCalledWith('/api/simulate/run', { method: 'POST', body });
  });

  it('compares plans and reads persisted results', async () => {
    const body = { tomeIds: ['t1'], extraPayment: 100 };

    await simulationApi.compare(body);
    await simulationApi.getRun(7);
    await simulationApi.getComparison('group/id');
    await simulationApi.history(5);

    expect(apiMock).toHaveBeenNthCalledWith(1, '/api/simulate/compare', {
      method: 'POST',
      body,
    });
    expect(apiMock).toHaveBeenNthCalledWith(2, '/api/simulate/runs/7');
    expect(apiMock).toHaveBeenNthCalledWith(3, '/api/simulate/comparisons/group%2Fid');
    expect(apiMock).toHaveBeenNthCalledWith(4, '/api/simulate/runs?limit=5');
  });
});

describe('tomesApi', () => {
  it('covers list, create and remove', async () => {
    await tomesApi.list();
    await tomesApi.create(tomeRequest);
    await tomesApi.remove('id 1');

    expect(apiMock).toHaveBeenNthCalledWith(1, '/api/tomes');
    expect(apiMock).toHaveBeenNthCalledWith(2, '/api/tomes', {
      method: 'POST',
      body: tomeRequest,
    });
    expect(apiMock).toHaveBeenNthCalledWith(3, '/api/tomes/id%201', { method: 'DELETE' });
  });
});
