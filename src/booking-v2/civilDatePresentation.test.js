import {
  civilDateFromLocalDate,
  formatCivilDate,
  isCivilDateToday,
  isCivilDateWithinInclusiveRange,
} from './civilDatePresentation';

describe('civil-date presentation without UTC date shifts', () => {
  test('serializes the local calendar fields rather than an ISO instant', () => {
    const date = new Date(2026, 0, 1, 23, 30);
    const toISOString = jest
      .spyOn(Date.prototype, 'toISOString')
      .mockImplementation(() => {
        throw new Error('UTC serialization must not be used');
      });

    expect(civilDateFromLocalDate(date)).toBe('2026-01-01');
    expect(toISOString).not.toHaveBeenCalled();

    toISOString.mockRestore();
  });

  test('formats positive and negative offset boundary dates as written', () => {
    const options = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };

    expect(formatCivilDate('2026-01-01', 'en-US', options)).toBe(
      'Thursday, January 1, 2026'
    );
    expect(formatCivilDate('2026-12-31', 'en-US', options)).toBe(
      'Thursday, December 31, 2026'
    );
  });

  test('compares canonical civil dates without constructing instants', () => {
    expect(
      isCivilDateWithinInclusiveRange(
        '2026-03-29',
        '2026-03-28',
        '2026-03-30'
      )
    ).toBe(true);
    expect(
      isCivilDateWithinInclusiveRange(
        '2026-03-31',
        '2026-03-28',
        '2026-03-30'
      )
    ).toBe(false);
    expect(isCivilDateToday('2026-01-01', new Date(2026, 0, 1, 23, 59))).toBe(
      true
    );
  });

  test('rejects invalid or non-canonical values', () => {
    expect(() => formatCivilDate('2026-02-30', 'en-US')).toThrow();
    expect(() => isCivilDateToday('2026-1-01')).toThrow();
    expect(() => civilDateFromLocalDate(new Date('invalid'))).toThrow(
      TypeError
    );
  });
});
