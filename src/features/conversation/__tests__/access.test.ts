import { canAccessConversation } from '../access';

describe('private conversation module', () => {
  it('only grants Portego access, including route checks before mounting the feature', () => {
    expect(canAccessConversation(' Portego ')).toBe(true);
    for (const username of ['portego2', 'another-user', '', null, undefined]) expect(canAccessConversation(username)).toBe(false);
  });
});
