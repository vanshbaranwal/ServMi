import { Service } from "../models/service.models.js";

export const listServices = async(req, res) => {
    try {

        const services = await Service.find({ userId: req.user.id, isDeleted: { $ne: true } }).sort({ createdAt: -1 });
    
        res.json({
            success: true,
            services
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "server error",
            error : error.message
        });
    }
};

export const createServices = async(req, res) => {
    try {

        const { name, duration, price, description, icon } = req.body;

        if(!name || !duration){
            return res.status(400).json({
                success: false,
                message: "service name and duration are required"
            });
        }

        const service = await Service.create({
            userId: req.user.id,
            name,
            duration,
            price: price || 0,
            description: description || "",
            icon: icon || "c1.png"
        });

        res.status(201).json({
            success: true,
            message: "service created",
            service
        });


    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "server error",
            error: error.message
        });
    }
};

export const updateService = async(req, res) => {
    try {

        const updates = {};
        const allowedFields = ['name', 'duration', 'price', 'description', 'isActive', 'icon'];

        allowedFields.forEach((field) => {
            if(req.body[field] !== undefined){
                updates[field] = req.body[field];
            }
        });

        const service = await Service.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id, isDeleted: { $ne: true } },
            updates,
            { new: true }
        );

        if(!service){
            return res.status(404).json({
                message: "service not found"
            });
        }

        res.json({
            success: true,
            message: "service updated",
            service
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "server error",
            error: error.message
        });
    }
};

export const deleteService = async(req, res) => {
    try {

        const service = await Service.findOneAndUpdate(
            {
                _id: req.params.id,
                userId: req.user.id,
                isDeleted: {
                    $ne: true
                }
            },
            {
                isDeleted: true,
                isActive: false,
            },
            {
                new: true,
            }
        );

        if(!service){
            return res.status(404).json({
                message: "service not found"
            });
        }

        res.json({
            success: true,
            message: "service deleted",
            service
        });


    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "server error",
            error: error.message
        });
    }
};