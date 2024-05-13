const mongoose = require('mongoose');

const archivedReapitApplicantsSchema = new mongoose.Schema({}, {strict: false});

module.exports = mongoose.model('Archived_Reapit_Contacts', archivedReapitApplicantsSchema);