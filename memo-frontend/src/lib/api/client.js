import axios from 'axios'
const client = axios.create()
// client.defaults.baseURL = 'http://127.0.0.1:12010/'  
// client.interceptors.response.use(response => response, error => Promise.reject(error)) 
export default client;