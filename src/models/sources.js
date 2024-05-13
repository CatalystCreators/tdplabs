const mongoose = require("mongoose");

const sourcesSchema = mongoose.Schema({
    id: {
        type: String
    },
    created: String,
    modified: String,
    name: String,
    type: String,
    officeIds: [],
    departmentIds: [],
    _eTag: String,
    _links: {
        self: Object
    },
    _embedded: mongoose.Schema.Types.Mixed
}, { strict: false });

module.exports = mongoose.model("Sources", sourcesSchema);
