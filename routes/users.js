var mongoose = require("mongoose");
var User = require("../models/user");
var Task = require("../models/task");

function parseJSONParam(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

module.exports = function (router) {
  // GET /api/users
  router.get("/", async (req, res) => {
    try {
      const where = parseJSONParam(req.query.where) || {};
      const sort = parseJSONParam(req.query.sort) || {};
      const select = parseJSONParam(req.query.select);
      const skip = parseInt(req.query.skip) || 0;
      const limit = req.query.limit ? parseInt(req.query.limit) : undefined;
      const count = req.query.count === "true";

      if (count) {
        const total = await User.countDocuments(where);
        return res.status(200).json({ message: "OK", data: total });
      }

      let q = User.find(where);
      if (Object.keys(sort).length) q = q.sort(sort);
      if (select) q = q.select(select);
      if (skip) q = q.skip(skip);
      if (limit) q = q.limit(limit);

      const result = await q.exec();
      res.status(200).json({ message: "OK", data: result });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Error fetching users", data: err.message });
    }
  });

  // POST /api/users
  router.post("/", async (req, res) => {
    try {
      const { name, email, pendingTasks } = req.body;
      if (!name || !email)
        return res
          .status(400)
          .json({ message: "Name and email are required", data: null });

      const exists = await User.findOne({ email });
      if (exists)
        return res
          .status(400)
          .json({ message: "Email already exists", data: null });

      const newUser = new User({
        name,
        email,
        pendingTasks: Array.isArray(pendingTasks) ? pendingTasks : [],
      });

      const saved = await newUser.save();

      // 双向更新 Task
      if (saved.pendingTasks.length)
        await Task.updateMany(
          { _id: { $in: saved.pendingTasks } },
          { assignedUser: saved._id.toString(), assignedUserName: saved.name }
        );

      res.status(201).json({ message: "Created", data: saved });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Error creating user", data: err.message });
    }
  });

  // GET /api/users/:id
  router.get("/:id", async (req, res) => {
    try {
      const select = parseJSONParam(req.query.select);
      let q = User.findById(req.params.id);
      if (select) q = q.select(select);
      const user = await q.exec();
      if (!user)
        return res.status(404).json({ message: "User not found", data: null });
      res.status(200).json({ message: "OK", data: user });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Error fetching user", data: err.message });
    }
  });

  // PUT /api/users/:id
  router.put("/:id", async (req, res) => {
    try {
      const { name, email, pendingTasks } = req.body;
      if (!name || !email)
        return res
          .status(400)
          .json({ message: "Name and email are required", data: null });

      const updated = await User.findByIdAndUpdate(
        req.params.id,
        { name, email, pendingTasks },
        { new: true, overwrite: true, runValidators: true }
      );

      if (!updated)
        return res.status(404).json({ message: "User not found", data: null });

      await Task.updateMany(
        { _id: { $in: pendingTasks } },
        { assignedUser: updated._id.toString(), assignedUserName: updated.name }
      );
      await Task.updateMany(
        { assignedUser: updated._id.toString(), _id: { $nin: pendingTasks } },
        { assignedUser: "", assignedUserName: "unassigned" }
      );

      res.status(200).json({ message: "OK", data: updated });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Error updating user", data: err.message });
    }
  });

  // DELETE /api/users/:id
  router.delete("/:id", async (req, res) => {
    try {
      const user = await User.findByIdAndDelete(req.params.id);
      if (!user)
        return res.status(404).json({ message: "User not found", data: null });
      await Task.updateMany(
        { assignedUser: req.params.id },
        { assignedUser: "", assignedUserName: "unassigned" }
      );
      res.status(204).json({ message: "No Content", data: null });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Error deleting user", data: err.message });
    }
  });

  return router;
};
