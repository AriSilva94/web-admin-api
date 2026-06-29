import { FriendsController } from './friends.controller';

describe('FriendsController', () => {
  it('envia solicitação em nome do usuário autenticado', async () => {
    const friends = {
      sendRequest: jest.fn().mockResolvedValue({ id: 'request-1' }),
    };
    const controller = new FriendsController(friends as never);

    await expect(
      controller.send(
        { userId: 'user-1', email: 'me@example.com' },
        { email: 'friend@example.com' },
      ),
    ).resolves.toEqual({ id: 'request-1' });
    expect(friends.sendRequest).toHaveBeenCalledWith(
      'user-1',
      'friend@example.com',
    );
  });
});
