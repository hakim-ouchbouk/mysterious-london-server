const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongoose = require("passport-local-mongoose");

const User = new Schema({
  email: { type: String, required: true, unique: true },
  addedAttractions: [mongoose.Types.ObjectId],
  beenThere: [{ type: mongoose.Types.ObjectId, ref: "Attraction" }],
  wantToVisit: [{ type: mongoose.Types.ObjectId, ref: "Attraction" }],
  list: [{ type: mongoose.Types.ObjectId, ref: "Attraction" }],
});

User.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", User);
