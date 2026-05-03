import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

export const bookSlot = async (slotId, userData) => {
    return await axios.post(`${API_BASE_URL}/book/${slotId}`, userData);
};

export const leaveSlot = async (slotId) => {
    return await axios.post(`${API_BASE_URL}/leave/${slotId}`);
};