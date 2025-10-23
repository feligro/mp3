module.exports = function (router) {

    const Task = require('../models/task');
    const tasksRoute = router.route('/tasks');
    const tasksIdRoute = router.route('/tasks/:id');

    function sendResponse(res, status, message, data) {
        return res.status(status).json({ message, data });
    }

    tasksRoute.post(async function (req, res) {
        const task = new Task(req.body);
        const err = task.validateSync();
        if (err) {
            sendResponse(res, 400, 'Validation Error', err);
            return;
        }

        try {
            const savedTask = await task.save();
            sendResponse(res, 201, 'Task created successfully', savedTask);
        } catch (err) {
            sendResponse(res, 500, 'Database Error', err);
        }
    });

    tasksRoute.get(async function (req, res) {
        let query = Task.find({});

        try {
            if (req.query["where"]) query = query.where(JSON.parse(req.query["where"]));
            if (req.query["sort"]) query = query.sort(JSON.parse(req.query["sort"]));
            if (req.query["select"]) query = query.select(JSON.parse(req.query["select"]));
        } catch (err) {
            sendResponse(res, 400, 'Invalid JSON in query parameters', err);
            return;
        }

        try {
            if (req.query["count"] === "true") {
                const where = req.query["where"] ? JSON.parse(req.query["where"]) : {};
                const count = await Task.countDocuments(where);
                sendResponse(res, 200, 'OK', { count });
                return;
            }
        } catch (err) {
            sendResponse(res, 500, 'Server Error', err);
            return;
        }

        if (req.query["skip"]) query = query.skip(parseInt(req.query["skip"], 10));
        if (req.query["limit"]) query = query.limit(parseInt(req.query["limit"], 10));

        try {
            const result = await query.exec();
            sendResponse(res, 200, 'OK', result);
        } catch (err) {
            sendResponse(res, 500, 'Server Error', err);
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
        const updatedTask = new Task(req.body);
        const err = updatedTask.validateSync();
        if (err) {
            sendResponse(res, 400, 'Validation Error', err);
            return;
        }

        try {
            const task = await Task.findByIdAndUpdate(
                taskId,
                req.body,
                { new: true, runValidators: true }
            );
            if (!task) {
                sendResponse(res, 404, 'Task not found', null);
                return;
            }
            sendResponse(res, 200, 'Task updated successfully', task);
        } catch (err) {
            sendResponse(res, 500, 'Server Error', err);
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
            sendResponse(res, 200, 'Task deleted successfully', deletedTask);
        } catch (err) {
            sendResponse(res, 500, 'Server Error', err);
        }
    });

    return router;
};
