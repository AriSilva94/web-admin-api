import { HuntShareController, SharedController } from './sharing.controller';

describe('Sharing controllers', () => {
  it('compartilha a hunt em nome do proprietário autenticado', async () => {
    const sharing = {
      share: jest.fn().mockResolvedValue({ id: 'share-1' }),
    };
    const controller = new HuntShareController(sharing as never);

    await expect(
      controller.share(
        { userId: 'owner-1', email: 'owner@example.com' },
        'hunt-1',
        { userId: 'friend-1' },
      ),
    ).resolves.toEqual({ id: 'share-1' });
    expect(sharing.share).toHaveBeenCalledWith('owner-1', 'hunt-1', 'friend-1');
  });

  it('lista hunts compartilhadas com paginação', async () => {
    const sharing = {
      listShared: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    };
    const controller = new SharedController(sharing as never);

    await controller.list(
      { userId: 'user-1', email: 'user@example.com' },
      { page: 2, pageSize: 10 },
    );

    expect(sharing.listShared).toHaveBeenCalledWith('user-1', {
      page: 2,
      pageSize: 10,
    });
  });
});
