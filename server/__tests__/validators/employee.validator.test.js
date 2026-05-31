/**
 * Unit tests for the employee request-body validators.
 *
 * Each validator returns an array of { field, message } errors (empty = valid).
 * validatePatch additionally returns the cleaned `patch` object. The tests
 * assert on which FIELDS produced errors rather than exact message strings, so
 * wording can be tweaked without breaking the suite.
 */
const {
  validateCreate,
  validateReplace,
  validatePatch
} = require('../../validators/employee.validator');

const fieldsWithErrors = (errors) => errors.map((e) => e.field).sort();

const validBody = {
  firstName: 'Aarav',
  lastName: 'Sharma',
  email: 'aarav.sharma@bankadmin.io',
  role: 'ADMIN',
  status: 'ACTIVE'
};

describe('validateCreate', () => {
  it('returns no errors for a fully valid body', () => {
    expect(validateCreate(validBody)).toEqual([]);
  });

  it('treats status as optional on create', () => {
    const { status, ...noStatus } = validBody;
    expect(validateCreate(noStatus)).toEqual([]);
  });

  it('flags a missing first name', () => {
    const errors = validateCreate({ ...validBody, firstName: '' });
    expect(fieldsWithErrors(errors)).toEqual(['firstName']);
  });

  it('flags a badly formatted first name distinctly from a missing one', () => {
    const errors = validateCreate({ ...validBody, firstName: 'A1!' });
    expect(fieldsWithErrors(errors)).toEqual(['firstName']);
    expect(errors[0].message).toMatch(/letters/);
  });

  it('flags an invalid email', () => {
    const errors = validateCreate({ ...validBody, email: 'not-an-email' });
    expect(fieldsWithErrors(errors)).toEqual(['email']);
  });

  it('flags an invalid role', () => {
    const errors = validateCreate({ ...validBody, role: 'CEO' });
    expect(fieldsWithErrors(errors)).toEqual(['role']);
  });

  it('flags an invalid status when one IS supplied', () => {
    const errors = validateCreate({ ...validBody, status: 'PENDING' });
    expect(fieldsWithErrors(errors)).toEqual(['status']);
  });

  it('accumulates multiple errors at once', () => {
    const errors = validateCreate({ firstName: '', lastName: '', email: 'x', role: 'NOPE' });
    expect(fieldsWithErrors(errors)).toEqual(['email', 'firstName', 'lastName', 'role']);
  });
});

describe('validateReplace', () => {
  it('returns no errors for a fully valid body', () => {
    expect(validateReplace(validBody)).toEqual([]);
  });

  it('REQUIRES status (unlike create)', () => {
    const { status, ...noStatus } = validBody;
    const errors = validateReplace(noStatus);
    expect(fieldsWithErrors(errors)).toContain('status');
  });

  it('still enforces the create rules', () => {
    const errors = validateReplace({ ...validBody, email: 'bad' });
    expect(fieldsWithErrors(errors)).toContain('email');
  });
});

describe('validatePatch', () => {
  it('returns an empty patch + no errors for an empty body', () => {
    const { errors, patch } = validatePatch({});
    expect(errors).toEqual([]);
    expect(patch).toEqual({});
  });

  it('only includes the allowed fields that are present', () => {
    const { patch } = validatePatch({ status: 'INACTIVE', notAField: 'ignored' });
    expect(patch).toEqual({ status: 'INACTIVE' });
  });

  it('validates only the fields that are present', () => {
    const { errors } = validatePatch({ email: 'still-bad' });
    expect(fieldsWithErrors(errors)).toEqual(['email']);
  });

  it('passes a valid single-field patch through cleanly', () => {
    const { errors, patch } = validatePatch({ role: 'MANAGER' });
    expect(errors).toEqual([]);
    expect(patch).toEqual({ role: 'MANAGER' });
  });

  it('flags an invalid status value', () => {
    const { errors } = validatePatch({ status: 'NOPE' });
    expect(fieldsWithErrors(errors)).toEqual(['status']);
  });
});
