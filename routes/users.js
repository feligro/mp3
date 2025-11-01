module.exports = function (router){
    const User = require('../models/user');

    const usersRoute = router.route('/users');
    const usersIdRoute = router.route('/users/:id');

    const Task = require('../models/task');

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
                message: data ? data : 'The requested resource could not be found.'
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

    usersRoute.post(async function (req, res) {

        // Use mongoose for schema validation
        const user = new User(req.body);
        const err = user.validateSync();

        if (err) {
            sendResponse(res, 400, 'Validation Error', err);
            return;
        }
        const session = await User.startSession();
        session.startTransaction();

        try {
            const savedUser = await user.save({ session });
            await session.commitTransaction();

            sendResponse(res, 201, 'User created successfully', savedUser);
        } catch (err) {
            if (err.code === 11000) {
                sendResponse(res, 400, 'Duplicate Key Error', err);
            } else {
                sendResponse(res, 500, 'Database Error', err);
            }
        } finally {
            session.endSession();
        }
    });


    usersRoute.get(async function (req, res) {
        
        try {
            let query = User.find({});
            query.collection(User.collection);

            // WHERE
            if (req.query["where"]) {
                const where = parseIfJSON(req.query["where"]);
                if (!where) { sendResponse(res, 400, "Invalid JSON in where", {}); return; }
                query = query.where(where);
            }

            // SORT
            if (req.query["sort"]) {
                const sort = parseIfJSON(req.query["sort"]);
                if (!sort) { sendResponse(res, 400, "Invalid JSON in sort", {}); return; }
                query = query.sort(sort);
            }

            // SELECT
            if (req.query["select"]) {
                const select = parseIfJSON(req.query["select"]);
                if (!select) { sendResponse(res, 400, "Invalid JSON in select", {}); return; }
                query = query.select(select);
            }

            // COUNT
            if (req.query["count"] === "true") {
                const where = req.query["where"] ? (parseIfJSON(req.query["where"]) || {}) : {};
                const count = await User.countDocuments(where);
                sendResponse(res, 200, "OK", { count });
                return;
            }

            // SKIP / LIMIT
            if (req.query["skip"]) query = query.skip(parseInt(req.query["skip"], 10));
            if (req.query["limit"]) query = query.limit(parseInt(req.query["limit"], 10));

            const result = await query.exec();
            sendResponse(res, 200, "OK", result);
        } catch (err) {
            sendResponse(res, 500, "Server Error", err);
        }
    }); 


            // ID part

    usersIdRoute.get(async function (req, res) {
        const userId = req.params["id"];
        try {
            const result = await User.findById(userId).exec();
            if (!result) {
                sendResponse(res, 404, "User not found", null);
                return;
            }
            sendResponse(res, 200, "OK", result);
        } catch (err) {
            sendResponse(res, 500, "Server Error", err);
        }
    }); 

    usersIdRoute.put(async function (req, res) {
        const userId = req.params["id"];

        const updatedUser = new User(req.body);
        const err = updatedUser.validateSync();

        if (err) {
            sendResponse(res, 400, "Validation Error", err);
            return;
        }

        try {
            const user = await User.findByIdAndUpdate(
                userId,
                req.body,
                { new: true, runValidators: true }
            );
            if (!user) {
                sendResponse(res, 404, "User not found", null);
                return;
            }
            sendResponse(res, 200, "User updated successfully", user);
        } catch (err) {
            if (err.code === 11000) {
                sendResponse(res, 400, 'Duplicate Key Error', err);
            } else {
                sendResponse(res, 500, 'Database Error', err);
            }
        }
    });

    usersIdRoute.delete(async function (req, res) {
        const userId = req.params["id"];
        try {
            const deletedUser = await User.findByIdAndDelete(userId);
            if (!deletedUser) {
                sendResponse(res, 404, "User not found", null);
                return;
            }
            await Task.updateMany(
                { assignedUser: userId },
                { $set: { assignedUser: "", assignedUserName: "unassigned" } }
            );
            sendResponse(res, 200, "User deleted successfully", deletedUser);
        } catch (err) {
            sendResponse(res, 500, "Server Error", err);
        }
    });

    return router;
}