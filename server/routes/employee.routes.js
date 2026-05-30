/**
 * Employee routes.
 *
 * Pure URL -> controller-method wiring. Order matters: the static
 * `/email-available` path is registered before `/:id` so Express doesn't
 * treat the literal segment as an id parameter.
 *
 * This router is mounted at /api/employees in app.js.
 */
const express = require('express');
const controller = require('../controllers/employee.controller');

const router = express.Router();

router.get('/', controller.list);
router.get('/email-available', controller.emailAvailable);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.replace);
router.patch('/:id', controller.patch);
router.delete('/:id', controller.remove);

module.exports = router;
