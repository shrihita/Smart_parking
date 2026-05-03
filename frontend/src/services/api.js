import axios from 'axios';

const API = axios.create({ baseURL: "http://localhost:5000" });

// Fetch owner details
export const getOwner = (plate) => API.get(`/booking/owner/${plate}`);

// Add new owner
export const addOwner = (owner) => API.post(`/booking/owner`, owner);