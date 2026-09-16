import { permanentStorage } from '../permanentStorage';
import { useSettingsStore } from '../store';

describe('conversation Home widget settings migration', () => {
  afterEach(() => { useSettingsStore.setState(useSettingsStore.getInitialState(), true); });

  it('migrates schema 22 once, adding the widget after Extra Study and preserving other preferences', async () => {
    permanentStorage.set('wanikani-settings', JSON.stringify({ version: 22, state: {
      homeWidgetOrder: ['lessonsReviews', 'streak', 'extraStudy', 'reviewForecast'],
      customTabOrder: ['home', 'epubs', 'news'],
      newsSourcePreference: 'both',
    } }));
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState().homeWidgetOrder).toEqual(['lessonsReviews', 'streak', 'extraStudy', 'conversation', 'reviewForecast']);
    expect(useSettingsStore.getState().customTabOrder).toEqual(['home', 'epubs', 'news']);
    expect(useSettingsStore.getState().newsSourcePreference).toBe('both');
    expect(JSON.parse(permanentStorage.getString('wanikani-settings')!).version).toBe(23);
  });

  it('appends to a customized order without Extra Study', async () => {
    permanentStorage.set('wanikani-settings', JSON.stringify({ version: 22, state: { homeWidgetOrder: ['lessonsReviews', 'studyTime', 'reviewHeatmap'] } }));
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState().homeWidgetOrder).toEqual(['lessonsReviews', 'studyTime', 'reviewHeatmap', 'conversation']);
  });

  it('persists hiding and reordering after the migration instead of reinserting on launch', async () => {
    useSettingsStore.getState().setHomeWidgetOrder(['lessonsReviews', 'conversation', 'extraStudy']);
    const reordered = permanentStorage.getString('wanikani-settings')!;
    useSettingsStore.setState({ homeWidgetOrder: useSettingsStore.getInitialState().homeWidgetOrder });
    permanentStorage.set('wanikani-settings', reordered);
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState().homeWidgetOrder).toEqual(['lessonsReviews', 'conversation', 'extraStudy']);

    useSettingsStore.getState().removeHomeWidget('conversation');
    const hidden = permanentStorage.getString('wanikani-settings')!;
    useSettingsStore.setState({ homeWidgetOrder: useSettingsStore.getInitialState().homeWidgetOrder });
    permanentStorage.set('wanikani-settings', hidden);
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState().homeWidgetOrder).toEqual(['lessonsReviews', 'extraStudy']);
  });
});
