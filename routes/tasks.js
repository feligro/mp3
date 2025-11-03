module.exports = function (router) {

    const Task = require('../models/task');
    const tasksRoute = router.route('/tasks');
    const tasksIdRoute = router.route('/tasks/:id');
    const User = require('../models/user');

    function sendResponse(res, status, message, data) {
        let formattedData = data;

        if (data && data.name === 'ValidationError') {
            const fields = Object.keys(data.errors);
            const messages = Object.values(data.errors).map(e => e.message);
            formattedData = {
                type: 'ValidationError',
                fields,
                messages
            };
        }

        else if (data && data.code === 11000) {
            const field = Object.keys(data.keyValue || {})[0];
            const value = data.keyValue ? data.keyValue[field] : '';
            formattedData = {
                type: 'DuplicateKeyError',
                field,
                value,
                message: `Duplicate value for field "${field}": ${value}`
            };
        }

        else if (message && message.startsWith('Invalid JSON')) {
            formattedData = {
                type: 'InvalidJSON',
                message: 'One of your query parameters could not be parsed as valid JSON. Check your quotes and braces.'
            };
        }

        else if (status === 404) {
            formattedData = {
                type: 'NotFound',
                message: data || 'The requested resource could not be found.'
            };
        }

        else if (data && data.name === 'CastError') {
            formattedData = {
                type: 'InvalidID',
                message: `The provided ID "${data.value}" is not a valid identifier. Please check the ID format.`
            };
        }

        else if (data instanceof Error) {
            formattedData = {
                type: data.name || 'ServerError',
                message: data.message || 'An unexpected server error occurred.'
            };
        }

        else if (typeof data === 'string') {
            formattedData = { message: data };
        }

        return res.status(status).json({ message, data: formattedData });
    }

    function parseIfJSON(param) {
        try {
            return JSON.parse(decodeURIComponent(param));
        } catch {
            return null;
        }
    }

    tasksRoute.post(async function (req, res) {
        if (req.body.assignedUser && !req.body.assignedUserName) {
            const user = await require('../models/user').findById(req.body.assignedUser);
            req.body.assignedUserName = user ? user.name : "unassigned";
        }
        else if (!req.body.assignedUser && req.body.assignedUserName && req.body.assignedUserName !== "unassigned") {
            const user = await require('../models/user').findOne({ name: req.body.assignedUserName });
            req.body.assignedUser = user ? user._id.toString() : "";
        }
        else if (!req.body.assignedUser && !req.body.assignedUserName) {
            req.body.assignedUser = "";
            req.body.assignedUserName = "unassigned";
        }

        const task = new Task(req.body);
        const err = task.validateSync();
        if (err) {
            sendResponse(res, 400, 'Validation Error', err);
            return;
        }

        try {
            const savedTask = await task.save();
            if (savedTask.assignedUser) {
                await User.findByIdAndUpdate(
                    savedTask.assignedUser,
                    { $addToSet: { pendingTasks: savedTask._id.toString() } }
                );
            }
            sendResponse(res, 201, 'Task created successfully', savedTask);
        } catch (err) {
            if (err.code === 11000) {
                    sendResponse(res, 400, 'Duplicate Key Error', err);
                } else {
                    sendResponse(res, 500, 'Database Error', err);
                }
            }
    });

    tasksRoute.get(async function (req, res) {
        try {
            let query = Task.find({});

            if (req.query["where"]) {
                const where = parseIfJSON(req.query["where"]);
                if (!where) { sendResponse(res, 400, "Invalid JSON in where", {}); return; }
                query = query.where(where);
            }

            if (req.query["sort"]) {
                const sort = parseIfJSON(req.query["sort"]);
                if (!sort) { sendResponse(res, 400, "Invalid JSON in sort", {}); return; }
                query = query.sort(sort);
            }

            if (req.query["select"]) {
                const select = parseIfJSON(req.query["select"]);
                if (!select) { sendResponse(res, 400, "Invalid JSON in select", {}); return; }
                query = query.select(select);
            }

            if (req.query["count"] === "true") {
                const where = req.query["where"] ? (parseIfJSON(req.query["where"]) || {}) : {};
                const count = await Task.countDocuments(where);
                sendResponse(res, 200, "OK", { count });
                return;
            }

            if (req.query["skip"]) query = query.skip(parseInt(req.query["skip"], 10));
            if (req.query["limit"]) query = query.limit(parseInt(req.query["limit"], 10));

            const result = await query.exec();
            sendResponse(res, 200, "OK", result);
        } catch (err) {
            sendResponse(res, 500, "Server Error", err);
        }
    });


    tasksIdRoute.get(async function (req, res) {
        const taskId = req.params["id"];
        try {
            const result = await Task.findById(taskId).exec();
            if (!result) {
                sendResponse(res, 404, 'Task not found', null);
                return;
            }
            sendResponse(res, 200, 'OK', result);
        } catch (err) {
            sendResponse(res, 500, 'Server Error', err);
        }
    });

    tasksIdRoute.put(async function (req, res) {
        const taskId = req.params["id"];

        if (req.body.assignedUser && !req.body.assignedUserName) {
            const user = await require('../models/user').findById(req.body.assignedUser);
            req.body.assignedUserName = user ? user.name : "unassigned";
        }
        else if (!req.body.assignedUser && req.body.assignedUserName && req.body.assignedUserName !== "unassigned") {
            const user = await require('../models/user').findOne({ name: req.body.assignedUserName });
            req.body.assignedUser = user ? user._id.toString() : "";
        }
        else if (!req.body.assignedUser && !req.body.assignedUserName) {
            req.body.assignedUser = "";
            req.body.assignedUserName = "unassigned";
        }

        const updatedTask = new Task(req.body);
        const err = updatedTask.validateSync();
        if (err) {
            sendResponse(res, 400, "Validation Error", err);
            return;
        }

        try {
            const existingTask = await Task.findById(taskId);
            if (!existingTask) {
                sendResponse(res, 404, "Task not found", null);
                return;
            }

            const task = await Task.findByIdAndUpdate(taskId, req.body, { new: true, runValidators: true });
            if (existingTask.assignedUser && existingTask.assignedUser !== task.assignedUser) {
                await User.findByIdAndUpdate(existingTask.assignedUser, { $pull: { pendingTasks: existingTask._id.toString() } });
            }
            if (task.assignedUser) {
                await User.findByIdAndUpdate(task.assignedUser, { $addToSet: { pendingTasks: task._id.toString() } });
            }

            sendResponse(res, 200, "Task updated successfully", task);
        } catch (err) {
            if (err.code === 11000) {
                sendResponse(res, 400, 'Duplicate Key Error', err);
            } else {
                sendResponse(res, 500, 'Database Error', err);
            }
        }
    });

    tasksIdRoute.delete(async function (req, res) {
        const taskId = req.params["id"];
        try {
            const deletedTask = await Task.findByIdAndDelete(taskId);
            if (!deletedTask) {
                sendResponse(res, 404, 'Task not found', null);
                return;
            }
            if (deletedTask.assignedUser) {
                await User.findByIdAndUpdate(
                    deletedTask.assignedUser,
                    { $pull: { pendingTasks: deletedTask._id.toString() } }
                );
            }
            sendResponse(res, 204, "Task deleted successfully", null);
        } catch (err) {
            sendResponse(res, 500, 'Server Error', err);
        }
    });

    return router;
};
