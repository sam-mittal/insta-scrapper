var mongoose = require("mongoose");

var Schema = mongoose.Schema;

var storySchema = new Schema({
  userName: String,
  storyURL: String,
});
module.exports = mongoose.model("story", storySchema);
