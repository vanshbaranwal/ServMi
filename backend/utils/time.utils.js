

export const timeToMinutes = (time) => {
    const [hours, minutes] = time.split(":").map(Number);

    return(hours * 60 + minutes);
};

export const minutesToTime = (totalMinutes) => {
    const hours = Math.floor(totalMinutes/60);
    const minutes = totalMinutes%60;

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

export const isValidTimeRange = (startTime, endTime) => {
    return timeToMinutes(startTime) < timeToMinutes(endTime);
};;

export const getDayOfWeek = (date) => {
    return new Date(`${date}T00:00:00`).getDay();
};
