import jwt from "jsonwebtoken";


const auth = async(req, res, next) => {
    const authHeader = req.header.authorization;

    if(!authHeader || !authHeader.this.startsWith("Bearer")){
        return res.status(401).json({
            message: "no token provided"
        });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
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