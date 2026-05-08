import {
  INITIAL_LAYOUT_STATE,
  layoutReducer,
  type LayoutAction,
} from './layoutReducer';

describe('layoutReducer', () => {
  it('toggles chat panel open/closed', () => {
    const opened = layoutReducer(INITIAL_LAYOUT_STATE, { type: 'TOGGLE_CHAT_PANEL' });
    expect(opened.chatPanel.open).toBe(true);
    const closed = layoutReducer(opened, { type: 'TOGGLE_CHAT_PANEL' });
    expect(closed.chatPanel.open).toBe(false);
  });

  it('sets chat panel width without mutating other panels', () => {
    const result = layoutReducer(INITIAL_LAYOUT_STATE, {
      type: 'SET_CHAT_PANEL_WIDTH',
      widthPx: 500,
    });
    expect(result.chatPanel.widthPx).toBe(500);
    expect(result.viewerPanel).toEqual(INITIAL_LAYOUT_STATE.viewerPanel);
  });

  it('toggles, opens, and closes the viewer panel', () => {
    const toggled = layoutReducer(INITIAL_LAYOUT_STATE, { type: 'TOGGLE_VIEWER_PANEL' });
    expect(toggled.viewerPanel.open).toBe(true);

    const opened = layoutReducer(INITIAL_LAYOUT_STATE, { type: 'OPEN_VIEWER_PANEL' });
    expect(opened.viewerPanel.open).toBe(true);

    const closed = layoutReducer(opened, { type: 'CLOSE_VIEWER_PANEL' });
    expect(closed.viewerPanel.open).toBe(false);
  });

  it('sets viewer panel width', () => {
    const result = layoutReducer(INITIAL_LAYOUT_STATE, {
      type: 'SET_VIEWER_PANEL_WIDTH',
      widthPx: 720,
    });
    expect(result.viewerPanel.widthPx).toBe(720);
  });

  it('returns identical-shape state for every action type (exhaustive switch)', () => {
    const actions: LayoutAction[] = [
      { type: 'TOGGLE_CHAT_PANEL' },
      { type: 'SET_CHAT_PANEL_WIDTH', widthPx: 1 },
      { type: 'TOGGLE_VIEWER_PANEL' },
      { type: 'OPEN_VIEWER_PANEL' },
      { type: 'CLOSE_VIEWER_PANEL' },
      { type: 'SET_VIEWER_PANEL_WIDTH', widthPx: 1 },
    ];
    for (const action of actions) {
      const result = layoutReducer(INITIAL_LAYOUT_STATE, action);
      expect(result).toMatchObject({
        chatPanel: expect.objectContaining({ open: expect.any(Boolean), widthPx: expect.any(Number) }),
        viewerPanel: expect.objectContaining({ open: expect.any(Boolean), widthPx: expect.any(Number) }),
        theme: expect.any(String),
      });
    }
  });
});
