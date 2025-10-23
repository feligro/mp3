module.exports = function (router){
    const User = require('../models/user');

    const usersRoute = router.route('/users');
    const usersIdRoute = router.route('/users/:id');

    function sendResponse(res, status, message, data) {
        return res.status(status).json({ message, data });
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

        //mongoose query builder
        let query = User.find({});
        query.collection(User.collection);

        // TODO: Add a query conditions (where, limit, etc)
        //  if (req.query["where"]) {query.where(...); }
        try{
            if (req.query["where"]) {
                query = query.where(JSON.parse(req.query["where"]));
            }
        } catch (err) {
            sendResponse(res, 400, 'Invalid JSON in where', err);
            return;
        };

        try{
            if (req.query["sort"]) {
                query = query.sort(JSON.parse(req.query["sort"]));
            }
        } catch (err) {
            sendResponse(res, 400, 'Invalid JSON in sort', err);
            return;
        };

        try{
        if (req.query["select"]) {
            query = query.select(JSON.parse(req.query["select"]));
        }
        } catch (err) {
            sendResponse(res, 400, 'Invalid JSON in select', err);
            return;
        };
        
        try{
            if (req.query["count"] === "true") {
                const where = req.query["where"] ? JSON.parse(req.query["where"]) : {};
                const count = await User.countDocuments(where || {});
                sendResponse(res, 200, 'OK', { count });
                return;
            }
        } catch (err) {
            sendResponse(res, 500, 'Server Error', err);
            return;
        }

        if (req.query["skip"]) {
            query = query.skip(parseInt(req.query["skip"]));
        }

        if (req.query["limit"]) {
            query = query.limit(parseInt(req.query["limit"]));
        }

        try {
            const result = await query.exec();
            sendResponse(res, 200, 'OK', result);
        } catch (err) {
            sendResponse(res, 500, 'Server Error', err);
        }
    }); 


            // ID part

    usersIdRoute.get(async function (req, res) {

        //mongoose query builder
        const userId = req.params["id"];
        let query = User.findById(userId);
        query.collection(User.collection);

        // TODO: Add a query conditions (where, limit, etc)
        //  if (req.query["where"]) {query.where(...); }

        try {
        const result = await query.exec();

        if (!result) {
            sendResponse(res, 404, 'User not found', null);
            return;
        }

        sendResponse(res, 200, 'OK', result);
        } catch (err) {
            sendResponse(res, 500, 'Server Error', err);
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