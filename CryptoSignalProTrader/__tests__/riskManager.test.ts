import { checkFlashCrash, checkSpreadLimit, shouldEmergencyClose } from '../src/engine/riskManager';

describe('Risk Manager', () => {
  test('checkFlashCrash should detect crash', () => {
    const prices = [100, 99, 98, 95, 90, 85];
    expect(checkFlashCrash(prices)).toBe(true);
  });

  test('checkFlashCrash should not trigger on normal movement', () => {
    const prices = [100, 100.5, 99.5, 100, 100.2, 99.8];
    expect(checkFlashCrash(prices)).toBe(false);
  });

  test('checkSpreadLimit should detect tight spread', () => {
    const result = checkSpreadLimit(100, 100.1);
    expect(result.withinLimit).toBe(true);
    expect(result.spreadPct).toBeCloseTo(0.1, 1);
  });

  test('checkSpreadLimit should detect wide spread', () => {
    const result = checkSpreadLimit(100, 101);
    expect(result.withinLimit).toBe(false);
    expect(result.spreadPct).toBeCloseTo(1, 0);
  });

  test('shouldEmergencyClose on API disconnect', () => {
    const disconnectedTime = Date.now() - 121000;
    const result = shouldEmergencyClose(disconnectedTime, 5, 15);
    expect(result.shouldClose).toBe(true);
  });

  test('shouldEmergencyClose on max drawdown', () => {
    const result = shouldEmergencyClose(null, 16, 15);
    expect(result.shouldClose).toBe(true);
  });

  test('shouldEmergencyClose should not trigger normally', () => {
    const result = shouldEmergencyClose(null, 5, 15);
    expect(result.shouldClose).toBe(false);
  });
});
