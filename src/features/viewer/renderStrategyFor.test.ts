import { renderStrategyFor } from '@shared/types';

describe('renderStrategyFor', () => {
  it('classifies application/pdf as pdf', () => {
    expect(renderStrategyFor('application/pdf')).toBe('pdf');
  });

  it('classifies image/* content types as image', () => {
    expect(renderStrategyFor('image/png')).toBe('image');
    expect(renderStrategyFor('image/jpeg')).toBe('image');
    expect(renderStrategyFor('image/tiff')).toBe('image');
  });

  it('handles parameters and casing in the content-type', () => {
    expect(renderStrategyFor('IMAGE/PNG; charset=binary')).toBe('image');
    expect(renderStrategyFor(' application/pdf ; v=1.7 ')).toBe('pdf');
  });

  it('returns unsupported for Office and unknown types', () => {
    expect(
      renderStrategyFor(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ),
    ).toBe('unsupported');
    expect(
      renderStrategyFor('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    ).toBe('unsupported');
    expect(renderStrategyFor('application/octet-stream')).toBe('unsupported');
  });

  it('returns unsupported for empty / null / undefined', () => {
    expect(renderStrategyFor('')).toBe('unsupported');
    expect(renderStrategyFor(null)).toBe('unsupported');
    expect(renderStrategyFor(undefined)).toBe('unsupported');
  });
});
