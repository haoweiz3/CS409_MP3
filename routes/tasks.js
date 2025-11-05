var mongoose = require("mongoose");
var Task = require("../models/task");
var User = require("../models/user");

function parseJSONParam(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

module.exports = function (router) {
  // GET /api/tasks
  router.get("/", async (req, res) => {
    try {
      const where = parseJSONParam(req.query.where) || {};
      const sort = parseJSONParam(req.query.sort) || {};
      const select = parseJSONParam(req.query.select);
      const skip = parseInt(req.query.skip) || 0;
      const limit = req.query.limit ? parseInt(req.query.limit) : 100;
      const count = req.query.count === "true";

      if (count) {
        const total = await Task.countDocuments(where);
        return res.status(200).json({ message: "OK", data: total });
      }

      let q = Task.find(where);
      if (Object.keys(sort).length) q = q.sort(sort);
      if (select) q = q.select(select);
      if (skip) q = q.skip(skip);
      if (limit) q = q.limit(limit);

      const result = await q.exec();
      res.status(200).json({ message: "OK", data: result });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Error fetching tasks", data: err.message });
    }
  });

  // POST /api/tasks
  router.post("/", async (req, res) => {
    try {
      const { name, description, deadline, completed, assignedUser } = req.body;
      if (!name || !deadline)
        return res
          .status(400)
          .json({ message: "Name and deadline required", data: null });

      const task = new Task({
        name,
        description: description || "",
        deadline,
        completed: completed || false,
        assignedUser: assignedUser || "",
        assignedUserName: "unassigned",
      });

      if (assignedUser) {
        const user = await User.findById(assignedUser);
        if (!user)
          return res
            .status(400)
            .json({ message: "Assigned user not found", data: null });
        task.assignedUserName = user.name;
      }

      const saved = await task.save();
      if (saved.assignedUser)
        await User.findByIdAndUpdate(saved.assignedUser, {
          $addToSet: { pendingTasks: saved._id.toString() },
        });

      res.status(201).json({ message: "Created", data: saved });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Error creating task", data: err.message });
    }
  });

  // GET /api/tasks/:id
  router.get("/:id", async (req, res) => {
    try {
      const select = parseJSONParam(req.query.select);
      let q = Task.findById(req.params.id);
      if (select) q = q.select(select);
      const task = await q.exec();
      if (!task)
        return res.status(404).json({ message: "Task not found", data: null });
      res.status(200).json({ message: "OK", data: task });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Error fetching task", data: err.message });
    }
  });

  // PUT /api/tasks/:id
  router.put("/:id", async (req, res) => {
    try {
      const { name, description, deadline, completed, assignedUser } = req.body;
      if (!name || !deadline)
        return res
          .status(400)
          .json({ message: "Name and deadline required", data: null });

      const oldTask = await Task.findById(req.params.id);
      if (!oldTask)
        return res.status(404).json({ message: "Task not found", data: null });

      let assignedUserName = "unassigned";
      if (assignedUser) {
        const user = await User.findById(assignedUser);
        if (!user)
          return res
            .status(400)
            .json({ message: "Assigned user not found", data: null });
        assignedUserName = user.name;
      }

      const updated = await Task.findByIdAndUpdate(
        req.params.id,
        {
          name,
          description: description || "",
          deadline,
          completed: completed || false,
          assignedUser: assignedUser || "",
          assignedUserName,
        },
        { new: true, overwrite: true, runValidators: true }
      );

      if (!updated)
        return res.status(404).json({ message: "Task not found", data: null });

      if (oldTask.assignedUser && oldTask.assignedUser !== assignedUser)
        await User.findByIdAndUpdate(oldTask.assignedUser, {
          $pull: { pendingTasks: updated._id.toString() },
        });

      if (assignedUser && oldTask.assignedUser !== assignedUser)
        await User.findByIdAndUpdate(assignedUser, {
          $addToSet: { pendingTasks: updated._id.toString() },
        });

      res.status(200).json({ message: "OK", data: updated });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Error updating task", data: err.message });
    }
  });

  // DELETE /api/tasks/:id
  router.delete("/:id", async (req, res) => {
    try {
      const task = await Task.findByIdAndDelete(req.params.id);
      if (!task)
        return res.status(404).json({ message: "Task not found", data: null });
      if (task.assignedUser)
        await User.findByIdAndUpdate(task.assignedUser, {
          $pull: { pendingTasks: task._id.toString() },
        });
      res.status(204).json({ message: "No Content", data: null });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Error deleting task", data: err.message });
    }
  });

  return router;
};
