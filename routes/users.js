module.exports = function (router){
    const User = require('../models/user');

    const usersRoute = router.route('/users');
    const usersIdRoute = router.route('/users/:id');

    function sendResponse(res, status, message, data) {
        return res.status(status).json({ message, data });
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
            await session.abortTransaction();
            sendResponse(res, 500, 'Database Error', err);
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
            sendResponse(res, 500, "Server Error", err);
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
            sendResponse(res, 200, "User deleted successfully", deletedUser);
        } catch (err) {
            sendResponse(res, 500, "Server Error", err);
        }
    });

    return router;
}