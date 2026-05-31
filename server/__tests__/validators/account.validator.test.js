/**
 * Unit tests for the account request-body validators.
 *
 * Like the employee validators these return { field, message } errors, but
 * validateCreate/validatePatch have account-specific quirks worth pinning:
 *   - the 8-19 digit accountNumber pattern
 *   - balance is OPTIONAL on create but REQUIRED on replace
 *   - validatePatch coerces a valid balance string to a Number in the
 *     returned patch (the only validator that transforms its input)
 */
const {
  validateCreate,
  validateReplace,
  validatePatch
} = require('../../validators/account.validator');

const fieldsWithErrors = (errors) => errors.map((e) => e.field).sort();

const validCreate = {
  accountNumber: '4023600000000001',
  accountType: 'CHECKING',
  currency: 'CAD',
  balance: '100.00'
};

describe('validateCreate', () => {
  it('returns no errors for a fully valid body', () => {
    expect(validateCreate(validCreate)).toEqual([]);
  });

  it('treats balance as optional (defaults applied later in the model)', () => {
    const { balance, ...noBalance } = validCreate;
    expect(validateCreate(noBalance)).toEqual([]);
    expect(validateCreate({ ...noBalance, balance: '' })).toEqual([]);
  });

  it('flags a missing account number', () => {
    const errors = validateCreate({ ...validCreate, accountNumber: '' });
    expect(fieldsWithErrors(errors)).toEqual(['accountNumber']);
  });

  it.each([
    ['too short (7 digits)', '1234567'],
    ['too long (20 digits)', '1'.repeat(20)],
    ['contains a letter', '40236000000000A1'],
    ['contains spaces', '4023 6000 0000']
  ])('flags an account number that is %s', (_label, accountNumber) => {
    const errors = validateCreate({ ...validCreate, accountNumber });
    expect(fieldsWithErrors(errors)).toEqual(['accountNumber']);
  });

  it('accepts the 8 and 19 digit boundaries', () => {
    expect(validateCreate({ ...validCreate, accountNumber: '12345678' })).toEqual([]);
    expect(validateCreate({ ...validCreate, accountNumber: '1'.repeat(19) })).toEqual([]);
  });

  it('flags an invalid account type and currency', () => {
    const errors = validateCreate({ ...validCreate, accountType: 'CREDIT', currency: 'EUR' });
    expect(fieldsWithErrors(errors)).toEqual(['accountType', 'currency']);
  });

  it('flags a malformed balance when one is supplied', () => {
    const errors = validateCreate({ ...validCreate, balance: '100.123' });
    expect(fieldsWithErrors(errors)).toEqual(['balance']);
  });
});

describe('validateReplace', () => {
  const validReplace = {
    accountType: 'SAVINGS',
    currency: 'USD',
    balance: '500.00',
    status: 'OPEN'
  };

  it('returns no errors for a fully valid body', () => {
    expect(validateReplace(validReplace)).toEqual([]);
  });

  it('REQUIRES balance (unlike create)', () => {
    const { balance, ...noBalance } = validReplace;
    const errors = validateReplace(noBalance);
    expect(fieldsWithErrors(errors)).toContain('balance');
  });

  it('REQUIRES a valid status', () => {
    const errors = validateReplace({ ...validReplace, status: 'FROZEN' });
    expect(fieldsWithErrors(errors)).toContain('status');
  });

  it('accumulates every invalid field', () => {
    const errors = validateReplace({
      accountType: 'X',
      currency: 'Y',
      balance: -1,
      status: 'Z'
    });
    expect(fieldsWithErrors(errors)).toEqual(['accountType', 'balance', 'currency', 'status']);
  });
});

describe('validatePatch', () => {
  it('returns an empty patch + no errors for an empty body', () => {
    const { errors, patch } = validatePatch({});
    expect(errors).toEqual([]);
    expect(patch).toEqual({});
  });

  it('only includes the allowed fields that are present', () => {
    const { patch } = validatePatch({ status: 'CLOSED', somethingElse: 'nope' });
    expect(patch).toEqual({ status: 'CLOSED' });
  });

  it('coerces a valid balance string to a Number in the returned patch', () => {
    const { errors, patch } = validatePatch({ balance: '1250.50' });
    expect(errors).toEqual([]);
    expect(patch.balance).toBe(1250.5);
    expect(typeof patch.balance).toBe('number');
  });

  it('flags (and does not coerce) an invalid balance', () => {
    const { errors, patch } = validatePatch({ balance: '100.123' });
    expect(fieldsWithErrors(errors)).toEqual(['balance']);
    expect(patch.balance).toBe('100.123'); // left as-is when invalid
  });

  it('flags an invalid status / type / currency', () => {
    const { errors } = validatePatch({ status: 'FROZEN', accountType: 'X', currency: 'Y' });
    expect(fieldsWithErrors(errors)).toEqual(['accountType', 'currency', 'status']);
  });
});
