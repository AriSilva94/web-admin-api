import { HuntsController } from './hunts.controller';

describe('HuntsController', () => {
  it('delegates creation with the authenticated user id', async () => {
    const hunts = {
      create: jest.fn().mockResolvedValue({ id: 'hunt-1' }),
    };
    const controller = new HuntsController(hunts as never);
    const dto = { raw: 'analyzer', visibility: 'PRIVATE' as const };

    await expect(
      controller.create({ userId: 'user-1', email: 'u@test.com' }, dto),
    ).resolves.toEqual({ id: 'hunt-1' });
    expect(hunts.create).toHaveBeenCalledWith('user-1', dto);
  });
});
