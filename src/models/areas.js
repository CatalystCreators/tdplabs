const mongoose = require("mongoose");

const areasSchema = mongoose.Schema(
  {
    id: String,
    created: String,
    modified: String,
    name: String,
    active: Boolean,
    type: String,
    area: mongoose.Schema.Types.Mixed,
    departmentIds: mongoose.Schema.Types.Mixed,
    officeIds: mongoose.Schema.Types.Mixed,
    parentIds: mongoose.Schema.Types.Mixed,
    _eTag: String,
    _links: {
      self: Object,
    },
    _embedded: mongoose.Schema.Types.Mixed,
  },
  { strict: false }
);

module.exports = mongoose.model("Areas", areasSchema);
