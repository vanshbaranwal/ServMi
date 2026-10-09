import jwt from "jsonwebtoken";


const adminAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if(!authHeader || !authHeader.startsWith("Bearer")){
        return res.status(401).json({
            success: false,
            message: "admin authorization is required"
        });
    }

    try {
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if(!decoded.role !== "admin"){
            return res.status(403).json({
                success: false,
                message: "admin access is required" 
            });
        }

        req.admin = { email: decoded.email };
        next();

    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "invalid admin token"
        });
    }
};


export default adminAuth;