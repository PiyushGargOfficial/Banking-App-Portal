// Seed data for the in-memory mock database.
//
// 33 employees + 12 accounts. With the default page size of 10 that gives
// 4 pages; with a page size of 25 you get 2 pages (25 + 8) which is the
// scenario the UI's pagination control is designed to exercise.
//
// Mix:
//   - Roles:    ADMIN (5), MANAGER (10), SUPPORT (18)
//   - Status:   ACTIVE (28), INACTIVE (5)
//   - Names spread across multiple regions for realistic search/filter testing.
const { v4: uuid } = require('uuid');

const now = () => new Date().toISOString();

// Helper - cuts down repetition and keeps role/status spread visible at a glance.
const e = (firstName, lastName, email, role, status = 'ACTIVE', id = uuid()) => ({
  employeeId: id,
  firstName,
  lastName,
  email,
  role,
  status,
  createdAt: now(),
  updatedAt: now()
});

const employees = [
  // The original three keep stable ids so demos / tests that reference them
  // by id continue to work after the seed expansion.
  e('Aarav',     'Sharma',    'aarav.sharma@bankadmin.io',     'ADMIN',   'ACTIVE',   '11111111-1111-1111-1111-111111111111'),
  e('Sara',      'Khan',      'sara.khan@bankadmin.io',        'MANAGER', 'ACTIVE',   '22222222-2222-2222-2222-222222222222'),
  e('Liam',      'Tremblay',  'liam.tremblay@bankadmin.io',    'SUPPORT', 'INACTIVE', '33333333-3333-3333-3333-333333333333'),

  // Additional 30 employees -------------------------------------------------
  e('Olivia',    'Chen',         'olivia.chen@bankadmin.io',         'MANAGER'),
  e('Noah',      'Williams',     'noah.williams@bankadmin.io',       'SUPPORT'),
  e('Emma',      'Patel',        'emma.patel@bankadmin.io',          'ADMIN'),
  e('Lucas',     'Gagnon',       'lucas.gagnon@bankadmin.io',        'SUPPORT'),
  e('Ava',       'Rodriguez',    'ava.rodriguez@bankadmin.io',       'MANAGER'),
  e('Mateo',     'Brown',        'mateo.brown@bankadmin.io',         'SUPPORT', 'INACTIVE'),
  e('Sophia',    'Singh',        'sophia.singh@bankadmin.io',        'MANAGER'),
  e('Ethan',     'Nguyen',       'ethan.nguyen@bankadmin.io',        'SUPPORT'),
  e('Mia',       'Johnson',      'mia.johnson@bankadmin.io',         'ADMIN'),
  e('Logan',     'Ali',          'logan.ali@bankadmin.io',           'SUPPORT'),
  e('Isabella',  'Garcia',       'isabella.garcia@bankadmin.io',     'MANAGER'),
  e('Benjamin',  'OConnor',      'benjamin.oconnor@bankadmin.io',    'SUPPORT'),
  e('Charlotte', 'Kim',          'charlotte.kim@bankadmin.io',       'MANAGER'),
  e('Elijah',    'Martin',       'elijah.martin@bankadmin.io',       'SUPPORT', 'INACTIVE'),
  e('Amelia',    'Lopez',        'amelia.lopez@bankadmin.io',        'SUPPORT'),
  e('James',     'Wright',       'james.wright@bankadmin.io',        'MANAGER'),
  e('Harper',    'Hassan',       'harper.hassan@bankadmin.io',       'SUPPORT'),
  e('Henry',     'Bouchard',     'henry.bouchard@bankadmin.io',      'ADMIN'),
  e('Evelyn',    'Davis',        'evelyn.davis@bankadmin.io',        'SUPPORT'),
  e('Alexander', 'Reyes',        'alexander.reyes@bankadmin.io',     'MANAGER'),
  e('Abigail',   'Thompson',     'abigail.thompson@bankadmin.io',    'SUPPORT'),
  e('Daniel',    'Wilson',       'daniel.wilson@bankadmin.io',       'SUPPORT', 'INACTIVE'),
  e('Emily',     'Roy',          'emily.roy@bankadmin.io',           'MANAGER'),
  e('Sebastian', 'Foster',       'sebastian.foster@bankadmin.io',    'SUPPORT'),
  e('Madison',   'Anderson',     'madison.anderson@bankadmin.io',    'ADMIN'),
  e('Jackson',   'Lee',          'jackson.lee@bankadmin.io',         'SUPPORT'),
  e('Avery',     'Taylor',       'avery.taylor@bankadmin.io',        'MANAGER'),
  e('Owen',      'Murphy',       'owen.murphy@bankadmin.io',         'SUPPORT'),
  e('Scarlett',  'Petrov',       'scarlett.petrov@bankadmin.io',     'MANAGER'),
  e('Leo',       'Yamamoto',     'leo.yamamoto@bankadmin.io',        'SUPPORT', 'INACTIVE')
];

// Helper for account fixtures - keeps the numeric/balance noise out of view.
const a = (employeeId, accountNumber, accountType, currency, balance, status = 'OPEN') => ({
  accountId: uuid(),
  employeeId,
  accountNumber,
  accountType,
  currency,
  balance,
  status,
  createdAt: now(),
  updatedAt: now()
});

const accounts = [
  // Original three accounts for the seeded ADMIN / MANAGER employees so the
  // detail page demo still has data on the first paginated row.
  a('11111111-1111-1111-1111-111111111111', '4023600012348877', 'CHECKING', 'CAD',  5230.75),
  a('11111111-1111-1111-1111-111111111111', '4023600099887766', 'SAVINGS',  'USD', 12890.10),
  a('22222222-2222-2222-2222-222222222222', '4023611122334455', 'CHECKING', 'CAD',   800.00),

  // A few more accounts for variety - including a CLOSED one so the badge
  // and "soft close" state are visible without having to click around.
  a('22222222-2222-2222-2222-222222222222', '4023611155667788', 'SAVINGS',  'CAD',  4250.00),
  a(employees[3].employeeId,                '4023612200110099', 'CHECKING', 'USD',  3120.55), // Olivia Chen
  a(employees[5].employeeId,                '4023612255443322', 'SAVINGS',  'CAD', 18750.40), // Emma Patel
  a(employees[5].employeeId,                '4023612266778899', 'CHECKING', 'CAD',   215.20), // Emma Patel
  a(employees[7].employeeId,                '4023612277665544', 'CHECKING', 'CAD',  9120.00), // Ava Rodriguez
  a(employees[10].employeeId,               '4023612288990011', 'SAVINGS',  'USD',   450.10), // Mia Johnson
  a(employees[12].employeeId,               '4023612299887766', 'CHECKING', 'CAD',  2330.85), // Isabella Garcia
  a(employees[18].employeeId,               '4023612200334455', 'CHECKING', 'CAD',  6700.00), // Henry Bouchard
  a(employees[25].employeeId,               '4023612211223344', 'SAVINGS',  'USD',     0.00, 'CLOSED') // Madison Anderson
];

module.exports = { employees, accounts };
