const asyncHandler = (requestHander) => {
    return (req, res, next) => {
        Promise.resolve(requestHander(req, res, next))
        .catch( (err) => next(err))
    }
}

export { asyncHandler }

// const asyncHandler = () => {}
// const asyncHandler = (func) => { () => {} }
// const asyncHandler = (func) => () => {}

//fn -> requestHandler
/* -> async-await, try-catch method
const asyncHandler = (requestHander) => async (req, res, next) => {
    try {
        await requestHandler(req, res, next)
    } catch (error) {
        res.status(err.code || 500).json({
            success: false,
            message: err.message
        })
    }
}
*/