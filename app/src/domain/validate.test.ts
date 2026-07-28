import { describe, expect, it } from 'vitest';
import { checkDate, checkDeparture, checkMoney, checkRate, checkYears } from './validate';

describe('date validation while typing', () => {
  it('rejects the years a part-typed date passes through', () => {
    // Typing "2026" into a year field goes 0002 -> 0020 -> 0202 -> 2026.
    expect(checkDate('0002-04-01', 'Start').error).toBeTruthy();
    expect(checkDate('0202-04-01', 'Start').error).toBeTruthy();
    expect(checkDate('2026-04-01', 'Start').error).toBeNull();
  });

  it('rejects an empty or partial value rather than passing it through', () => {
    expect(checkDate('', 'Start').error).toBeTruthy();
    expect(checkDate('2026-04', 'Start').error).toBeTruthy();
  });

  it('rejects a date that does not exist', () => {
    // Date would silently roll 31 February forward to 3 March.
    expect(checkDate('2026-02-31', 'Start').error).toBeTruthy();
    expect(checkDate('2026-13-01', 'Start').error).toBeTruthy();
  });

  it('rejects a departure before arrival', () => {
    expect(checkDeparture('2025-01-01', '2026-04-01').error).toBeTruthy();
    expect(checkDeparture('2030-01-01', '2026-04-01').error).toBeNull();
    expect(checkDeparture('', '2026-04-01').error).toBeNull();
  });
});

describe('money and rate validation', () => {
  it('accepts what people actually paste', () => {
    expect(checkMoney('$180,000', 'Salary').value).toBe(180000);
    expect(checkMoney(' 90000 ', 'Salary').value).toBe(90000);
  });

  it('rejects negatives, blanks and nonsense', () => {
    expect(checkMoney('-5', 'Salary').error).toBeTruthy();
    expect(checkMoney('', 'Salary').error).toBeTruthy();
    expect(checkMoney('abc', 'Salary').error).toBeTruthy();
  });

  it('catches an exchange rate that is clearly wrong', () => {
    expect(checkRate('150', 'Rate').error).toBeNull();
    expect(checkRate('0', 'Rate').error).toBeTruthy();
    expect(checkRate('1.5', 'Rate').error).toBeTruthy();
  });

  it('bounds the projection horizon', () => {
    expect(checkYears('8').error).toBeNull();
    expect(checkYears('0').error).toBeTruthy();
    expect(checkYears('500').error).toBeTruthy();
    expect(checkYears('2.5').error).toBeTruthy();
  });
});
