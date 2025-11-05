// routes/index.js
var express = require("express");

module.exports = function (app) {
  // Home route
  app.use("/api", require("./home")(express.Router()));

  // User routes
  app.use("/api/users", require("./users")(express.Router()));

  // Task routes
  app.use("/api/tasks", require("./tasks")(express.Router()));
};
