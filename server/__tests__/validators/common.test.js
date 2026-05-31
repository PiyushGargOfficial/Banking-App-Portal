/**
 * Unit tests for the shared validation primitives.
 *
 * These are pure functions with no store / HTTP dependency, so the tests are
 * plain input -> boolean assertions. They're listed in `collectCoverageFrom`,
 * so leaving them untested showed up directly as a hole in the coverage report.
 *
 * The boundary cases matter most here: max lengths, the MAX_BALANCE ceiling,
 * decimal-place limits, and the exact enum membership.
 */
const { MAX_BALANCE } = require('../../config');
const {
  isValidEmail,
  isValidName,
  isValidBalance,
  isValidEmployeeRole,
  isValidEmployeeStatus,
  isValidAccountType,
  isValidCurrency,
  isValidAccountStatus
} = require('../../validators/common');

describe('isValidEmail', () => {
  it('accepts a normal address', () => {
    expect(isValidEmail('aarav.sharma@bankadmin.io')).toBe(true);
  });

  it.each([
    ['missing @', 'aaravbankadmin.io'],
    ['missing domain dot', 'aarav@bankadmin'],
    ['leading space', ' aarav@x.io'],
    ['internal space', 'aar av@x.io'],
    ['empty string', '']
  ])('rejects %s', (_label, value) => {
    expect(isValidEmail(value)).toBe(false);
  });

  it('rejects non-string input', () => {
    expect(isValidEmail(undefined)).toBe(false);
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(42)).toBe(false);
  });

  it('accepts an address exactly 120 characters long (the boundary)', () => {
    const local = 'a'.repeat(115);
    expect(`${local}@x.io`).toHaveLength(120);
    expect(isValidEmail(`${local}@x.io`)).toBe(true);
  });

  it('rejects an address longer than 120 characters', () => {
    const local = 'a'.repeat(116);
    expect(`${local}@x.io`).toHaveLength(121);
    expect(isValidEmail(`${local}@x.io`)).toBe(false);
  });
});

describe('isValidName', () => {
  it('accepts letters, spaces, hyphens and apostrophes', () => {
    expect(isValidName('Aarav')).toBe(true);
    expect(isValidName("O'Brien")).toBe(true);
    expect(isValidName('Anne-Marie')).toBe(true);
    expect(isValidName('Mary Jane')).toBe(true);
  });

  it('accepts pure-letter non-Latin scripts', () => {
    expect(isValidName('张伟')).toBe(true); // Han
    expect(isValidName('Иван')).toBe(true); // Cyrillic
  });

  it('currently REJECTS names containing combining marks (a known \\p{L}-only limitation)', () => {
    // Devanagari vowel signs (matras) are Unicode Mark (\p{M}), not Letter
    // (\p{L}), so the name pattern rejects them. Captured here so the
    // limitation is explicit and intentional rather than a silent surprise -
    // worth revisiting if the app needs to support such names.
    expect(isValidName('कुमार')).toBe(false);
  });

  it('rejects names shorter than 2 trimmed characters', () => {
    expect(isValidName('A')).toBe(false);
    expect(isValidName(' ')).toBe(false);
  });

  it('rejects names longer than 60 characters', () => {
    expect(isValidName('a'.repeat(61))).toBe(false);
  });

  it('rejects digits and symbols', () => {
    expect(isValidName('Aarav2')).toBe(false);
    expect(isValidName('Aarav!')).toBe(false);
    expect(isValidName('<script>')).toBe(false);
  });

  it('rejects a name that does not start with a letter', () => {
    expect(isValidName('-Aarav')).toBe(false);
    expect(isValidName(" 'Brien")).toBe(false);
  });

  it('rejects non-string input', () => {
    expect(isValidName(undefined)).toBe(false);
    expect(isValidName(123)).toBe(false);
  });
});

describe('isValidBalance', () => {
  it('accepts zero and positive amounts', () => {
    expect(isValidBalance(0)).toBe(true);
    expect(isValidBalance('0')).toBe(true);
    expect(isValidBalance(100)).toBe(true);
    expect(isValidBalance('1250.50')).toBe(true);
  });

  it('accepts the MAX_BALANCE ceiling exactly', () => {
    expect(isValidBalance(MAX_BALANCE)).toBe(true);
  });

  it('rejects anything above MAX_BALANCE', () => {
    expect(isValidBalance(MAX_BALANCE + 1)).toBe(false);
  });

  it('rejects negative amounts', () => {
    expect(isValidBalance(-1)).toBe(false);
    expect(isValidBalance('-0.01')).toBe(false);
  });

  it('rejects more than two decimal places', () => {
    expect(isValidBalance('100.123')).toBe(false);
  });

  it('rejects commas and scientific notation', () => {
    expect(isValidBalance('1,000')).toBe(false);
    expect(isValidBalance('1e3')).toBe(false);
  });

  it('rejects empty / null / undefined', () => {
    expect(isValidBalance('')).toBe(false);
    expect(isValidBalance(null)).toBe(false);
    expect(isValidBalance(undefined)).toBe(false);
  });

  it('rejects non-numeric strings', () => {
    expect(isValidBalance('abc')).toBe(false);
  });
});

describe('enum membership helpers', () => {
  it('isValidEmployeeRole', () => {
    expect(isValidEmployeeRole('ADMIN')).toBe(true);
    expect(isValidEmployeeRole('SUPPORT')).toBe(true);
    expect(isValidEmployeeRole('MANAGER')).toBe(true);
    expect(isValidEmployeeRole('CEO')).toBe(false);
    expect(isValidEmployeeRole('admin')).toBe(false); // case sensitive
  });

  it('isValidEmployeeStatus', () => {
    expect(isValidEmployeeStatus('ACTIVE')).toBe(true);
    expect(isValidEmployeeStatus('INACTIVE')).toBe(true);
    expect(isValidEmployeeStatus('PENDING')).toBe(false);
  });

  it('isValidAccountType', () => {
    expect(isValidAccountType('CHECKING')).toBe(true);
    expect(isValidAccountType('SAVINGS')).toBe(true);
    expect(isValidAccountType('CREDIT')).toBe(false);
  });

  it('isValidCurrency', () => {
    expect(isValidCurrency('CAD')).toBe(true);
    expect(isValidCurrency('USD')).toBe(true);
    expect(isValidCurrency('EUR')).toBe(false);
  });

  it('isValidAccountStatus', () => {
    expect(isValidAccountStatus('OPEN')).toBe(true);
    expect(isValidAccountStatus('CLOSED')).toBe(true);
    expect(isValidAccountStatus('FROZEN')).toBe(false);
  });
});
