import { DashboardController } from './dashboard.controller';

describe('DashboardController', () => {
  it('busca o resumo do usuário autenticado', async () => {
    const dashboard = {
      summary: jest.fn().mockResolvedValue({ totalHunts: 2 }),
    };
    const controller = new DashboardController(dashboard as never);

    await expect(
      controller.summary({ userId: 'user-1', email: 'u@test.com' }),
    ).resolves.toEqual({ totalHunts: 2 });
    expect(dashboard.summary).toHaveBeenCalledWith('user-1');
  });
});
