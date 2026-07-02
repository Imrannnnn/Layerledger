const cors = require("cors")

const configCors = () => {
    return cors({
        origin: (origin, callback) => {
            const allowedOrigin = ["http://localhost:5173", "http://localhost:5174", "http://localhost:3000"]

            if (!origin || allowedOrigin.includes(origin)) {
                callback(null, true)
            }
            else {
                callback(new Error("Not allowed by CORS"))
            }
        },


        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        exposedHeaders: ["Content-Length", "Date"],
        maxAge: 600,
        preflightContinue: false,
        optionsSuccessStatus: 200
    })
}

module.exports = configCors;