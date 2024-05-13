const mongoose = require('mongoose');

const reapitApplicantsSchema = new mongoose.Schema({}, {strict: false});

module.exports = mongoose.model('Reapit_Applicants', reapitApplicantsSchema);