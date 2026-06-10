import { beforeEach, describe, expect, it, vi } from 'vitest';
import { gsap } from 'gsap';
import { modePaneMotion } from './motion';

vi.mock('gsap', () => ({
  gsap: {
    fromTo: vi.fn(() => ({ kill: vi.fn() })),
    set: vi.fn(),
    to: vi.fn(),
  },
}));

describe('modePaneMotion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fades the visible pane with opacity only so layout measurements stay reliable', () => {
    const editorGrid = document.createElement('div');
    const sourcePane = document.createElement('section');
    const semanticPane = document.createElement('section');
    sourcePane.className = 'source-pane';
    semanticPane.className = 'semantic-pane';
    editorGrid.append(sourcePane, semanticPane);

    const action = modePaneMotion(editorGrid, { mode: 'semantic' });

    action.update({ mode: 'source' });

    const fromTo = vi.mocked(gsap.fromTo);
    expect(fromTo).toHaveBeenCalledTimes(1);

    const [target, fromVars, toVars] = fromTo.mock.calls[0];
    expect(target).toBe(sourcePane);
    expect(fromVars).toMatchObject({ opacity: 0 });
    expect(toVars).toMatchObject({ opacity: 1, clearProps: 'opacity' });
    expect(fromVars).not.toHaveProperty('autoAlpha');
    expect(toVars).not.toHaveProperty('autoAlpha');
    expect(fromVars).not.toHaveProperty('visibility');
    expect(toVars).not.toHaveProperty('visibility');
    expect(String(toVars.clearProps)).not.toContain('visibility');
  });
});
