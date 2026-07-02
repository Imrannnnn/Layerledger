const logger = (req, res, next) => {

    const TimeStamp = new Date().toISOString();
    const method = req.method;
    const url = req.url;
    const userAgent = req.headers['user-agent'];
    console.log(TimeStamp, method, url, userAgent);
    next()
}



const addTimeStamp = (req, res, next) => {
    req.TimeStamp = new Date().toISOString()
    next();
}

module.exports = { logger, addTimeStamp }