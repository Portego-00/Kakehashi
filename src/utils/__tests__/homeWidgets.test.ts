import { addConversationHomeWidget, DEFAULT_HOME_WIDGET_ORDER, getAvailableHomeWidgets, getVisibleHomeWidgetOrder, normalizeHomeWidgetOrder } from '../homeWidgets';

describe('conversation Home widget', () => {
  it('appears immediately after Extra Study in the default order', () => {
    expect(DEFAULT_HOME_WIDGET_ORDER[DEFAULT_HOME_WIDGET_ORDER.indexOf('extraStudy') + 1]).toBe('conversation');
    expect(DEFAULT_HOME_WIDGET_ORDER.filter(id => id === 'conversation')).toHaveLength(1);
  });

  it('inserts after Extra Study without changing the other saved choices', () => {
    const existing = ['lessonsReviews', 'reviewHeatmap', 'extraStudy', 'studyTime'];
    expect(addConversationHomeWidget(existing)).toEqual(['lessonsReviews', 'reviewHeatmap', 'extraStudy', 'conversation', 'studyTime']);
    expect(existing).toEqual(['lessonsReviews', 'reviewHeatmap', 'extraStudy', 'studyTime']);
  });

  it('appends when Extra Study is hidden and preserves an existing custom conversation position', () => {
    expect(addConversationHomeWidget(['lessonsReviews', 'reviewHeatmap'])).toEqual(['lessonsReviews', 'reviewHeatmap', 'conversation']);
    expect(addConversationHomeWidget(['lessonsReviews', 'conversation', 'extraStudy'])).toEqual(['lessonsReviews', 'conversation', 'extraStudy']);
  });

  it('keeps a later hidden choice hidden during ordinary normalization', () => {
    expect(normalizeHomeWidgetOrder(['lessonsReviews', 'extraStudy', 'streak'])).toEqual(['lessonsReviews', 'extraStudy', 'streak']);
  });

  it.each([
    ['Portego', true, true],
    [' portego ', true, true],
    ['Portego', false, false],
    ['Someone else', true, false],
    ['Portego2', true, false],
    [null, true, false],
  ] as const)('filters Home rows and customization choices together for %s / signed in %s', (username, signedIn, allowed) => {
    const order = ['lessonsReviews', 'extraStudy', 'conversation', 'streak'];
    expect(getAvailableHomeWidgets(username, signedIn).some(widget => widget.id === 'conversation')).toBe(allowed);
    expect(getVisibleHomeWidgetOrder(order, username, signedIn)).toEqual(allowed ? order : ['lessonsReviews', 'extraStudy', 'streak']);
  });
});
