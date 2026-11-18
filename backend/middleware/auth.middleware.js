import jwt from "jsonwebtoken";


const auth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = typeof authHeader === "string"
        ? authHeader.match(/^Bearer\s+(\S+)$/i)?.[1]
        : null;

    if(!token){
        return res.status(401).json({
            message: "no token provided"
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if(!decoded.userId){
            return res.status(401).json({
                success: false,
                message: "invalid token"
            });
        }

        req.user = { id: decoded.userId };
        
        next();

    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "invalid token"
        });
    }
};


export default auth;
