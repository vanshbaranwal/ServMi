import jwt from "jsonwebtoken";


const adminAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = typeof authHeader === "string"
        ? authHeader.match(/^Bearer\s+(\S+)$/i)?.[1]
        : null;

    if(!token){
        return res.status(401).json({
            success: false,
            message: "admin authorization is required"
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const adminEmail = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();

        if(decoded.role !== "admin" || !adminEmail || decoded.email !== adminEmail){
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
