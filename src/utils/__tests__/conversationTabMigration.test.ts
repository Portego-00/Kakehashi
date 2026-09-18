import { permanentStorage } from '../permanentStorage';
import { useSettingsStore, type CustomTabId } from '../store';

describe('standalone conversation tab migration', () => {
  afterEach(() => { useSettingsStore.setState(useSettingsStore.getInitialState(), true); });

  it('removes the retired tab from an existing saved order and keeps other settings', async () => {
    permanentStorage.set('wanikani-settings', JSON.stringify({
      version: 21,
      state: { customTabOrder: ['home', 'conversation', 'progress', 'epubs', 'news'], newsSourcePreference: 'both', noteLinkIncludeCharacters: true },
    }));
    await useSettingsStore.persist.rehydrate();

    expect(useSettingsStore.getState().customTabOrder).toEqual(['home', 'progress', 'epubs', 'news']);
    expect(useSettingsStore.getState().newsSourcePreference).toBe('both');
    expect(useSettingsStore.getState().noteLinkIncludeCharacters).toBe(true);
    const saved = JSON.parse(permanentStorage.getString('wanikani-settings')!);
    expect(saved.version).toBe(23);
    expect(saved.state.customTabOrder).toEqual(['home', 'progress', 'epubs', 'news']);
  });

  it('uses the normal default order if the retired tab was the only saved entry', async () => {
    permanentStorage.set('wanikani-settings', JSON.stringify({ version: 21, state: { customTabOrder: ['conversation'] } }));
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState().customTabOrder).toEqual(useSettingsStore.getInitialState().customTabOrder);
    expect(useSettingsStore.getState().customTabOrder).not.toContain('conversation');
  });

  it('does not allow an old caller to add the retired tab again', () => {
    useSettingsStore.getState().setCustomTabOrder(['home', 'conversation', 'news'] as CustomTabId[]);
    expect(useSettingsStore.getState().customTabOrder).toEqual(['home', 'news']);
  });
});
