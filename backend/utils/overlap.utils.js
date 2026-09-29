import { timeToMinutes } from "./time.utils.js";


export const timeOverlap = (firstStart, firstEnd, secondStart, secondEnd) => {
    return timeToMinutes(firstStart) < timeToMinutes(secondEnd)
    && timeToMinutes(firstEnd) > timeToMinutes(secondStart);
};