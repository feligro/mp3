module.exports = function (router){
    
    const usersRoute = router.route('/users');
    const usersIdRoute = router.route('/users/:id');

    usersRoute.post(async function (req, res) {

    // Use mongoose for schema validation
    const user = new User(req.body);
    const err = newUser.validateSync();

    if (err) {
        // TODO: handle errors and responses
        return res.status(400).json({message: err});
    }

    try {

        await User.db.transaction(async session => {
            // Multiple db queries can have concurrency issues
            // Lost updates, Inconsistent retrivals, etc
            const savedUser = await newUser.save({session});
        });
    } catch (err) {
        // ...
        return ;
    }
    // ...
    });


    usersRoute.get(async function (req, res) {

    //mongoose query builder
    const query = User.find({});
    query.collection(User.collection);

    // TODO: Add a query conditions (where, limit, etc)
    //  if (req.query["where"]) {query.where(...); }

    try {
        const result = await query.exec();
        res.status(200).json(result);
    } catch (err) {
        res.status(500).json({message: err});
    }
    }); 
/*    usersRoute.put(... );
    usersRoute.delete(... );

    usersIdRoute.post(... );*/
    usersIdRoute.get(async function (req, res) {

    //mongoose query builder
    const userId = req.params["id"];
    const query = User.find({});
    query.collection(User.collection);

    // TODO: Add a query conditions (where, limit, etc)
    //  if (req.query["where"]) {query.where(...); }

    try {
        const result = await query.exec();
        res.status(200).json(result);
    } catch (err) {
        res.status(500).json({message: err});
    }
    }); 
/*  usersIdRoute.put(... );
    usersIdRoute.delete(... ); */

    return router;
}

/* 






*/ 